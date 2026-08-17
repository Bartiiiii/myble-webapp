// ─────────────────────────────────────────────────────────────────────────────
// Myble pricing config — BARTI OWNS THESE NUMBERS.
// ─────────────────────────────────────────────────────────────────────────────
// `lib/pricing.ts` is the *verified meble.pl cost engine* (do not touch its logic).
// This file holds the Myble business knobs layered on top of that cost, per
// Business/Finance/PRICING_STRATEGY_AND_SYSTEM.md §6 — the landed-cost + markup
// model. Change a number HERE and every price across the app updates.
//
// The pipeline (see lib/quote.ts):
//   mebleCZK = mebleCostPLN × FX × (VAT_REGISTERED ? 1/(1+MEBLE_VAT) : 1)
//   landed   = mebleCZK + ACCESSORIES_CZK + PACKAGING_CZK + INBOUND_ALLOC_CZK
//   base     = landed × MARKUP / (1 − PAYMENT_FEE_PCT)
//   price    = max(PRICE_FLOOR_CZK, ceilTo90(base))
//   sticker  = VAT_REGISTERED ? round(price × (1 + CZ_VAT)) : price
//   delivery = price ≥ FREE_SHIP_CZK ? 0 : DELIVERY_CZK   (DELIVERY_CZK lives in model.ts)

import type { ServiceTier } from "./pricing";

/**
 * PLN → CZK conversion rate. Actual ≈ 5.65 (Jul 2026); we use 5.7 as a small
 * buffer and re-quote quarterly. Every customer price scales linearly with this.
 * TODO(Barti): wire a quarterly re-quote rather than hardcoding long-term. §7.
 */
export const FX_PLN_CZK = 5.7;

/**
 * Markup applied to LANDED CZK cost (not to meble cost). 2.0 = ×2 = 50% gross
 * margin by construction. Launch band: 1.8× (≈44%) → 2.0× (50%) → 2.2× (≈55%).
 * TODO(Barti): 1.8× for the first ~20 orders to buy traction, then 2.0×. §4.
 */
export const MARKUP = 2.0;

/** Hardware kit per order (dowels, glue, connectors), CZK. Plan 20–50. §2. */
export const ACCESSORIES_CZK = 35;

/** Consumer packaging per order (5-layer carton + corner protectors), CZK. §2. */
export const PACKAGING_CZK = 110;

/**
 * PL→CZ inbound freight, batched and allocated per unit, CZK. Batching is a
 * margin REQUIREMENT — single-parcel inbound (~335 CZK) roughly halves margin. §7.
 */
export const INBOUND_ALLOC_CZK = 130;

/** Payment-processor fee as a fraction of price (Comgate EU cards). §2. */
export const PAYMENT_FEE_PCT = 0.018;

/** Minimum sellable kit price, CZK — keeps tiny designs above break-even. §4. */
export const PRICE_FLOOR_CZK = 1490;

/** Free delivery at/above this ex-VAT price, CZK — nudges basket size. §4. */
export const FREE_SHIP_CZK = 3000;

// --- VAT staging (§5) --------------------------------------------------------
/**
 * Stage 1 (false): pay meble GROSS, charge no separate VAT (small-business regime).
 * Stage 2 (true):  buy meble NET (÷(1+MEBLE_VAT) via intra-EU reverse charge) and
 *                  quote the consumer price incl. CZ VAT. Net effect: ~15% more
 *                  margin at the same sticker. Flip this once VAT-registered. §5.
 * TODO(Barti): confirm reverse-charge mechanics with a Czech accountant first.
 */
export const VAT_REGISTERED = false;

/** Czech standard VAT (2026), added to the sticker in Stage 2. §5. */
export const CZ_VAT = 0.21;

/** meble.pl prices are gross incl. 23% PL VAT; this is the divisor to buy net. §5. */
export const MEBLE_VAT = 0.23;

// --- WTP guardrail (admin/debug only — never shown to customers) -------------
/**
 * Market ceilings (consumer sticker, CZK). A design whose price exceeds its
 * ceiling isn't viable at target margin yet — flag it in the admin/debug view so
 * it can be simplified or accept a lower margin. §4 "WTP guardrail".
 */
export const WTP_CEILING_CZK = { sideTable: 2490, shelf: 3490 } as const;

/** A design shorter than this (outer height, cm) is treated as a side table for
 *  the WTP guardrail; taller pieces use the shelf ceiling. */
export const SIDE_TABLE_MAX_H_CM = 60;

/**
 * When on, quote() logs marginPct and flags over-ceiling designs to the console,
 * and the design price panel shows a debug row. Off in production. Enable with
 * NEXT_PUBLIC_PRICING_DEBUG=1.
 */
export const PRICING_DEBUG = process.env.NEXT_PUBLIC_PRICING_DEBUG === "1";

/**
 * meble.pl service tier the quote is priced at. "premium" = white glue,
 * invisible seams, 0.3 mm precision (what the verified engine was calibrated at).
 */
export const MEBLE_TIER: ServiceTier = "premium";
