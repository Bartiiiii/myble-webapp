// Solid-body rule: boards are not ghosts. Two parts may sit flush (a butt joint)
// but may never occupy the same volume, so a drag stops at the face it hits
// instead of sliding through it.
//
// Everything here is axis-aligned, so collision is plain AABB work: a move is
// resolved one axis at a time (swept, from the part's previous position) which
// gives free sliding along a blocker's face and makes tunnelling impossible even
// on a fast flick.
import { type Axis, type Part, partBox, partSize } from "../model";
import { AXES, EPS, overlap1D } from "./core";

const SIZE_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/**
 * Do two parts share actual volume? Faces that merely touch (overlap ≈ 0) are a
 * joint, not an intersection, so the test needs more than EPS on every axis.
 */
export function intersects(a: Part, b: Part, tCm: number): boolean {
  const ba = partBox(a, tCm);
  const bb = partBox(b, tCm);
  for (const ax of AXES) {
    if (overlap1D(ba.min[ax], ba.max[ax], bb.min[ax], bb.max[ax]) <= EPS) return false;
  }
  return true;
}

/** Ids of every part `part` currently interpenetrates. */
export function intersecting(part: Part, others: Part[], tCm: number): string[] {
  return others.filter((o) => o.id !== part.id && intersects(part, o, tCm)).map((o) => o.id);
}

export function isClear(part: Part, others: Part[], tCm: number): boolean {
  return intersecting(part, others, tCm).length === 0;
}

/**
 * How far along `axis` the part may travel from `from` towards `to` before a
 * board is in the way. Returns `to` when the path is clear.
 *
 * `at` is the part's position on the other two axes (already resolved by an
 * earlier axis of the same move), which is what lets a shelf slide sideways
 * along a wall it is resting against.
 */
function limitAxis(
  part: Part,
  others: Part[],
  tCm: number,
  axis: Axis,
  from: number,
  to: number,
  at: { x: number; y: number; z: number },
): number {
  const dir = Math.sign(to - from);
  if (dir === 0) return to;

  const halfSize = partSize(part, tCm)[SIZE_INDEX[axis]] / 2;
  const probe = partBox({ ...part, pos: { ...at, [axis]: from } }, tCm);
  let limit = to;

  for (const o of others) {
    if (o.id === part.id) continue;
    const ob = partBox(o, tCm);
    // Only boards the part actually faces can block it: they must overlap on
    // both of the other axes. Sharing a face there (overlap ≈ 0) is a slide.
    let faces = true;
    for (const ax of AXES) {
      if (ax === axis) continue;
      if (overlap1D(probe.min[ax], probe.max[ax], ob.min[ax], ob.max[ax]) <= EPS) faces = false;
    }
    if (!faces) continue;

    if (dir > 0) {
      const barrier = ob.min[axis] - halfSize;
      // Barriers behind the start are ignored, so a part that somehow began
      // inside another can always move back out rather than being frozen.
      if (barrier >= from - EPS && barrier < limit) limit = barrier;
    } else {
      const barrier = ob.max[axis] + halfSize;
      if (barrier <= from + EPS && barrier > limit) limit = barrier;
    }
  }
  return limit;
}

export interface SlideResult {
  pos: { x: number; y: number; z: number };
  /** True when a board stopped the move short of the target. */
  blocked: boolean;
}

/**
 * Move `part` towards `target`, stopping flush against whatever is in the way.
 * Axes are resolved largest-motion-first so a diagonal drag that is blocked on
 * one axis still travels the full distance on the other.
 */
export function slide(
  part: Part,
  target: { x: number; y: number; z: number },
  others: Part[],
  tCm: number,
): SlideResult {
  const pos = { ...part.pos };
  let blocked = false;

  const order = [...AXES].sort(
    (a, b) => Math.abs(target[b] - part.pos[b]) - Math.abs(target[a] - part.pos[a]),
  );

  for (const axis of order) {
    const from = part.pos[axis];
    const to = target[axis];
    if (to === from) continue;
    const limit = limitAxis(part, others, tCm, axis, from, to, pos);
    if (Math.abs(limit - to) > EPS) blocked = true;
    pos[axis] = limit;
  }

  return { pos, blocked };
}

/**
 * Find the nearest free spot for a part that was dropped into occupied space
 * (a freshly added shelf, say), searching along its own thickness axis — the
 * direction that keeps a shelf a shelf.
 *
 * `range` bounds the part's centre so the search stays inside the piece: a
 * board pushed out past the carcass would read as a detached floater and is not
 * a placement any customer asked for. Returns the part untouched when nothing
 * inside the range is free.
 */
export function nudgeClear(
  part: Part,
  others: Part[],
  tCm: number,
  range: { min: number; max: number },
): Part {
  if (isClear(part, others, tCm)) return part;

  const axis = part.axis;
  const step = Math.max(tCm, 0.5);
  const base = part.pos[axis];
  const reach = Math.max(range.max - base, base - range.min);
  if (reach <= 0) return part;
  const steps = Math.ceil(reach / step);

  for (let i = 1; i <= steps; i++) {
    for (const dir of [1, -1]) {
      const at = base + dir * i * step;
      if (at < range.min - EPS || at > range.max + EPS) continue;
      const candidate: Part = { ...part, pos: { ...part.pos, [axis]: at } };
      if (isClear(candidate, others, tCm)) return candidate;
    }
  }
  return part;
}
