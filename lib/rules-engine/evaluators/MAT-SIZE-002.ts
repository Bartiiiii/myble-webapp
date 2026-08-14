// Part must fit the raw sheet minus trim: 2740 × 2010 mm (orientation-free).

import type { Evaluator } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const maxLength = thresholdNum(ctx.rule, "max_length");
  const maxWidth = thresholdNum(ctx.rule, "max_width");
  const bad: string[] = [];
  for (const part of design.parts) {
    const long = Math.max(part.length_mm, part.width_mm);
    const short = Math.min(part.length_mm, part.width_mm);
    if (long > maxLength || short > maxWidth) bad.push(part.id);
  }
  if (bad.length > 0) return [violated({ part_ids: bad, computed: { offending_parts: bad.length } })];
  return [ok({ parts_checked: design.parts.length })];
};
