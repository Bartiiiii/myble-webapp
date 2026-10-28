// ─────────────────────────────────────────────────────────────────────────────
// Myble pricing config — BARTI OWNS THESE NUMBERS.
// ─────────────────────────────────────────────────────────────────────────────
// `lib/pricing.ts` is the *verified meble.pl cost engine* (do not touch its logic).
// This file holds the Myble business knobs layered on top of that cost, per
// Business/Finance/PRICING_STRATEGY_AND_SYSTEM.md §6 — the landed-cost + markup
// model, with freight as pass-through per §2 (revised 28 Sep 2026). Change a
// number HERE and every price across the app updates.
//
// The pipeline (see lib/quote.ts):
//   mebleCZK = mebleCostPLN × FX × (VAT_REGISTERED ? 1/(1+MEBLE_VAT) : 1)
//   landed   = mebleCZK + ACCESSORIES_CZK + PACKAGING_CZK
//   base     = landed × MARKUP / (1 − PAYMENT_FEE_PCT) + (FREIGHT_COST_CZK − DELIVERY_CZK)
//   price    = max(PRICE_FLOOR_CZK, ceilTo90(base))       (ceilTo90: up to the next …90)
//   sticker  = VAT_REGISTERED ? round(price × (1 + CZ_VAT)) : price
//   delivery = DELIVERY_CZK, never marked up (free once price − discount ≥ FREE_SHIP_CZK > 0)

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

/**
 * Hardware kit per order, CZK. Verified ~34: 20 dowels 11.3, 30 g D3 glue 9.5,
 * applicator 6, guide/filler/label 7. §2.
 */
export const ACCESSORIES_CZK = 35;

/**
 * Hardware carton only, CZK. Under drop-ship meble.pl packs the panels, so we
 * only box the hardware kit: klopová krabice 3VVL 200×150×100, 4.96 Kč/ks ex VAT
 * from 25 pcs = 6.00 incl. VAT. §2.
 */
export const PACKAGING_CZK = 6;

/**
 * @deprecated Drop-ship means there is no inbound leg into a Myble hub: panels
 * go PL→CZ straight to the customer, and that cost lives in FREIGHT_COST_CZK.
 * Kept at 0 so nothing adds a phantom inbound cost. §2.
 */
export const INBOUND_ALLOC_CZK = 0;

/**
 * True freight per order, CZK. Pass-through: NEVER marked up. §2.
 *   570  panels PL→CZ direct to customer (meble.pl, 100 PLN GLS × FX 5.7)
 * + 105  hardware parcel (Balíkovna to address, registered)
 */
export const FREIGHT_COST_CZK = 675;

/**
 * Delivery charged to the customer, CZK, shown as its own line and never marked
 * up. The FREIGHT_COST_CZK − DELIVERY_CZK shortfall (176) is recovered flat in
 * the kit price, not absorbed. §2.
 */
export const DELIVERY_CZK = 499;

/** Payment-processor fee as a fraction of price (Comgate EU cards). §2. */
export const PAYMENT_FEE_PCT = 0.018;

/** Minimum sellable kit price, CZK — keeps tiny designs above break-even. §4. */
export const PRICE_FLOOR_CZK = 1490;

/** Free delivery when the kit price (ex-VAT, after any discount) reaches this,
 *  CZK. 0 = free shipping disabled. Set to 10 000 on 4 Oct 2026 (Barti): the
 *  waived 499 is under 5% of the order, so a free-delivery order still keeps
 *  ~43% gross margin at MARKUP 2.0. (5 000 was tried first: ~37%.) */
export const FREE_SHIP_CZK = 10000;

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
