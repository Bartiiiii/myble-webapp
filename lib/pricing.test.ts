import { describe, it, expect } from "vitest";
import { calculatePrice } from "./pricing";

// Verified meble.pl anchors (live rozkrój, June 2026 — see pricing.ts header).
// Feeding meble's exact "Cięcie" metres via cuttingMetresOverride must reproduce
// the gross meble cost to the cent. This proves board / edge / gluing / drilling
// and every rate are exact; only the cutting estimate is approximate.
describe("pricing.ts reproduces verified meble totals (cutting overridden)", () => {
  it("white_18 · 4×600×300 (live #17617409) → 91.65 PLN", () => {
    const r = calculatePrice({
      materialId: "white_18",
      parts: [{ name: "600x300", widthMm: 600, heightMm: 300, quantity: 4 }],
      tier: "premium",
      cuttingMetresOverride: 7,
      accessoriesPLN: 0,
      deliveryPLN: 0,
    });
    expect(r.mebleCostPLN).toBeCloseTo(91.65, 2);
    expect(r.detail.boardUnits).toBe(1);
    expect(r.detail.edgeBilledMetres).toBe(15);
    expect(r.detail.gluingMetres).toBe(8);
  });

  it("white_18 · 1×2000×400 (live #17617427) → 117.10 PLN", () => {
    const r = calculatePrice({
      materialId: "white_18",
      parts: [{ name: "2000x400", widthMm: 2000, heightMm: 400, quantity: 1 }],
      tier: "premium",
      cuttingMetresOverride: 7,
      accessoriesPLN: 0,
      deliveryPLN: 0,
    });
    expect(r.mebleCostPLN).toBeCloseTo(117.1, 2);
    expect(r.detail.boardUnits).toBe(2);
    expect(r.detail.edgeBilledMetres).toBe(10);
    expect(r.detail.gluingMetres).toBe(5);
  });

  it("spreadsheet anchor: white_18 · 1×400² drilled+banded → 81.36 PLN", () => {
    const r = calculatePrice({
      materialId: "white_18",
      parts: [{ name: "400x400", widthMm: 400, heightMm: 400, quantity: 1, drilled: true }],
      tier: "premium",
      cuttingMetresOverride: 5,
      accessoriesPLN: 0,
      deliveryPLN: 0,
    });
    expect(r.mebleCostPLN).toBeCloseTo(81.36, 2);
    expect(r.detail.drilledPieces).toBe(1);
  });

  it("the cutting estimate (no override) is biased slightly high, not low", () => {
    const est = calculatePrice({
      materialId: "white_18",
      parts: [{ name: "600x300", widthMm: 600, heightMm: 300, quantity: 4 }],
      tier: "premium",
      accessoriesPLN: 0,
      deliveryPLN: 0,
    });
    expect(est.detail.cuttingEstimated).toBe(true);
    expect(est.detail.cuttingMetres).toBeGreaterThanOrEqual(7);
  });
});
