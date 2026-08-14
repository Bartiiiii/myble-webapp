// MVP envelope limits: height ≤ 2000, module width ≤ 1200, depth 150–600 mm.

import type { Evaluator } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const { width_mm, height_mm, depth_mm } = design.unit;
  const heightMax = thresholdNum(ctx.rule, "height_max");
  const widthMax = thresholdNum(ctx.rule, "module_width_max");
  const depthMin = thresholdNum(ctx.rule, "depth_min");
  const depthMax = thresholdNum(ctx.rule, "depth_max");

  const computed = { width_mm, height_mm, depth_mm };
  if (height_mm > heightMax || width_mm > widthMax || depth_mm < depthMin || depth_mm > depthMax) {
    return [violated({ computed })];
  }
  return [ok(computed)];
};
