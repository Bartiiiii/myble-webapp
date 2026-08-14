// Tool access clearance: compartments under 120 mm may not contain fasteners
// that need driving. Screening: vertical gaps between consecutive horizontal
// members (bottom, shelves, top) below the threshold flag the bounding fixed
// shelves (their cams must be turned from inside the compartment).

import type { Evaluator, RawFinding } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const minAccess = thresholdNum(ctx.rule, "min_access_mm");
  const levels: { y: number; part_id: string | null; fixed: boolean }[] = [
    { y: 0, part_id: null, fixed: true },
    ...design.shelves.map((s) => ({ y: s.position_y_mm, part_id: s.part_id, fixed: s.fixity === "fixed" })),
    { y: design.unit.height_mm, part_id: null, fixed: true },
  ].sort((a, b) => a.y - b.y);

  const findings: RawFinding[] = [];
  for (let i = 1; i < levels.length; i++) {
    const gap = levels[i].y - levels[i - 1].y;
    if (gap <= 0) continue; // co-located levels are STRUCT-GEOM territory
    if (gap < minAccess && (levels[i].fixed || levels[i - 1].fixed)) {
      const parts = [levels[i - 1].part_id, levels[i].part_id].filter((p): p is string => p !== null);
      if (parts.length > 0) {
        findings.push(violated({ part_ids: parts, computed: { gap_mm: gap, min_access_mm: minAccess } }));
      }
    }
  }
  if (findings.length === 0) return [ok()];
  return findings;
};
