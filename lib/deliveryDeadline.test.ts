import { describe, it, expect } from "vitest";
import {
  DELIVERY_DEADLINE_DAYS,
  DELIVERY_WARNING_DAYS,
  byDeadlineUrgency,
  deliveryDeadline,
  isAtRisk,
} from "./deliveryDeadline";

// The clock this safeguard watches is contractual (T&C §6.2a), so the boundaries
// matter: flagging a day late is the failure mode the safeguard exists to stop.

const NOW = Date.parse("2026-08-18T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const paidOrder = (days: number, status = "in_production") => ({
  status,
  payment_status: "paid",
  paid_at: daysAgo(days),
});

describe("deliveryDeadline — when the clock applies", () => {
  it("does not run for unpaid orders", () => {
    const d = deliveryDeadline({ status: "received", payment_status: "unpaid", paid_at: null }, NOW);
    expect(d.tracked).toBe(false);
    expect(d.level).toBe("ok");
  });

  it("does not run for a paid order with no paid_at recorded", () => {
    expect(deliveryDeadline({ status: "confirmed", payment_status: "paid", paid_at: null }, NOW).tracked).toBe(false);
  });

  it("stops once the order is shipped, delivered or cancelled", () => {
    for (const status of ["shipped", "delivered", "cancelled"]) {
      expect(deliveryDeadline(paidOrder(40, status), NOW).tracked).toBe(false);
    }
  });

  it("runs for paid orders still in an open status", () => {
    for (const status of ["received", "confirmed", "in_production"]) {
      expect(deliveryDeadline(paidOrder(1, status), NOW).tracked).toBe(true);
    }
  });

  it("survives an unparseable paid_at rather than throwing", () => {
    expect(deliveryDeadline({ status: "confirmed", payment_status: "paid", paid_at: "not a date" }, NOW).tracked).toBe(false);
  });
});

describe("deliveryDeadline — thresholds", () => {
  it("is quiet before the warning day", () => {
    const d = deliveryDeadline(paidOrder(DELIVERY_WARNING_DAYS - 1), NOW);
    expect(d.level).toBe("ok");
    expect(isAtRisk(d)).toBe(false);
    expect(d.daysLeft).toBe(DELIVERY_DEADLINE_DAYS - (DELIVERY_WARNING_DAYS - 1));
  });

  it("flags exactly on the 21st day, with a week of headroom left", () => {
    const d = deliveryDeadline(paidOrder(DELIVERY_WARNING_DAYS), NOW);
    expect(d.level).toBe("due");
    expect(isAtRisk(d)).toBe(true);
    expect(d.daysLeft).toBe(7);
  });

  it("is still only 'due' on the last lawful day", () => {
    expect(deliveryDeadline(paidOrder(DELIVERY_DEADLINE_DAYS - 1), NOW).level).toBe("due");
  });

  it("turns overdue on day 28 and counts negative after", () => {
    expect(deliveryDeadline(paidOrder(DELIVERY_DEADLINE_DAYS), NOW).level).toBe("overdue");
    const late = deliveryDeadline(paidOrder(DELIVERY_DEADLINE_DAYS + 5), NOW);
    expect(late.level).toBe("overdue");
    expect(late.daysLeft).toBe(-5);
  });

  it("reports the due date as paid_at + 28 days", () => {
    const d = deliveryDeadline(paidOrder(0), NOW);
    expect(d.dueAt).toBe(new Date(NOW + DELIVERY_DEADLINE_DAYS * 86_400_000).toISOString());
  });
});

describe("byDeadlineUrgency", () => {
  it("puts overdue first, then due, then the rest", () => {
    const orders = [paidOrder(2), paidOrder(30), paidOrder(22), paidOrder(40)];
    const sorted = orders
      .map((o) => deliveryDeadline(o, NOW))
      .sort(byDeadlineUrgency)
      .map((d) => `${d.level}:${d.daysLeft}`);
    expect(sorted).toEqual(["overdue:-12", "overdue:-2", "due:6", "ok:26"]);
  });
});
