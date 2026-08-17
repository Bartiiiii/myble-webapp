// ─────────────────────────────────────────────────────────────────────────────
// Payment domain layer — the only module that mutates payment state.
//
// Everything above this (API routes, admin actions) calls into here; nothing
// below it knows about HTTP. Three invariants this file exists to protect:
//
//   1. THE PRICE IS RECOMPUTED ON THE SERVER, ALWAYS.
//      The configurator lets a customer build an arbitrary product and the
//      browser knows the price. If we charged the posted total, anyone could
//      order a wardrobe for 1 Kč with a devtools console. We re-run
//      quoteDesign() on the stored design and charge that.
//
//   2. STATE ONLY MOVES FORWARD, AND FULFILMENT HAPPENS ONCE.
//      Comgate retries a failed push up to 1 000 times, and the return URL can
//      fire at the same moment. Both call syncPaymentByTransId(). The status
//      machine below is idempotent, and `payments_one_paid_per_order` enforces
//      it at the database level as a second line of defence.
//
//   3. THE WEBHOOK IS NEVER THE SOURCE OF TRUTH.
//      Comgate's push notification carries NO HMAC signature. We verify the
//      shared secret, then throw the payload away and ask the status API what
//      actually happened. Comgate's own docs recommend exactly this.
//
// SERVER ONLY — same convention as utils/supabase/admin.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { quoteDesign } from "@/lib/quote";
import type { Design } from "@/lib/model";
import {
  CAPTURE_MODE,
  COMGATE_METHOD,
  COMGATE_TEST,
  PAYMENT_EXPIRATION,
  comgateSecret,
  currencyForCountry,
  paymentLabel,
  siteUrl,
  toMinorUnits,
} from "@/lib/comgate/config";
import {
  ComgateError,
  cancelPayment,
  cancelPreauth,
  capturePreauth,
  createPayment,
  getPaymentStatus,
  refundPayment,
} from "@/lib/comgate/client";
import type { ComgateStatus, ComgateStatusResponse } from "@/lib/comgate/types";

export type PaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "paid"
  | "cancelled"
  | "refunded"
  | "failed";

export interface PaymentRow {
  id: string;
  created_at: string;
  updated_at: string;
  order_id: string;
  order_no: string;
  trans_id: string | null;
  status: PaymentStatus;
  comgate_status: string | null;
  amount_minor: number;
  currency: string;
  refunded_minor: number;
  method: string | null;
  fee_minor: number | null;
  is_preauth: boolean;
  is_test: boolean;
  payer_name: string | null;
  payer_account: string | null;
  card_number_masked: string | null;
  variable_symbol: string | null;
  error_reason: string | null;
  redirect_url: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  settled_transfer_id: string | null;
  settled_at: string | null;
  last_status_payload: Record<string, unknown> | null;
}

// ── Audit log ────────────────────────────────────────────────────────────────

export async function logPaymentEvent(input: {
  paymentId?: string | null;
  orderNo?: string | null;
  transId?: string | null;
  kind: string;
  statusFrom?: string | null;
  statusTo?: string | null;
  payload?: unknown;
  message?: string;
  sourceIp?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("payment_events").insert({
      payment_id: input.paymentId ?? null,
      order_no: input.orderNo ?? null,
      trans_id: input.transId ?? null,
      kind: input.kind,
      status_from: input.statusFrom ?? null,
      status_to: input.statusTo ?? null,
      payload: (input.payload as Record<string, unknown>) ?? null,
      message: input.message ?? null,
      source_ip: input.sourceIp ?? null,
    });
  } catch (err) {
    // Never let audit logging break a payment. Log and move on.
    console.error("[payments] audit log failed", err);
  }
}

// ── Price authority ──────────────────────────────────────────────────────────

export interface AuthoritativePrice {
  totalCzk: number;
  minorUnits: number;
  currency: string;
}

/**
 * The single source of truth for what a customer is charged.
 *
 * `design` is the stored Design JSON from the order row. quoteDesign() is pure
 * and server-reproducible by construction (see lib/quote.ts), so this returns
 * the same number the configurator showed — unless the client tampered with it,
 * which is exactly the case we are defending against.
 */
export function authoritativePrice(
  design: Design,
  country: string | null | undefined,
): AuthoritativePrice {
  const quote = quoteDesign(design);
  const totalCzk = Math.round(quote.total);
  if (!Number.isFinite(totalCzk) || totalCzk <= 0) {
    throw new Error(`refusing to charge a non-positive total: ${totalCzk}`);
  }
  return {
    totalCzk,
    minorUnits: toMinorUnits(totalCzk),
    currency: currencyForCountry(country),
  };
}

/**
 * How far the client's displayed price may differ from the server's before we
 * refuse. Zero tolerance is correct: quoteDesign is deterministic, so any
 * mismatch is either tampering or a genuine bug — both worth failing loudly.
 */
export function assertPriceMatches(clientTotal: number | null | undefined, server: AuthoritativePrice) {
  if (clientTotal == null) return;
  if (Math.round(clientTotal) !== server.totalCzk) {
    throw new Error(
      `price mismatch: client showed ${clientTotal} CZK, server computed ${server.totalCzk} CZK`,
    );
  }
}

// ── Creating a payment ───────────────────────────────────────────────────────

export interface StartPaymentInput {
  orderId: string;
  orderNo: string;
  design: Design;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  locale?: string | null;
  /** What the browser showed. Checked, never trusted. */
  clientTotalCzk?: number | null;
}

export interface StartPaymentResult {
  paymentId: string;
  transId: string;
  redirect: string;
  amountCzk: number;
}

/**
 * Create a Comgate payment for an order and return the URL to send the browser to.
 *
 * Reuses an existing PENDING payment for the same order instead of creating a
 * second one — a customer who double-clicks "Pay" should not generate two
 * transactions.
 */
export async function startPaymentForOrder(input: StartPaymentInput): Promise<StartPaymentResult> {
  const supabase = createAdminClient();

  // Never start a payment for an order that already has one settled.
  const { data: existing } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", input.orderId)
    .in("status", ["paid", "authorized", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prior = existing as PaymentRow | null;
  if (prior && (prior.status === "paid" || prior.status === "authorized")) {
    throw new Error(`order ${input.orderNo} is already paid`);
  }
  if (prior && prior.status === "pending" && prior.redirect_url && prior.trans_id) {
    // Re-use the open payment rather than creating a duplicate.
    return {
      paymentId: prior.id,
      transId: prior.trans_id,
      redirect: prior.redirect_url,
      amountCzk: prior.amount_minor / 100,
    };
  }

  const price = authoritativePrice(input.design, input.country);
  assertPriceMatches(input.clientTotalCzk, price);

  const usePreauth = CAPTURE_MODE === "preauth";

  const { data: inserted, error: insertErr } = await supabase
    .from("payments")
    .insert({
      order_id: input.orderId,
      order_no: input.orderNo,
      status: "created",
      amount_minor: price.minorUnits,
      currency: price.currency,
      is_preauth: usePreauth,
      is_test: COMGATE_TEST,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    throw new Error(`could not create payment row: ${insertErr?.message}`);
  }
  const paymentId = inserted.id as string;

  const base = siteUrl();
  const returnUrl = `${base}/api/payment/return?order=${encodeURIComponent(input.orderNo)}`;

  try {
    const res = await createPayment({
      price: price.minorUnits,
      curr: price.currency,
      label: paymentLabel(input.orderNo),
      refId: input.orderNo,
      method: COMGATE_METHOD,
      email: input.email,
      phone: input.phone ?? undefined,
      fullName: input.fullName ?? undefined,
      country: (input.country ?? "CZ").toUpperCase(),
      lang: (input.locale ?? "cs").slice(0, 2),
      // 3DS risk hints — these measurably improve frictionless authentication
      // rates for physical goods, and cost nothing to send.
      billingAddrStreet: input.street ?? undefined,
      billingAddrCity: input.city ?? undefined,
      billingAddrPostalCode: input.zip ?? undefined,
      billingAddrCountry: (input.country ?? "CZ").toUpperCase(),
      delivery: "HOME_DELIVERY",
      homeDeliveryStreet: input.street ?? undefined,
      homeDeliveryCity: input.city ?? undefined,
      homeDeliveryPostalCode: input.zip ?? undefined,
      homeDeliveryCountry: (input.country ?? "CZ").toUpperCase(),
      category: "PHYSICAL_GOODS_ONLY",
      name: "Myble kit",
      preauth: usePreauth || undefined,
      expirationTime: PAYMENT_EXPIRATION,
      url_paid: `${returnUrl}&result=paid`,
      url_cancelled: `${returnUrl}&result=cancelled`,
      url_pending: `${returnUrl}&result=pending`,
    });

    await supabase
      .from("payments")
      .update({
        trans_id: res.transId,
        redirect_url: res.redirect,
        status: "pending",
      })
      .eq("id", paymentId);

    await logPaymentEvent({
      paymentId,
      orderNo: input.orderNo,
      transId: res.transId,
      kind: "create",
      statusFrom: "created",
      statusTo: "pending",
      payload: { price: price.minorUnits, curr: price.currency, preauth: usePreauth },
    });

    await supabase
      .from("orders")
      .update({ payment_status: "pending" })
      .eq("id", input.orderId);

    return {
      paymentId,
      transId: res.transId,
      redirect: res.redirect,
      amountCzk: price.totalCzk,
    };
  } catch (err) {
    const message = err instanceof ComgateError ? err.message : String(err);
    await supabase
      .from("payments")
      .update({ status: "failed", error_reason: message })
      .eq("id", paymentId);
    await logPaymentEvent({
      paymentId,
      orderNo: input.orderNo,
      kind: "error",
      statusTo: "failed",
      message,
    });
    throw err;
  }
}

// ── Status synchronisation ───────────────────────────────────────────────────

/** Terminal states never move again. This is what makes replay safe. */
const TERMINAL: ReadonlySet<PaymentStatus> = new Set(["paid", "refunded", "cancelled"]);

function mapComgateStatus(status: ComgateStatus, isPreauth: boolean): PaymentStatus {
  switch (status) {
    case "PAID":
      return "paid";
    case "AUTHORIZED":
      return isPreauth ? "authorized" : "paid";
    case "CANCELLED":
      return "cancelled";
    case "PENDING":
    default:
      return "pending";
  }
}

export interface SyncResult {
  payment: PaymentRow;
  changed: boolean;
  newlyPaid: boolean;
}

/**
 * Ask Comgate what actually happened and reconcile our row to it.
 *
 * Called from three places — the push webhook, the browser return URL, and the
 * admin "re-sync" button. All three are safe to call any number of times.
 */
export async function syncPaymentByTransId(
  transId: string,
  source: "push" | "return" | "manual" | "reconcile",
  sourceIp?: string | null,
): Promise<SyncResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("trans_id", transId)
    .maybeSingle();

  if (error) throw new Error(`payment lookup failed: ${error.message}`);
  if (!data) throw new Error(`no payment for transId ${transId}`);
  const payment = data as PaymentRow;

  const remote: ComgateStatusResponse = await getPaymentStatus(transId);

  // Defence in depth: the amount Comgate reports must equal what we asked for.
  // A mismatch means either a Comgate bug or a manipulated payment — refuse to
  // mark it paid and escalate.
  const remoteMinor = Number(remote.price);
  if (Number.isFinite(remoteMinor) && remoteMinor !== payment.amount_minor) {
    await logPaymentEvent({
      paymentId: payment.id,
      orderNo: payment.order_no,
      transId,
      kind: "error",
      message: `amount mismatch: expected ${payment.amount_minor}, Comgate reports ${remoteMinor}`,
      payload: remote as unknown as Record<string, unknown>,
      sourceIp,
    });
    throw new Error(`amount mismatch on ${transId}`);
  }

  const next = mapComgateStatus(remote.status, payment.is_preauth);
  const wasTerminal = TERMINAL.has(payment.status);
  const changed = !wasTerminal && next !== payment.status;
  const newlyPaid = changed && next === "paid";

  const patch: Record<string, unknown> = {
    comgate_status: remote.status,
    method: remote.method ?? payment.method,
    payer_name: remote.payerName ?? payment.payer_name,
    payer_account: remote.payerAcc ?? payment.payer_account,
    card_number_masked: remote.cardNumber ?? payment.card_number_masked,
    variable_symbol: remote.vs ?? payment.variable_symbol,
    error_reason: remote.paymentErrorReason ?? payment.error_reason,
    fee_minor: remote.fee != null ? Math.round(Number(remote.fee) * 100) : payment.fee_minor,
    last_status_payload: remote as unknown as Record<string, unknown>,
  };

  if (changed) {
    patch.status = next;
    if (next === "paid") patch.paid_at = new Date().toISOString();
    if (next === "cancelled") patch.cancelled_at = new Date().toISOString();
  }

  await supabase.from("payments").update(patch).eq("id", payment.id);

  await logPaymentEvent({
    paymentId: payment.id,
    orderNo: payment.order_no,
    transId,
    kind: source === "push" ? "push" : "status_sync",
    statusFrom: payment.status,
    statusTo: changed ? next : payment.status,
    payload: remote as unknown as Record<string, unknown>,
    sourceIp,
  });

  // Mirror onto the order so the existing orders list needs no join.
  if (changed) {
    const orderPatch: Record<string, unknown> = {
      payment_status: next === "authorized" ? "authorized" : next === "paid" ? "paid" : next === "cancelled" ? "unpaid" : next,
      payment_method: remote.method ?? null,
    };
    if (next === "paid") {
      orderPatch.paid_at = new Date().toISOString();
      // 'confirmed' is an existing status in ORDER_STATUSES. Production is still
      // gated behind review_state — payment alone does not release to meble.pl.
      orderPatch.status = "confirmed";
    }
    await supabase.from("orders").update(orderPatch).eq("id", payment.order_id);
  }

  const { data: fresh } = await supabase.from("payments").select("*").eq("id", payment.id).single();
  return { payment: (fresh ?? payment) as PaymentRow, changed, newlyPaid };
}

// ── Webhook verification ─────────────────────────────────────────────────────

/**
 * Comgate's push notification echoes the API secret rather than signing the
 * payload. Compare it in constant time; a mismatch means the request did not
 * come from Comgate and must be rejected.
 */
export function verifyPushSecret(received: string | undefined | null): boolean {
  if (!received) return false;
  const expected = Buffer.from(comgateSecret(), "utf8");
  const actual = Buffer.from(received, "utf8");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// ── Refunds ──────────────────────────────────────────────────────────────────

/**
 * Refund a payment, fully or partially.
 *
 * `amountCzk` omitted refunds the outstanding balance. Partial refunds matter
 * here: the defects-only policy means "one damaged panel in a five-panel kit"
 * is the common case, not a full return.
 */
export async function refundPaymentById(
  paymentId: string,
  amountCzk?: number,
): Promise<{ refundedMinor: number; fullyRefunded: boolean }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  if (error || !data) throw new Error(`payment ${paymentId} not found`);
  const payment = data as PaymentRow;

  if (payment.status !== "paid" && payment.status !== "refunded") {
    throw new Error(`cannot refund a payment in status ${payment.status}`);
  }
  if (!payment.trans_id) throw new Error("payment has no transId");

  const outstanding = payment.amount_minor - payment.refunded_minor;
  if (outstanding <= 0) throw new Error("payment is already fully refunded");

  const requested = amountCzk != null ? toMinorUnits(amountCzk) : outstanding;
  if (requested <= 0) throw new Error("refund amount must be positive");
  if (requested > outstanding) {
    throw new Error(`refund of ${requested} exceeds outstanding ${outstanding}`);
  }

  await refundPayment({
    transId: payment.trans_id,
    amount: requested,
    refId: `${payment.order_no}-R${Date.now()}`,
  });

  const refundedTotal = payment.refunded_minor + requested;
  const fullyRefunded = refundedTotal >= payment.amount_minor;

  await supabase
    .from("payments")
    .update({
      refunded_minor: refundedTotal,
      status: fullyRefunded ? "refunded" : payment.status,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  await logPaymentEvent({
    paymentId: payment.id,
    orderNo: payment.order_no,
    transId: payment.trans_id,
    kind: "refund",
    statusFrom: payment.status,
    statusTo: fullyRefunded ? "refunded" : payment.status,
    payload: { requested, refundedTotal },
  });

  if (fullyRefunded) {
    await supabase
      .from("orders")
      .update({ payment_status: "refunded" })
      .eq("id", payment.order_id);
  }

  return { refundedMinor: requested, fullyRefunded };
}

// ── Pre-auth capture / release (dormant while CAPTURE_MODE is "immediate") ───

/** Capture a held authorization — call this when a design passes review. */
export async function capturePaymentById(paymentId: string, amountCzk?: number): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  const payment = data as PaymentRow | null;
  if (!payment?.trans_id) throw new Error(`payment ${paymentId} not found`);
  if (payment.status !== "authorized") {
    throw new Error(`cannot capture a payment in status ${payment.status}`);
  }

  await capturePreauth(payment.trans_id, {
    amount: amountCzk != null ? toMinorUnits(amountCzk) : undefined,
  });

  await supabase
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", payment.id);
  await supabase
    .from("orders")
    .update({ payment_status: "paid", paid_at: new Date().toISOString(), status: "confirmed" })
    .eq("id", payment.order_id);
  await logPaymentEvent({
    paymentId: payment.id,
    orderNo: payment.order_no,
    transId: payment.trans_id,
    kind: "capture",
    statusFrom: "authorized",
    statusTo: "paid",
  });
}

/** Release a held authorization — call this when a design is rejected. */
export async function releasePaymentById(paymentId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  const payment = data as PaymentRow | null;
  if (!payment?.trans_id) throw new Error(`payment ${paymentId} not found`);

  if (payment.status === "authorized") {
    await cancelPreauth(payment.trans_id);
  } else if (payment.status === "pending") {
    await cancelPayment(payment.trans_id);
  } else {
    throw new Error(`cannot release a payment in status ${payment.status}`);
  }

  await supabase
    .from("payments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", payment.id);
  await supabase.from("orders").update({ payment_status: "unpaid" }).eq("id", payment.order_id);
  await logPaymentEvent({
    paymentId: payment.id,
    orderNo: payment.order_no,
    transId: payment.trans_id,
    kind: "cancel",
    statusFrom: payment.status,
    statusTo: "cancelled",
  });
}
