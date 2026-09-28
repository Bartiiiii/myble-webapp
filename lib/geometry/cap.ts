// "Cap" promotion: turning a board into the outer top / bottom / side of the
// piece, and back again.
//
// The carcass convention (see build.ts) is that the side walls run the full
// height and the top/bottom sit BETWEEN them, so dragging a shelf up stops
// flush under the top and there is no way to say "make this board the top".
// This module is that second step: at the edge, the board spans the full outer
// dimension, lands flush with the outer face, every board it now covers loses
// one thickness so it ends underneath it, and the board that held that slot is
// absorbed.
//
// The outer envelope never changes: a 118 cm design stays 118 cm tall, which is
// what an alcove fit and the 120 cm parcel rule depend on.
import { type Axis, type Design, type Part, MAX_PART_CM, MIN_PART_CM, partBox } from "../model";
import { EPS, round2 } from "./core";
import { isClear } from "./collide";

export type CapDir = "up" | "down" | "left" | "right";

const SPEC: Record<CapDir, { axis: Axis; sign: 1 | -1; span: "w" | "h" }> = {
  up: { axis: "y", sign: 1, span: "w" },
  down: { axis: "y", sign: -1, span: "w" },
  right: { axis: "x", sign: 1, span: "h" },
  left: { axis: "x", sign: -1, span: "h" },
};

const OUTER: Record<Axis, "w" | "h" | "d"> = { x: "w", y: "h", z: "d" };

/**
 * Which of a part's two face dimensions runs along `axis` — or null when the
 * part's thickness runs along it (a board parallel to the cap, never trimmed).
 * Mirrors partSize(): axis x → a:Y b:Z, axis y → a:X b:Z, axis z → a:X b:Y.
 */
function fieldAlong(part: Part, axis: Axis): "aCm" | "bCm" | null {
  if (part.axis === axis) return null;
  if (part.axis === "x") return axis === "y" ? "aCm" : "bCm";
  if (part.axis === "y") return axis === "x" ? "aCm" : "bCm";
  return axis === "x" ? "aCm" : "bCm"; // axis z
}

/** The coordinate of the envelope face `dir` points at. */
function facePos(design: Design, dir: CapDir): number {
  const { axis, sign } = SPEC[dir];
  return (sign * design.outerCm[OUTER[axis]]) / 2;
}

/** Distance from the part's leading face to that envelope face (always >= 0). */
function gapToFace(part: Part, design: Design, dir: CapDir, tCm: number): number {
  const { axis, sign } = SPEC[dir];
  const box = partBox(part, tCm);
  const lead = sign > 0 ? box.max[axis] : box.min[axis];
  return Math.abs(facePos(design, dir) - lead);
}

/** Is this part already the cap on that edge — full span, flush with the face? */
export function isCap(part: Part, design: Design, dir: CapDir, tCm: number): boolean {
  const { axis, span } = SPEC[dir];
  if (part.axis !== axis) return false;
  if (Math.abs(part.aCm - design.outerCm[span]) > EPS) return false;
  return gapToFace(part, design, dir, tCm) <= EPS;
}

/**
 * Is the board in the last slot on that edge — lying the right way round, and
 * either flush with the outer face or flush under the board that holds it?
 * This is what a promotion needs, and what a drag has to have reached BEFORE
 * the gesture that promotes it: one drag takes a board to the edge, the next
 * one turns it into the cap.
 */
export function isAtEdgeSlot(part: Part, design: Design, dir: CapDir, tCm: number): boolean {
  const { axis } = SPEC[dir];
  if (part.axis !== axis) return false;
  if (isCap(part, design, dir, tCm)) return false;
  return gapToFace(part, design, dir, tCm) <= tCm + EPS;
}

/**
 * Promote a board to the cap on `dir`. Returns the new design, or null when the
 * move doesn't apply: wrong orientation (a shelf caps top/bottom, an upright
 * caps left/right), not in the last slot, already the cap, or the trim would
 * leave a board shorter than we can cut.
 */
export function capAtEdge(design: Design, partId: string, dir: CapDir, tCm: number): Design | null {
  const { axis, sign, span } = SPEC[dir];
  const part = design.parts.find((p) => p.id === partId);
  if (!part || !isAtEdgeSlot(part, design, dir, tCm)) return null;

  const face = facePos(design, dir);
  const others = design.parts.filter((p) => p.id !== partId);

  // A cap spans the whole piece, so on a wide one it would be a board nobody
  // can cut or carry. Refuse rather than promote something unmakeable.
  if (design.outerCm[span] > MAX_PART_CM || design.outerCm.d > MAX_PART_CM) return null;

  // The cap: full span, full depth, flush with the outer face and centred on
  // the two axes it now spans.
  const cap: Part = {
    ...part,
    role: "wall",
    aCm: design.outerCm[span],
    bCm: design.outerCm.d,
    pos: { x: 0, y: 0, z: 0, [axis]: round2(face - (sign * tCm) / 2) },
  };

  // Boards running the other way that reach this face now end under the cap.
  const trimmed = new Map<string, Part>();
  for (const o of others) {
    const field = fieldAlong(o, axis);
    if (!field) continue; // parallel to the cap
    if (gapToFace(o, design, dir, tCm) > EPS) continue;
    const next = round2(o[field] - tCm);
    if (next < MIN_PART_CM) return null; // no stubs we can't cut
    trimmed.set(o.id, {
      ...o,
      [field]: next,
      pos: { ...o.pos, [axis]: round2(o.pos[axis] - (sign * tCm) / 2) },
    });
  }

  // Whatever board held that slot is absorbed: the promoted board is the top
  // now, and two tops stacked in one place is not a piece anyone wants.
  const absorbed = new Set(
    others.filter((o) => o.axis === axis && gapToFace(o, design, dir, tCm) <= EPS).map((o) => o.id),
  );

  const parts = design.parts
    .filter((p) => !absorbed.has(p.id))
    .map((p) => (p.id === partId ? cap : (trimmed.get(p.id) ?? p)));

  // Never promote into an overlap.
  if (!isClear(cap, parts.filter((p) => p.id !== partId), tCm)) return null;
  return { ...design, parts };
}

/**
 * The inverse: a cap pushed back off its edge becomes an ordinary inner board
 * in the same slot, and the boards it covered grow back to the outer face.
 */
export function uncap(design: Design, partId: string, dir: CapDir, tCm: number): Design | null {
  const { axis, sign, span } = SPEC[dir];
  const part = design.parts.find((p) => p.id === partId);
  if (!part || !isCap(part, design, dir, tCm)) return null;

  const inner = round2(Math.max(MIN_PART_CM, design.outerCm[span] - 2 * tCm));
  const restored: Part = { ...part, role: axis === "y" ? "shelf" : "divider", aCm: inner };

  const grown = new Map<string, Part>();
  for (const o of design.parts) {
    if (o.id === partId) continue;
    const field = fieldAlong(o, axis);
    if (!field) continue;
    // A board ending exactly one thickness short of the face is one this cap
    // trimmed, so it reaches the outer face again.
    if (Math.abs(gapToFace(o, design, dir, tCm) - tCm) > EPS) continue;
    grown.set(o.id, {
      ...o,
      [field]: round2(o[field] + tCm),
      pos: { ...o.pos, [axis]: round2(o.pos[axis] + (sign * tCm) / 2) },
    });
  }

  return { ...design, parts: design.parts.map((p) => (p.id === partId ? restored : (grown.get(p.id) ?? p))) };
}

export const OVERSHOOT_CM = 2.5; // how far past the edge a drag has to push to promote
export const CAP_DIRS: CapDir[] = ["up", "down", "left", "right"];
const dirAxis = (d: CapDir) => (d === "up" || d === "down" ? "y" : "x") as "x" | "y";
const dirSign = (d: CapDir) => (d === "up" || d === "right" ? 1 : -1);

/**
 * What a drag is asking for at the edges: the direction it is pushing past
 * (promote), or the face it is pulling a cap back off (demote). Null while the
 * pointer is inside the carcass, which is every ordinary drag.
 */
export function dragCapIntent(
  want: { x: number; y: number },
  limit: { x: number; y: number },
  part: Part,
  design: Design,
  tCm: number,
): { dir: CapDir; back: boolean } | null {
  // A board that is already a cap only reacts to being pulled back off its face.
  for (const dir of CAP_DIRS) {
    if (!isCap(part, design, dir, tCm)) continue;
    const axis = dirAxis(dir);
    if (dirSign(dir) * (want[axis] - part.pos[axis]) < -OVERSHOOT_CM) return { dir, back: true };
    return null;
  }
  const over: Record<CapDir, number> = {
    up: want.y - limit.y,
    down: -limit.y - want.y,
    right: want.x - limit.x,
    left: -limit.x - want.x,
  };
  // Only the edges this board could actually cap: a shelf caps top/bottom, an
  // upright caps left/right. Without this the sideways drift a drag picks up
  // under an orbited camera reads as a huge overshoot on the other axis.
  let best: CapDir | null = null;
  for (const dir of CAP_DIRS) {
    if (dirAxis(dir) !== part.axis) continue;
    if (over[dir] > OVERSHOOT_CM && (best === null || over[dir] > over[best])) best = dir;
  }
  return best ? { dir: best, back: false } : null;
}
