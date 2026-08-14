// ─────────────────────────────────────────────────────────────────────────────
// Canonical DesignModel (schema §5). All dimensions mm, masses kg. The webapp's
// cm-based configurator model maps into this via an adapter (not here).
// `sanitizeDesign` is the §11 hostile-input gate: every design entering the
// engine passes through it; anything malformed throws DesignInputError so the
// caller fails closed (invalid, never silently valid).
// ─────────────────────────────────────────────────────────────────────────────

export type PartRole =
  | "side"
  | "top"
  | "bottom"
  | "shelf_fixed"
  | "shelf_adj"
  | "divider"
  | "back"
  | "door"
  | "drawer_front"
  | "drawer_side"
  | "drawer_back"
  | "drawer_bottom"
  | "plinth"
  | "top_panel"
  | "rail";

export type EdgeId = "front" | "back" | "left" | "right";

export interface PartEdge {
  edge: EdgeId;
  /** ABS banding thickness in mm; 0 = raw. */
  banding_mm: number;
  /** Is this edge visible/exposed in the assembled unit? */
  exposed: boolean;
}

export interface Hole {
  x_mm: number;
  y_mm: number;
  dia_mm: number;
  depth_mm: number;
  through: boolean;
}

export interface Part {
  id: string;
  role: PartRole;
  length_mm: number;
  width_mm: number;
  thickness_mm: number;
  material_id: string;
  edges: PartEdge[];
  holes: Hole[];
  grain_direction?: "vertical" | "horizontal" | "none";
  visibility?: "visible" | "hidden";
}

export type ShelfLoadClass = "light" | "book" | "heavy";
export type ShelfFixity = "adjustable" | "fixed";
export type ShelfSupportType = "pins_4" | "pins_locking" | "cam_dowel" | "confirmat";

export interface Shelf {
  part_id: string;
  span_mm: number;
  depth_mm: number;
  load_class: ShelfLoadClass;
  fixity: ShelfFixity;
  /** Height of shelf top surface above the unit's internal bottom, mm. */
  position_y_mm: number;
  support_type: ShelfSupportType;
}

export interface Door {
  part_id: string;
  width_mm: number;
  height_mm: number;
  hinge_count: number;
  hinge_id: string;
}

export type DrawerLoadPreset = "utensils" | "clothes" | "paper";

export interface Drawer {
  id: string;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  runner_id: string;
  load_preset: DrawerLoadPreset;
  /** 0 = lowest drawer row in the unit. */
  row_index: number;
}

export type JointType = "cam_dowel" | "confirmat" | "screw" | "nail_staple";

export interface JointConnector {
  hardware_id: string;
  /** Position along the joint line, mm from joint start. */
  position_mm: number;
}

export interface Joint {
  id: string;
  type: JointType;
  part_a: string;
  part_b: string;
  length_mm: number;
  connectors: JointConnector[];
  visible: boolean;
}

export interface Divider {
  part_id: string;
  /** Horizontal centre of the divider within the unit, mm from left inside face. */
  x_center_mm: number;
  /** Vertical extent, mm above internal bottom. */
  bottom_y_mm: number;
  top_y_mm: number;
}

export type RailPosition = "top_rear" | "mid_rear" | "plinth";

export interface Brace {
  part_id: string;
  position: RailPosition;
  width_mm: number;
}

export type BackMethod = "rebate" | "overlay_screwed" | "grooved";

export interface DesignUnit {
  category: string;
  template_id: string | null;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  freestanding: boolean;
  has_back: boolean;
  back_method: BackMethod | null;
  plinth: { depth_mm: number; height_mm: number } | null;
  /** Optional customer-provided room height for tilt-up check. */
  room_height_mm?: number | null;
  room_intent?: "dry" | "bathroom" | "utility" | null;
  /** Applied-top overhang per side, mm (cabinets/desks). */
  top_overhang_mm?: number;
  /** Free desktop span between supports, mm (desks). */
  top_free_span_mm?: number;
}

export interface DesignModel {
  schema_version: 1;
  unit: DesignUnit;
  parts: Part[];
  shelves: Shelf[];
  doors: Door[];
  drawers: Drawer[];
  joints: Joint[];
  dividers: Divider[];
  braces: Brace[];
  wall_anchor: { present: boolean };
}

// ── §11 hostile-input sanitisation ──────────────────────────────────────────

export class DesignInputError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid DesignModel: ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? " …" : ""}`);
    this.name = "DesignInputError";
  }
}

export const INPUT_LIMITS = {
  max_parts: 200,
  max_array: 500,
  max_string: 200,
  max_dimension_mm: 100_000,
  max_holes_per_part: 500,
} as const;

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function checkDim(problems: string[], label: string, v: unknown, min = 0): void {
  if (!isFiniteNum(v) || v < min || v > INPUT_LIMITS.max_dimension_mm) {
    problems.push(`${label} must be a finite number in [${min}, ${INPUT_LIMITS.max_dimension_mm}], got ${String(v)}`);
  }
}

function checkStr(problems: string[], label: string, v: unknown): void {
  if (typeof v !== "string" || v.length === 0 || v.length > INPUT_LIMITS.max_string) {
    problems.push(`${label} must be a non-empty string ≤ ${INPUT_LIMITS.max_string} chars`);
  }
}

function checkArray(problems: string[], label: string, v: unknown, max: number = INPUT_LIMITS.max_array): v is unknown[] {
  if (!Array.isArray(v)) {
    problems.push(`${label} must be an array`);
    return false;
  }
  if (v.length > max) {
    problems.push(`${label} exceeds max length ${max}`);
    return false;
  }
  return true;
}

/**
 * Validates and returns the design (same reference) or throws DesignInputError.
 * Treats client input as hostile: shape, sizes, finiteness, id uniqueness and
 * referential integrity are all enforced here so evaluators can assume a
 * structurally sound model and focus on domain rules.
 */
export function sanitizeDesign(raw: unknown): DesignModel {
  const problems: string[] = [];
  if (typeof raw !== "object" || raw === null) throw new DesignInputError(["design must be an object"]);
  const d = raw as DesignModel;

  if (d.schema_version !== 1) problems.push("schema_version must be 1");
  if (typeof d.unit !== "object" || d.unit === null) {
    throw new DesignInputError(["unit must be an object"]);
  }
  checkStr(problems, "unit.category", d.unit.category);
  if (d.unit.template_id !== null) checkStr(problems, "unit.template_id", d.unit.template_id);
  checkDim(problems, "unit.width_mm", d.unit.width_mm, 1);
  checkDim(problems, "unit.height_mm", d.unit.height_mm, 1);
  checkDim(problems, "unit.depth_mm", d.unit.depth_mm, 1);
  if (typeof d.unit.freestanding !== "boolean") problems.push("unit.freestanding must be boolean");
  if (typeof d.unit.has_back !== "boolean") problems.push("unit.has_back must be boolean");
  if (typeof (d.wall_anchor as unknown) !== "object" || d.wall_anchor === null || typeof d.wall_anchor.present !== "boolean") {
    problems.push("wall_anchor.present must be boolean");
  }

  const ids = new Set<string>();
  if (checkArray(problems, "parts", d.parts, INPUT_LIMITS.max_parts)) {
    for (const [i, p] of (d.parts as Part[]).entries()) {
      checkStr(problems, `parts[${i}].id`, p?.id);
      if (p?.id) {
        if (ids.has(p.id)) problems.push(`duplicate part id ${p.id}`);
        ids.add(p.id);
      }
      checkStr(problems, `parts[${i}].role`, p?.role);
      checkStr(problems, `parts[${i}].material_id`, p?.material_id);
      checkDim(problems, `parts[${i}].length_mm`, p?.length_mm, 1);
      checkDim(problems, `parts[${i}].width_mm`, p?.width_mm, 1);
      checkDim(problems, `parts[${i}].thickness_mm`, p?.thickness_mm, 1);
      if (checkArray(problems, `parts[${i}].holes`, p?.holes, INPUT_LIMITS.max_holes_per_part)) {
        for (const [j, h] of (p.holes as Hole[]).entries()) {
          checkDim(problems, `parts[${i}].holes[${j}].x_mm`, h?.x_mm);
          checkDim(problems, `parts[${i}].holes[${j}].y_mm`, h?.y_mm);
          checkDim(problems, `parts[${i}].holes[${j}].dia_mm`, h?.dia_mm, 0.1);
          checkDim(problems, `parts[${i}].holes[${j}].depth_mm`, h?.depth_mm);
        }
      }
      checkArray(problems, `parts[${i}].edges`, p?.edges, 4);
    }
  }

  const refCheck = (label: string, part_id: unknown): void => {
    if (typeof part_id === "string" && !ids.has(part_id)) problems.push(`${label} references unknown part ${part_id}`);
  };

  if (checkArray(problems, "shelves", d.shelves)) {
    for (const [i, s] of (d.shelves as Shelf[]).entries()) {
      checkStr(problems, `shelves[${i}].part_id`, s?.part_id);
      refCheck(`shelves[${i}]`, s?.part_id);
      checkDim(problems, `shelves[${i}].span_mm`, s?.span_mm, 1);
      checkDim(problems, `shelves[${i}].depth_mm`, s?.depth_mm, 1);
      checkDim(problems, `shelves[${i}].position_y_mm`, s?.position_y_mm);
    }
  }
  if (checkArray(problems, "doors", d.doors)) {
    for (const [i, dr] of (d.doors as Door[]).entries()) {
      checkStr(problems, `doors[${i}].part_id`, dr?.part_id);
      refCheck(`doors[${i}]`, dr?.part_id);
      checkDim(problems, `doors[${i}].width_mm`, dr?.width_mm, 1);
      checkDim(problems, `doors[${i}].height_mm`, dr?.height_mm, 1);
      if (!isFiniteNum(dr?.hinge_count) || dr.hinge_count < 0 || dr.hinge_count > 10 || !Number.isInteger(dr.hinge_count)) {
        problems.push(`doors[${i}].hinge_count must be an integer 0–10`);
      }
    }
  }
  if (checkArray(problems, "drawers", d.drawers)) {
    for (const [i, dr] of (d.drawers as Drawer[]).entries()) {
      checkStr(problems, `drawers[${i}].id`, dr?.id);
      checkDim(problems, `drawers[${i}].width_mm`, dr?.width_mm, 1);
      checkDim(problems, `drawers[${i}].depth_mm`, dr?.depth_mm, 1);
      checkDim(problems, `drawers[${i}].height_mm`, dr?.height_mm, 1);
      if (!isFiniteNum(dr?.row_index) || dr.row_index < 0) problems.push(`drawers[${i}].row_index must be ≥ 0`);
    }
  }
  if (checkArray(problems, "joints", d.joints)) {
    for (const [i, j] of (d.joints as Joint[]).entries()) {
      checkStr(problems, `joints[${i}].id`, j?.id);
      refCheck(`joints[${i}].part_a`, j?.part_a);
      refCheck(`joints[${i}].part_b`, j?.part_b);
      checkDim(problems, `joints[${i}].length_mm`, j?.length_mm, 1);
      checkArray(problems, `joints[${i}].connectors`, j?.connectors, 100);
    }
  }
  if (checkArray(problems, "dividers", d.dividers)) {
    for (const [i, dv] of (d.dividers as Divider[]).entries()) {
      refCheck(`dividers[${i}]`, dv?.part_id);
      checkDim(problems, `dividers[${i}].x_center_mm`, dv?.x_center_mm);
      checkDim(problems, `dividers[${i}].bottom_y_mm`, dv?.bottom_y_mm);
      checkDim(problems, `dividers[${i}].top_y_mm`, dv?.top_y_mm);
    }
  }
  if (checkArray(problems, "braces", d.braces)) {
    for (const [i, b] of (d.braces as Brace[]).entries()) {
      refCheck(`braces[${i}]`, b?.part_id);
      checkDim(problems, `braces[${i}].width_mm`, b?.width_mm, 1);
    }
  }

  if (problems.length > 0) throw new DesignInputError(problems);
  return d;
}
