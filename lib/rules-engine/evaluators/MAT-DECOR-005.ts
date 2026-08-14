// Woodgrain décor direction consistency (aesthetic; auto-correctable, sev 2).
// Uni-colour décors are exempt — parts with grain "none"/unset are skipped.

import type { PartRole } from "../design";
import type { Evaluator } from "../context";
import { notApplicable, ok, violated } from "../context";

const EXPECTED: Partial<Record<PartRole, "vertical" | "horizontal">> = {
  side: "vertical", door: "vertical", divider: "vertical", drawer_front: "vertical",
  top: "horizontal", bottom: "horizontal", shelf_fixed: "horizontal",
  shelf_adj: "horizontal", top_panel: "horizontal",
};

export const evaluate: Evaluator = (design) => {
  const grained = design.parts.filter((p) => p.grain_direction && p.grain_direction !== "none");
  if (grained.length === 0) return [notApplicable("uni-colour décor — no grain direction to check")];
  const bad: string[] = [];
  for (const part of grained) {
    const expected = EXPECTED[part.role];
    if (expected && part.grain_direction !== expected) bad.push(part.id);
  }
  if (bad.length > 0) return [violated({ part_ids: bad })];
  return [ok({ grained_parts: grained.length })];
};
