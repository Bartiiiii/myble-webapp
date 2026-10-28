import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { PAYMENTS_ENABLED } from "@/lib/comgate/config";
import {
  BANK_TRANSFER_ACCOUNT_NUMBER,
  BANK_TRANSFER_BANK_NAME,
  BANK_TRANSFER_DUE_DAYS,
  variableSymbolFromOrderNo,
} from "@/lib/bankTransfer";
import type { Design } from "@/lib/model";
import { validateConfiguratorDesign } from "@/lib/rules-engine/configurator";
import { quoteDesign } from "@/lib/quote";
import { checkDiscount, reserveDiscount, reverseOrderRewards, type DiscountCheck } from "@/lib/rewards";

// ─────────────────────────────────────────────────────────────────────────────
// Order intake + consent record (B4 / B5).
//
// This route is the durable, server-side home for a placed order. It (a) records
// the accepted document versions + timestamp and the customer/address (B4) into
// the Supabase `orders` table, and (b) sends the durable-medium confirmation
// e-mail via Resend, linking the Terms & Conditions and the model withdrawal
// form (B5).
//
// The `orders` table is locked down with RLS; this route writes via the
// service-role key (see utils/supabase/admin.ts), which is server-only.
// ─────────────────────────────────────────────────────────────────────────────

export interface Customer {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
  deliveryMethod?: string;
}

/** What the customer was shown when they placed the order. The checkout has no
 *  consent ticks: placing the order under the passive notice is the agreement,
 *  so the proof is which version of that notice and of the T&C was on screen. */
export interface ConsentRecord {
  orderNo: string;
  locale: string;
  submittedAt: string; // ISO timestamp
  /** CHECKOUT_LEGAL_COPY_VERSION (lib/legal.ts) shown under the order button. */
  legalCopyVersion: string;
  /** T&C version in force (TERMS_VERSION). */
  termsVersion: string;
  acceptedDocVersions: Record<string, string>;
  customSpecification?: Record<string, unknown>;
}

/** A severity-3 recommendation the customer was shown at checkout. Checkout
 *  presents these as read-only tips, so this records what was displayed — it is
 *  not a consent record and must not be read as one. */
export interface OrderRecommendationShown {
  rule_id: string;
  catalogue_version: string;
  message: string;
  inputs_hash: string;
  design_hash: string;
  shown_at: string;
}

export interface OrderRulesRecord {
  catalogue_version: string;
  engine_version: string;
  health: string;
  design_hash: string;
  recommendationsShown: OrderRecommendationShown[];
}

export interface OrderPayload {
  orderNo: string;
  consent: ConsentRecord;
  customer?: Customer;
  summary?: Record<string, unknown>;
  /** Full Design JSON (parts list) — production source of truth for the cut list. */
  design?: Record<string, unknown>;
  /** Client-side rules record + acknowledgements (server re-validates). */
  rules?: OrderRulesRecord;
  /** Referral code or voucher the customer applied (lib/rewards.ts re-checks it). */
  promoCode?: string;
}

export async function POST(req: Request) {
  let body: OrderPayload;
  try {
    body = (await req.json()) as OrderPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { orderNo, consent, customer, summary, design, rules: clientRules, promoCode } = body ?? {};
  if (!orderNo || !consent?.acceptedDocVersions || !consent.submittedAt || !consent.legalCopyVersion || !consent.termsVersion) {
    return NextResponse.json({ ok: false, error: "missing_consent" }, { status: 400 });
  }

  // ── Authoritative server-side re-validation ────────────────────────────────
  // Never trust the client's rules report. Re-run the deterministic engine on
  // the posted design. Run stage "design": the order-pipeline invariants (part
  // labels, instructions, packaging spec) are produced AFTER the order is
  // placed, so asserting them here would wrongly reject every order.
  let serverRules: {
    catalogue_version: string;
    engine_version: string;
    health: string;
    design_hash: string;
    report: unknown;
    revalidated: boolean;
  } | null = null;
  if (design && typeof design === "object") {
    try {
      const ui = validateConfiguratorDesign(design as unknown as Design);
      // Sales-first: we never reject an order on rules. Health is stored with
      // the order; designs needing a human check are flagged for our team.
      if (ui.needsReview) {
        console.warn("[order] design flagged for review", { orderNo, health: ui.report.health });
      }
      serverRules = {
        catalogue_version: ui.report.catalogue_version,
        engine_version: ui.report.engine_version,
        health: ui.report.health,
        design_hash: ui.report.design_hash,
        report: ui.report,
        revalidated: clientRules ? clientRules.health !== ui.report.health : true,
      };
    } catch (err) {
      // A design that can't even be adapted/validated is not orderable.
      console.error("[order] server re-validation failed", { orderNo, err });
      return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 422 });
    }
  }

  // ── Promo code: re-check and claim ─────────────────────────────────────────
  // The checkout already previewed this code, but the browser is not trusted:
  // re-check it against a server-computed kit price, then claim it (a voucher
  // is taken atomically). If it no longer applies, refuse the order rather than
  // record a price the customer was never shown.
  let discount: Extract<DiscountCheck, { ok: true }> | null = null;
  let serverKitCzk: number | null = null;
  let serverTotalCzk: number | null = null;
  if (typeof promoCode === "string" && promoCode.trim()) {
    if (!design || typeof design !== "object") {
      return NextResponse.json({ ok: false, error: "promo_invalid", reason: "invalid_design" }, { status: 422 });
    }
    try {
      const full = quoteDesign(design as unknown as Design);
      const check = await checkDiscount({ code: promoCode, email: customer?.email, kitCzk: full.kitCZK, excludeOrderNo: orderNo });
      if (!check.ok) {
        return NextResponse.json({ ok: false, error: "promo_invalid", reason: check.reason }, { status: 409 });
      }
      if (!(await reserveDiscount(check, orderNo))) {
        return NextResponse.json({ ok: false, error: "promo_invalid", reason: "used" }, { status: 409 });
      }
      discount = check;
      const priced = quoteDesign(design as unknown as Design, { discountCZK: check.discountCzk });
      serverKitCzk = priced.kitCZK;
      serverTotalCzk = priced.total;
    } catch (err) {
      console.error("[order] promo check failed", { orderNo, err });
      return NextResponse.json({ ok: false, error: "promo_invalid", reason: "unavailable" }, { status: 500 });
    }
  }

  // Light audit trail. Behind Vercel/proxies the client IP is the first entry of
  // x-forwarded-for; fall back to x-real-ip.
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent");

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("orders").insert({
      order_no: orderNo,
      locale: consent.locale,

      first_name: customer?.firstName ?? null,
      last_name: customer?.lastName ?? null,
      email: customer?.email ?? null,
      phone: customer?.phone ?? null,

      street: customer?.street ?? null,
      city: customer?.city ?? null,
      zip: customer?.zip ?? null,
      country: customer?.country ?? "CZ",
      delivery_method: customer?.deliveryMethod ?? null,

      design_spec: summary ?? {},
      design: design ?? null,
      kit_price_czk: serverKitCzk ?? (typeof summary?.kit_price_czk === "number" ? summary.kit_price_czk : null),
      total_price_czk: serverTotalCzk ?? (typeof summary?.total_price_czk === "number" ? summary.total_price_czk : null),

      discount_code: discount?.code ?? null,
      discount_kind: discount?.kind ?? null,
      discount_czk: discount?.discountCzk ?? 0,
      referrer_email: discount?.referrerEmail ?? null,

      // `accepted_at` (NOT NULL, predates the passive notice) keeps the same
      // timestamp; `acknowledged_custom_withdrawal_exclusion` is no longer
      // written (no tick exists) and falls back to its default, false. The
      // §1837 proof for these orders is `checkout_legal_copy_version`.
      submitted_at: consent.submittedAt,
      accepted_at: consent.submittedAt,
      checkout_legal_copy_version: consent.legalCopyVersion,
      terms_version: consent.termsVersion,
      accepted_doc_versions: consent.acceptedDocVersions,
      custom_specification: consent.customSpecification ?? null,

      // Sales-first rules record (server-authoritative report + the tips the
      // customer was shown). The `rules_acknowledgements` column predates the
      // read-only recommendations and is kept as-is to avoid a migration; it
      // now holds "shown" records, each with `shown_at` rather than a consent
      // timestamp. Rows written before 2026-08-17 carry `acknowledged_at`.
      rules_catalogue_version: serverRules?.catalogue_version ?? clientRules?.catalogue_version ?? null,
      rules_engine_version: serverRules?.engine_version ?? clientRules?.engine_version ?? null,
      rules_health: serverRules?.health ?? clientRules?.health ?? null,
      rules_design_hash: serverRules?.design_hash ?? clientRules?.design_hash ?? null,
      rules_report: serverRules?.report ?? null,
      rules_acknowledgements: clientRules?.recommendationsShown ?? [],
      rules_server_revalidated: serverRules?.revalidated ?? false,

      ip,
      user_agent: userAgent,
    });

    if (error) {
      console.error("[order] persist failed", { orderNo, error: error.message });
      if (discount) await reverseOrderRewards(orderNo); // give the voucher back
      return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
    }
  } catch (err) {
    // Missing env / client init — don't lose the record silently.
    console.error("[order] persist threw", { orderNo, err });
    if (discount) await reverseOrderRewards(orderNo);
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }

  const emailResult = await sendOrderConfirmationEmail({
    orderNo,
    customer,
    consent,
    summary: serverTotalCzk != null ? { ...summary, total_price_czk: serverTotalCzk } : summary,
    // Only while Comgate is off: once payments are live the customer has already
    // paid by the time this e-mail goes out, so no transfer details belong in it.
    paymentInstructions:
      !PAYMENTS_ENABLED && typeof (serverTotalCzk ?? summary?.total_price_czk) === "number"
        ? {
            accountNumber: BANK_TRANSFER_ACCOUNT_NUMBER,
            bankName: BANK_TRANSFER_BANK_NAME,
            variableSymbol: variableSymbolFromOrderNo(orderNo),
            amountCzk: (serverTotalCzk ?? summary?.total_price_czk) as number,
            dueDays: BANK_TRANSFER_DUE_DAYS,
          }
        : null,
  });
  if (!emailResult.sent) {
    console.warn("[order] confirmation email not sent", { orderNo, reason: emailResult.reason });
  }

  return NextResponse.json({ ok: true, orderNo, emailSent: emailResult.sent });
}
