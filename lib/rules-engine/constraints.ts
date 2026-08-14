// Engine-exported constraint queries (implementation task 6): the configurator
// input layer uses these to clamp sliders and snap drags so invalid states
// are PREVENTED rather than corrected after the fact. All values come from
// catalogue thresholds — never hard-coded here.

import type { RulesCatalogue } from "./types";

export interface ValidRange {
  min_mm: number;
  max_mm: number;
  /** Present when positions must snap to a grid (32 mm system). */
  snap_mm?: number;
}

export type RangeTarget =
  | { kind: "unit_dimension"; dim: "width" | "height" | "depth" }
  | { kind: "shelf_span" }
  | { kind: "shelf_position"; unit_height_mm: number }
  | { kind: "door_width" };

function num(catalogue: RulesCatalogue, ruleId: string, key: string): number {
  const rule = catalogue.rules.find((r) => r.rule_id === ruleId);
  const t = rule?.threshold;
  if (t && typeof t === "object" && typeof t[key] === "number") return t[key] as number;
  throw new Error(`constraint query: ${ruleId}.threshold.${key} missing from catalogue`);
}

export function getValidRange(catalogue: RulesCatalogue, target: RangeTarget): ValidRange {
  switch (target.kind) {
    case "unit_dimension": {
      if (target.dim === "height") return { min_mm: 1, max_mm: num(catalogue, "SCOPE-SIZE-003", "height_max") };
      if (target.dim === "width") return { min_mm: 1, max_mm: num(catalogue, "SCOPE-SIZE-003", "module_width_max") };
      return {
        min_mm: num(catalogue, "SCOPE-SIZE-003", "depth_min"),
        max_mm: num(catalogue, "SCOPE-SIZE-003", "depth_max"),
      };
    }
    case "shelf_span":
      return {
        min_mm: num(catalogue, "MFG-MIN-001", "min_length_mm"),
        max_mm: num(catalogue, "STRUCT-SHELF-001", "hard_max_span"),
      };
    case "shelf_position": {
      const pitch = num(catalogue, "SYS32-SNAP-002", "snap_pitch_mm");
      return { min_mm: 0, max_mm: target.unit_height_mm, snap_mm: pitch };
    }
    case "door_width":
      return {
        min_mm: num(catalogue, "MFG-MIN-001", "min_width_mm"),
        max_mm: num(catalogue, "CONN-HINGE-004", "width_abs_max"),
      };
  }
}
