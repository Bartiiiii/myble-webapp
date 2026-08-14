// Calculation-module fixtures (implementation task 12): hand-computed worked
// examples, conservative-bound selection, and packaging determinism.

import { describe, expect, it } from "vitest";
import rawCatalogue from "./catalogue/catalogue.v1.1.0.json";
import { enforcedSagLimitMm, sagLimitMm, shelfDeflection } from "./calc/deflection";
import { doorMassKg, materialDensity, partMassKg } from "./calc/mass";
import { carrierFor, packDesign, PACK_TARGET_KG } from "./calc/packaging";
import { tippingMargin } from "./calc/tipping";
import { loadCatalogue } from "./loader";
import { DEFAULT_CARRIER_PROFILES } from "./profiles";
import { makeValidBedside, part } from "./__tests__/fixtures";
import { clone, RULE_CASES } from "./__tests__/violated-cases";

const catalogue = loadCatalogue(rawCatalogue);
const materials = new Map(catalogue.materials.map((m) => [m.material_id, m]));
const board = materials.get("ltd_18_p2")!;

describe("deflection.ts", () => {
  it("matches the hand-computed 800×300×18 book-load fixture to 0.01 mm", () => {
    // w = 65 kg/m² × 0.8 m × 0.3 m × 9.81 / 800 mm = 0.191295 N/mm
    // I = 300 × 18³ / 12 = 145 800 mm⁴
    // δ = 5wL⁴/(384EI) = 3.91772e11 / 8.95795e10 = 4.3735 mm
    const { delta_mm, I_mm4, w_N_per_mm } = shelfDeflection({
      span_mm: 800,
      depth_mm: 300,
      thickness_mm: 18,
      moe_Nmm2: 1600,
      load_kg_m2: 65,
    });
    expect(I_mm4).toBe(145800);
    expect(w_N_per_mm).toBeCloseTo(0.191295, 6);
    expect(delta_mm).toBeCloseTo(4.3735, 2);
  });

  it("applies the sag limit at 60 % while the creep factor is unvalidated", () => {
    expect(sagLimitMm(800)).toBeCloseTo(4.0, 6); // min(4.533, 4.0)
    const { limit_mm, conservative_mode } = enforcedSagLimitMm(800);
    expect(conservative_mode).toBe(true);
    expect(limit_mm).toBeCloseTo(2.4, 6);
  });

  it("is monotonic: increasing span never decreases deflection", () => {
    let previous = -Infinity;
    for (let span = 300; span <= 900; span += 50) {
      const { delta_mm } = shelfDeflection({ span_mm: span, depth_mm: 300, thickness_mm: 18, moe_Nmm2: 1600, load_kg_m2: 65 });
      expect(delta_mm).toBeGreaterThanOrEqual(previous);
      previous = delta_mm;
    }
  });

  it("rejects non-positive inputs", () => {
    expect(() => shelfDeflection({ span_mm: 0, depth_mm: 300, thickness_mm: 18, moe_Nmm2: 1600, load_kg_m2: 65 })).toThrow();
  });
});

describe("mass.ts", () => {
  it("uses the provisional density range bounds explicitly", () => {
    expect(materialDensity(board, "upper")).toBe(680);
    expect(materialDensity(board, "lower")).toBe(600);
  });

  it("computes part mass = volume × density", () => {
    const p = part("x", "shelf_fixed", 800, 300);
    expect(partMassKg(p, board, "upper")).toBeCloseTo(0.8 * 0.3 * 0.018 * 680, 6); // 2.9376 kg
    expect(partMassKg(p, board, "lower")).toBeCloseTo(2.592, 6);
  });

  it("throws on materials without any density data (fail closed)", () => {
    // v1.1.0 gives every shipped material a density (range), so synthesise a
    // material with none to exercise the fail-closed path.
    const noDensity = { material_id: "x", names: {}, nominal_thickness_mm: 18 } as unknown as typeof board;
    const p = part("b", "back", 600, 600);
    expect(() => partMassKg(p, noDensity, "upper")).toThrow(/density/);
  });

  it("door mass uses the upper bound (conservative for hinge count)", () => {
    expect(doorMassKg(500, 700, 18, board)).toBeCloseTo(0.5 * 0.7 * 0.018 * 680, 6);
  });
});

describe("tipping.ts", () => {
  const stabRule = catalogue.rules.find((r) => r.rule_id === "STAB-CALC-003")!;
  const tippy = RULE_CASES.find((c) => c.rule_id === "STAB-CALC-003" && c.expect === "VIOLATED")!.build;

  it("flags the shallow wide-door cabinet as unstable unloaded", () => {
    const result = tippingMargin(tippy(), materials, stabRule);
    expect(result.margin_unloaded).toBeLessThan(1);
    expect(result.loaded_check).toBe("blocked_unvalidated");
  });

  it("reports infinite margin when nothing can overturn the unit", () => {
    const result = tippingMargin(makeValidBedside(), materials, stabRule);
    expect(result.margin_unloaded).toBe(Infinity);
  });

  it("is monotonic: wider doors never improve the margin", () => {
    let previous = Infinity;
    for (let width = 300; width <= 580; width += 70) {
      const design = tippy();
      design.doors.forEach((door) => (door.width_mm = width));
      const { margin_unloaded } = tippingMargin(design, materials, stabRule);
      expect(margin_unloaded).toBeLessThanOrEqual(previous);
      previous = margin_unloaded;
    }
  });
});

describe("packaging.ts", () => {
  it("is deterministic: identical input ⇒ identical packs", () => {
    const design = makeValidBedside();
    const a = packDesign(design, materials, DEFAULT_CARRIER_PROFILES);
    const b = packDesign(clone(design), materials, DEFAULT_CARRIER_PROFILES);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("packs the bedside into one GLS parcel", () => {
    const result = packDesign(makeValidBedside(), materials, DEFAULT_CARRIER_PROFILES);
    expect(result.packages.length).toBe(1);
    expect(result.packages[0].carrier).toBe("gls_cz");
    expect(result.packages[0].mass_kg).toBeLessThan(PACK_TARGET_KG);
  });

  it("splits packs at the 25 kg handling target", () => {
    const design = makeValidBedside();
    for (let i = 0; i < 12; i++) design.parts.push(part(`p${i}`, "shelf_adj", 1000, 500));
    const result = packDesign(design, materials, DEFAULT_CARRIER_PROFILES);
    expect(result.packages.length).toBeGreaterThan(1);
    // Every part lands in exactly one pack.
    const packed = result.packages.flatMap((p) => p.part_ids);
    expect(packed.length).toBe(new Set(packed).size);
    expect(packed.length).toBe(design.parts.length);
  });

  it("falls back to pallet freight when no carrier fits", () => {
    expect(carrierFor([2500, 400, 150], 20, DEFAULT_CARRIER_PROFILES)).toBe("pallet_freight");
    expect(carrierFor([1900, 400, 150], 20, DEFAULT_CARRIER_PROFILES)).toBe("gls_cz");
  });
});
