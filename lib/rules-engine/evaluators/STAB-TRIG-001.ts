// Stability regime trigger (EN 14749 applicability): freestanding ≥ 600 mm.
// Severity 0 — records the regime decision for downstream stability rules,
// which read it from ctx.prior.

import type { Evaluator } from "../context";
import { ok, thresholdNum } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const trigger = thresholdNum(ctx.rule, "height_trigger_mm");
  const inRegime = design.unit.freestanding && design.unit.height_mm >= trigger;
  return [ok({ in_stability_regime: inRegime, height_mm: design.unit.height_mm, freestanding: design.unit.freestanding })];
};
