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
  /** User forces band/raw on a specific edge (rare). Omit = geometry decides. */
  bandOverride?: Partial<Record<EdgeKey, boolean>>;
}

export interface Design {
  colour: Colour;
  thickness: Thickness;
  /** false = "Neohranovat zadní hranu" — drop banding on the wall-facing edges. */
  bandBack: boolean;
  /** Overall bounding box of the piece (cm); drives the proportional size panel. */
  outerCm: { w: number; h: number; d: number };
  parts: Part[];
}

// --- Limits & shipping -------------------------------------------------------
// The 120 cm max-edge parcel rule is sacred (verified shipping constraint).
export const MAX_EDGE_CM = 120;
export const DELIVERY_CZK = 199;

export const LIMITS = {
  w: { min: 20, max: 120 },
  h: { min: 20, max: 120 },
  d: { min: 15, max: 60 },
} as const;

export const MIN_PART_CM = 10; // shortest board we'll cut
export const MAX_PARTS = 40;

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

/** Outward 3D unit direction of one of a part's four face edges. */
export function edgeDir(part: Part, edge: EdgeKey): { x: number; y: number; z: number } {
  // Local face axes per board axis: (aAxis, bAxis) in world terms.
  const aAxis = part.axis === "x" ? "y" : "x"; // a runs along this world axis
  const bAxis = part.axis === "z" ? "y" : "z"; // b runs along this world axis
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
