// Authoring kit for the curated Design Library.
//
// The legacy plank format (interior cm from the bottom-left of a closed box,
// BOARD = 1.8) can only describe one shape: four walls with boards inside. The
// library needs tables standing on side panels, U-shapes, raised plinths, back
// rails, two modules side by side and 36 mm board. This kit describes a piece
// the way a workshop drawing does: every board is a box in EXTERIOR
// centimetres, measured from the floor-left-back corner of the piece
// (x → right, y → up, z → front), and the kit turns it into the centre-origin
// `Part` list the configurator, the price and the rules engine all read.
//
// It is only an authoring convenience: the output is an ordinary `Design`, so a
// library piece opens, edits, prices and saves exactly like anything else.

import type { Axis, Colour, Design, Part, Role, Thickness } from "./model";

const round1 = (n: number) => Math.round(n * 10) / 10;
// Part centres get 0.01 cm, like build.ts: rounding them to 0.1 could leave a
// board a hair off the face it was drawn against (see the note in build.ts).
const round2 = (n: number) => Math.round(n * 100) / 100;

/** One board as drawn: an axis-aligned box in exterior cm (floor-left-back origin). */
export interface Board {
  id: string;
  /** Which axis the board's THICKNESS runs along (x = upright, y = flat, z = back/front panel). */
  axis: Axis;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/**
 * A drawing context for one piece: the board thickness (cm) and the default
 * depth every upright and flat board runs to unless told otherwise.
 */
export interface Kit {
  /** Board thickness, cm (1.8 or 3.6). */
  t: number;
  /** Default depth of uprights and flat boards, cm. */
  d: number;
  /**
   * Upright (thickness along x). `x` is its LEFT face; it runs from `y0` to
   * `y1`, front to back over `z0`..`z1` (default the full depth).
   */
  v(id: string, x: number, y0: number, y1: number, z0?: number, z1?: number): Board;
  /**
   * Flat board (thickness along y). `y` is its BOTTOM face; it runs from `x0`
   * to `x1`, over `z0`..`z1` (default the full depth).
   */
  h(id: string, x0: number, x1: number, y: number, z0?: number, z1?: number): Board;
  /**
   * Back or front panel / rail (thickness along z). `z` is its BACK face
   * (default 0, flush with the back of the piece); it covers `x0`..`x1` × `y0`..`y1`.
   */
  b(id: string, x0: number, x1: number, y0: number, y1: number, z?: number): Board;
}

export function kit(thicknessMm: Thickness, depthCm: number): Kit {
  const t = thicknessMm / 10;
  const d = depthCm;
  return {
    t,
    d,
    v: (id, x, y0, y1, z0 = 0, z1 = d) => ({ id, axis: "x", x0: x, x1: x + t, y0, y1, z0, z1 }),
    h: (id, x0, x1, y, z0 = 0, z1 = d) => ({ id, axis: "y", x0, x1, y0: y, y1: y + t, z0, z1 }),
    b: (id, x0, x1, y0, y1, z = 0) => ({ id, axis: "z", x0, x1, y0, y1, z0: z, z1: z + t }),
  };
}

/**
 * The classic flat-pack carcass: two full-height sides with the top and bottom
 * BETWEEN them (exactly what `boxWalls` builds). `x` offsets the whole box, so
 * two carcasses can stand side by side in one piece.
 */
export function carcass(k: Kit, w: number, h: number, x = 0, opts: { top?: boolean; bottom?: boolean; bottomY?: number } = {}): Board[] {
  const { t } = k;
  const out: Board[] = [k.v("L", x, 0, h), k.v("R", x + w - t, 0, h)];
  if (opts.top !== false) out.push(k.h("T", x + t, x + w - t, h - t));
  if (opts.bottom !== false) out.push(k.h("B", x + t, x + w - t, opts.bottomY ?? 0));
  return out;
}

export interface PieceSpec {
  colour: Colour;
  thickness: Thickness;
  boards: Board[];
}

/**
 * Turn a drawing into a Design: centre the bounding box on the origin, map each
 * box to a Part (cut size + centre), and size `outerCm` to the boards
 * themselves so the size panel, the parcel rule and the engine all agree.
 */
export function piece(spec: PieceSpec): Design {
  const { boards } = spec;
  if (boards.length === 0) throw new Error("a piece needs at least one board");
  const ids = new Set<string>();
  for (const b of boards) {
    if (ids.has(b.id)) throw new Error(`duplicate board id "${b.id}"`);
    ids.add(b.id);
  }

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of boards) {
    min.x = Math.min(min.x, b.x0);
    min.y = Math.min(min.y, b.y0);
    min.z = Math.min(min.z, b.z0);
    max.x = Math.max(max.x, b.x1);
    max.y = Math.max(max.y, b.y1);
    max.z = Math.max(max.z, b.z1);
  }
  const outer = { w: round1(max.x - min.x), h: round1(max.y - min.y), d: round1(max.z - min.z) };
  const centre = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const t = spec.thickness / 10;

  const parts: Part[] = boards.map((b) => {
    const sx = round1(b.x1 - b.x0);
    const sy = round1(b.y1 - b.y0);
    const sz = round1(b.z1 - b.z0);
    const thick = b.axis === "x" ? sx : b.axis === "y" ? sy : sz;
    if (Math.abs(thick - t) > 0.01) {
      throw new Error(`board "${b.id}" is ${thick} cm thick on its ${b.axis} axis, the piece is ${t} cm`);
    }
    // partSize(): axis x → [t, a, b] (a = height, b = depth); axis y → [a, t, b]
    // (a = width, b = depth); axis z → [a, b, t] (a = width, b = height).
    const aCm = b.axis === "x" ? sy : sx;
    const bCm = b.axis === "z" ? sy : sz;
    return {
      id: b.id,
      role: roleFor(b, min, max),
      axis: b.axis,
      aCm,
      bCm,
      pos: {
        x: round2((b.x0 + b.x1) / 2 - centre.x),
        y: round2((b.y0 + b.y1) / 2 - centre.y),
        z: round2((b.z0 + b.z1) / 2 - centre.z),
      },
    };
  });

  return { colour: spec.colour, thickness: spec.thickness, outerCm: outer, parts };
}

/** Cosmetic role label (the cut list names parts by it; geometry ignores it). */
function roleFor(b: Board, min: { x: number; y: number }, max: { x: number; y: number }): Role {
  const eps = 0.05;
  if (b.axis === "z") return "wall";
  if (b.axis === "x") return Math.abs(b.x0 - min.x) < eps || Math.abs(b.x1 - max.x) < eps ? "wall" : "divider";
  return Math.abs(b.y0 - min.y) < eps || Math.abs(b.y1 - max.y) < eps ? "wall" : "shelf";
}

/**
 * Evenly spaced levels between `from` and `to` for `n` boards of thickness `t`,
 * returned as the bottom face of each board, so the n + 1 openings are equal.
 * Rounded to 0.1 cm.
 */
export function evenLevels(from: number, to: number, n: number, t: number): number[] {
  const clear = (to - from - n * t) / (n + 1);
  return Array.from({ length: n }, (_, i) => round1(from + clear * (i + 1) + t * i));
}

/**
 * Left faces for `n` uprights spread evenly across `from`..`to`, so the n + 1
 * bays come out equal. Rounded to 0.1 cm.
 */
export function evenBays(from: number, to: number, n: number, t: number): number[] {
  return evenLevels(from, to, n, t);
}
