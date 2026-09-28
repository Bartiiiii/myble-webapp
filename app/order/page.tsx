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
  // One delivery arrangement, so this is a constant rather than a choice. It
  // still feeds the quote, which prices the in-room service separately, so
  // reinstating that option later is a matter of making this state again.
  const deliveryMethod = "curbside" as const;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesign(loadDesign());
  }, []);

  const quote = useMemo(() => quoteDesign(design, { deliveryMethod }), [design, deliveryMethod]);
  const kit = quote.kitCZK;
  const total = quote.customerCZK;
  // The cut list (lib/cutlist.ts) is production data for us, not the customer:
  // it ships with the order payload (`design`) and lives in the admin, so the
  // checkout page never renders it.

  // Sales-first rules validation at checkout: severity-3 findings are shown as
  // expert tips, read-only. They are advice, not a gate — the customer never has
  // to tick anything to get past them; we still record which ones they were
  // shown with the order so our team sees them before production.
  // Stage is "design", not "order": the order-pipeline invariants (part labels,
  // generated instructions, packaging spec) are produced by us AFTER the order
  // is placed, so asserting them against a customer's cart wrongly flags every
  // correct design. Same stage the server re-validates with (app/api/order).
  const rules = useMemo(() => safeValidateConfiguratorDesign(design, { locale, stage: "design" }), [design, locale]);
  // Consent only. The rules engine never gates this: it advises, we review.
  // See `orderable` in lib/rules-engine/configurator.ts.
  const canPlace = confirmed && acceptedTerms && acceptedCustom;


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
        edge_banding: "all_edges",
      },
    };

    // Recommendations the customer was shown, recorded with the exact message,
    // rule id, catalogue version, design hash and time. These are *shown*, not
    // acknowledged: the checkout no longer asks the customer to tick them, so
    // the record must not claim consent that was never given.
    const nowIso = new Date().toISOString();
    const recommendationsShown = rules.acknowledgements.map((f) => ({
      rule_id: f.rule_id,
      catalogue_version: rules.report.catalogue_version,
      message: f.message ?? f.rule_name,
      inputs_hash: f.inputs_hash,
      design_hash: rules.report.design_hash,
      shown_at: nowIso,
    }));

    const payload = {
      orderNo,
      consent,
      customer,
      // Full parts list — the production/cut-list source of truth. Without it
      // the order can't be manufactured (localStorage is not a datastore).
      design,
      // Sales-first rules record: health, catalogue version and the tips the
      // customer saw. The server re-validates and stores the full report.
      rules: {
        catalogue_version: rules.report.catalogue_version,
        engine_version: rules.report.engine_version,
        health: rules.report.health,
        design_hash: rules.report.design_hash,
        recommendationsShown,
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

    // Also persist the total/delivery method locally (NOT sent to /api/order —
    // `consent` above is unchanged) so the confirmation page can show accurate
    // bank-transfer instructions without a second round-trip to the server.
    persistConsent({ ...consent, totalCzk: total, deliveryMethod });
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
      rules_recommendations_shown: recommendationsShown.length,
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
              {/* The option subtitles say "included in your total delivery estimate
                  above" — this is that estimate. */}
              <p className="mt-1 text-sm text-zinc-600">{t("order.deliveryEstimate")}</p>
              {/* One way to get it, so this states the arrangement rather than
                  asking a question. The value still rides along with the order
                  so the record says how it was shipped. */}
              <input type="hidden" name="delivery" value="courier" />
              <div className="mt-5">
                <FixedOption
                  title={t("order.shipCourier")}
                  sub={t("order.shipCourierSub")}
                  price={fmt(DELIVERY_CZK)}
                />
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
              <h2 className="text-lg font-semibold">{t("order.payment")}</h2>
              {/* Also the place the customer is told nothing is charged here:
                  the order comes first, we check it can be built, and only then
                  does the invoice go out. QR code or plain transfer details,
                  whichever the customer's bank makes easier. */}
              <div className="mt-5">
                <FixedOption title={t("order.payQr")} sub={t("order.payQrSub")} />
              </div>
            </section>

            {/* Severity-4 findings are never shown to the customer — they'd
                only invite doubt on a design we're going to build anyway.
                They're recorded with the order (rules.health / needsReview,
                full findings in the server's stored report) for our team to
                review before production. */}

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
              {/* Drag/pinch to look the design over before paying. Manual
                  control replaces the old auto-spin: a piece drifting on its
                  own while someone is trying to check it closely at checkout
                  fights the thing they're actually here to do. */}
              <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-zinc-200">
                <ShelfViewer design={design} height={260} interactive />
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

              {/* The three things that gate the order, all read the same way.
                  They used to sit in coloured panels of their own, which made
                  the two legal ones look like warnings rather than the consents
                  they are. The wording is untouched: the §1837 exclusion still
                  states why the withdrawal right does not apply, right where it
                  is being agreed to. */}
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-indigo-600"
                  />
                  <span className="text-xs leading-5 text-zinc-600">
                    {t("order.measuredOk1")}{" "}
                    <Link href="/" className="font-medium text-indigo-600 underline">{t("order.measuredGuide")}</Link>{" "}
                    {t("order.measuredOk2")}
                  </span>
                </label>

                {/* B3: the un-prechecked §1837 acknowledgement. The notice that
                    explains *why* the withdrawal right does not apply used to
                    sit above it as its own paragraph, which said the same thing
                    twice in a row. It is still shown verbatim, now on the info
                    tip attached to the line it is the reason for. */}
                <label className="relative flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={acceptedCustom}
                    onChange={(e) => setAcceptedCustom(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-indigo-600"
                  />
                  <span className="text-xs leading-5 text-zinc-600">
                    {t("checkout.customAck")}
                    <InfoTip label={t("checkout.customNoticeTip")} text={t("checkout.customNotice")} />
                  </span>
                </label>

              {/* B4: un-prechecked Terms/Complaints/Privacy acceptance. */}
              <label className="flex items-start gap-2.5">
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
              </div>

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

/** The "why" behind a consent line, one hover away. Legal copy that has to be
 *  shown but does not have to be read before ticking sits here rather than as a
 *  paragraph of its own, which is what used to push the order button down the
 *  page. Hover and keyboard focus are handled in CSS so the note never depends
 *  on JS; the click toggle is for touch, where there is no hover at all.
 *
 *  The bubble is positioned against the row it hangs off (the label carries
 *  `relative`), not against the 16px mark — anchored to the mark it runs off the
 *  edge of the summary column, since that is where the mark sits. */
function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="group ml-1 inline-block align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        // Inside a <label>: stop the click here so revealing the note never
        // ticks the checkbox it explains.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 text-[10px] font-semibold leading-none text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700"
      >
        i
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-0 right-0 z-20 mb-2 rounded-xl bg-zinc-900 px-3 py-2 text-[11px] font-normal leading-5 text-white shadow-lg ${
          open ? "block" : "hidden group-hover:block group-focus-within:block"
        }`}
      >
        {text}
      </span>
    </span>
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

/** The one way this happens, stated rather than offered. A radio group with a
 *  single option asks a question that has no second answer; this reads as the
 *  arrangement it is, while still looking like the selected choice. */
function FixedOption({ title, sub, price }: { title: string; sub: string; price?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-indigo-500 bg-indigo-50/50 p-4">
      <span className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[5px] border-indigo-600 bg-white"
        />
        <span>
          <span className="block text-sm font-semibold text-zinc-900">{title}</span>
          <span className="block text-xs leading-5 text-zinc-500">{sub}</span>
        </span>
      </span>
      {price && <span className="shrink-0 text-sm font-semibold text-zinc-900">{price}</span>}
    </div>
  );
}
