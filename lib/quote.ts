// ─────────────────────────────────────────────────────────────────────────────
// Quote pipeline — turns a customer Design into a price (§6 landed-cost model).
// ─────────────────────────────────────────────────────────────────────────────
// Design (parts, cm)  →  meble CutParts (mm, geometry-derived edge banding)
//   →  calculatePrice()  →  mebleCostPLN  →  landed CZK  →  × MARKUP  →  sticker.
//
// The markup is applied to LANDED COGS (meble + accessories + packaging + inbound),
// NOT to meble cost — so the margin covers every real cost and scales with the
// design. `lib/pricing.ts` is the verified meble cost engine (unchanged); this
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
  FREE_SHIP_CZK,
  FX_PLN_CZK,
  INBOUND_ALLOC_CZK,
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
import { type Design, DELIVERY_CZK, IN_ROOM_DELIVERY_SURCHARGE_CZK, materialId } from "./model";
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
  /** Delivery, in CZK (free at/above FREE_SHIP_CZK). */
  deliveryCZK: number;
  /** Landed COGS in CZK (mebleCZK + accessories + packaging + inbound). */
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
  /** The full verified meble breakdown, for the expandable price panel. */
  pricing: PricingResult;
}

const round0 = (n: number) => Math.round(n);
/** Round up to the nearest 90 (…x90 psychological pricing + margin cushion). */
export const ceilTo90 = (n: number) => Math.ceil(n / 90) * 90;

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
   *  (order qualifies for FREE_SHIP_CZK) — it's a service fee, not transport cost.
   *  FLAG FOR BARTI: confirm this free-shipping interaction is the intended
   *  business rule before shipping — see note in priceFromMeble below. */
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
 * The core §6 formula: gross meble cost (PLN) → landed CZK → markup → sticker.
 * Pure and server-reproducible; every rate comes from pricingConfig.ts.
 */
export function priceFromMeble(mebleCostPLN: number, opts: PriceOptions = {}): CzkPrice {
  const vat = opts.vatRegistered ?? VAT_REGISTERED;
  const mebleCZK = mebleCostPLN * FX_PLN_CZK * (vat ? 1 / (1 + MEBLE_VAT) : 1);
  const landedCZK = mebleCZK + ACCESSORIES_CZK + PACKAGING_CZK + INBOUND_ALLOC_CZK;
  const base = (landedCZK * MARKUP) / (1 - PAYMENT_FEE_PCT);
  const price = Math.max(PRICE_FLOOR_CZK, ceilTo90(base));
  const sticker = vat ? round0(price * (1 + CZ_VAT)) : price;
  // In-room is a service surcharge, not the base transport fee — it applies even
  // when the order qualifies for free curbside shipping (FREE_SHIP_CZK).
  const baseDeliveryCZK = price >= FREE_SHIP_CZK ? 0 : DELIVERY_CZK;
  const inRoomSurchargeCZK = opts.deliveryMethod === "in-room" ? IN_ROOM_DELIVERY_SURCHARGE_CZK : 0;
  const deliveryCZK = baseDeliveryCZK + inRoomSurchargeCZK;
  const marginPct = price > 0 ? (price - landedCZK) / price : 0;
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

export interface BreakdownLine {
  /** i18n key under `breakdown.*`. */
  key: string;
  czk: number;
  estimate?: boolean;
}

// meble line label → i18n key. Lines not listed are hidden (accessories are added
// separately below as a CZK adder, so the meble "accessories" line is dropped).
const LINE_KEYS: Record<string, string> = {
  "Board material": "board",
  "Edge banding material": "edge",
  Cutting: "cutting",
  "Edge gluing": "gluing",
  Drilling: "drilling",
};

/**
 * The price broken into CZK components for the expandable panel, reading top to
 * bottom as: meble breakdown → landed adders (accessories/packaging/inbound) →
 * margin & fees → kit sticker. Every meble line is converted at the same
 * meble→CZK factor (net in Stage 2); the margin line absorbs markup, the payment
 * fee, rounding and any Stage-2 VAT uplift, so the components sum EXACTLY to the
 * kit sticker.
 */
export function breakdownCZK(q: Quote): BreakdownLine[] {
  if (q.mebleCostPLN <= 0) return [];
  // meble net-or-gross CZK = landed minus the three fixed CZK adders.
  const mebleCZK = q.landedCZK - ACCESSORIES_CZK - PACKAGING_CZK - INBOUND_ALLOC_CZK;
  const factor = q.mebleCostPLN > 0 ? mebleCZK / q.mebleCostPLN : 0;

  const lines: BreakdownLine[] = q.pricing.lines
    .filter((l) => LINE_KEYS[l.label] !== undefined)
    .map((l) => ({
      key: LINE_KEYS[l.label],
      czk: Math.round(l.totalPLN * factor),
      estimate: l.label === "Cutting" && q.pricing.detail.cuttingEstimated,
    }));

  lines.push({ key: "accessories", czk: ACCESSORIES_CZK });
  lines.push({ key: "packaging", czk: PACKAGING_CZK });
  lines.push({ key: "inbound", czk: INBOUND_ALLOC_CZK });

  // Margin & fees closes the gap to the sticker so the panel always foots exactly.
  const sumSoFar = lines.reduce((n, l) => n + l.czk, 0);
  lines.push({ key: "margin", czk: q.sticker - sumSoFar });

  return lines;
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
