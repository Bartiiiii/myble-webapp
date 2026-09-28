import { describe, it, expect } from "vitest";
import { buildHtml, type OrderConfirmationEmailParams } from "./email";

// This e-mail is the durable copy of the payment instructions. Two properties
// matter: the details must be there while Comgate is off, and they must vanish
// the moment it goes live — otherwise a customer who already paid by card is
// told to also wire the money.

const base = (locale: "en" | "cs"): OrderConfirmationEmailParams => ({
  orderNo: "MB-2026-1234",
  customer: { firstName: "Jan", lastName: "Novák" },
  consent: {
    orderNo: "MB-2026-1234",
    locale,
    acceptedAt: "2026-08-18T10:00:00.000Z",
    acceptedDocVersions: { "terms-and-conditions": "1.4" },
    acknowledgedCustomWithdrawalExclusion: true,
  },
  summary: { total_price_czk: 3790 },
});

const instructions = {
  accountNumber: "7921807003/5500",
  bankName: "Raiffeisenbank a.s.",
  variableSymbol: "20261234",
  amountCzk: 3790,
  dueDays: 5,
};

describe("order confirmation e-mail — bank transfer block", () => {
  it("includes account, bank, variable symbol and amount when payments are off", () => {
    const html = buildHtml({ ...base("en"), paymentInstructions: instructions });
    expect(html).toContain("Payment instructions");
    expect(html).toContain("7921807003/5500");
    expect(html).toContain("Raiffeisenbank a.s.");
    expect(html).toContain("20261234");
    expect(html).toContain("3790 Kč");
    expect(html).toContain("within 5 business days");
  });

  it("renders the Czech copy for a Czech order", () => {
    const html = buildHtml({ ...base("cs"), paymentInstructions: instructions });
    expect(html).toContain("Platební údaje");
    expect(html).toContain("Variabilní symbol");
    expect(html).toContain("do 5 pracovních dnů");
  });

  it("says production waits for payment, not that it has already started", () => {
    const withPayment = buildHtml({ ...base("en"), paymentInstructions: instructions });
    expect(withPayment).toContain("Production starts as soon as your payment arrives");
    expect(withPayment).not.toContain("we're sending it to production");
  });

  it("shows no payment block at all once Comgate is live", () => {
    for (const paymentInstructions of [null, undefined]) {
      const html = buildHtml({ ...base("en"), paymentInstructions });
      expect(html).not.toContain("Payment instructions");
      expect(html).not.toContain("7921807003/5500");
      expect(html).not.toContain("Variable symbol");
      // …and the normal "off to production" intro comes back.
      expect(html).toContain("we're sending it to production");
    }
  });

  it("still renders the documents section either way", () => {
    expect(buildHtml({ ...base("en"), paymentInstructions: instructions })).toContain("Your documents");
    expect(buildHtml({ ...base("en"), paymentInstructions: null })).toContain("Your documents");
  });
});
