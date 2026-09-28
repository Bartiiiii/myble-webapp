// ─────────────────────────────────────────────────────────────────────────────
// Quote pipeline — turns a customer Design into a price (§6 landed-cost model).
// ─────────────────────────────────────────────────────────────────────────────
// Design (parts, cm)  →  meble CutParts (mm, geometry-derived edge banding)
//   →  calculatePrice()  →  mebleCostPLN  →  landed CZK  →  × MARKUP  →  sticker.
//
// The markup is applied to LANDED COGS (meble + accessories + packaging), NOT to
// meble cost — so the margin covers every real cost and scales with the design.
// Freight is pass-through (§2, rev. 28 Sep 2026): the customer pays DELIVERY_CZK
// as its own line, and the FREIGHT_COST_CZK − DELIVERY_CZK shortfall is added
// flat to the kit price. Neither is ever marked up. `lib/pricing.ts` is the verified meble cost engine (unchanged); this
// module is the thin Myble layer. All knobs live in lib/pricingConfig.ts.

import {
  calculatePrice,
  type CutPart,
  type EdgeBanding,
  type PricingResult,
} from "./pricing";
import {
  ACCESSORIES_CZK,
  CZ_VAT,
  DELIVERY_CZK,
  FREE_SHIP_CZK,
  FREIGHT_COST_CZK,
  FX_PLN_CZK,
  MARKUP,
  MEBLE_TIER,
  MEBLE_VAT,
  PACKAGING_CZK,
  PAYMENT_FEE_PCT,
  PRICE_FLOOR_CZK,
  PRICING_DEBUG,
  SIDE_TABLE_MAX_H_CM,
  VAT_REGISTERED,
  WTP_CEILING_CZK,
} from "./pricingConfig";
import { type Design, IN_ROOM_DELIVERY_SURCHARGE_CZK, materialId } from "./model";
import { bandedEdges } from "./geometry";
import { drillingPlan, drillSignature } from "./drilling";
import { PRESETS, presetDesign } from "./build";

export interface Quote {
  /** What the customer pays, incl. delivery, in CZK (rounded). Alias: `total`. */
  customerCZK: number;
  /** Customer price for the kit alone (incl. CZ VAT in Stage 2), CZK. Alias: `sticker`. */
  kitCZK: number;
  /** Kit sticker, CZK — same as `kitCZK` (spec name). */
  sticker: number;
  /** kit + delivery, CZK — same as `customerCZK` (spec name). */
  total: number;
  /** Ex-VAT, post-markup, floored & rounded price. Drives delivery + the WTP check.
   *  Equals `sticker` in Stage 1; `sticker` = price × (1 + CZ_VAT) in Stage 2. */
  price: number;
  /** Delivery, in CZK (DELIVERY_CZK, never marked up; + in-room surcharge). */
  deliveryCZK: number;
  /** Landed COGS in CZK (mebleCZK + accessories + packaging). Excludes freight. */
  landedCZK: number;
  /** meble.pl cost only (board + edge + cutting + gluing + drilling), gross PLN. */
  mebleCostPLN: number;
  /** Gross margin implied by the ex-VAT price vs landed cost. */
  marginPct: number;
  /** Whether meble was bought net (Stage 2) — mirrors VAT_REGISTERED. */
  vatRegistered: boolean;
  /** WTP ceiling (consumer CZK) for this design's class, or null if unclassified. */
  wtpCeilingCZK: number | null;
  /** True when the sticker exceeds the WTP ceiling (admin/debug guardrail). */
  exceedsWTP: boolean;
  /** The full verified meble breakdown (admin/export; not shown to customers). */
  pricing: PricingResult;
}

const round0 = (n: number) => Math.round(n);
/** Round up to the next price ending in 90 (…x90 psychological pricing):
 *  1780.3 → 1790, 1790 → 1790, 1790.01 → 1890. */
export const ceilTo90 = (n: number) => Math.ceil((n - 90) / 100) * 100 + 90;

/**
 * Expand a Design into meble cut parts (mm). Edge banding is derived from the
 * geometry (exposed → banded, buried → raw) honouring "don't band the back";
 * parts that sit in a joint are drilled for dowels. Identical parts are grouped
 * → quantity.
 *
 * Two boards may only share a group when their DRILLING matches as well as
 * their size and banding — meble drills a group to one template, so merging the
 * two side walls of a box (mirror-image hole patterns) would send one of them
 * back with its holes on the wrong face. `id` carries the design part ids in the
 * group, so the meble export can find the group's drill rows again.
 */
export function designToCutParts(design: Design): CutPart[] {
  const parts = design.parts;
  if (parts.length === 0) return [];

  const plan = drillingPlan(design);

  const groups = new Map<string, CutPart>();
  const members = new Map<string, string[]>();
  for (const p of parts) {
    const widthMm = Math.round(p.aCm * 10);
    const heightMm = Math.round(p.bCm * 10);
    const banded = bandedEdges(p, design);
    const edgeBanding: EdgeBanding = {
      top: banded.top,
      bottom: banded.bottom,
      left: banded.left,
      right: banded.right,
    };
    const drills = plan.byPart.get(p.id);
    const drilled = !!drills?.length;
    const key = `${widthMm}x${heightMm}|${banded.top}${banded.bottom}${banded.left}${banded.right}|${drillSignature(drills)}`;
    members.set(key, [...(members.get(key) ?? []), p.id]);
    const existing = groups.get(key);
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + 1;
      existing.id = members.get(key)!.join(",");
    } else {
      // `name` carries the role enum (wall|shelf|divider); the cut list maps it to
      // a localized label for display and an English label for the export file.
      groups.set(key, { id: p.id, name: p.role, widthMm, heightMm, quantity: 1, edgeBanding, drilled });
    }
  }
  return [...groups.values()];
}

/** Options to preview a stage/scenario other than the live config (tests, admin). */
export interface PriceOptions {
  /** Override VAT_REGISTERED (Stage 1/2 preview). */
  vatRegistered?: boolean;
  /** WTP ceiling to compare the sticker against (admin guardrail). */
  wtpCeilingCZK?: number | null;
  /** "in-room" adds IN_ROOM_DELIVERY_SURCHARGE_CZK on top of the base delivery fee.
   *  Omitted/"curbside" = no surcharge. Applied even when base delivery is free
   *  (only possible if FREE_SHIP_CZK is re-enabled) — it's a service fee, not
   *  transport cost. */
  deliveryMethod?: "curbside" | "in-room";
}

export interface CzkPrice {
  price: number;
  sticker: number;
  deliveryCZK: number;
  landedCZK: number;
  marginPct: number;
  vatRegistered: boolean;
  wtpCeilingCZK: number | null;
  exceedsWTP: boolean;
}

/**
 * The core §6 formula: gross meble cost (PLN) → landed CZK → markup → + freight
 * shortfall → sticker. Delivery is added after, never marked up. Pure and
 * server-reproducible; every rate comes from pricingConfig.ts.
 */
export function priceFromMeble(mebleCostPLN: number, opts: PriceOptions = {}): CzkPrice {
  const vat = opts.vatRegistered ?? VAT_REGISTERED;
  const mebleCZK = mebleCostPLN * FX_PLN_CZK * (vat ? 1 / (1 + MEBLE_VAT) : 1);
  const landedCZK = mebleCZK + ACCESSORIES_CZK + PACKAGING_CZK;
  // Freight the customer's delivery fee doesn't cover is recovered flat in the
  // kit price: after markup and the fee gross-up, so it is never marked up.
  const freightShortfallCZK = FREIGHT_COST_CZK - DELIVERY_CZK;
  const base = (landedCZK * MARKUP) / (1 - PAYMENT_FEE_PCT) + freightShortfallCZK;
  const price = Math.max(PRICE_FLOOR_CZK, ceilTo90(base));
  const sticker = vat ? round0(price * (1 + CZ_VAT)) : price;
  // FREE_SHIP_CZK = 0 disables free shipping. In-room is a service surcharge, not
  // the base transport fee — it would apply even if free shipping were on.
  const freeShip = FREE_SHIP_CZK > 0 && price >= FREE_SHIP_CZK;
  const baseDeliveryCZK = freeShip ? 0 : DELIVERY_CZK;
  const inRoomSurchargeCZK = opts.deliveryMethod === "in-room" ? IN_ROOM_DELIVERY_SURCHARGE_CZK : 0;
  const deliveryCZK = baseDeliveryCZK + inRoomSurchargeCZK;
  // Margin vs landed COGS plus the freight the kit price carries.
  const marginPct = price > 0 ? (price - landedCZK - freightShortfallCZK) / price : 0;
  const wtpCeilingCZK = opts.wtpCeilingCZK ?? null;
  const exceedsWTP = wtpCeilingCZK != null && sticker > wtpCeilingCZK;
  return { price, sticker, deliveryCZK, landedCZK, marginPct, vatRegistered: vat, wtpCeilingCZK, exceedsWTP };
}

/** WTP ceiling for a design: short pieces are side tables, taller ones shelves. §4. */
function wtpCeilingFor(design: Design): number {
  return design.outerCm.h <= SIDE_TABLE_MAX_H_CM ? WTP_CEILING_CZK.sideTable : WTP_CEILING_CZK.shelf;
}

/** Price a Design end-to-end: meble cost → landed CZK → markup → sticker + delivery. */
export function quoteDesign(design: Design, opts: PriceOptions = {}): Quote {
  const parts = designToCutParts(design);
  // Empty designs have no cost; surface a zero quote rather than throwing.
  if (parts.length === 0) {
    const emptyDeliveryCZK =
      DELIVERY_CZK + (opts.deliveryMethod === "in-room" ? IN_ROOM_DELIVERY_SURCHARGE_CZK : 0);
    return {
      customerCZK: emptyDeliveryCZK,
      kitCZK: 0,
      sticker: 0,
      total: emptyDeliveryCZK,
      price: 0,
      deliveryCZK: emptyDeliveryCZK,
      landedCZK: 0,
      mebleCostPLN: 0,
      marginPct: 0,
      vatRegistered: opts.vatRegistered ?? VAT_REGISTERED,
      wtpCeilingCZK: null,
      exceedsWTP: false,
      pricing: emptyPricing(design),
    };
  }

  const pricing = calculatePrice({
    materialId: materialId(design),
    parts,
    tier: MEBLE_TIER,
    accessoriesPLN: 0, // accessories are a CZK adder now (ACCESSORIES_CZK), not PLN
    marginRate: 0, // markup is applied below, on landed CZK
  });

  const wtpCeilingCZK = opts.wtpCeilingCZK ?? wtpCeilingFor(design);
  const cz = priceFromMeble(pricing.mebleCostPLN, { ...opts, wtpCeilingCZK });

  const quote: Quote = {
    customerCZK: cz.sticker + cz.deliveryCZK,
    kitCZK: cz.sticker,
    sticker: cz.sticker,
    total: cz.sticker + cz.deliveryCZK,
    price: cz.price,
    deliveryCZK: cz.deliveryCZK,
    landedCZK: cz.landedCZK,
    mebleCostPLN: pricing.mebleCostPLN,
    marginPct: cz.marginPct,
    vatRegistered: cz.vatRegistered,
    wtpCeilingCZK: cz.wtpCeilingCZK,
    exceedsWTP: cz.exceedsWTP,
    pricing,
  };

  if (PRICING_DEBUG) {
    const tag = quote.exceedsWTP ? "⚠︎ OVER WTP CEILING" : "ok";
    // eslint-disable-next-line no-console
    console.debug(
      `[pricing] sticker=${quote.sticker} CZK · margin=${(quote.marginPct * 100).toFixed(1)}% · ` +
        `landed=${Math.round(quote.landedCZK)} · meble=${quote.mebleCostPLN} PLN · ` +
        `ceiling=${quote.wtpCeilingCZK ?? "—"} · ${tag}`,
    );
  }

  return quote;
}

function emptyPricing(design: Design): PricingResult {
  return {
    materialId: materialId(design),
    materialLabel: "",
    tier: MEBLE_TIER,
    lines: [],
    mebleCostPLN: 0,
    accessoriesPLN: 0,
    deliveryPLN: 0,
    totalCostPLN: 0,
    marginPLN: 0,
    customerPricePLN: 0,
    detail: {
      boardUnits: 0,
      boardUnitLabel: "",
      edgeActualMetres: 0,
      edgeBilledMetres: 0,
      gluingMetres: 0,
      cuttingMetres: 0,
      cuttingEstimated: true,
      drilledPieces: 0,
    },
    assumptions: [],
  };
}

/** Convenience: the kit sticker (CZK, excl. delivery) — replaces `computePrice`. */
export function quotePrice(design: Design): number {
  return quoteDesign(design).kitCZK;
}

/** Back-compat alias for the old placeholder name; kit sticker, excl. delivery. */
export const computePrice = quotePrice;

// Cheapest typical config per template, for honest "už od" teasers on the home
// page. Computed once at module load through the verified pricing engine.
export const FROM_PRICE: Record<(typeof PRESETS)[number]["id"], number> = {
  police: quotePrice(presetDesign("police")),
  skrinka: quotePrice(presetDesign("skrinka")),
  stolek: quotePrice(presetDesign("stolek")),
};
