// ─────────────────────────────────────────────────────────────────────────────
// Promotions — BARTI OWNS THESE NUMBERS.
// ─────────────────────────────────────────────────────────────────────────────
// The four offers in the promo ticker (components/PromoBar.tsx) and the pages
// behind them all read from here, and so do the server rules that make them
// real (lib/rewards.ts) and the checkout. Change a number here and the bar, the
// pages, the checkout and the server move together.
//
// Shared by client and server: nothing secret belongs in this file.

import { FREE_SHIP_CZK, PRICE_FLOOR_CZK } from "./pricingConfig";

export { FREE_SHIP_CZK };

// --- Refer a friend ----------------------------------------------------------

/** Taken off a referred friend's first order. */
export const REFERRAL_FRIEND_CZK = 500;

/** Voucher the referrer gets once that friend's order is confirmed. */
export const REFERRAL_REWARD_CZK = 500;

// --- myble+ ------------------------------------------------------------------

/** One point for every this many Kč of kit price paid (after discounts). */
export const LOYALTY_CZK_PER_POINT = 10;

/** Points for a design approved into the public Design Library. */
export const LOYALTY_DESIGN_PUBLISHED_POINTS = 200;

/** Points → voucher exchange tiers. Better value the more you save up. */
export const LOYALTY_REWARDS = [
  { points: 1200, czk: 300 },
  { points: 2250, czk: 600 },
  { points: 4500, czk: 1500 },
] as const;

// --- Voucher rules -------------------------------------------------------------

/** Vouchers expire this long after they are issued. */
export const VOUCHER_VALID_DAYS = 365;

/**
 * Smallest kit price a discount of `amountCzk` may be used on. Keeps any one
 * discount at roughly a quarter of the kit price or less, which keeps every
 * discounted order profitable at MARKUP 2.0: 300 → 1 490 (any kit),
 * 500 → 1 990, 600 → 2 390, 1 500 → 5 990.
 */
export function minKitFor(amountCzk: number): number {
  return Math.max(PRICE_FLOOR_CZK, amountCzk * 4 - 10);
}

/** Points earned for a kit price (after discount). */
export function pointsFor(kitAfterDiscountCzk: number): number {
  return Math.max(0, Math.floor(kitAfterDiscountCzk / LOYALTY_CZK_PER_POINT));
}

// --- Code formats --------------------------------------------------------------

/** localStorage key that carries a code from /refer?ref=… to the checkout. */
export const PROMO_CODE_STORAGE_KEY = "myble.promoCode";

/** Codes are typed by hand: uppercase, no spaces, no look-alike confusion. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}
