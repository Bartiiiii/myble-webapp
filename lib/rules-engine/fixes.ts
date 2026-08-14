// Auto-correction proposals (implementation task 6): pure
// propose(design, report) → DesignPatch[]. Patches are DECLARATIVE — the
// configurator applies them through its normal edit pipeline so the result is
// re-validated exactly like a user edit, and every applied patch fires a
// notification event carrying the rule reference.
// Only rules with auto_correct:true in the catalogue may propose patches.

import type { DesignModel } from "./design";
import { OPEN_BACK_RAIL_PLACEHOLDER_WIDTH_MM } from "./constants";
import type { ValidationFinding, ValidationReport } from "./report";
import type { RulesCatalogue } from "./types";

export interface DesignPatch {
  rule_id: string;
  op: string;
  part_ids: string[];
  params: Record<string, number | string | boolean>;
  /** Human-readable summary for the notification event. */
  summary: string;
}

type PatchBuilder = (finding: ValidationFinding, design: DesignModel) => DesignPatch | null;

const BUILDERS: Record<string, PatchBuilder> = {
  "MAT-EDGE-003": (f) => patch(f, "band_exposed_edges", {}, "Band all exposed edges"),
  "MAT-EDGE-004": (f) => patch(f, "set_front_edge_banding", { banding_mm: 2 }, "Apply 2 mm ABS to wear edges"),
  "MAT-DECOR-005": (f) => patch(f, "align_grain_direction", {}, "Align décor grain direction"),
  "STRUCT-BACK-003": (f) => patch(f, "add_back_panel", {}, "Add back panel"),
  "STRUCT-BACK-004": (f) =>
    patch(f, "add_bracing_rails", { rail_width_mm: OPEN_BACK_RAIL_PLACEHOLDER_WIDTH_MM }, "Add open-back bracing rails"),
  "STRUCT-DIV-005": (f) => patch(f, "align_divider_stack", {}, "Align divider over the support below"),
  "STRUCT-FIX-006": (f) => patch(f, "convert_shelf_to_fixed", {}, "Convert a middle shelf to a fixed shelf"),
  "STRUCT-DESK-008": (f) => patch(f, "add_rear_rail", {}, "Add rear stiffening rail"),
  "STAB-ANCHOR-002": (f, d) =>
    d.wall_anchor.present ? null : patch(f, "add_wall_anchor_kit", {}, "Add wall-anchor kit (non-removable)"),
  "CONN-SYS-001": (f) => patch(f, "regenerate_joint_hardware", {}, "Regenerate standard cam+dowel hardware"),
  "CONN-EDGE-002": (f) => patch(f, "reposition_connectors", {}, "Move connectors to safe edge distances"),
  "CONN-SPACING-003": (f) => patch(f, "regenerate_joint_hardware", {}, "Re-space connectors along joints"),
  "SYS32-GRID-001": (f) => patch(f, "regenerate_system_holes", {}, "Regenerate 32 mm system holes"),
  "SYS32-SNAP-002": (f, d) => {
    const shelf = d.shelves.find((s) => f.part_ids.includes(s.part_id));
    if (!shelf) return null;
    const snapped = Math.round(shelf.position_y_mm / 32) * 32;
    return patch(f, "snap_shelf_position", { position_y_mm: snapped }, `Snap shelf to ${snapped} mm`);
  },
  "SYS32-GAP-003": (f) => patch(f, "resize_doors_for_reveals", { reveal_mm: 2 }, "Resize doors for 2 mm reveals"),
  "SYS32-BACK-004": (f) => patch(f, "set_back_method_default", {}, "Use partner's frozen back-integration method"),
  "SYS32-PLINTH-005": (f) => patch(f, "set_plinth_ergonomic_defaults", { depth_mm: 64, height_mm: 114 }, "Use ergonomic toe-kick dimensions"),
  "MFG-HOLE-003": (f) => patch(f, "regenerate_hole_pattern", {}, "Regenerate feasible hole pattern"),
  "MFG-EDGE-005": (f) => patch(f, "regenerate_edging_plan", {}, "Regenerate edging sequence"),
  "MFG-LABEL-006": (f) => patch(f, "generate_labels", {}, "Generate part labels"),
  "ASM-TOOL-002": (f) => patch(f, "reposition_fasteners_for_access", {}, "Move fasteners for tool access"),
  "SHIP-MASS-002": (f) => patch(f, "repack_order", {}, "Re-split packages under the mass cap"),
  "SHIP-PROT-003": (f) => patch(f, "apply_protection_spec", {}, "Apply packaging protection spec"),
};

function patch(
  finding: ValidationFinding,
  op: string,
  params: Record<string, number | string | boolean>,
  summary: string,
): DesignPatch {
  return { rule_id: finding.rule_id, op, part_ids: finding.part_ids, params, summary };
}

export function proposeFixes(
  design: DesignModel,
  report: ValidationReport,
  catalogue: RulesCatalogue,
): DesignPatch[] {
  const rulesById = new Map(catalogue.rules.map((r) => [r.rule_id, r]));
  const patches: DesignPatch[] = [];
  for (const finding of report.findings) {
    if (finding.verdict !== "VIOLATED") continue;
    const rule = rulesById.get(finding.rule_id);
    if (!rule?.auto_correct) continue;
    const builder = BUILDERS[finding.rule_id];
    const built = builder ? builder(finding, design) : null;
    if (built) patches.push(built);
  }
  return patches;
}
