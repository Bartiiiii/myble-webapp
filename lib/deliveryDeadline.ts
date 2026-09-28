// ─────────────────────────────────────────────────────────────────────────────
// The 28-day delivery deadline, as an internal ops signal.
//
// T&C §6.2a is a BINDING commitment, not an estimate: the Seller delivers no
// later than 28 days from the start of production, and §5.5 defines that start
// as receipt of payment. So the clock runs from `orders.paid_at`, and an order
// that is paid but not yet shipped is on that clock.
//
// This module is deliberately pure and dependency-free: it is the one piece of
// the safeguard worth unit-testing, and lib/backstageData.ts (which imports the
// service-role Supabase client) is not importable from a plain node test.
//
// Nothing here notifies anyone — it only classifies. The signal is rendered in
// the backstage orders list, see app/admin/(backstage)/orders/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

/** T&C §6.2a: hard contractual ceiling, in days from `paid_at`. */
export const DELIVERY_DEADLINE_DAYS = 28;

/**
 * Days elapsed at which an unshipped paid order starts being flagged — one week
 * of headroom before the contractual date, which is roughly the shortest window
 * in which a panel order can still be re-cut and shipped.
 */
export const DELIVERY_WARNING_DAYS = 21;

/** Statuses where we are no longer on the hook for the delivery clock. */
export const TERMINAL_ORDER_STATUSES = ["shipped", "delivered", "cancelled"] as const;

const DAY_MS = 86_400_000;

export type DeadlineLevel = "ok" | "due" | "overdue";

export interface DeliveryDeadline {
  /** False when the clock does not apply: unpaid, or already shipped/cancelled. */
  tracked: boolean;
  level: DeadlineLevel;
  /** Whole days since `paid_at`. 0 when untracked. */
  daysElapsed: number;
  /** Days left before the §6.2a date. Negative once breached. 0 when untracked. */
  daysLeft: number;
  /** ISO date the goods must be delivered by, or null when untracked. */
  dueAt: string | null;
}

const UNTRACKED: DeliveryDeadline = {
  tracked: false,
  level: "ok",
  daysElapsed: 0,
  daysLeft: 0,
  dueAt: null,
};

export interface DeadlineInput {
  status: string;
  payment_status?: string | null;
  paid_at?: string | null;
}

/**
 * Classify one order against the §6.2a deadline.
 *
 * `now` is injectable so this is testable and so a server render can classify a
 * whole list against a single instant rather than drifting mid-render.
 */
export function deliveryDeadline(order: DeadlineInput, now: number = Date.now()): DeliveryDeadline {
  if (order.payment_status !== "paid" || !order.paid_at) return UNTRACKED;
  if ((TERMINAL_ORDER_STATUSES as readonly string[]).includes(order.status)) return UNTRACKED;

  const paidAt = Date.parse(order.paid_at);
  if (Number.isNaN(paidAt)) return UNTRACKED;

  const daysElapsed = Math.floor((now - paidAt) / DAY_MS);
  const daysLeft = DELIVERY_DEADLINE_DAYS - daysElapsed;
  const level: DeadlineLevel =
    daysElapsed >= DELIVERY_DEADLINE_DAYS ? "overdue" : daysElapsed >= DELIVERY_WARNING_DAYS ? "due" : "ok";

  return {
    tracked: true,
    level,
    daysElapsed,
    daysLeft,
    dueAt: new Date(paidAt + DELIVERY_DEADLINE_DAYS * DAY_MS).toISOString(),
  };
}

/** True when the order needs Barti's attention today. */
export function isAtRisk(d: DeliveryDeadline): boolean {
  return d.tracked && d.level !== "ok";
}

/**
 * Most urgent first (overdue, then due, then everything else), preserving the
 * caller's existing order within each band — the list is already newest-first
 * and that stays true for the un-flagged majority.
 */
export function byDeadlineUrgency(a: DeliveryDeadline, b: DeliveryDeadline): number {
  const rank = (d: DeliveryDeadline) => (d.level === "overdue" ? 0 : d.level === "due" ? 1 : 2);
  const byRank = rank(a) - rank(b);
  return byRank !== 0 ? byRank : a.daysLeft - b.daysLeft;
}
