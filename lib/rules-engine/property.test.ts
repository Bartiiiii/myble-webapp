// Property-based checks (implementation task 12): a seeded deterministic PRNG
// mutates valid fixtures into hundreds of odd-but-well-formed designs — the
// engine must never throw and must always land on a defined health status.
//
// Monotonicity note: the prompt suggests "increasing height never improves
// tipping margin". In the static screening model (moments about the front toe
// line, no EN top-edge test force yet) taller sides ADD stabilising mass, so
// height-monotonicity does not hold by construction; the validated loaded
// check will own that once margin_min_loaded exists. We assert the properties
// the model does guarantee: span↑ ⇒ deflection↑ (calc.test.ts) and door
// width↑ ⇒ margin non-increasing (calc.test.ts).

import { describe, expect, it } from "vitest";
import rawCatalogue from "./catalogue/catalogue.v1.1.0.json";
import { createEngine } from "./engine";
import { HEALTH_PRECEDENCE } from "./report";
import { makeBookcase, makeValidBedside, TEST_PARTNER } from "./__tests__/fixtures";
import type { DesignModel } from "./design";

/** Deterministic LCG (Numerical Recipes constants) — no Math.random. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomizedDesign(rng: () => number): DesignModel {
  const design = rng() < 0.5 ? makeValidBedside() : makeBookcase();
  const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];

  design.unit.width_mm = 150 + Math.floor(rng() * 2000);
  design.unit.height_mm = 100 + Math.floor(rng() * 2400);
  design.unit.depth_mm = 100 + Math.floor(rng() * 700);
  design.unit.category = pick(["bookcase", "cabinet", "bedside_table", "desk_simple", "wardrobe", "bunk_bed", "storage_unit"]);
  design.unit.freestanding = rng() < 0.9;
  if (rng() < 0.3) design.unit.template_id = null;
  if (rng() < 0.3) design.unit.room_height_mm = 2000 + Math.floor(rng() * 800);
  if (rng() < 0.3) design.unit.top_free_span_mm = 200 + Math.floor(rng() * 1600);

  for (const part of design.parts) {
    if (rng() < 0.4) part.length_mm = 20 + Math.floor(rng() * 3000);
    if (rng() < 0.4) part.width_mm = 20 + Math.floor(rng() * 2200);
    if (rng() < 0.1) part.holes.push({ x_mm: rng() * 500, y_mm: rng() * 300, dia_mm: pick([5, 8, 15, 35]), depth_mm: 10, through: rng() < 0.5 });
  }
  for (const shelf of design.shelves) {
    if (rng() < 0.6) shelf.span_mm = 100 + Math.floor(rng() * 1400);
    if (rng() < 0.4) shelf.position_y_mm = Math.floor(rng() * design.unit.height_mm);
    if (rng() < 0.3) shelf.load_class = pick(["light", "book", "heavy"]);
  }
  if (rng() < 0.2) design.joints = design.joints.slice(0, Math.floor(rng() * design.joints.length));
  if (rng() < 0.2) design.wall_anchor.present = !design.wall_anchor.present;
  return design;
}

describe("random well-formed designs", () => {
  const engine = createEngine(rawCatalogue, { partner: TEST_PARTNER });

  it("never throw and always resolve to a defined health status (300 seeds)", () => {
    const rng = makeRng(0xc0ffee);
    for (let i = 0; i < 300; i++) {
      const design = randomizedDesign(rng);
      const report = engine.validate(design);
      expect(HEALTH_PRECEDENCE).toContain(report.health);
      expect(report.findings.length).toBeGreaterThanOrEqual(55);
    }
  });

  it("are deterministic: same seed ⇒ same sequence of health statuses", () => {
    const run = () => {
      const rng = makeRng(42);
      const engineRun = createEngine(rawCatalogue, { partner: TEST_PARTNER });
      const healths: string[] = [];
      for (let i = 0; i < 50; i++) healths.push(engineRun.validate(randomizedDesign(rng)).health);
      return healths.join(",");
    };
    expect(run()).toBe(run());
  });
});
