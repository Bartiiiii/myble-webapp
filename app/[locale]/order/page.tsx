"use client";

import Link from "../../../lib/localeNav";
import dynamic from "next/dynamic";
import { useLocaleRouter } from "../../../lib/localeNav";
import React, { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { Design, DEFAULT_DESIGN, loadDesign } from "../../../lib/design";
import { quoteDesign } from "../../../lib/quote";
import { useI18n, useT } from "../../../lib/i18n";
import { acceptedDocVersions, CHECKOUT_LEGAL_COPY_VERSION, TERMS_VERSION } from "../../../lib/legal";
import { PAYMENTS_ENABLED } from "../../../lib/comgate/config";
import { safeValidateConfiguratorDesign } from "../../../lib/rules-engine/configurator";
import posthog from "posthog-js";
import { usePromoCopy } from "../../../components/promo/usePromoCopy";
import { czk } from "../../../lib/promoCopy";
import { PROMO_CODE_STORAGE_KEY, normalizeCode } from "../../../lib/promotions";

// Persist the consent record (B4) locally so the confirmation
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

const ShelfViewer = dynamic(() => import("../../../components/ShelfViewer"), {
  ssr: false,
  loading: () => <PreviewLoading />,
});

export default function OrderPage() {
  const router = useLocaleRouter();
  const { t, fmt, locale } = useI18n();
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  // One delivery arrangement, so this is a constant rather than a choice. It
  // still feeds the quote, which prices the in-room service separately, so
  // reinstating that option later is a matter of making this state again.
  const deliveryMethod = "curbside" as const;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesign(loadDesign());
  }, []);

  // ── Discount code ──────────────────────────────────────────────────────────
  // A referral code or voucher (lib/rewards.ts). Applying it here only previews
  // the price; /api/order checks it again and claims it before the order is
  // written, and the payment step re-prices from what the server stored.
  const promo = usePromoCopy();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ code: string; discountCzk: number; kind: string } | null>(null);

  // A code carried over from a friend's /refer link.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROMO_CODE_STORAGE_KEY);
      if (saved) {
        setPromoInput(saved);
        setPromoOpen(true);
      }
    } catch {
      /* storage blocked */
    }
  }, []);

  function reasonText(reason: string, minKitCzk?: number): string {
    const r = promo.checkout.reasons[reason] ?? promo.checkout.reasons.unavailable;
    return typeof r === "function" ? r(czk(minKitCzk ?? 0)) : r;
  }

  async function applyPromo() {
    const code = normalizeCode(promoInput);
    if (!code) return;
    const email = (formRef.current?.elements.namedItem("email") as HTMLInputElement | null)?.value.trim();
    if (!email) {
      setPromoError(promo.checkout.needEmail);
      return;
    }
    setPromoChecking(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email, design }),
      });
      const j = await res.json();
      if (j?.ok) {
        setApplied({ code: j.code, discountCzk: j.discountCzk, kind: j.kind });
        posthog.capture("promo_code_applied", { kind: j.kind, discount_czk: j.discountCzk });
      } else {
        setApplied(null);
        setPromoError(reasonText(j?.reason ?? "unavailable", j?.minKitCzk));
        posthog.capture("promo_code_rejected", { reason: j?.reason });
      }
    } catch {
      setPromoError(reasonText("unavailable"));
    } finally {
      setPromoChecking(false);
    }
  }

  function removePromo() {
    setApplied(null);
    setPromoInput("");
    setPromoError(null);
    try {
      window.localStorage.removeItem(PROMO_CODE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const quote = useMemo(
    () => quoteDesign(design, { deliveryMethod, discountCZK: applied?.discountCzk ?? 0 }),
    [design, deliveryMethod, applied],
  );
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
  // Nothing gates the button but the form's own `required` fields: the legal
  // terms are a passive notice under it (§1826a), and the rules engine only
  // advises. See `orderable` in lib/rules-engine/configurator.ts.

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
    if (submitting) return;
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

  async function placeOrder(customer: Customer) {
    if (submitting) return;
    setSubmitting(true);

    const orderNo = `MB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // B4: consent record. The checkout collects no ticks: placing the order is
    // the agreement, so this records what the customer was shown when they
    // did it: the version of the notice under the button, the T&C version,
    // the linked documents' versions, locale and time. Also records the
    // customer-set specification, which anchors the §1837 "made to the
    // customer's specification" position per T&C Art. 2.3 / 9.2.
    const consent = {
      orderNo,
      locale,
      submittedAt: new Date().toISOString(),
      legalCopyVersion: CHECKOUT_LEGAL_COPY_VERSION,
      termsVersion: TERMS_VERSION,
      acceptedDocVersions: acceptedDocVersions(),
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
      promoCode: applied?.code,
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
        discount_czk: quote.discountCZK,
        total_price_czk: total,
        product_type: "custom",
      },
    };

    // Also persist the total/delivery method locally (NOT sent to /api/order —
    // `consent` above is unchanged) so the confirmation page can show accurate
    // bank-transfer instructions without a second round-trip to the server.
    // B5: hand off to the order route which records consent and sends the
    // durable-medium confirmation e-mail. Fire-and-forget, except when a
    // discount code is applied: the server re-checks it and may refuse, and
    // the customer must not land on a confirmation for a price that was not
    // accepted.
    const send = fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (applied) {
      let rejected: string | null = null;
      try {
        const res = await send;
        const j = await res.json().catch(() => null);
        if (!res.ok && j?.error === "promo_invalid") rejected = j.reason ?? "unavailable";
      } catch {
        /* network trouble: same behaviour as the un-discounted path */
      }
      if (rejected) {
        setApplied(null);
        setPromoOpen(true);
        setPromoError(`${promo.checkout.promoRejected} ${reasonText(rejected)}`);
        setPendingCustomer(null);
        setSubmitting(false);
        posthog.capture("promo_code_rejected", { reason: rejected, at: "order" });
        return;
      }
      try {
        window.localStorage.removeItem(PROMO_CODE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    } else {
      void send.catch(() => {
        /* the on-screen confirmation is the durable copy */
      });
    }
    persistConsent({ ...consent, totalCzk: total, deliveryMethod });

    posthog.capture("order_placed", {
      ...payload.summary,
      accepted_doc_versions: JSON.stringify(consent.acceptedDocVersions),
      legal_copy_version: consent.legalCopyVersion,
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
      <SiteHeader variant="app" promo={false} />

      <form ref={formRef} onSubmit={onSubmit} className="mx-auto w-full max-w-7xl px-5 py-8">
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
                  price={quote.deliveryCZK > 0 ? fmt(quote.deliveryCZK) : t("order.deliveryFree")}
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
                {applied && quote.discountCZK > 0 && (
                  <Row label={promo.checkout.discountRow(applied.code)} value={`−${fmt(quote.discountCZK)}`} accent />
                )}
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

              <div className="mt-4">
                {applied ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-indigo-50 px-3 py-2.5 ring-1 ring-indigo-100">
                    <span className="font-mono text-sm tracking-[0.06em] text-indigo-900">{applied.code}</span>
                    <button type="button" onClick={removePromo} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">
                      {promo.checkout.remove}
                    </button>
                  </div>
                ) : !promoOpen ? (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setPromoOpen(true)}
                      className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
                    >
                      {promo.checkout.codeToggle}
                    </button>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="promo-code" className="mb-1.5 block text-xs font-medium text-zinc-600">
                      {promo.checkout.codeLabel}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="promo-code"
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value.toUpperCase());
                          setPromoError(null);
                        }}
                        onKeyDown={(e) => {
                          // Enter applies the code; it must never submit the order.
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void applyPromo();
                          }
                        }}
                        placeholder={promo.checkout.codePlaceholder}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={promoError ? true : undefined}
                        aria-describedby={promoError ? "promo-error" : undefined}
                        className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-sm tracking-[0.06em] outline-none transition focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => void applyPromo()}
                        disabled={promoChecking || !promoInput.trim()}
                        className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      >
                        {promoChecking ? promo.checkout.applying : promo.checkout.apply}
                      </button>
                    </div>
                  </div>
                )}
                {promoError && (
                  <p id="promo-error" role="alert" className="mt-2 text-xs leading-5 text-red-600">
                    {promoError}
                  </p>
                )}
              </div>

              <button
                ref={submitBtnRef}
                type="submit"
                disabled={submitting}
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {/* §1826a OZ: the button itself must say ordering creates an
                    obligation to pay. Same wording while payments are off: the
                    order is still binding, it is just settled by invoice. */}
                {t("order.place")}
              </button>

              {/* Passive legal notice, no ticks (§1837 + T&C acceptance). What
                  was shown is recorded per order as CHECKOUT_LEGAL_COPY_VERSION,
                  so changing this copy means bumping that constant. Links open
                  in a new tab so the filled-in form survives. */}
              <div className="mt-3 space-y-1.5 px-1 text-sm leading-6 text-zinc-500">
                <p className="font-medium text-zinc-700">{t("checkout.legal.madeToMeasure")}</p>
                <p>
                  {t("checkout.legal.agreePre")}{" "}
                  <LegalLink href="/legal/terms-and-conditions">{t("checkout.legal.terms")}</LegalLink>{" "}
                  {t("checkout.legal.agreeAnd")}{" "}
                  <LegalLink href="/legal/complaints-procedure">{t("checkout.legal.complaints")}</LegalLink>
                  {t("checkout.legal.agreeEnd")} {t("checkout.legal.privacyPre")}{" "}
                  <LegalLink href="/legal/privacy-policy">{t("checkout.legal.privacy")}</LegalLink>
                  {t("checkout.legal.privacyEnd")}
                </p>
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

/** A legal document link under the order button: opens in a new tab so the
 *  half-filled checkout is not lost. */
function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noopener" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700">
      {children}
    </Link>
  );
}

function Row({ label, value, strong = false, accent = false }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "text-sm font-semibold text-zinc-900" : accent ? "text-sm text-indigo-700" : "text-sm text-zinc-600"}>{label}</span>
      <span className={strong ? "text-base font-semibold text-zinc-900" : accent ? "text-sm font-medium text-indigo-700" : "text-sm text-zinc-800"}>{value}</span>
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
