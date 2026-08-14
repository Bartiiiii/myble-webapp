// 32 mm system holes: Ø5 pin rows at 32 mm pitch, 37 mm setback from front/
// back edges (PROVISIONAL — freeze with CNC partner). Severity 0, auto-
// correctable: the configurator generates holes on-grid; this verifies.
// Part-local coords: x along length (vertical on sides), y along width (depth).

import type { Evaluator, RawFinding } from "../context";
import { ok, thresholdNum, violated } from "../context";

/** Positional tolerance for grid conformance, mm (drilling tolerance class). */
const GRID_TOL_MM = 0.5;

export const evaluate: Evaluator = (design, ctx) => {
  const pitch = thresholdNum(ctx.rule, "pitch_mm");
  const setback = thresholdNum(ctx.rule, "front_setback_mm");
  const findings: RawFinding[] = [];

  for (const part of design.parts) {
    if (part.role !== "side" && part.role !== "divider") continue;
    let offGrid = 0;
    for (const hole of part.holes) {
      if (hole.dia_mm !== 5) continue;
      const setbackFront = Math.abs(hole.y_mm - setback);
      const setbackBack = Math.abs(part.width_mm - hole.y_mm - setback);
      const rowOk = setbackFront <= GRID_TOL_MM || setbackBack <= GRID_TOL_MM;
      const pitchRemainder = hole.x_mm % pitch;
      const pitchOk = pitchRemainder <= GRID_TOL_MM || pitch - pitchRemainder <= GRID_TOL_MM;
      if (!rowOk || !pitchOk) offGrid++;
    }
    if (offGrid > 0) findings.push(violated({ part_ids: [part.id], computed: { off_grid_holes: offGrid } }));
  }
  if (findings.length === 0) return [ok()];
  return findings;
};
