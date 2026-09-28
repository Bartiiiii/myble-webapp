// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// ─────────────────────────────────────────────────────────────────────────────
// Bank-transfer instructions on the order confirmation page.
//
// Two money-adjacent properties: the amount shown next to a variable symbol must
// belong to THIS order (a stale total means the customer wires the wrong sum),
// and none of it may survive once Comgate is live and the customer has paid.
// ─────────────────────────────────────────────────────────────────────────────

const ORDER_NO = "MB-2026-3818";

async function renderConfirmation(enabled: boolean, search = `?order=${ORDER_NO}`) {
  vi.resetModules();
  vi.doMock("../../lib/comgate/config", () => ({ PAYMENTS_ENABLED: enabled }));
  vi.doMock("../../components/SiteHeader", () => ({ SiteHeader: () => null, Logo: () => null }));
  vi.doMock("../../components/SiteFooter", () => ({ SiteFooter: () => null }));

  window.history.replaceState({}, "", `/order/confirmation${search}`);

  const { LocaleProvider } = await import("../../lib/i18n");
  const { default: ConfirmationPage } = await import("./confirmation/page");
  return render(
    <LocaleProvider>
      <ConfirmationPage />
    </LocaleProvider>,
  );
}

/** Simulate the record placeOrder() writes just before redirecting here. */
function storeLastOrder(orderNo: string, totalCzk: number) {
  window.localStorage.setItem("myble.lastOrder", JSON.stringify({ orderNo, totalCzk }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.doUnmock("../../lib/comgate/config");
});

describe("confirmation page — payments off", () => {
  it("shows the account number, a numeric-only variable symbol and this order's total", async () => {
    storeLastOrder(ORDER_NO, 3790);
    await renderConfirmation(false);

    expect(screen.getByText("7921807003/5500")).toBeTruthy();
    // Derived from MB-2026-3818 — digits only, no letters or dashes.
    const vs = screen.getByText("20263818");
    expect(vs.textContent).toMatch(/^\d+$/);
    expect(screen.getByText(/3,790 Kč|3 790 Kč/)).toBeTruthy();
    expect(screen.getByText(/within 5 business days/)).toBeTruthy();
  });

  it("falls back to the e-mail when the stored total belongs to a DIFFERENT order", async () => {
    storeLastOrder("MB-2026-1111", 9999); // an earlier order, still in localStorage
    await renderConfirmation(false);

    expect(screen.getByText(/Full payment instructions are in your confirmation e-mail/)).toBeTruthy();
    expect(screen.queryByText("7921807003/5500")).toBeNull();
    expect(screen.queryByText(/9,999|9 999/)).toBeNull();
  });

  it("falls back when the page is opened cold, with no stored order at all", async () => {
    await renderConfirmation(false);
    expect(screen.getByText(/Full payment instructions are in your confirmation e-mail/)).toBeTruthy();
    expect(screen.queryByText("7921807003/5500")).toBeNull();
  });
});

describe("confirmation page — payments live", () => {
  it("shows no bank-transfer content whatsoever", async () => {
    storeLastOrder(ORDER_NO, 3790);
    await renderConfirmation(true);

    expect(screen.queryByText("7921807003/5500")).toBeNull();
    expect(screen.queryByText("20263818")).toBeNull();
    expect(screen.queryByText(/Payment instructions/)).toBeNull();
    expect(screen.queryByText(/within 5 business days/)).toBeNull();
    // The normal paid-order confirmation copy is back.
    expect(screen.getByText(/sending it to production/)).toBeTruthy();
  });
});
