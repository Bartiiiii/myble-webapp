// Adjustable shelf positions must sit on the 32 mm hole grid. The configurator
// snaps at input time (getValidRange/snap queries); this is the backend check.

import type { Evaluator, RawFinding } from "../context";
import { ok, thresholdNum, violated } from "../context";

const SNAP_TOL_MM = 0.5;

export const evaluate: Evaluator = (design, ctx) => {
  const pitch = thresholdNum(ctx.rule, "snap_pitch_mm");
  const findings: RawFinding[] = [];
  for (const shelf of design.shelves) {
    if (shelf.fixity !== "adjustable") continue;
    const remainder = shelf.position_y_mm % pitch;
    const onGrid = remainder <= SNAP_TOL_MM || pitch - remainder <= SNAP_TOL_MM;
    if (!onGrid) {
      findings.push(violated({ part_ids: [shelf.part_id], computed: { position_y_mm: shelf.position_y_mm, pitch_mm: pitch } }));
    }
  }
  if (findings.length === 0) return [ok()];
  return findings;
};
