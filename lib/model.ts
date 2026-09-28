// ─────────────────────────────────────────────────────────────────────────────
// Core furniture model (pure, dependency-free leaf module).
// ─────────────────────────────────────────────────────────────────────────────
// Myble's idea: total creative freedom from orthogonal boards. A Design is just a
// flat list of axis-aligned `Part` boards (walls + shelves + dividers, all
// equal and all deletable) that snap into butt joints. Each board's THICKNESS is
// the material (18 or 36 mm); its other two dims are the cut size meble bills.
//
// Coordinate space: centimetres, centre-origin. The whole piece is centred on the
// origin (x = left↔right, y = down↔up, z = back↔front). `pos` is a part's centre.
// Scaling about the origin therefore scales positions proportionally (see
// geometry/scale.ts). drei <Center> re-frames it for the camera regardless.

export type Colour = "white" | "black";
export type Thickness = 18 | 36; // mm
export type Role = "wall" | "shelf" | "divider"; // labels / defaults only
/** Which axis the board's THICKNESS runs along. */
export type Axis = "x" | "y" | "z";
/** A board face has four edges. top/bottom run along `aCm`; left/right along `bCm`. */
export type EdgeKey = "top" | "bottom" | "left" | "right";

export interface Part {
  id: string;
  role: Role;
  axis: Axis;
  /** Cut dimension along the board's local width (cm). NOT thickness. */
  aCm: number;
  /** Cut dimension along the board's local height/depth (cm). NOT thickness. */
  bCm: number;
  /** Part centre in carcass space (cm), centre-origin. */
  pos: { x: number; y: number; z: number };
}

export interface Design {
  colour: Colour;
  thickness: Thickness;
  /** Overall bounding box of the piece (cm); drives the proportional size panel. */
  outerCm: { w: number; h: number; d: number };
  parts: Part[];
}

// --- Limits & shipping -------------------------------------------------------
// Two different ceilings, and conflating them is what used to keep the whole
// piece down at 120 cm:
//
//   • ONE BOARD is bounded by what the partner can cut and what a courier will
//     carry. meble.pl price by a 1397 × 1032 mm panel, the raw sheet trims to
//     2740 × 2010 mm (rules catalogue MAT-SIZE-002), and GLS take a parcel side
//     of at most 2000 mm (the source behind SCOPE-SIZE-003). Shipping is the
//     binding one, so no board's cut dimension may exceed 200 cm.
//   • THE WHOLE PIECE has no such ceiling, because it is assembled from many
//     boards. A 5 m run of shelving is ganged modules, not one impossible board.
//
// Anything that can grow a board therefore checks MAX_PART_CM, and only the
// envelope checks LIMITS.

/** Sheet the partner cuts from, minus trim (mm → cm). Documented, not enforced:
 *  shipping bites first. Kept so the cutting ceiling is visible if we ever move
 *  to freight. */
export const SHEET_MAX_CM = { long: 274, short: 201 } as const;
/** Longest parcel side a courier will take (GLS CZ). */
export const PARCEL_MAX_SIDE_CM = 200;
/** The real ceiling on a single board's cut dimensions: the lower of the two. */
export const MAX_PART_CM = Math.min(SHEET_MAX_CM.long, PARCEL_MAX_SIDE_CM);
export const DELIVERY_CZK = 199;
/** Extra charged for in-room (vs. curbside) delivery. Added on top of DELIVERY_CZK. */
export const IN_ROOM_DELIVERY_SURCHARGE_CZK = 100;

/**
 * The envelope the whole piece may occupy — which is also how far a board can
 * travel before the piece stops growing to follow it.
 *
 * Width runs to 5 m because a wall of shelving is exactly what ganged modules
 * are for. Height stops at 3 m: ceilings are 2.5–2.7 m, and a taller
 * freestanding piece cannot be stood up safely (EN 14749). Depth stops at 1 m
 * because depth is the one dimension that is nearly always a single board's,
 * and nothing anyone calls furniture is deeper than a wardrobe.
 */
export const LIMITS = {
  w: { min: 20, max: 500 },
  h: { min: 20, max: 300 },
  d: { min: 15, max: 100 },
} as const;

export const MIN_PART_CM = 10; // shortest board we'll cut
export const MAX_PARTS = 40;

/** Which outer dimension a board's own axis measures against. */
export const OUTER_DIM: Record<Axis, "w" | "h" | "d"> = { x: "w", y: "h", z: "d" };

// --- Material colours (swatches) --------------------------------------------
export const COLOURS: { id: Colour; name: string; hex: string }[] = [
  { id: "white", name: "Bílá", hex: "#F3F1EC" },
  { id: "black", name: "Černá", hex: "#2B2B2E" },
];

export function colourHex(c: Colour): string {
  return COLOURS.find((x) => x.id === c)?.hex ?? "#F3F1EC";
}
export function colourName(c: Colour): string {
  return COLOURS.find((x) => x.id === c)?.name ?? "Bílá";
}

export function thicknessCm(d: Pick<Design, "thickness">): number {
  return d.thickness / 10;
}

export function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `p_${Math.random().toString(36).slice(2, 9)}`;
}

// --- Box geometry ------------------------------------------------------------
// Map (axis, aCm, bCm, thickness) → a 3D box size [sx, sy, sz] in cm.
//   axis x: thickness on X, a→Y, b→Z  (a vertical side wall / divider)
//   axis y: thickness on Y, a→X, b→Z  (a horizontal shelf / top / bottom)
//   axis z: thickness on Z, a→X, b→Y  (a back / front panel)
export function partSize(part: Part, tCm: number): [number, number, number] {
  switch (part.axis) {
    case "x":
      return [tCm, part.aCm, part.bCm];
    case "y":
      return [part.aCm, tCm, part.bCm];
    case "z":
      return [part.aCm, part.bCm, tCm];
  }
}

export interface AABB {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export function partBox(part: Part, tCm: number): AABB {
  const [sx, sy, sz] = partSize(part, tCm);
  const { x, y, z } = part.pos;
  return {
    min: { x: x - sx / 2, y: y - sy / 2, z: z - sz / 2 },
    max: { x: x + sx / 2, y: y + sy / 2, z: z + sz / 2 },
  };
}

/**
 * The world axes a board's `aCm` and `bCm` run along. A board is drawn (and cut,
 * and drilled) as a flat rectangle: `a` is its width, `b` its height, and its
 * thickness runs along `axis`. Everything that maps between carcass space and a
 * single board's own 2-D frame goes through here.
 */
export function faceAxes(part: Pick<Part, "axis">): { a: Axis; b: Axis } {
  return {
    a: part.axis === "x" ? "y" : "x",
    b: part.axis === "z" ? "y" : "z",
  };
}

/** Outward 3D unit direction of one of a part's four face edges. */
export function edgeDir(part: Part, edge: EdgeKey): { x: number; y: number; z: number } {
  const { a: aAxis, b: bAxis } = faceAxes(part);
  const sign = edge === "top" || edge === "right" ? 1 : -1;
  const along = edge === "left" || edge === "right" ? aAxis : bAxis;
  return { x: along === "x" ? sign : 0, y: along === "y" ? sign : 0, z: along === "z" ? sign : 0 };
}

/** Cut length (cm) of one of a part's four edges. */
export function edgeLengthCm(part: Part, edge: EdgeKey): number {
  return edge === "top" || edge === "bottom" ? part.aCm : part.bCm;
}

export const EDGE_KEYS: EdgeKey[] = ["top", "bottom", "left", "right"];

/** materialId for the verified meble engine, from colour + thickness. */
export function materialId(d: Pick<Design, "colour" | "thickness">): `${Colour}_${Thickness}` {
  return `${d.colour}_${d.thickness}`;
}
