// ─────────────────────────────────────────────────────────────────────────────
// Adapter: the configurator's cm-based `Design` (lib/model.ts) → the engine's
// mm-based `DesignModel`. This is the ONLY coupling point between the live
// configurator and the rules engine; everything the engine needs is derived
// here from geometry so the rest of the engine stays configurator-agnostic.
//
// Design decisions (documented because they are judgment calls):
//  • Colour is décor, not structure → every board maps to ltd_18_p2 / ltd_36_p2
//    by thickness; a z-axis panel maps to hdf_back_3.
//  • Roles are derived from axis + position, not the cm model's cosmetic label:
//    horizontal boards → top / bottom / shelf_fixed; vertical → side / divider;
//    z-panel → back. Configurator shelves are butt-jointed, so they are FIXED.
//  • Shelf span is the largest clear gap between the verticals actually under a
//    shelf, so STRUCT-SHELF findings are meaningful (not just the cut width).
//  • The configurator applies Myble's single standard connection system by
//    construction, so joints are emitted as that standard system (cam+dowel,
//    count scaled to length). The manufacturing BOM comes from the verified
//    meble engine (lib/cutlist.ts), not from these rules-layer connectors.
//  • No per-hole drilling data exists in the cm model, so holes are empty; the
//    32 mm/edge-distance rules are prevention-by-construction in the configurator.
// ─────────────────────────────────────────────────────────────────────────────

import type { Design, Part as CmPart, Axis } from "../model";
import { partBox, partSize } from "../model";
import { bandedEdges, exposedEdges } from "../geometry/edges";
import { detectJoints } from "../geometry/joints";
import type {
  Brace,
  DesignModel,
  Joint,
  JointConnector,
  Part as EnginePart,
  PartEdge,
  PartRole,
  Shelf,
} from "./design";

/** Product category the configurator builds. Open panel shelving by default;
 *  a z-axis panel (back) nudges it to a closed bookcase. */
function inferCategory(hasBack: boolean): string {
  return hasBack ? "bookcase" : "shelving_unit";
}

const cm = (v: number): number => v * 10; // cm → mm

interface Classified {
  cmPart: CmPart;
  role: PartRole;
  /** World-space box in cm. */
  box: ReturnType<typeof partBox>;
}

/** Assign an engine role to every board from its axis and extremity. */
function classify(design: Design, tCm: number): Classified[] {
  const boxes = design.parts.map((p) => ({ p, box: partBox(p, tCm) }));
  const verticals = boxes.filter((b) => b.p.axis === "x");
  const horizontals = boxes.filter((b) => b.p.axis === "y");

  const minX = Math.min(...verticals.map((b) => b.box.min.x));
  const maxX = Math.max(...verticals.map((b) => b.box.max.x));
  const yLevels = horizontals.map((b) => b.box.min.y);
  const minY = Math.min(...yLevels, Infinity);
  const maxY = Math.max(...yLevels, -Infinity);

  const out: Classified[] = [];
  for (const { p, box } of boxes) {
    let role: PartRole;
    if (p.axis === "z") {
      role = "back";
    } else if (p.axis === "x") {
      // Outermost verticals are the sides; interior verticals are dividers.
      const atLeft = Math.abs(box.min.x - minX) < 1;
      const atRight = Math.abs(box.max.x - maxX) < 1;
      role = atLeft || atRight ? "side" : "divider";
    } else {
      // Horizontal: top / bottom / fixed shelf by vertical position.
      if (Math.abs(box.min.y - maxY) < 1) role = "top";
      else if (Math.abs(box.min.y - minY) < 1) role = "bottom";
      else role = "shelf_fixed";
    }
    out.push({ cmPart: p, role, box });
  }
  return out;
}

/** Largest clear span (mm) under a horizontal shelf, split by any verticals
 *  standing beneath it. Falls back to the shelf's own cut width. */
function shelfSpanMm(shelf: Classified, verticals: Classified[]): number {
  const y = shelf.box.min.y;
  const supportsX: number[] = [shelf.box.min.x, shelf.box.max.x];
  for (const v of verticals) {
    const underShelf = v.box.max.y >= y - 0.5 && v.box.min.y <= y + 0.5;
    const withinSpan = v.box.min.x >= shelf.box.min.x - 0.5 && v.box.max.x <= shelf.box.max.x + 0.5;
    if (underShelf && withinSpan) supportsX.push((v.box.min.x + v.box.max.x) / 2);
  }
  supportsX.sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < supportsX.length; i++) maxGap = Math.max(maxGap, supportsX[i] - supportsX[i - 1]);
  return cm(maxGap);
}

/** Map the cm model's 2D face edges to the engine's 4 named edges + banding. */
function edgesFor(part: CmPart, design: Design): PartEdge[] {
  const banded = bandedEdges(part, design);
  const exposed = exposedEdges(part, design);
  // cm EdgeKey (top/bottom/left/right on the board face) → engine EdgeId.
  const map: [keyof typeof banded, PartEdge["edge"]][] = [
    ["top", "back"],
    ["bottom", "front"],
    ["left", "left"],
    ["right", "right"],
  ];
  return map.map(([cmEdge, edge]) => ({
    edge,
    // Live product bands exposed edges with 2 mm ABS (see lib/cutlist.ts).
    banding_mm: banded[cmEdge] ? 2 : 0,
    exposed: exposed[cmEdge],
  }));
}

/** Emit the standard cam+dowel connection system for a detected joint,
 *  connector count scaled to joint length (satisfies CONN-SYS/SPACING by
 *  construction — the configurator only ever applies the standard system). */
function standardConnectors(lengthMm: number): JointConnector[] {
  const connectors: JointConnector[] = [];
  const camPositions = [50, lengthMm - 50];
  if (lengthMm > 450) camPositions.push(lengthMm / 2);
  for (const position_mm of camPositions) connectors.push({ hardware_id: "minifix15_dowel8", position_mm });
  for (const position_mm of [100, lengthMm - 100]) connectors.push({ hardware_id: "dowel_8x35", position_mm });
  return connectors;
}

export interface AdapterOptions {
  /** Stable template id so SCOPE-REV-004 treats configurator output as
   *  in-template (it is fully parametric). */
  template_id?: string;
  /** Customer-supplied room height (mm) for the tilt-up check, if known. */
  room_height_mm?: number | null;
  /** Whether the wall-anchor kit is already on the order. */
  wall_anchor_present?: boolean;
}

/**
 * Convert a configurator Design into an engine DesignModel. Pure and
 * deterministic: same Design ⇒ same DesignModel ⇒ same ValidationReport.
 */
export function designToEngineModel(design: Design, options: AdapterOptions = {}): DesignModel {
  const tCm = design.thickness / 10;
  const material_id = design.thickness === 36 ? "ltd_36_p2" : "ltd_18_p2";
  const classified = classify(design, tCm);
  const byId = new Map(classified.map((c) => [c.cmPart.id, c]));
  const verticals = classified.filter((c) => c.cmPart.axis === "x");

  const hasBack = classified.some((c) => c.role === "back");
  const allBoxes = classified.map((c) => c.box);
  const minY = Math.min(...allBoxes.map((b) => b.min.y));
  // Carcass space is centre-origin, so half the piece sits at negative x. The
  // engine measures everything from the unit's own corner (and rejects negative
  // coordinates outright), so the left edge is the origin here, exactly as minY
  // is for heights.
  const minX = Math.min(...allBoxes.map((b) => b.min.x));

  // Unit dimensions are derived from the ACTUAL part bounding box, not the cm
  // model's `outerCm` — the two can disagree when the configurator clamps a
  // requested size, and the parts are the physical truth the rules must judge
  // (envelope, packing, tilt-up all key off real geometry).
  const bbox =
    allBoxes.length > 0
      ? {
          w: Math.max(...allBoxes.map((b) => b.max.x)) - Math.min(...allBoxes.map((b) => b.min.x)),
          h: Math.max(...allBoxes.map((b) => b.max.y)) - Math.min(...allBoxes.map((b) => b.min.y)),
          d: Math.max(...allBoxes.map((b) => b.max.z)) - Math.min(...allBoxes.map((b) => b.min.z)),
        }
      : design.outerCm;

  const parts: EnginePart[] = classified.map(({ cmPart, role }) => {
    const [sx, sy, sz] = partSize(cmPart, tCm);
    // In-plane cut dims (thickness axis removed): length = longer, width = shorter.
    const [p0, p1] = removeThicknessAxis(cmPart.axis, sx, sy, sz);
    return {
      id: cmPart.id,
      role,
      length_mm: cm(Math.max(p0, p1)),
      width_mm: cm(Math.min(p0, p1)),
      thickness_mm: design.thickness,
      material_id: role === "back" ? "hdf_back_3" : material_id,
      edges: edgesFor(cmPart, design),
      holes: [],
      visibility: "visible",
    };
  });

  const shelves: Shelf[] = classified
    .filter((c) => c.role === "shelf_fixed")
    .map((c) => ({
      part_id: c.cmPart.id,
      span_mm: shelfSpanMm(c, verticals),
      depth_mm: cm(c.box.max.z - c.box.min.z),
      load_class: "book",
      fixity: "fixed",
      position_y_mm: cm(c.box.min.y - minY),
      support_type: "cam_dowel",
    }));

  const joints: Joint[] = detectJoints(design).map((j, i) => {
    const a = byId.get(j.aId);
    const b = byId.get(j.bId);
    // Joint length ≈ shared seam length.
    const seamLen = Math.hypot(
      j.seam.b.x - j.seam.a.x,
      j.seam.b.y - j.seam.a.y,
      j.seam.b.z - j.seam.a.z,
    );
    const length_mm = Math.max(cm(seamLen), 1);
    const touchesBack = a?.role === "back" || b?.role === "back";
    return {
      id: `j${i}`,
      type: touchesBack ? "screw" : "cam_dowel",
      part_a: j.aId,
      part_b: j.bId,
      length_mm,
      connectors: touchesBack ? backConnectors(length_mm) : standardConnectors(length_mm),
      visible: false,
    };
  });

  const dividers = classified
    .filter((c) => c.role === "divider")
    .map((c) => ({
      part_id: c.cmPart.id,
      x_center_mm: cm((c.box.min.x + c.box.max.x) / 2 - minX),
      bottom_y_mm: cm(c.box.min.y - minY),
      top_y_mm: cm(c.box.max.y - minY),
    }));

  const braces: Brace[] = []; // open-panel shelving carries no rails in this model

  return {
    schema_version: 1,
    unit: {
      category: inferCategory(hasBack),
      template_id: options.template_id ?? "configurator_v2",
      width_mm: cm(bbox.w),
      height_mm: cm(bbox.h),
      depth_mm: cm(bbox.d),
      freestanding: true,
      has_back: hasBack,
      back_method: hasBack ? "overlay_screwed" : null,
      plinth: null,
      room_height_mm: options.room_height_mm ?? null,
    },
    parts,
    shelves,
    doors: [],
    drawers: [],
    joints,
    dividers,
    braces,
    wall_anchor: { present: options.wall_anchor_present ?? false },
  };
}

/** Back fixing: screws at ≤150 mm pitch along the joint. */
function backConnectors(lengthMm: number): JointConnector[] {
  const connectors: JointConnector[] = [];
  for (let position_mm = 75; position_mm < lengthMm; position_mm += 150) {
    connectors.push({ hardware_id: "back_nail_screw", position_mm });
  }
  if (connectors.length === 0) connectors.push({ hardware_id: "back_nail_screw", position_mm: lengthMm / 2 });
  return connectors;
}

/** The two in-plane dimensions (cm) of a board, dropping its thickness axis. */
function removeThicknessAxis(axis: Axis, sx: number, sy: number, sz: number): [number, number] {
  switch (axis) {
    case "x":
      return [sy, sz];
    case "y":
      return [sx, sz];
    case "z":
      return [sx, sy];
  }
}
