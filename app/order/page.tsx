"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { Design, DEFAULT_DESIGN, loadDesign, DELIVERY_CZK } from "../../lib/design";
import { quoteDesign } from "../../lib/quote";
import { useI18n, useT } from "../../lib/i18n";
import { acceptedDocVersions } from "../../lib/legal";
import { PAYMENTS_ENABLED } from "../../lib/comgate/config";
import { safeValidateConfiguratorDesign } from "../../lib/rules-engine/configurator";
import posthog from "posthog-js";

// Persist the accepted-terms consent record (B4) locally so the confirmation
// page can show it and a returning session can reference it. The API stub
// (/api/order) is the server-side home for this once a datastore/email exist.
function persistConsent(record: unknown) {
  try {
    window.localStorage.setItem("myble.lastOrder", JSON.stringify(record));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** Contact + delivery address as read off the checkout form. */
type Customer = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
  deliveryMethod?: string;
};

function PreviewLoading() {
  const t = useT();
  return <div className="flex h-[260px] items-center justify-center rounded-2xl bg-zinc-50 text-sm text-zinc-400">{t("common.loadingShort")}</div>;
}

const ShelfViewer = dynamic(() => import("../../components/ShelfViewer"), {
  ssr: false,
  loading: () => <PreviewLoading />,
});

export default function OrderPage() {
  const router = useRouter();
  const { t, fmt, locale } = useI18n();
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  const [confirmed, setConfirmed] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false); // B4
  const [acceptedCustom, setAcceptedCustom] = useState(false); // B3 (§1837)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesign(loadDesign());
  }, []);

  const quote = useMemo(() => quoteDesign(design), [design]);
  const kit = quote.kitCZK;
  const total = quote.customerCZK;
  // The cut list (lib/cutlist.ts) is production data for us, not the customer:
  // it ships with the order payload (`design`) and lives in the admin, so the
  // checkout page never renders it.

  // Sales-first rules validation at checkout: severity-3 recommendations become
  // "Order anyway" acknowledgements. Nothing here blocks placing the order.
  // Stage is "design", not "order": the order-pipeline invariants (part labels,
  // generated instructions, packaging spec) are produced by us AFTER the order
  // is placed, so asserting them against a customer's cart wrongly flags every
  // correct design. Same stage the server re-validates with (app/api/order).
  const rules = useMemo(() => safeValidateConfiguratorDesign(design, { locale, stage: "design" }), [design, locale]);
  const [ackKeys, setAckKeys] = useState<Set<string>>(new Set());
  // Recommendations start collapsed — a wall of open expert-advice cards at
  // checkout reads as "something's wrong" even when it's routine guidance.
  const [recsOpen, setRecsOpen] = useState(false);
  // Re-key acknowledgements by rule + inputs hash so an edit invalidates them.
  const ackId = (f: { rule_id: string; inputs_hash: string }) => `${f.rule_id}:${f.inputs_hash}`;
  const allAcknowledged = rules.acknowledgements.every((f) => ackKeys.has(ackId(f)));
  function toggleAck(key: string, on: boolean) {
    setAckKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // All consent + every severity-3 recommendation acknowledged. The rules
  // engine never gates this: it advises, we review. See `orderable` in
  // lib/rules-engine/configurator.ts.
  const canPlace = confirmed && acceptedTerms && acceptedCustom && allAcknowledged;


  // ── Submit flow ────────────────────────────────────────────────────────────
  // While PAYMENTS_ENABLED is false nothing is charged here, so the submit is
  // interrupted by an interstitial the customer has to confirm. The order still
  // completes end to end either way — Comgate has to be able to walk it.
  const [pendingCustomer, setPendingCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitBtnRef = React.useRef<HTMLButtonElement>(null);

  function readCustomer(form: HTMLFormElement): Customer {
    // Contact + CZ delivery address entered above. Read straight off the form so
    // the order route can persist who ordered and where to ship.
    const fd = new FormData(form);
    const str = (k: string) => (fd.get(k)?.toString().trim() || undefined);
    return {
      firstName: str("firstName"),
      lastName: str("lastName"),
      email: str("email"),
      phone: str("phone"),
      street: str("street"),
      city: str("city"),
      zip: str("zip"),
      country: str("country") ?? "CZ",
      deliveryMethod: str("delivery"),
    };
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canPlace || submitting) return;
    const customer = readCustomer(e.currentTarget);
    if (!PAYMENTS_ENABLED) {
      setPendingCustomer(customer); // opens the interstitial; nothing is sent yet
      return;
    }
    placeOrder(customer);
  }

  function cancelPending() {
    setPendingCustomer(null);
    submitBtnRef.current?.focus();
  }

  function placeOrder(customer: Customer) {
    if (submitting) return;
    setSubmitting(true);

    const orderNo = `MB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // B4: consent record — accepted document versions, locale, timestamp.
    // Also records the customer-set specification (confirmed dimensions etc.),
    // which anchors the §1837 "made to the customer's specification" position
    // per T&C Art. 2.3 / 9.2.
    const consent = {
      orderNo,
      locale,
      acceptedAt: new Date().toISOString(),
      acceptedDocVersions: acceptedDocVersions(),
      acknowledgedCustomWithdrawalExclusion: acceptedCustom,
      customSpecification: {
        width_cm: design.outerCm.w,
        height_cm: design.outerCm.h,
        depth_cm: design.outerCm.d,
        colour: design.colour,
        thickness_mm: design.thickness,
        parts_count: design.parts.length,
        band_back: design.bandBack,
      },
    };

    // Recommendations the customer chose to "order anyway", recorded with the
    // exact message shown, rule id, catalogue version, design hash and time.
    const nowIso = new Date().toISOString();
    const acknowledgements = rules.acknowledgements.map((f) => ({
      rule_id: f.rule_id,
      catalogue_version: rules.report.catalogue_version,
      message: f.message ?? f.rule_name,
      inputs_hash: f.inputs_hash,
      design_hash: rules.report.design_hash,
      acknowledged_at: nowIso,
    }));

    const payload = {
      orderNo,
      consent,
      customer,
      // Full parts list — the production/cut-list source of truth. Without it
      // the order can't be manufactured (localStorage is not a datastore).
      design,
      // Sales-first rules record: health, catalogue version and the customer's
      // acknowledgements. The server re-validates and stores the full report.
      rules: {
        catalogue_version: rules.report.catalogue_version,
        engine_version: rules.report.engine_version,
        health: rules.report.health,
        design_hash: rules.report.design_hash,
        acknowledgements,
      },
      summary: {
        width_cm: design.outerCm.w,
        height_cm: design.outerCm.h,
        depth_cm: design.outerCm.d,
        colour: design.colour,
        thickness_mm: design.thickness,
        parts_count: design.parts.length,
        kit_price_czk: kit,
        total_price_czk: total,
        product_type: "custom",
      },
    };

    persistConsent(consent);
    // B5: hand off to the (stub) order route which records consent and will send
    // the durable-medium confirmation e-mail. Fire-and-forget; the on-screen
    // confirmation is the durable copy until email is wired.
    void fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      /* stub — see /api/order route TODO */
    });

    posthog.capture("order_placed", {
      ...payload.summary,
      accepted_doc_versions: JSON.stringify(consent.acceptedDocVersions),
      rules_health: rules.report.health,
      rules_catalogue_version: rules.report.catalogue_version,
      rules_acknowledgements: acknowledgements.length,
      payments_enabled: PAYMENTS_ENABLED,
    });
    router.push(`/order/confirmation?order=${encodeURIComponent(orderNo)}`);
  }

  const { w, h, d } = design.outerCm;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <SiteHeader variant="app" />

      <form onSubmit={onSubmit} className="mx-auto w-full max-w-7xl px-5 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">{t("order.title")}</h1>
            <Link href="/design" className="shrink-0 text-sm font-medium text-zinc-600 hover:text-zinc-900">{t("order.back")}</Link>
          </div>
          <p className="mt-1 text-sm text-zinc-600">{t("order.subtitle")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left */}
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
              <h2 className="text-lg font-semibold">{t("order.contact")}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label={t("order.firstName")}><Input name="firstName" placeholder="Jan" required /></Field>
                <Field label={t("order.lastName")}><Input name="lastName" placeholder="Novák" required /></Field>
                <Field label={t("order.email")} className="sm:col-span-2"><Input name="email" type="email" placeholder="you@example.com" required /></Field>
                <Field label={t("order.phone")} className="sm:col-span-2"><Input name="phone" type="tel" placeholder="+420 123 456 789" required /></Field>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
              <h2 className="text-lg font-semibold">{t("order.address")}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label={t("order.street")} className="sm:col-span-2"><Input name="street" placeholder="Národní 12" required /></Field>
                <Field label={t("order.city")}><Input name="city" placeholder="Praha" required /></Field>
                <Field label={t("order.zip")}><Input name="zip" placeholder="110 00" required /></Field>
                {/* B7: CZ-only delivery at MVP. */}
                <Field label={t("order.country")} className="sm:col-span-2">
                  <select
                    name="country"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="CZ">{t("order.cz")}</option>
                  </select>
                  <span className="mt-1.5 block text-xs text-zinc-500">{t("checkout.czOnly")}</span>
                </Field>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
              <h2 className="text-lg font-semibold">{t("order.shipping")}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DeliveryOption name="delivery" value="curbside" defaultChecked title={t("order.ship1")} sub={t("order.ship1sub")} price={fmt(DELIVERY_CZK)} />
                <DeliveryOption name="delivery" value="in-room" title={t("order.ship2")} sub={t("order.ship2sub")} price={fmt(DELIVERY_CZK + 100)} />
              </div>
            </section>

            {/* Severity-4 findings are never shown to the customer — they'd
                only invite doubt on a design we're going to build anyway.
                They're recorded with the order (rules.health / needsReview,
                full findings in the server's stored report) for our team to
                review before production. */}

            {/* Severity-3 recommendations — "Order anyway" acknowledgements.
                Collapsed by default: a wall of open warnings at checkout reads
                as "something's wrong with my design" even when it's routine
                expert advice, so we tuck it behind a summary line. */}
            {rules.acknowledgements.length > 0 && (
              <section className="rounded-3xl bg-white p-6 ring-1 ring-amber-200">
                <details open={recsOpen} onToggle={(e) => setRecsOpen(e.currentTarget.open)}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span>
                      <h2 className="inline text-lg font-semibold">{t("rules.recommendations")}</h2>
                      <span className="ml-2 text-sm text-zinc-500">
                        {t("rules.recommendationsCount", { n: rules.acknowledgements.length })}
                      </span>
                    </span>
                    <span className={`text-zinc-400 transition-transform ${recsOpen ? "rotate-180" : ""}`}>▾</span>
                  </summary>
                  <p className="mt-1 text-sm text-zinc-600">{t("rules.recommendationsHint")}</p>
                  <div className="mt-4 space-y-3">
                    {rules.acknowledgements.map((f) => {
                      const key = `${f.rule_id}:${f.inputs_hash}`;
                      return (
                        <label key={key} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                          <input
                            type="checkbox"
                            checked={ackKeys.has(key)}
                            onChange={(e) => toggleAck(key, e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-zinc-300"
                          />
                          <span className="text-sm text-zinc-700">
                            {f.message ?? f.rule_name}
                            <span className="mt-0.5 block text-xs font-medium text-amber-700">{t("rules.orderAnyway")}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              </section>
            )}

            {/* Dimension confirmation now lives in the summary column, next to
                the price and the §1837 notice — see the aside below. */}
          </div>

          {/* Right */}
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t("order.yourDesign")}</h2>
                <span className="text-xs text-zinc-500">{t("parts.label")} · {t("parts.count", { n: design.parts.length })} · {t(`colors.${design.colour}`)} {design.thickness} mm</span>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-zinc-200">
                <ShelfViewer design={design} height={260} interactive={false} autoRotate />
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
              {/* B2: itemized total (goods + delivery). Seller is not a VAT
                  payer, so no VAT line is shown.
                  TODO(B8 — Omnibus): if a discounted/"sale" price is ever shown
                  here, also display the lowest price in the previous 30 days as
                  the reference price. */}
              <div className="space-y-3 rounded-2xl bg-zinc-50 p-4">
                <Row label={t("order.summaryKit", { dims: `${w}×${h}×${d}` })} value={fmt(kit)} />
                {/* Must be the delivery actually included in the total — it is
                    free at/above FREE_SHIP_CZK, and a hardcoded 199 made the
                    lines fail to add up. */}
                <Row
                  label={t("order.summaryDelivery")}
                  value={quote.deliveryCZK > 0 ? fmt(quote.deliveryCZK) : t("order.deliveryFree")}
                />
                <div className="border-t border-zinc-200 pt-3">
                  <Row label={t("order.summaryTotal")} value={fmt(total)} strong />
                </div>
              </div>

              {/* Dimension confirmation, compact. It sits with the other two
                  consent checks (custom-made, terms) directly above the order
                  button, so everything that gates the order is in one column. */}
              <div className="mt-4 rounded-2xl bg-indigo-50/60 p-4 ring-1 ring-indigo-200">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-indigo-900">{t("order.confirmTitle")}</p>
                  <Link href="/design" className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-500">
                    {t("order.editIn")}
                  </Link>
                </div>
                <p className="mt-1.5 text-sm font-semibold tabular-nums text-zinc-900">{w} × {h} × {d} cm</p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {t(`colors.${design.colour}`)} · {design.thickness} mm · {t("parts.count", { n: design.parts.length })} ·{" "}
                  {t("order.backEdge", { v: design.bandBack ? t("order.backEdgeOn") : t("order.backEdgeOff") })}
                </p>
                <label className="mt-3 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-indigo-600"
                  />
                  <span className="text-xs leading-5 text-indigo-900">
                    {t("order.measuredOk1")}{" "}
                    <Link href="/" className="font-medium text-indigo-600 underline">{t("order.measuredGuide")}</Link>{" "}
                    {t("order.measuredOk2")}
                  </span>
                </label>
              </div>

              {/* B3: custom-made notice + un-prechecked §1837 acknowledgement. */}
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="text-sm font-semibold text-amber-900">{t("checkout.customTitle")}</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">{t("checkout.customNotice")}</p>
                <label className="mt-3 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={acceptedCustom}
                    onChange={(e) => setAcceptedCustom(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-indigo-600"
                  />
                  <span className="text-xs text-amber-900">{t("checkout.customAck")}</span>
                </label>
              </div>

              {/* B4: un-prechecked Terms/Complaints/Privacy acceptance. */}
              <label className="mt-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-indigo-600"
                />
                <span className="text-xs leading-5 text-zinc-600">
                  {t("checkout.termsPre")}{" "}
                  <Link href="/legal/terms-and-conditions" className="font-medium text-indigo-600 underline">
                    {t("legal.docs.terms-and-conditions.title")}
                  </Link>
                  {t("checkout.termsSep")}
                  <Link href="/legal/complaints-procedure" className="font-medium text-indigo-600 underline">
                    {t("legal.docs.complaints-procedure.title")}
                  </Link>{" "}
                  {t("checkout.termsAnd")}{" "}
                  <Link href="/legal/privacy-policy" className="font-medium text-indigo-600 underline">
                    {t("legal.docs.privacy-policy.title")}
                  </Link>
                  {t("checkout.termsEnd")}
                </span>
              </label>

              {/* Payments not live yet: say so in the form itself, not only in
                  the modal, so the customer knows before they commit. */}
              {!PAYMENTS_ENABLED && (
                <div className="mt-4 rounded-2xl bg-indigo-50/60 p-4 ring-1 ring-indigo-200">
                  <p className="text-sm font-semibold text-indigo-900">{t("checkout.paymentsOff.noticeTitle")}</p>
                  <p className="mt-1 text-xs leading-5 text-indigo-800">{t("checkout.paymentsOff.noticeBody")}</p>
                </div>
              )}

              <button
                ref={submitBtnRef}
                type="submit"
                disabled={!canPlace || submitting}
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {/* Nothing is charged while payments are off, so the button must
                    not promise a payment. */}
                {PAYMENTS_ENABLED ? t("order.place") : t("order.placeNoPay")}
              </button>
              {!confirmed && (
                <p className="mt-2 text-center text-xs text-amber-600">{t("order.confirmFirst")}</p>
              )}
              {confirmed && !acceptedCustom && (
                <p className="mt-2 text-center text-xs text-amber-600">{t("checkout.mustAckCustom")}</p>
              )}
              {confirmed && acceptedCustom && !acceptedTerms && (
                <p className="mt-2 text-center text-xs text-amber-600">{t("checkout.mustAccept")}</p>
              )}

              <div className="mt-4 space-y-2 text-xs text-zinc-500">
                <p className="flex items-center gap-2"><span className="text-emerald-600">✓</span> {t("order.badge1")}</p>
                <p className="flex items-center gap-2"><span className="text-emerald-600">✓</span> {t("order.badge2")}</p>
                <p className="flex items-center gap-2"><span className="text-emerald-600">✓</span> {t("order.badge3")}</p>
              </div>
            </section>
          </aside>
        </div>
      </form>

      {pendingCustomer && (
        <PaymentsOffDialog
          submitting={submitting}
          onCancel={cancelPending}
          onConfirm={() => placeOrder(pendingCustomer)}
        />
      )}

      <SiteFooter />
    </main>
  );
}

// Checkout interstitial shown while online payment is off. It does not block the
// order — it makes sure the customer knows a real, binding order is being placed
// and that payment will be arranged by invoice.
function PaymentsOffDialog({
  submitting,
  onConfirm,
  onCancel,
}: {
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  // Escape cancels, and Tab is trapped inside the panel.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      {/* Backdrop click cancels — it must never submit by accident. */}
      <div className="absolute inset-0 bg-zinc-900/50" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payments-off-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200"
      >
        <h2 id="payments-off-title" className="text-lg font-semibold text-zinc-900">
          {t("checkout.paymentsOff.modalTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{t("checkout.paymentsOff.modalBody1")}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{t("checkout.paymentsOff.modalBody2")}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
          >
            {t("checkout.paymentsOff.modalCancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {submitting ? t("checkout.paymentsOff.submitting") : t("checkout.paymentsOff.modalConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function Input({ type = "text", name, placeholder, required }: { type?: string; name?: string; placeholder?: string; required?: boolean }) {
  return (
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500"
    />
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "text-sm font-semibold text-zinc-900" : "text-sm text-zinc-600"}>{label}</span>
      <span className={strong ? "text-base font-semibold text-zinc-900" : "text-sm text-zinc-800"}>{value}</span>
    </div>
  );
}

function DeliveryOption({
  name,
  value,
  title,
  sub,
  price,
  defaultChecked,
}: {
  name: string;
  value: string;
  title: string;
  sub: string;
  price: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-zinc-200 p-4 transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50">
      <span className="flex items-start gap-3">
        <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 border-zinc-300" />
        <span>
          <span className="block text-sm font-semibold text-zinc-900">{title}</span>
          <span className="block text-xs text-zinc-500">{sub}</span>
        </span>
      </span>
      <span className="text-sm font-semibold text-zinc-900">{price}</span>
    </label>
  );
}
