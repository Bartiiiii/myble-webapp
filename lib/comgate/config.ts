// ─────────────────────────────────────────────────────────────────────────────
// Comgate configuration — BARTI OWNS THESE NUMBERS (same convention as
// lib/pricingConfig.ts).
//
// Credentials live in env, never here. Required env vars:
//   COMGATE_MERCHANT       merchant id from portal.comgate.cz
//   COMGATE_SECRET         API secret from portal.comgate.cz
//   COMGATE_TEST           "1" for the sandbox, unset/"0" for live money
//   NEXT_PUBLIC_SITE_URL   e.g. https://myble.cz — used to build return URLs
//
// The secret is ALSO the shared value echoed in the push notification, so it is
// server-only. It must never appear in a NEXT_PUBLIC_* variable.
// ─────────────────────────────────────────────────────────────────────────────

export const COMGATE_BASE_URL = "https://payments.comgate.cz/v2.0";

/** Comgate's published egress ranges for push notifications. */
export const COMGATE_IP_LIST_URL = "https://payments.comgate.cz/ips-v4";

export function comgateMerchant(): string {
  const v = process.env.COMGATE_MERCHANT;
  if (!v) throw new Error("COMGATE_MERCHANT is not set");
  return v;
}

export function comgateSecret(): string {
  const v = process.env.COMGATE_SECRET;
  if (!v) throw new Error("COMGATE_SECRET is not set");
  return v;
}

/** Test mode. Test payments are fully functional but never settle real money. */
export const COMGATE_TEST = process.env.COMGATE_TEST === "1";

export function siteUrl(): string {
  const v = process.env.NEXT_PUBLIC_SITE_URL;
  if (!v) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  return v.replace(/\/$/, "");
}

/** Online card payment is live. While false, orders are taken and settled by
 *  invoice/bank transfer — see the checkout interstitial. Flip to true when the
 *  Comgate contract is signed and the gateway is wired into the checkout.
 *
 *  NEXT_PUBLIC_ on purpose: this is UI state, not a secret. Unset ⇒ false, so
 *  the safe state (tell the customer nothing is charged yet) is the default. */
export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "1";

// ── Business knobs ───────────────────────────────────────────────────────────

/**
 * Which methods the gateway offers.
 *
 * "ALL"       — everything enabled on the merchant account (recommended at launch).
 * "BANK_ALL+CARD_ALL" — arithmetic expression; "+" adds a group, "-" removes one.
 *
 * Do NOT hardcode individual method ids (BANK_CZ_KB_PSD2 etc.). Comgate adds and
 * retires bank connectors; a hardcoded list silently loses methods. Use the
 * /method.json endpoint if you ever want to render your own picker.
 */
export const COMGATE_METHOD = "ALL";

/**
 * How long an unpaid payment stays open before Comgate expires it.
 * `^[1-9][0-9]*(m|h|d)$`. 30 minutes is enough for a bank-app redirect and
 * short enough that abandoned checkouts don't clutter the payments table.
 */
export const PAYMENT_EXPIRATION = "30m";

/**
 * CAPTURE MODE — the money question.
 *
 * "immediate" (default)
 *   Authorize and capture in one step. Money is in the Comgate account the same
 *   day and settles D+1. Works identically for EVERY payment method.
 *   If we later reject a design, we refund (5 Kč fee, lands in 3–10 days).
 *
 * "preauth"
 *   Authorize at checkout, capture only after the design passes review.
 *   READ THIS BEFORE FLIPPING THE FLAG:
 *     • Cards + Apple Pay + Google Pay ONLY. Czech bank buttons CANNOT be
 *       pre-authorized, so ~28% of expected CZ orders fall back to immediate
 *       capture and you are running two flows at once.
 *     • Banks guarantee the hold for a MINIMUM of 7 days (Comgate docs). Some
 *       issuers hold longer, none guarantee it. If a design sits unreviewed for
 *       more than a week the authorization can lapse and the money is gone.
 *     • The customer sees the amount reserved on their card either way, so the
 *       UX benefit is "no refund appears on my statement", not "nothing happened".
 *
 * The whole capture/cancel path is implemented and tested either way, so this is
 * a one-line change if the review-rejection rate ever justifies it.
 */
export type CaptureMode = "immediate" | "preauth";
export const CAPTURE_MODE: CaptureMode =
  process.env.COMGATE_CAPTURE_MODE === "preauth" ? "preauth" : "immediate";

/** Methods that actually support pre-authorization. Everything else captures now. */
export const PREAUTH_CAPABLE_PREFIXES = ["CARD_", "APPLEPAY", "GOOGLEPAY"] as const;

/**
 * Currency per shipping country. Comgate settles in the payment currency, so
 * selling PL in PLN avoids a conversion round-trip — which matters because
 * meble.pl invoices us in PLN. That is a natural FX hedge; keep it.
 */
export const CURRENCY_BY_COUNTRY: Record<string, string> = {
  CZ: "CZK",
  SK: "EUR",
  PL: "PLN",
};

export function currencyForCountry(country: string | null | undefined): string {
  return CURRENCY_BY_COUNTRY[(country ?? "CZ").toUpperCase()] ?? "CZK";
}

/** CZK → haléře. Comgate takes minor units everywhere. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/** haléře → CZK. */
export function fromMinorUnits(minor: number | string): number {
  return Number(minor) / 100;
}

/**
 * Comgate's `label` is capped at 16 characters and is what the payer sees on
 * their statement. Our order numbers (MB-2026-1234) are 12, so they fit as-is.
 */
export function paymentLabel(orderNo: string): string {
  return orderNo.slice(0, 16);
}
