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

  vi.doMock("../../lib/comgate/config", () => ({ PAYMENTS_ENABLED: enabled }));
  vi.doMock("next/navigation", () => ({ useRouter: () => ({ push }) }));
  vi.doMock("posthog-js", () => ({ default: { capture } }));
  // Heavy/irrelevant chrome: three.js viewer, header (auth session), footer.
  vi.doMock("../../components/ShelfViewer", () => ({ default: () => <div data-testid="viewer" /> }));
  vi.doMock("../../components/SiteHeader", () => ({ SiteHeader: () => null, Logo: () => null }));
  vi.doMock("../../components/SiteFooter", () => ({ SiteFooter: () => null }));

  // Imported after resetModules so the provider and the page share one
  // module registry — otherwise the page sees an empty locale context.
  const { LocaleProvider } = await import("../../lib/i18n");
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

/** Tick the three consent boxes so the submit button is enabled. */
function acceptEverything() {
  const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
  // Dimensions confirmation, §1837 custom-goods acknowledgement, T&C acceptance.
  for (const box of boxes) if (!box.checked) fireEvent.click(box);
}

function submitButton() {
  return screen.getByRole("button", { name: /Submit order|Order with obligation to pay/ });
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
  it("labels the submit button so it does not promise a payment", async () => {
    await renderOrderPage(false);
    expect(screen.getByRole("button", { name: "Submit order" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Order with obligation to pay" })).toBeNull();
  });

  it("states in the form, before the button, that no card payment happens yet", async () => {
    await renderOrderPage(false);
    expect(screen.getByText(/Online card payment is being activated/)).toBeTruthy();
  });

  it("opens the dialog on submit instead of placing the order straight away", async () => {
    await renderOrderPage(false);
    fillForm();
    acceptEverything();
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
    acceptEverything();
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
    acceptEverything();
    fireEvent.click(submitButton());
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("confirming submits exactly once, even on a double click", async () => {
    await renderOrderPage(false);
    fillForm();
    acceptEverything();
    fireEvent.click(submitButton());

    const confirm = await screen.findByRole("button", { name: "I understand, submit the order" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/order");
    expect(JSON.parse((init as RequestInit).body as string).orderNo).toMatch(/^MB-\d{4}-\d{4}$/);
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/order/confirmation?order=MB-"));
  });
});

describe("checkout interstitial — payments enabled", () => {
  it("renders none of it and submits directly", async () => {
    await renderOrderPage(true);

    expect(screen.queryByText(/Online card payment is being activated/)).toBeNull();
    expect(screen.getByRole("button", { name: "Order with obligation to pay" })).toBeTruthy();

    fillForm();
    acceptEverything();
    fireEvent.click(submitButton());

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
