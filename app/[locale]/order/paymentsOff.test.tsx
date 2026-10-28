// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// ─────────────────────────────────────────────────────────────────────────────
// The checkout interstitial shown while NEXT_PUBLIC_PAYMENTS_ENABLED is off.
//
// What matters here is money-adjacent: the customer must be told no payment is
// taken, cancelling must not create an order, confirming must create exactly
// one, and none of it may appear once payments are live.
// ─────────────────────────────────────────────────────────────────────────────

const push = vi.fn();
const capture = vi.fn();

/** Render the order page with `PAYMENTS_ENABLED` forced to `enabled`. */
async function renderOrderPage(enabled: boolean) {
  vi.resetModules();

  vi.doMock("../../../lib/comgate/config", () => ({ PAYMENTS_ENABLED: enabled }));
  vi.doMock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/en/order" }));
  vi.doMock("posthog-js", () => ({ default: { capture } }));
  // Heavy/irrelevant chrome: three.js viewer, header (auth session), footer.
  vi.doMock("../../../components/ShelfViewer", () => ({ default: () => <div data-testid="viewer" /> }));
  vi.doMock("../../../components/SiteHeader", () => ({ SiteHeader: () => null, Logo: () => null }));
  vi.doMock("../../../components/SiteFooter", () => ({ SiteFooter: () => null }));

  // Imported after resetModules so the provider and the page share one
  // module registry — otherwise the page sees an empty locale context.
  const { LocaleProvider } = await import("../../../lib/i18n");
  const { default: OrderPage } = await import("./page");
  const view = render(
    <LocaleProvider>
      <OrderPage />
    </LocaleProvider>,
  );
  return view;
}

/** Fill the required contact + address fields so the form actually submits. */
function fillForm() {
  const values: Record<string, string> = {
    firstName: "Jan",
    lastName: "Novák",
    email: "jan@example.com",
    phone: "+420123456789",
    street: "Národní 12",
    city: "Praha",
    zip: "110 00",
  };
  for (const [name, value] of Object.entries(values)) {
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input) throw new Error(`missing field ${name}`);
    fireEvent.change(input, { target: { value } });
  }
}

function submitButton() {
  return screen.getByRole("button", { name: "Order with obligation to pay" });
}

beforeEach(() => {
  push.mockReset();
  capture.mockReset();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))));
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.doUnmock("../../lib/comgate/config");
});

describe("checkout interstitial — payments disabled", () => {
  it("labels the button with the obligation to pay (§1826a) even while payments are off", async () => {
    // The order is binding either way; it is only settled by invoice.
    await renderOrderPage(false);
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Submit order" })).toBeNull();
  });

  it("has no consent ticks: the legal terms are a passive notice under the button", async () => {
    await renderOrderPage(false);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText("Made to measure: the 14-day right of withdrawal does not apply.")).toBeTruthy();
    for (const name of ["Terms & Conditions", "Complaints Procedure", "Privacy Policy"]) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("href")).toMatch(/^\/en\/legal\//);
    }
  });

  it("states in the form, before the button, that no card payment happens yet", async () => {
    // The promise this protects is the customer's, not any one panel's: before
    // committing they must read that nothing is charged here. It used to live
    // in a payments-off notice; it now lives in the Payment section, which says
    // the same thing and also says what does happen instead.
    await renderOrderPage(false);
    expect(screen.getByText(/Nothing is charged on this page/)).toBeTruthy();
    expect(screen.getByText(/QR payment once we confirm your order/)).toBeTruthy();
  });

  it("opens the dialog on submit instead of placing the order straight away", async () => {
    await renderOrderPage(false);
    fillForm();
    fireEvent.click(submitButton());

    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText(/Online payment is not active yet/)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("cancelling closes the dialog and submits nothing", async () => {
    await renderOrderPage(false);
    fillForm();
    fireEvent.click(submitButton());
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    // The form is still there with the customer's data intact.
    expect(submitButton()).toBeTruthy();
  });

  it("Escape cancels too", async () => {
    await renderOrderPage(false);
    fillForm();
    fireEvent.click(submitButton());
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("confirming submits exactly once, even on a double click", async () => {
    await renderOrderPage(false);
    fillForm();
    fireEvent.click(submitButton());

    const confirm = await screen.findByRole("button", { name: "I understand, submit the order" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/order");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.orderNo).toMatch(/^MB-\d{4}-\d{4}$/);
    // The evidence of what was shown replaces the old tick booleans.
    expect(body.consent).toMatchObject({ locale: "en", legalCopyVersion: "2026-10-04", termsVersion: expect.any(String) });
    expect(typeof body.consent.submittedAt).toBe("string");
    expect(body.consent).not.toHaveProperty("acknowledgedCustomWithdrawalExclusion");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/en/order/confirmation?order=MB-"));
  });
});

describe("checkout interstitial — payments enabled", () => {
  it("renders none of it and submits directly", async () => {
    await renderOrderPage(true);

    expect(screen.queryByText(/Online card payment is being activated/)).toBeNull();
    expect(screen.getByRole("button", { name: "Order with obligation to pay" })).toBeTruthy();

    fillForm();
    fireEvent.click(submitButton());

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
