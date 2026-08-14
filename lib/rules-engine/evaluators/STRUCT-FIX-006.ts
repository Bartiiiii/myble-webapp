// Minimum structural horizontals: the vertical gap between consecutive fixed
// members (bottom, fixed shelves, top) must not exceed 1000 mm (provisional).
// Adjustable shelves do not count as structure.

import type { Evaluator } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const maxGap = thresholdNum(ctx.rule, "max_unbraced_side_height_mm");
  const fixedLevels = design.shelves
    .filter((s) => s.fixity === "fixed")
    .map((s) => s.position_y_mm)
    .sort((a, b) => a - b);
  const levels = [0, ...fixedLevels, design.unit.height_mm];
  let worstGap = 0;
  for (let i = 1; i < levels.length; i++) worstGap = Math.max(worstGap, levels[i] - levels[i - 1]);
  const computed = { worst_gap_mm: worstGap, fixed_shelves: fixedLevels.length, max_gap_mm: maxGap };
  if (worstGap > maxGap) return [violated({ computed })];
  return [ok(computed)];
};
