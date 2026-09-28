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

export interface ConsentRecord {
  orderNo: string;
  locale: string;
  acceptedAt: string; // ISO timestamp
  acceptedDocVersions: Record<string, string>;
  acknowledgedCustomWithdrawalExclusion: boolean;
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
}

export async function POST(req: Request) {
  let body: OrderPayload;
  try {
    body = (await req.json()) as OrderPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { orderNo, consent, customer, summary, design, rules: clientRules } = body ?? {};
  if (!orderNo || !consent?.acceptedDocVersions || !consent.acknowledgedCustomWithdrawalExclusion) {
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
      kit_price_czk: typeof summary?.kit_price_czk === "number" ? summary.kit_price_czk : null,
      total_price_czk: typeof summary?.total_price_czk === "number" ? summary.total_price_czk : null,

      accepted_at: consent.acceptedAt,
      accepted_doc_versions: consent.acceptedDocVersions,
      acknowledged_custom_withdrawal_exclusion: consent.acknowledgedCustomWithdrawalExclusion,
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
      return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
    }
  } catch (err) {
    // Missing env / client init — don't lose the record silently.
    console.error("[order] persist threw", { orderNo, err });
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }

  const emailResult = await sendOrderConfirmationEmail({
    orderNo,
    customer,
    consent,
    summary,
    // Only while Comgate is off: once payments are live the customer has already
    // paid by the time this e-mail goes out, so no transfer details belong in it.
    paymentInstructions:
      !PAYMENTS_ENABLED && typeof summary?.total_price_czk === "number"
        ? {
            accountNumber: BANK_TRANSFER_ACCOUNT_NUMBER,
            bankName: BANK_TRANSFER_BANK_NAME,
            variableSymbol: variableSymbolFromOrderNo(orderNo),
            amountCzk: summary.total_price_czk,
            dueDays: BANK_TRANSFER_DUE_DAYS,
          }
        : null,
  });
  if (!emailResult.sent) {
    console.warn("[order] confirmation email not sent", { orderNo, reason: emailResult.reason });
  }

  return NextResponse.json({ ok: true, orderNo, emailSent: emailResult.sent });
}
