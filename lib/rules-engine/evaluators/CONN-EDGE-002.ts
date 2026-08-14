// Minimum hole-to-edge distances (particleboard blowout prevention):
// Ø5/Ø8 → bore CENTRE ≥ 10 mm from any edge; Ø15/Ø35 → bore EDGE ≥ 10 mm;
// Ø15 cam housings ≥ 50 mm from panel corners. Exception: Ø35 hinge cups in
// door parts sit 3–7 mm from the door edge by spec.
// Hole coordinates are part-local: x along length, y along width.

import type { Evaluator, RawFinding } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const minEdge = thresholdNum(ctx.rule, "min_edge_mm");
  const minCorner = thresholdNum(ctx.rule, "min_corner_mm");
  const findings: RawFinding[] = [];

  for (const part of design.parts) {
    for (const hole of part.holes) {
      const edgeX = Math.min(hole.x_mm, part.length_mm - hole.x_mm);
      const edgeY = Math.min(hole.y_mm, part.width_mm - hole.y_mm);
      const nearest = Math.min(edgeX, edgeY);
      const isCup = hole.dia_mm >= 35;
      const isCam = hole.dia_mm >= 15 && hole.dia_mm < 35;
      const isDowelOrPin = hole.dia_mm <= 8;

      if (isCup && part.role === "door") {
        const cupEdgeDistance = nearest - hole.dia_mm / 2;
        if (cupEdgeDistance < 3 || cupEdgeDistance > 7) {
          findings.push(violated({ part_ids: [part.id], computed: { problem: "cup_distance_out_of_spec", cup_edge_mm: Math.round(cupEdgeDistance * 10) / 10 } }));
        }
        continue;
      }

      const clearance = isDowelOrPin ? nearest : nearest - hole.dia_mm / 2;
      if (clearance < minEdge) {
        findings.push(violated({ part_ids: [part.id], computed: { problem: "hole_too_close_to_edge", clearance_mm: Math.round(clearance * 10) / 10, dia_mm: hole.dia_mm } }));
        continue;
      }
      if (isCam) {
        const corner = Math.hypot(edgeX, edgeY);
        if (corner < minCorner) {
          findings.push(violated({ part_ids: [part.id], computed: { problem: "cam_too_close_to_corner", corner_mm: Math.round(corner) } }));
        }
      }
    }
  }
  if (findings.length === 0) return [ok({ parts_checked: design.parts.length })];
  return findings;
};
