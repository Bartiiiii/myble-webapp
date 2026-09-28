// Solid-body rule: boards are not ghosts. Two parts may sit flush (a butt joint)
// but may never occupy the same volume, so a drag stops at the face it hits
// instead of sliding through it.
//
// Everything here is axis-aligned, so collision is plain AABB work: a move is
// resolved one axis at a time (swept, from the part's previous position) which
// gives free sliding along a blocker's face and makes tunnelling impossible even
// on a fast flick.
import { type Axis, type Part, type Design, MIN_PART_CM, OUTER_DIM, faceAxes, partBox, partSize } from "../model";
import { AXES, EPS, overlap1D, round1 } from "./core";

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

/**
 * Candidate positions along one axis, nearest `base` first, clamped to
 * `range` and de-duplicated — the same expanding-outward order `nudgeClear`
 * uses, exposed here so `fitClear` can sweep two axes at once.
 */
function sweepFrom(base: number, range: { min: number; max: number }, step: number): number[] {
  const clamp = (v: number) => Math.min(range.max, Math.max(range.min, v));
  const start = clamp(base);
  const out = [round1(start)];
  const seen = new Set(out);
  const reach = Math.max(range.max - start, start - range.min);
  const steps = reach > 0 ? Math.ceil(reach / step) : 0;
  for (let i = 1; i <= steps; i++) {
    for (const dir of [1, -1] as const) {
      const v = start + dir * i * step;
      if (v < range.min - EPS || v > range.max + EPS) continue;
      const vc = round1(clamp(v));
      if (seen.has(vc)) continue;
      seen.add(vc);
      out.push(vc);
    }
  }
  return out;
}

/**
 * Like `nudgeClear`, but for a board that has nowhere obvious to go — a fresh
 * duplicate landing exactly on its source, or a flip whose new orientation
 * doesn't fit anywhere at full size. Tries, in order: the requested slot; a
 * different level along the thickness axis (plain `nudgeClear`); a sideways
 * shift along the board's own length, still at full size; and only as a last
 * resort, a shorter board.
 *
 * The old behaviour when nothing was free was to silently keep the part at
 * its (colliding) candidate position — two boards rendered inside each other.
 * This never does that: it returns `null` instead, so the caller can refuse
 * the action rather than ship an overlap.
 */
export function fitClear(
  part: Part,
  others: Part[],
  tCm: number,
  outerCm: Design["outerCm"],
): Part | null {
  const thickOuter = outerCm[OUTER_DIM[part.axis]];
  const thickRange = { min: -thickOuter / 2 + tCm / 2, max: thickOuter / 2 - tCm / 2 };
  const thickStep = Math.max(tCm, 0.5);

  const nudged = nudgeClear(part, others, tCm, thickRange);
  if (isClear(nudged, others, tCm)) return nudged;

  const { a: aAxis } = faceAxes(part);
  const aOuter = outerCm[OUTER_DIM[aAxis]];
  const aStep = Math.max(tCm, 5);
  const sizeStep = 5;

  for (let size = part.aCm; size >= MIN_PART_CM - EPS; size -= sizeStep) {
    const aCm = Math.max(MIN_PART_CM, round1(size));
    const halfA = aCm / 2;
    const aRange = { min: -aOuter / 2 + halfA, max: aOuter / 2 - halfA };
    if (aRange.min <= aRange.max + EPS) {
      for (const aCentre of sweepFrom(part.pos[aAxis], aRange, aStep)) {
        for (const tPos of sweepFrom(part.pos[part.axis], thickRange, thickStep)) {
          const candidate: Part = { ...part, aCm, pos: { ...part.pos, [aAxis]: aCentre, [part.axis]: tPos } };
          if (isClear(candidate, others, tCm)) return candidate;
        }
      }
    }
    if (aCm <= MIN_PART_CM + EPS) break; // already tried the smallest board
  }

  return null;
}

