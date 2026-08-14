// Dividers must stack vertically so loads pass to the floor: a divider that
// doesn't start at the bottom needs a divider below within the stack-offset
// tolerance, otherwise it point-loads an unsupported shelf mid-span.

import type { Evaluator, RawFinding } from "../context";
import { ok, thresholdNum, violated } from "../context";

/** Vertical continuity tolerance between stacked dividers, mm. */
const VERTICAL_CONTINUITY_TOL_MM = 50;

export const evaluate: Evaluator = (design, ctx) => {
  const maxOffset = thresholdNum(ctx.rule, "divider_stack_offset_max_mm");
  const findings: RawFinding[] = [];
  for (const divider of design.dividers) {
    if (divider.bottom_y_mm <= VERTICAL_CONTINUITY_TOL_MM) continue; // rests on the unit bottom
    const supported = design.dividers.some(
      (below) =>
        below !== divider &&
        Math.abs(below.x_center_mm - divider.x_center_mm) <= maxOffset &&
        below.top_y_mm >= divider.bottom_y_mm - VERTICAL_CONTINUITY_TOL_MM &&
        below.bottom_y_mm < divider.bottom_y_mm,
    );
    if (!supported) {
      findings.push(
        violated({
          part_ids: [divider.part_id],
          computed: { x_center_mm: divider.x_center_mm, bottom_y_mm: divider.bottom_y_mm },
        }),
      );
    }
  }
  if (findings.length === 0) return [ok({ dividers_checked: design.dividers.length })];
  return findings;
};
