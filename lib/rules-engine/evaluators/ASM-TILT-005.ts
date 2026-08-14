// Tilt-up ceiling clearance: √(H² + D²) must clear room height − 20 mm.
// Only evaluable when the customer provided a room height.

import type { Evaluator } from "../context";
import { notApplicable, ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const room = design.unit.room_height_mm;
  if (room == null) return [notApplicable("room height not provided")];
  const margin = thresholdNum(ctx.rule, "margin_mm");
  const diagonal = Math.hypot(design.unit.height_mm, design.unit.depth_mm);
  const computed = {
    diag: Math.round(diagonal / 10), // cm, for the user message
    h: Math.round(design.unit.height_mm / 10),
    d: Math.round(design.unit.depth_mm / 10),
    room_height_mm: room,
  };
  if (diagonal > room - margin) return [violated({ computed })];
  return [ok(computed)];
};
