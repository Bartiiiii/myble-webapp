// Reference design builders for tests and the golden corpus. All fixtures are
// structurally valid DesignModels (they pass sanitizeDesign); rule violations
// are introduced by explicit mutations in violated-cases.ts.

import type { DesignModel, Joint, Part, PartEdge } from "../design";
import type { PartnerProfile } from "../profiles";

/** Confirmed-capability partner used by most tests (the default profile is
 *  deliberately all-unknown and fail-closed — tested separately). */
export const TEST_PARTNER: PartnerProfile = {
  partner_id: "test_partner",
  capabilities: { edging_2mm: true, premill: true, back_methods: ["overlay_screwed", "rebate"] },
  tolerances: { cut_mm: 0.5, drill_mm: 0.3 },
};

export function edges(frontBanding: number, hiddenBanding = 0.4): PartEdge[] {
  return [
    { edge: "front", banding_mm: frontBanding, exposed: true },
    { edge: "back", banding_mm: hiddenBanding, exposed: false },
    { edge: "left", banding_mm: hiddenBanding, exposed: false },
    { edge: "right", banding_mm: hiddenBanding, exposed: false },
  ];
}

/** Fully concealed edges (back panels sitting inside the carcass). */
export function hiddenEdges(): PartEdge[] {
  return (["front", "back", "left", "right"] as const).map((edge) => ({ edge, banding_mm: 0, exposed: false }));
}

export function part(id: string, role: Part["role"], length: number, width: number, over: Partial<Part> = {}): Part {
  return {
    id,
    role,
    length_mm: length,
    width_mm: width,
    thickness_mm: role === "back" || role === "drawer_bottom" ? 3 : 18,
    material_id: role === "back" || role === "drawer_bottom" ? "hdf_back_3" : "ltd_18_p2",
    edges: edges(2),
    holes: [],
    visibility: "visible",
    ...over,
  };
}

export function camJoint(id: string, a: string, b: string, length: number): Joint {
  return {
    id,
    type: "cam_dowel",
    part_a: a,
    part_b: b,
    length_mm: length,
    connectors: [
      { hardware_id: "minifix15_dowel8", position_mm: 50 },
      { hardware_id: "minifix15_dowel8", position_mm: length - 50 },
      { hardware_id: "dowel_8x35", position_mm: 100 },
      { hardware_id: "dowel_8x35", position_mm: length - 100 },
    ],
    visible: false,
  };
}

export function backJoint(id: string, back: string, to: string, length: number): Joint {
  const connectors = [];
  for (let position = 150; position < length; position += 250) {
    connectors.push({ hardware_id: "back_nail_screw", position_mm: position });
  }
  return { id, type: "screw", part_a: back, part_b: to, length_mm: length, connectors, visible: false };
}

/**
 * Small bedside unit, 450×450×400 mm, open back with bracing rails, all LTD.
 * Health VALID with the TEST_PARTNER profile: below the 600 mm stability
 * regime, all-LTD (no HDF density unknowns), no doors/drawers.
 */
export function makeValidBedside(): DesignModel {
  const inner = 450 - 2 * 18;
  return {
    schema_version: 1,
    unit: {
      category: "bedside_table",
      template_id: "tmpl_bedside_v1",
      width_mm: 450,
      height_mm: 450,
      depth_mm: 400,
      freestanding: true,
      has_back: false,
      back_method: null,
      plinth: null,
    },
    parts: [
      part("side_l", "side", 450, 400),
      part("side_r", "side", 450, 400),
      part("top", "top", inner, 400),
      part("bottom", "bottom", inner, 400),
      part("rail_top", "rail", inner, 100),
      part("rail_kick", "rail", inner, 100),
    ],
    shelves: [],
    doors: [],
    drawers: [],
    joints: [
      camJoint("j_tl", "top", "side_l", 400),
      camJoint("j_tr", "top", "side_r", 400),
      camJoint("j_bl", "bottom", "side_l", 400),
      camJoint("j_br", "bottom", "side_r", 400),
      camJoint("j_rt_l", "rail_top", "side_l", 100),
      camJoint("j_rt_r", "rail_top", "side_r", 100),
      camJoint("j_rk_l", "rail_kick", "side_l", 100),
      camJoint("j_rk_r", "rail_kick", "side_r", 100),
    ],
    dividers: [],
    braces: [
      { part_id: "rail_top", position: "top_rear", width_mm: 100 },
      { part_id: "rail_kick", position: "plinth", width_mm: 100 },
    ],
    wall_anchor: { present: false },
  };
}

/**
 * Bookcase 600×1200×300 with HDF back, fixed shelf at 600, locking-pin
 * adjustable shelf at 928 (on the 32 mm grid), anchor kit included.
 * Expected health with catalogue v1: REQUIRES_REVIEW — the HDF back has no
 * validated density (shipping mass can't pass) and the loaded tipping margin
 * is unvalidated; both fail closed. This golden documents that reality.
 */
export function makeBookcase(): DesignModel {
  const inner = 600 - 2 * 18;
  return {
    schema_version: 1,
    unit: {
      category: "bookcase",
      template_id: "tmpl_bookcase_v1",
      width_mm: 600,
      height_mm: 1200,
      depth_mm: 300,
      freestanding: true,
      has_back: true,
      back_method: "overlay_screwed",
      plinth: null,
    },
    parts: [
      part("side_l", "side", 1200, 300),
      part("side_r", "side", 1200, 300),
      part("top", "top", inner, 300),
      part("bottom", "bottom", inner, 300),
      part("shelf_fix", "shelf_fixed", inner, 300),
      part("shelf_adj", "shelf_adj", inner, 300),
      part("back", "back", 1200, 600, { edges: hiddenEdges(), visibility: "hidden" }),
    ],
    shelves: [
      { part_id: "shelf_fix", span_mm: inner, depth_mm: 300, load_class: "book", fixity: "fixed", position_y_mm: 600, support_type: "cam_dowel" },
      { part_id: "shelf_adj", span_mm: inner, depth_mm: 300, load_class: "book", fixity: "adjustable", position_y_mm: 928, support_type: "pins_locking" },
    ],
    doors: [],
    drawers: [],
    joints: [
      camJoint("j_tl", "top", "side_l", 300),
      camJoint("j_tr", "top", "side_r", 300),
      camJoint("j_bl", "bottom", "side_l", 300),
      camJoint("j_br", "bottom", "side_r", 300),
      camJoint("j_sl", "shelf_fix", "side_l", 300),
      camJoint("j_sr", "shelf_fix", "side_r", 300),
      backJoint("j_back_l", "back", "side_l", 1200),
      backJoint("j_back_r", "back", "side_r", 1200),
      backJoint("j_back_t", "back", "top", 600),
      backJoint("j_back_b", "back", "bottom", 600),
    ],
    dividers: [],
    braces: [],
    wall_anchor: { present: true },
  };
}

/** Deep-clone helper so cases can mutate fixtures freely. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
