/**
 * Myble — meble.pl cost & price calculator
 * =========================================
 * Estimates what meble.pl will charge for a cut-to-size ("rozkrój on-line") order,
 * then adds Myble's own costs and margin to produce a customer-facing price.
 *
 * The cost model is reverse-engineered from:
 *   1. Barti's spreadsheet ("Price Calculator" sheet) — 19 white-18mm cases plus
 *      black-18 / white-36 / black-36 spot checks, all 400×400 mm pieces.
 *   2. Live verification on https://www.meble.pl/rozkroj (June 2026): two non-square
 *      cases (4×600×300, 1×2000×400) used to confirm rates and calibrate cutting.
 *
 * What is EXACT (matches meble to the unit):
 *   - Board billing (geometric quarter-cell / sheet model)
 *   - Edge-banding material metres
 *   - Edge-gluing metres
 *   - Drilling
 *   - All unit prices (PLN/m, PLN/piece, board fractions)
 *
 * What is ESTIMATED (meble runs a proprietary nesting optimiser we can't replicate
 * exactly): the CUTTING metres. Our estimator is calibrated to all known data points
 * and biased slightly high so Myble never under-prices. For an exact figure on a real
 * order, paste meble's "Cięcie" number into `cuttingMetresOverride`.
 *
 * All prices are meble.pl GROSS (brutto, incl. 23% PL VAT) — i.e. what Barti actually pays.
 * All dimensions are in millimetres.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MaterialId = "white_18" | "black_18" | "white_36" | "black_36";

/** Service tier on meble.pl. "premium" = white glue on white boards, 0.3 mm precision,
 *  5-day lead time (this is what the spreadsheet was priced at). "standard" = neutral
 *  glue, 0.5 mm precision, 3-day lead time, slightly cheaper (less cutting/edge buffer). */
export type ServiceTier = "premium" | "standard";

/** Which of a part's four edges get banded. Omit = all four banded. */
export interface EdgeBanding {
  /** top edge, runs the length of `widthMm` */
  top?: boolean;
  /** bottom edge, runs the length of `widthMm` */
  bottom?: boolean;
  /** left edge, runs the length of `heightMm` */
  left?: boolean;
  /** right edge, runs the length of `heightMm` */
  right?: boolean;
}

export interface CutPart {
  id?: string;
  name?: string;
  /** Width in mm (one face dimension). */
  widthMm: number;
  /** Height in mm (the other face dimension). */
  heightMm: number;
  /** How many identical pieces (default 1). */
  quantity?: number;
  /** Which edges to band. Omit = band all 4 edges. Pass {} for no banding. */
  edgeBanding?: EdgeBanding;
  /** Does this part get a drilling template on meble (default false)? Charged per piece. */
  drilled?: boolean;
}

export interface PricingInput {
  materialId: MaterialId;
  parts: CutPart[];
  /** Service tier (default "premium"). */
  tier?: ServiceTier;
  /** Override the cutting estimate with meble's exact "Cięcie" metres, if known. */
  cuttingMetresOverride?: number;
  /** Myble's own accessories cost (dowels, glue, instruction, packaging). Default 20 PLN. */
  accessoriesPLN?: number;
  /** Delivery to the customer (pass-through, not marked up). Default 0. */
  deliveryPLN?: number;
  /** Myble margin on (meble cost + accessories). e.g. 0.5 = +50%. Default 0. */
  marginRate?: number;
}

export interface PriceLine {
  label: string;
  quantity: number;
  unit: string;
  unitPricePLN: number;
  totalPLN: number;
  note?: string;
}

export interface PricingResult {
  materialId: MaterialId;
  materialLabel: string;
  tier: ServiceTier;
  lines: PriceLine[];
  /** meble.pl cost only (board + edge + cutting + gluing + drilling). */
  mebleCostPLN: number;
  accessoriesPLN: number;
  deliveryPLN: number;
  /** mebleCost + accessories + delivery, before margin. */
  totalCostPLN: number;
  marginPLN: number;
  /** What Myble charges the customer. */
  customerPricePLN: number;
  /** Derived quantities, for debugging / display. */
  detail: {
    boardUnits: number;
    boardUnitLabel: string;
    edgeActualMetres: number;
    edgeBilledMetres: number;
    gluingMetres: number;
    cuttingMetres: number;
    cuttingEstimated: boolean;
    drilledPieces: number;
  };
  assumptions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Material presets (all rates verified against spreadsheet + live meble.pl)
// ─────────────────────────────────────────────────────────────────────────────

interface MaterialPreset {
  id: MaterialId;
  label: string;
  thickness: 18 | 36;
  /** Board billing unit. 18 mm bills per 1397×1032 quarter-cell; 36 mm per whole 2800×1032 sheet. */
  boardUnit: { widthMm: number; heightMm: number; pricePLN: number; label: string };
  /** Edge-band tape: 0.8 mm on most boards, 2 mm on white-36. */
  edgeRatePLNPerM: number;
  /** "Cięcie" cutting rate. */
  cutRatePLNPerM: number;
  /** Minimum billed cutting metres (a floor meble applies to tiny orders). */
  minCutMetres: number;
  /** "Oklejanie" edge-gluing rate. */
  glueRatePLNPerM: number;
  /** Drilling per drilled piece. */
  drillPLNPerPiece: number;
  /** Rounding family for edge-band material metres. */
  edgeRounding: "mm18" | "mm36";
}

const MATERIALS: Record<MaterialId, MaterialPreset> = {
  white_18: {
    id: "white_18",
    label: "White board 18 mm (Kronospan U8685 BS Biel Alpejska)",
    thickness: 18,
    boardUnit: { widthMm: 1397, heightMm: 1032, pricePLN: 40, label: "¼ board (1397×1032)" },
    edgeRatePLNPerM: 1.41,
    cutRatePLNPerM: 1.5,
    minCutMetres: 5,
    glueRatePLNPerM: 2.5,
    drillPLNPerPiece: 14.76,
    edgeRounding: "mm18",
  },
  black_18: {
    id: "black_18",
    label: "Black board 18 mm (EGGER U999 ST7 Czarny)",
    thickness: 18,
    boardUnit: { widthMm: 1397, heightMm: 1032, pricePLN: 62.56, label: "¼ board (1397×1032)" },
    edgeRatePLNPerM: 2.04,
    cutRatePLNPerM: 4.92,
    minCutMetres: 5,
    glueRatePLNPerM: 8.61,
    drillPLNPerPiece: 14.76,
    edgeRounding: "mm18",
  },
  white_36: {
    id: "white_36",
    label: "White board 36 mm (Kronospan WU8685 BS)",
    thickness: 36,
    boardUnit: { widthMm: 2800, heightMm: 1032, pricePLN: 277.29, label: "whole 2800×1032 sheet" },
    edgeRatePLNPerM: 7.52, // 2 mm tape
    cutRatePLNPerM: 8.61,
    minCutMetres: 9,
    glueRatePLNPerM: 8.61,
    drillPLNPerPiece: 14.76,
    edgeRounding: "mm36",
  },
  black_36: {
    id: "black_36",
    label: "Black board 36 mm (EGGER U999 ST7 Czarny)",
    thickness: 36,
    boardUnit: { widthMm: 2800, heightMm: 1032, pricePLN: 367.54, label: "whole 2800×1032 sheet" },
    edgeRatePLNPerM: 5.52,
    cutRatePLNPerM: 8.61,
    minCutMetres: 9,
    glueRatePLNPerM: 8.61,
    drillPLNPerPiece: 14.76,
    edgeRounding: "mm36",
  },
};

// Cutting estimator constants (calibrated — see pricing.test.ts).
const CUT_SCALAR = 1.1; // PLN-metres per metre of Σ(length+width)
const CUT_BOARD_CONST = 1.5; // per board unit (quarter-cell / sheet)
const CUT_BASE: Record<ServiceTier, number> = { premium: 2.1, standard: 1.1 };

export function listMaterials(): { id: MaterialId; label: string }[] {
  return Object.values(MATERIALS).map((m) => ({ id: m.id, label: m.label }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers — board nesting
// ─────────────────────────────────────────────────────────────────────────────

interface Rect { w: number; h: number }

/** Does a rectangle fit inside a cell in either orientation? */
function fitsCell(w: number, h: number, cellW: number, cellH: number): boolean {
  return (w <= cellW && h <= cellH) || (h <= cellW && w <= cellH);
}

/**
 * Shelf / guillotine first-fit-decreasing bin packer.
 * Packs rectangles into fixed bins of binW × binH and returns the number of bins used.
 * Reproduces meble's observed densities: six 400×400 per ¼-cell, four 600×300 per ¼-cell, etc.
 */
function packBins(rects: Rect[], binW: number, binH: number): number {
  const sorted = [...rects].sort(
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h
  );

  interface Shelf { height: number; usedW: number }
  interface Bin { shelves: Shelf[]; usedH: number }
  const bins: Bin[] = [];

  const tryPlace = (bin: Bin, r: Rect): boolean => {
    const orients: Rect[] = [{ w: r.w, h: r.h }, { w: r.h, h: r.w }];
    // 1) existing shelf
    for (const sh of bin.shelves) {
      for (const o of orients) {
        if (o.h <= sh.height && o.w <= binW - sh.usedW) {
          sh.usedW += o.w;
          return true;
        }
      }
    }
    // 2) new shelf (place tallest-fitting orientation that still leaves vertical room)
    for (const o of orients) {
      if (o.w <= binW && bin.usedH + o.h <= binH) {
        bin.shelves.push({ height: o.h, usedW: o.w });
        bin.usedH += o.h;
        return true;
      }
    }
    return false;
  };

  for (const r of sorted) {
    let placed = false;
    for (const bin of bins) {
      if (tryPlace(bin, r)) { placed = true; break; }
    }
    if (!placed) {
      const bin: Bin = { shelves: [], usedH: 0 };
      if (!tryPlace(bin, r)) {
        throw new Error(
          `Part ${r.w}×${r.h} mm does not fit the board unit (${binW}×${binH} mm).`
        );
      }
      bins.push(bin);
    }
  }
  return bins.length;
}

/** Minimum number of quarter-cells an oversized part spans. */
function cellsForOversized(w: number, h: number, cellW: number, cellH: number): number {
  const a = Math.ceil(w / cellW) * Math.ceil(h / cellH);
  const b = Math.ceil(h / cellW) * Math.ceil(w / cellH);
  return Math.min(a, b);
}

/** Count billed board units (¼-cells for 18 mm, whole sheets for 36 mm). */
function countBoardUnits(rects: Rect[], m: MaterialPreset): number {
  const { widthMm: uW, heightMm: uH } = m.boardUnit;

  if (m.thickness === 36) {
    // 36 mm is sold only as whole 2800×1032 sheets.
    for (const r of rects) {
      if (!fitsCell(r.w, r.h, uW, uH)) {
        throw new Error(
          `Part ${r.w}×${r.h} mm does not fit a 36 mm sheet (${uW}×${uH} mm).`
        );
      }
    }
    return packBins(rects, uW, uH);
  }

  // 18 mm: bill per quarter-cell. Normal parts are packed into cells; oversized parts
  // (too big for one cell) consume a dedicated block of adjacent cells.
  const normal: Rect[] = [];
  let oversizedCells = 0;
  for (const r of rects) {
    if (fitsCell(r.w, r.h, uW, uH)) normal.push(r);
    else {
      // must still fit within a 2×2 cell block (= one full 2800×2070 board)
      const cells = cellsForOversized(r.w, r.h, uW, uH);
      if (cells > 4) {
        throw new Error(`Part ${r.w}×${r.h} mm is larger than a full 18 mm board.`);
      }
      oversizedCells += cells;
    }
  }
  const normalCells = normal.length ? packBins(normal, uW, uH) : 0;
  return normalCells + oversizedCells;
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge / gluing / cutting metre formulas
// ─────────────────────────────────────────────────────────────────────────────

/** Billed edge-band material metres from the actual banded length (metres). */
function edgeBilledMetres(actualM: number, m: MaterialPreset, tier: ServiceTier): number {
  if (actualM <= 0) return 0;
  if (m.edgeRounding === "mm18") {
    return tier === "premium"
      ? Math.max(10, Math.ceil(actualM / 5) * 5 + 5) // round up to 5 m, + 5 m buffer
      : Math.max(5, Math.ceil(actualM / 5) * 5);
  }
  // 36 mm (verified on premium; reused for standard)
  return Math.max(6, Math.round(actualM + 4));
}

/** Billed gluing metres = banded length rounded up to the next whole metre. */
function gluingMetres(actualM: number): number {
  return actualM > 0 ? Math.ceil(actualM) : 0;
}

/** Estimated cutting metres (see file header — this is the one inexact component). */
function estimateCuttingMetres(
  sumLWMetres: number,
  boardUnits: number,
  m: MaterialPreset,
  tier: ServiceTier
): number {
  const est = CUT_SCALAR * sumLWMetres + CUT_BOARD_CONST * boardUnits + CUT_BASE[tier];
  return Math.max(m.minCutMetres, Math.ceil(est));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export function calculatePrice(input: PricingInput): PricingResult {
  const m = MATERIALS[input.materialId];
  if (!m) throw new Error(`Unknown material: ${input.materialId}`);
  const tier: ServiceTier = input.tier ?? "premium";

  const parts = validateAndNormalise(input.parts);

  // Expand to individual rectangles for nesting.
  const rects: Rect[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.quantity; i++) rects.push({ w: p.widthMm, h: p.heightMm });
  }

  // 1) Board.
  const boardUnits = countBoardUnits(rects, m);
  const boardCost = round2(boardUnits * m.boardUnit.pricePLN);

  // 2) Edge banding (material) + 3) gluing.
  let edgeActualMm = 0;
  for (const p of parts) {
    const e = p.edgeBanding ?? { top: true, bottom: true, left: true, right: true };
    let per = 0;
    if (e.top) per += p.widthMm;
    if (e.bottom) per += p.widthMm;
    if (e.left) per += p.heightMm;
    if (e.right) per += p.heightMm;
    edgeActualMm += per * p.quantity;
  }
  const edgeActualM = edgeActualMm / 1000;
  const edgeBilled = edgeBilledMetres(edgeActualM, m, tier);
  const edgeCost = round2(edgeBilled * m.edgeRatePLNPerM);
  const glueM = gluingMetres(edgeActualM);
  const glueCost = round2(glueM * m.glueRatePLNPerM);

  // 4) Cutting.
  let sumLWMm = 0;
  for (const p of parts) sumLWMm += (p.widthMm + p.heightMm) * p.quantity;
  const sumLWMetres = sumLWMm / 1000;
  const cuttingEstimated = input.cuttingMetresOverride === undefined;
  const cuttingMetres = cuttingEstimated
    ? estimateCuttingMetres(sumLWMetres, boardUnits, m, tier)
    : input.cuttingMetresOverride!;
  const cuttingCost = round2(cuttingMetres * m.cutRatePLNPerM);

  // 5) Drilling.
  let drilledPieces = 0;
  for (const p of parts) if (p.drilled) drilledPieces += p.quantity;
  const drillCost = round2(drilledPieces * m.drillPLNPerPiece);

  // Assemble line items.
  const lines: PriceLine[] = [
    {
      label: "Board material",
      quantity: boardUnits,
      unit: m.boardUnit.label,
      unitPricePLN: m.boardUnit.pricePLN,
      totalPLN: boardCost,
    },
  ];
  if (edgeBilled > 0) {
    lines.push({
      label: "Edge banding material",
      quantity: edgeBilled,
      unit: "m",
      unitPricePLN: m.edgeRatePLNPerM,
      totalPLN: edgeCost,
      note: `actual banded ${edgeActualM.toFixed(2)} m`,
    });
  }
  lines.push({
    label: "Cutting",
    quantity: cuttingMetres,
    unit: "m",
    unitPricePLN: m.cutRatePLNPerM,
    totalPLN: cuttingCost,
    note: cuttingEstimated ? "estimated (see cuttingMetresOverride for exact)" : "manual override",
  });
  if (glueM > 0) {
    lines.push({
      label: "Edge gluing",
      quantity: glueM,
      unit: "m",
      unitPricePLN: m.glueRatePLNPerM,
      totalPLN: glueCost,
    });
  }
  if (drilledPieces > 0) {
    lines.push({
      label: "Drilling",
      quantity: drilledPieces,
      unit: "piece",
      unitPricePLN: m.drillPLNPerPiece,
      totalPLN: drillCost,
    });
  }

  const mebleCostPLN = round2(boardCost + edgeCost + cuttingCost + glueCost + drillCost);
  const accessoriesPLN = input.accessoriesPLN ?? 20;
  const deliveryPLN = input.deliveryPLN ?? 0;
  const marginBase = round2(mebleCostPLN + accessoriesPLN);
  const marginRate = input.marginRate ?? 0;
  const marginPLN = round2(marginBase * marginRate);
  const totalCostPLN = round2(mebleCostPLN + accessoriesPLN + deliveryPLN);
  const customerPricePLN = round2(marginBase + marginPLN + deliveryPLN);

  lines.push({
    label: "Accessories / instruction / packaging (Myble)",
    quantity: 1,
    unit: "fixed",
    unitPricePLN: accessoriesPLN,
    totalPLN: accessoriesPLN,
  });
  if (deliveryPLN > 0) {
    lines.push({
      label: "Delivery (pass-through)",
      quantity: 1,
      unit: "fixed",
      unitPricePLN: deliveryPLN,
      totalPLN: deliveryPLN,
    });
  }

  return {
    materialId: m.id,
    materialLabel: m.label,
    tier,
    lines,
    mebleCostPLN,
    accessoriesPLN,
    deliveryPLN,
    marginPLN,
    totalCostPLN,
    customerPricePLN,
    detail: {
      boardUnits,
      boardUnitLabel: m.boardUnit.label,
      edgeActualMetres: round2(edgeActualM),
      edgeBilledMetres: edgeBilled,
      gluingMetres: glueM,
      cuttingMetres,
      cuttingEstimated,
      drilledPieces,
    },
    assumptions: [
      "Prices are meble.pl GROSS (incl. 23% PL VAT) — what Myble pays.",
      `Service tier: ${tier}. Board, edge, gluing, drilling and all rates are exact.`,
      cuttingEstimated
        ? "Cutting metres are ESTIMATED (meble's nesting optimiser is proprietary); calibrated and biased slightly high."
        : "Cutting metres were supplied manually (exact).",
      "Dimensions in mm. 18 mm bills per ¼-cell (1397×1032); 36 mm per whole 2800×1032 sheet.",
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

type NormalisedPart = CutPart & { quantity: number };

function validateAndNormalise(parts: CutPart[]): NormalisedPart[] {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("At least one part is required.");
  }
  return parts.map((p) => {
    if (!(p.widthMm > 0) || !(p.heightMm > 0)) {
      throw new Error(`Invalid dimensions for part ${p.name ?? p.id ?? "?"}.`);
    }
    const quantity = p.quantity ?? 1;
    if (!(quantity > 0) || !Number.isInteger(quantity)) {
      throw new Error(`Invalid quantity for part ${p.name ?? p.id ?? "?"}.`);
    }
    return { ...p, quantity };
  });
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
