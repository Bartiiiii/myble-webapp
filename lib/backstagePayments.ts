import { createAdminClient } from "@/utils/supabase/admin";
import type { PaymentRow, PaymentStatus } from "@/lib/payments";

// ─────────────────────────────────────────────────────────────────────────────
// Backstage reads for payments. Mirrors lib/backstageData.ts: service-role
// queries, every caller behind requireBackstage().
// ─────────────────────────────────────────────────────────────────────────────

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "created",
  "pending",
  "authorized",
  "paid",
  "cancelled",
  "refunded",
  "failed",
] as const;

export interface PaymentEventRow {
  id: string;
  created_at: string;
  payment_id: string | null;
  order_no: string | null;
  trans_id: string | null;
  kind: string;
  status_from: string | null;
  status_to: string | null;
  payload: Record<string, unknown> | null;
  message: string | null;
  source_ip: string | null;
}

export interface SettlementRow {
  id: string;
  transfer_id: string;
  transfer_date: string | null;
  account: string | null;
  variable_symbol: string | null;
  matched_minor: number;
  matched_count: number;
  detail: Record<string, unknown> | null;
}

export async function fetchPayments(statusFilter?: string): Promise<PaymentRow[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (statusFilter && (PAYMENT_STATUSES as readonly string[]).includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }
  const { data, error } = await query;
  if (error) throw new Error(`payments query failed: ${error.message}`);
  return (data ?? []) as PaymentRow[];
}

export async function fetchPaymentsForOrder(orderId: string): Promise<PaymentRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`payments query failed: ${error.message}`);
  return (data ?? []) as PaymentRow[];
}

export async function fetchPaymentEvents(paymentId: string): Promise<PaymentEventRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_events")
    .select("*")
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`payment events query failed: ${error.message}`);
  return (data ?? []) as PaymentEventRow[];
}

export async function fetchSettlements(): Promise<SettlementRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_settlements")
    .select("*")
    .order("transfer_date", { ascending: false })
    .limit(200);
  if (error) throw new Error(`settlements query failed: ${error.message}`);
  return (data ?? []) as SettlementRow[];
}

// ── Aggregates ───────────────────────────────────────────────────────────────

export interface PaymentStats {
  /** Captured, net of refunds, CZK. */
  capturedCzk: number;
  captured30dCzk: number;
  refundedCzk: number;
  /** Comgate fees where the tariff exposes them, CZK. */
  feesCzk: number;
  /** Effective blended rate actually paid — compare this to the 1.8% baked into
   *  lib/pricingConfig.ts PAYMENT_FEE_PCT. If it is materially lower, that knob
   *  is overpricing every kit. */
  effectiveFeePct: number | null;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  /** Payment-attempt → paid conversion. The number that tells you whether the
   *  checkout is working. */
  conversionPct: number | null;
  /** Real method mix. This is why Comgate was chosen — measure it, don't assume. */
  methodMix: { method: string; count: number; czk: number; share: number }[];
  unsettledCzk: number;
}

export async function fetchPaymentStats(): Promise<PaymentStats> {
  const payments = await fetchPayments();
  const now = Date.now();
  const cutoff30d = now - 30 * 86_400_000;

  const paid = payments.filter((p) => p.status === "paid" || p.status === "refunded");
  const capturedMinor = paid.reduce((s, p) => s + p.amount_minor - p.refunded_minor, 0);
  const captured30dMinor = paid
    .filter((p) => p.paid_at && Date.parse(p.paid_at) > cutoff30d)
    .reduce((s, p) => s + p.amount_minor - p.refunded_minor, 0);
  const refundedMinor = payments.reduce((s, p) => s + p.refunded_minor, 0);
  const feesMinor = paid.reduce((s, p) => s + (p.fee_minor ?? 0), 0);
  const grossMinor = paid.reduce((s, p) => s + p.amount_minor, 0);

  // Attempts = every payment that actually reached the gateway.
  const attempts = payments.filter((p) => p.status !== "created").length;

  const byMethod = new Map<string, { count: number; minor: number }>();
  for (const p of paid) {
    const key = p.method ?? "unknown";
    const cur = byMethod.get(key) ?? { count: 0, minor: 0 };
    cur.count += 1;
    cur.minor += p.amount_minor;
    byMethod.set(key, cur);
  }
  const methodMix = [...byMethod.entries()]
    .map(([method, v]) => ({
      method,
      count: v.count,
      czk: v.minor / 100,
      share: paid.length ? v.count / paid.length : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const unsettledMinor = paid
    .filter((p) => !p.settled_transfer_id)
    .reduce((s, p) => s + p.amount_minor, 0);

  return {
    capturedCzk: capturedMinor / 100,
    captured30dCzk: captured30dMinor / 100,
    refundedCzk: refundedMinor / 100,
    feesCzk: feesMinor / 100,
    effectiveFeePct: grossMinor > 0 && feesMinor > 0 ? feesMinor / grossMinor : null,
    paidCount: paid.length,
    pendingCount: payments.filter((p) => p.status === "pending").length,
    failedCount: payments.filter((p) => p.status === "failed").length,
    conversionPct: attempts > 0 ? paid.length / attempts : null,
    methodMix,
    unsettledCzk: unsettledMinor / 100,
  };
}
