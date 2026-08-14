// Manifest of failing designs, one (or more) per rule. The conformance test
// asserts every severity-4/5 rule has at least one VIOLATED entry here, runs
// every entry, and checks the expected verdict — so catalogue coverage can
// never silently rot.

import type { DesignModel, Joint } from "../design";
import type { EvalStage, OrderContext } from "../context";
import type { PartnerProfile } from "../profiles";
import type { Verdict } from "../report";
import { camJoint, clone, edges, makeBookcase, makeValidBedside, part, TEST_PARTNER } from "./fixtures";
import { UNVALIDATED_PARTNER_PROFILE } from "../profiles";

export interface RuleCase {
  rule_id: string;
  label: string;
  expect: Verdict;
  build: () => DesignModel;
  stage?: EvalStage;
  order?: OrderContext;
  partner?: PartnerProfile;
}

const ORDER_NOTHING_DONE: OrderContext = {
  labels_generated: false,
  instructions_generated: false,
  protection_spec_applied: false,
  acknowledgements: [],
};

function violatedCase(rule_id: string, label: string, build: () => DesignModel, extra: Partial<RuleCase> = {}): RuleCase {
  return { rule_id, label, expect: "VIOLATED", build, partner: TEST_PARTNER, ...extra };
}

/** Shallow, wide, heavy-doored cabinet — tips over even unloaded. */
function makeTippyCabinet(): DesignModel {
  const design = makeValidBedside();
  design.unit = {
    ...design.unit,
    category: "cabinet",
    template_id: "tmpl_cabinet_v1",
    width_mm: 1200,
    height_mm: 700,
    depth_mm: 150,
  };
  design.parts = [
    part("side_l", "side", 700, 150),
    part("side_r", "side", 700, 150),
    part("top", "top", 1164, 150),
    part("bottom", "bottom", 1164, 150),
    part("door_l", "door", 680, 580),
    part("door_r", "door", 680, 580),
  ];
  design.joints = [
    camJoint("j_tl", "top", "side_l", 150),
    camJoint("j_tr", "top", "side_r", 150),
    camJoint("j_bl", "bottom", "side_l", 150),
    camJoint("j_br", "bottom", "side_r", 150),
  ];
  design.braces = [];
  design.doors = [
    { part_id: "door_l", width_mm: 580, height_mm: 680, hinge_count: 2, hinge_id: "cup_hinge_35" },
    { part_id: "door_r", width_mm: 580, height_mm: 680, hinge_count: 2, hinge_id: "cup_hinge_35" },
  ];
  return design;
}

export const RULE_CASES: RuleCase[] = [
  violatedCase("SCOPE-CAT-001", "unsupported category", () => {
    const d = makeValidBedside();
    d.unit.category = "wardrobe";
    return d;
  }),
  violatedCase("SCOPE-CAT-002", "blocked safety category", () => {
    const d = makeValidBedside();
    d.unit.category = "bunk_bed";
    return d;
  }),
  violatedCase("SCOPE-SIZE-003", "over-height", () => {
    const d = makeBookcase();
    d.unit.height_mm = 2200;
    return d;
  }),
  violatedCase("SCOPE-REV-004", "out-of-template", () => {
    const d = makeValidBedside();
    d.unit.template_id = null;
    return d;
  }),
  violatedCase("MAT-THK-001", "wrong material for role", () => {
    const d = makeValidBedside();
    d.parts[0].material_id = "hdf_back_3";
    return d;
  }),
  violatedCase("MAT-SIZE-002", "part exceeds sheet", () => {
    const d = makeValidBedside();
    d.parts[0].length_mm = 2800;
    return d;
  }),
  violatedCase("MAT-EDGE-003", "raw exposed edge", () => {
    const d = makeValidBedside();
    d.parts[2].edges = edges(0);
    return d;
  }),
  violatedCase("MAT-EDGE-004", "thin banding on wear edge", () => {
    const d = makeValidBedside();
    d.parts[2].edges = edges(0.4);
    return d;
  }),
  violatedCase("MAT-DECOR-005", "grain direction mismatch", () => {
    const d = makeValidBedside();
    d.parts[0].grain_direction = "horizontal";
    return d;
  }),
  violatedCase("MAT-MOIST-006", "bathroom intent", () => {
    const d = makeValidBedside();
    d.unit.room_intent = "bathroom";
    return d;
  }),
  violatedCase("STRUCT-SHELF-001", "span over 900 hard cap", () => {
    const d = makeBookcase();
    d.unit.width_mm = 1000;
    d.shelves[0].span_mm = 950;
    return d;
  }),
  violatedCase("STRUCT-SHELF-002", "sagging book shelf", () => {
    const d = makeBookcase();
    d.unit.width_mm = 800;
    d.shelves[1].span_mm = 764;
    return d;
  }),
  violatedCase("STRUCT-BACK-003", "no back, no bracing", () => {
    const d = makeValidBedside();
    d.braces = [];
    return d;
  }),
  violatedCase("STRUCT-BACK-004", "open back missing rails", () => {
    const d = makeBookcase();
    d.unit.has_back = false;
    d.braces = [];
    return d;
  }),
  {
    // Sales-first policy: rails present but the rail-WIDTH minimum is an
    // unvalidated null threshold ⇒ never blocks (policy point 5). It passes OK
    // with a pending-validation note rather than routing to review.
    rule_id: "STRUCT-BACK-004",
    label: "rails present, unvalidated width minimum never blocks (§7 / policy 5)",
    expect: "OK",
    partner: TEST_PARTNER,
    build: () => {
      const d = makeBookcase();
      d.unit.has_back = false;
      d.parts.push(part("rail_top", "rail", 564, 100), part("rail_kick", "rail", 564, 100));
      d.joints.push(
        camJoint("j_rt_l", "rail_top", "side_l", 100),
        camJoint("j_rt_r", "rail_top", "side_r", 100),
        camJoint("j_rk_l", "rail_kick", "side_l", 100),
        camJoint("j_rk_r", "rail_kick", "side_r", 100),
      );
      d.braces = [
        { part_id: "rail_top", position: "top_rear", width_mm: 100 },
        { part_id: "rail_kick", position: "plinth", width_mm: 100 },
      ];
      return d;
    },
  },
  violatedCase("STRUCT-DIV-005", "divider on unsupported shelf", () => {
    const d = makeBookcase();
    d.parts.push(part("div1", "divider", 600, 300));
    d.joints.push(camJoint("j_d1", "div1", "shelf_fix", 300));
    d.dividers = [{ part_id: "div1", x_center_mm: 300, bottom_y_mm: 600, top_y_mm: 1200 }];
    return d;
  }),
  violatedCase("STRUCT-FIX-006", "1500 mm unbraced side", () => {
    const d = makeBookcase();
    d.unit.height_mm = 2000;
    d.shelves[0].position_y_mm = 500;
    d.shelves[1].position_y_mm = 480; // adjustable — doesn't count
    return d;
  }),
  violatedCase("STRUCT-TOP-007", "80 mm top overhang", () => {
    const d = makeValidBedside();
    d.unit.top_overhang_mm = 80;
    return d;
  }),
  violatedCase("STRUCT-DESK-008", "1500 mm free desktop span", () => {
    const d = makeValidBedside();
    d.unit.category = "desk_simple";
    d.unit.top_free_span_mm = 1500;
    return d;
  }),
  violatedCase("STRUCT-GEOM-009", "multi-part design without joints", () => {
    const d = makeValidBedside();
    d.joints = [];
    return d;
  }),
  violatedCase("STAB-ANCHOR-002", "tall narrow unit without kit", () => {
    const d = makeBookcase();
    d.wall_anchor.present = false;
    return d;
  }),
  violatedCase("STAB-CALC-003", "unloaded tipping margin below 1", makeTippyCabinet),
  {
    // Loaded margin threshold null ⇒ anchor-required severity-3 advisory
    // (never a hard block; policy point 5). Verdict is VIOLATED at sev 3.
    rule_id: "STAB-CALC-003",
    label: "loaded margin unvalidated ⇒ anchor advisory (policy 5)",
    expect: "VIOLATED",
    partner: TEST_PARTNER,
    build: makeBookcase,
  },
  violatedCase("STAB-DRAWER-004", "two drawer rows above 800 mm", () => {
    const d = makeValidBedside();
    d.unit.category = "storage_unit";
    d.unit.height_mm = 1000;
    d.drawers = [
      { id: "dr0", width_mm: 400, depth_mm: 380, height_mm: 150, runner_id: "runner_30kg", load_preset: "clothes", row_index: 0 },
      { id: "dr1", width_mm: 400, depth_mm: 380, height_mm: 150, runner_id: "runner_30kg", load_preset: "clothes", row_index: 1 },
    ];
    return d;
  }),
  violatedCase("STAB-SHELF-005", "plain pins without anti-slide", () => {
    const d = makeBookcase();
    d.shelves[1].support_type = "pins_4";
    return d;
  }),
  violatedCase("CONN-SYS-001", "cam joint with one cam", () => {
    const d = makeBookcase();
    d.joints[0].connectors = [{ hardware_id: "minifix15_dowel8", position_mm: 50 }];
    return d;
  }),
  violatedCase("CONN-EDGE-002", "pin bore 5 mm from edge", () => {
    const d = makeBookcase();
    d.parts[0].holes = [{ x_mm: 5, y_mm: 150, dia_mm: 5, depth_mm: 10, through: false }];
    return d;
  }),
  violatedCase("CONN-SPACING-003", "600 mm unfastened back run", () => {
    const d = makeBookcase();
    const backJointRef = d.joints.find((j) => j.id === "j_back_l") as Joint;
    backJointRef.connectors = [{ hardware_id: "back_nail_screw", position_mm: 600 }];
    return d;
  }),
  violatedCase("CONN-HINGE-004", "door wider than 650 mm", () => {
    const d = makeTippyCabinet();
    d.doors[0].width_mm = 700;
    return d;
  }),
  violatedCase("CONN-PIN-005", "heavy load on wide adjustable shelf", () => {
    const d = makeBookcase();
    d.unit.width_mm = 1000;
    d.shelves[1].span_mm = 964;
    d.shelves[1].load_class = "heavy";
    return d;
  }),
  violatedCase("CONN-RUNNER-006", "950 mm wide drawer", () => {
    const d = makeValidBedside();
    d.unit.category = "storage_unit";
    d.drawers = [
      { id: "dr0", width_mm: 950, depth_mm: 380, height_mm: 150, runner_id: "runner_30kg", load_preset: "clothes", row_index: 0 },
    ];
    return d;
  }),
  violatedCase("SYS32-GRID-001", "pin hole off the 32 mm grid", () => {
    const d = makeBookcase();
    d.parts[0].holes = [{ x_mm: 40, y_mm: 37, dia_mm: 5, depth_mm: 10, through: false }];
    return d;
  }),
  violatedCase("SYS32-SNAP-002", "shelf 2 mm off grid", () => {
    const d = makeBookcase();
    d.shelves[1].position_y_mm = 930;
    return d;
  }),
  violatedCase("SYS32-GAP-003", "doors leave no reveal", () => {
    const d = makeTippyCabinet();
    d.unit.width_mm = 1100;
    return d;
  }),
  violatedCase("SYS32-BACK-004", "back method partner can't do", () => {
    const d = makeBookcase();
    d.unit.back_method = "grooved";
    return d;
  }),
  {
    // Sales-first: unknown partner back-method capability advises, never blocks.
    rule_id: "SYS32-BACK-004",
    label: "partner capability unknown ⇒ advisory, not blocked (policy 5)",
    expect: "VIOLATED",
    partner: UNVALIDATED_PARTNER_PROFILE,
    build: makeBookcase,
  },
  violatedCase("SYS32-PLINTH-005", "toe-kick outside ergonomic range", () => {
    const d = makeValidBedside();
    d.unit.category = "storage_unit"; // plinth rule scope: cabinet/storage/desk
    d.unit.plinth = { depth_mm: 120, height_mm: 200 };
    return d;
  }),
  violatedCase("MFG-MIN-001", "part below the absolute physical floor (blocks)", () => {
    const d = makeValidBedside();
    d.parts[4].length_mm = 90; // < 100 mm absolute floor → severity-4 block
    d.parts[4].width_mm = 40; // < 50 mm
    return d;
  }),
  violatedCase("MFG-HOLE-003", "overlapping bores", () => {
    const d = makeBookcase();
    d.parts[0].holes = [
      { x_mm: 100, y_mm: 100, dia_mm: 5, depth_mm: 10, through: false },
      { x_mm: 104, y_mm: 100, dia_mm: 5, depth_mm: 10, through: false },
    ];
    return d;
  }),
  violatedCase(
    "MFG-EDGE-005",
    "2 mm banding, partner can't premill",
    makeBookcase,
    { partner: { ...TEST_PARTNER, capabilities: { ...TEST_PARTNER.capabilities, edging_2mm: false } } },
  ),
  {
    // 2 mm ABS always has a 1 mm fallback ⇒ advisory, never blocks a sale.
    rule_id: "MFG-EDGE-005",
    label: "2 mm banding, capability unknown ⇒ advisory (1 mm fallback)",
    expect: "VIOLATED",
    partner: UNVALIDATED_PARTNER_PROFILE,
    build: makeBookcase,
  },
  violatedCase("MFG-LABEL-006", "labels not generated", makeValidBedside, { stage: "order", order: ORDER_NOTHING_DONE }),
  violatedCase("MFG-COMPLEX-007", "61 parts", () => {
    const d = makeValidBedside();
    for (let i = 0; i < 55; i++) {
      d.parts.push(part(`filler_${i}`, "shelf_adj", 200 + i, 100));
    }
    return d;
  }),
  violatedCase("ASM-SEQ-001", "fixed shelf joined to fixed shelf", () => {
    const d = makeBookcase();
    d.parts.push(part("shelf_fix2", "shelf_fixed", 564, 300));
    d.joints.push(camJoint("j_ss", "shelf_fix", "shelf_fix2", 300));
    return d;
  }),
  violatedCase("ASM-TOOL-002", "80 mm compartment with fasteners", () => {
    const d = makeBookcase();
    d.parts.push(part("shelf_fix2", "shelf_fixed", 564, 300));
    d.shelves.push({ part_id: "shelf_fix2", span_mm: 564, depth_mm: 300, load_class: "book", fixity: "fixed", position_y_mm: 680, support_type: "cam_dowel" });
    d.joints.push(camJoint("j_s2l", "shelf_fix2", "side_l", 300), camJoint("j_s2r", "shelf_fix2", "side_r", 300));
    return d;
  }),
  violatedCase("ASM-TOOLKIT-003", "joint type outside the toolkit", () => {
    const d = makeValidBedside();
    (d.joints[0] as { type: string }).type = "glue";
    return d;
  }),
  violatedCase("ASM-PEOPLE-004", "1900 mm panels", () => {
    const d = makeValidBedside(); // all-LTD so panel masses are computable
    d.unit.height_mm = 1900;
    d.parts[0].length_mm = 1900;
    d.parts[1].length_mm = 1900;
    return d;
  }),
  violatedCase("ASM-TILT-005", "diagonal exceeds room height", () => {
    const d = makeBookcase();
    d.unit.room_height_mm = 1220;
    return d;
  }),
  violatedCase("ASM-INSTR-006", "instructions not generated", makeValidBedside, { stage: "order", order: ORDER_NOTHING_DONE }),
  // All-LTD bases: with an HDF back the unknown density blocks mass calcs
  // upstream (fail closed) and the target rule would never get to fire.
  violatedCase("SHIP-PANEL-001", "2050 mm panel fits no parcel carrier", () => {
    const d = makeValidBedside();
    d.unit.height_mm = 2000;
    d.parts[0].length_mm = 2050;
    return d;
  }),
  violatedCase("SHIP-MASS-002", "single 66 kg panel busts the hard cap", () => {
    const d = makeValidBedside();
    d.unit.height_mm = 2000;
    d.parts[0].length_mm = 2700;
    d.parts[0].width_mm = 2000;
    return d;
  }),
  violatedCase("SHIP-PROT-003", "protection spec missing", makeValidBedside, { stage: "order", order: ORDER_NOTHING_DONE }),
  violatedCase("SHIP-ECON-004", "30 mm shorter would ship parcel", () => {
    // Open-back so the wide HDF back doesn't dominate the pack's girth: the
    // 1970 mm sides pack to a 2010 mm parcel (pallet), 30 mm less fits GLS.
    const d = makeBookcase();
    d.unit.height_mm = 2000;
    d.unit.has_back = false;
    d.parts = d.parts.filter((p) => p.id !== "back");
    d.joints = d.joints.filter((j) => j.part_a !== "back" && j.part_b !== "back");
    d.parts[0].length_mm = 1970;
    d.parts[1].length_mm = 1970;
    return d;
  }),
];

export { clone };
