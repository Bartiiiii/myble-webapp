// Toe-kick ergonomics (Rae): depth 64 mm, height 114 mm, each ±25 mm.
// Severity 2 recommendation; optional feature — absent plinth is fine.

import type { Evaluator } from "../context";
import { notApplicable, ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const plinth = design.unit.plinth;
  if (!plinth) return [notApplicable("no toe-kick")];
  const depth = thresholdNum(ctx.rule, "depth_mm");
  const height = thresholdNum(ctx.rule, "height_mm");
  const tol = thresholdNum(ctx.rule, "tolerance_mm");
  const computed = { depth_mm: plinth.depth_mm, height_mm: plinth.height_mm };
  if (Math.abs(plinth.depth_mm - depth) > tol || Math.abs(plinth.height_mm - height) > tol) {
    return [violated({ computed })];
  }
  return [ok(computed)];
};
