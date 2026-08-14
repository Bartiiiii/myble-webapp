// Frameless overlay reveals: 2 mm between neighbouring fronts and at the unit
// perimeter. Screening check: total door widths + required reveals must fit
// the unit width (hinge-crank clearance vs neighbouring units needs room
// context the model doesn't carry yet — noted for the configurator layer).

import type { Evaluator } from "../context";
import { notApplicable, ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  if (design.doors.length === 0) return [notApplicable("no doors")];
  const reveal = thresholdNum(ctx.rule, "reveal_mm");
  const totalDoors = design.doors.reduce((s, d) => s + d.width_mm, 0);
  const required = totalDoors + (design.doors.length + 1) * reveal;
  const computed = { total_door_width_mm: totalDoors, required_mm: required, unit_width_mm: design.unit.width_mm };
  if (required > design.unit.width_mm) {
    return [violated({ part_ids: design.doors.map((d) => d.part_id), computed })];
  }
  return [ok(computed)];
};
