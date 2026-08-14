// 2 mm ABS on wear edges (fronts of doors, drawer fronts, tops, shelves).
// Severity 2 recommendation, auto-correctable.

import type { PartRole } from "../design";
import type { Evaluator } from "../context";
import { ok, thresholdNum, violated } from "../context";

const WEAR_EDGE_ROLES: PartRole[] = ["door", "drawer_front", "top", "top_panel", "shelf_fixed", "shelf_adj"];

export const evaluate: Evaluator = (design, ctx) => {
  const frontMin = thresholdNum(ctx.rule, "front_edge_mm");
  const bad: string[] = [];
  for (const part of design.parts) {
    if (!WEAR_EDGE_ROLES.includes(part.role)) continue;
    const front = part.edges.find((e) => e.edge === "front");
    if (front && front.exposed && front.banding_mm < frontMin) bad.push(part.id);
  }
  if (bad.length > 0) return [violated({ part_ids: bad, computed: { front_edge_mm: frontMin } })];
  return [ok()];
};
