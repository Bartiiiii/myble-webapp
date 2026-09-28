// Resizing a board: which face moves, and what "fill" aims at.
//
// Three rules, all about keeping a resize predictable once boards are in
// contact with each other:
//
//  1. Anchored resize — a board touching another board on exactly ONE side
//     keeps that joint and grows/shrinks from its free side. Touching on both
//     sides (or on neither) it resizes symmetrically about its centre, which is
//     what it has always done and the only sensible answer when both ends are
//     pinned.
//  2. Fill matches a neighbour — when a board is longer than a board it touches,
//     "fill" trims it to that neighbour's length instead of spanning the whole
//     carcass. With several shorter neighbours it takes the closest length below
//     its own, not the shortest.
//  3. Otherwise fill spans the slot — the board grows until it butts into the
//     boards standing in its way, each side resolved independently, and only
//     reaches for the carcass face where nothing blocks it. Aiming at the full
//     inner span instead made "fill" do nothing at all whenever a wall or a
//     divider stood anywhere in the path: the oversized result was simply
//     rejected as an overlap.
import {
  type Axis,
  type Design,
  type Part,
  MAX_PART_CM,
  MIN_PART_CM,
  OUTER_DIM,
  faceAxes,
  partBox,
} from "../model";
import { AXES, EPS, MIN_CONTACT_CM, SNAP_CM, boxSize, inContact, overlap1D, round1, round2 } from "./core";
import { isClear } from "./collide";

export type SizeField = "aCm" | "bCm";

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The world axis a board's `aCm` / `bCm` runs along. */
export function fieldAxis(part: Pick<Part, "axis">, field: SizeField): Axis {
  return faceAxes(part)[field === "aCm" ? "a" : "b"];
}

export interface ContactSides {
  /** A board is flush against this board's low face on the axis. */
  min: boolean;
  /** …and against its high face. */
  max: boolean;
}

/**
 * Which of a board's two faces along `axis` have another board flush against
 * them. Only real face joints count: a board merely brushing a corner or an
 * edge shares no meaningful area and does not pin anything.
 */
export function contactSides(part: Part, others: Part[], tCm: number, axis: Axis): ContactSides {
  const pb = partBox(part, tCm);
  const cross = AXES.filter((a) => a !== axis);
  const sides: ContactSides = { min: false, max: false };

  for (const o of others) {
    if (o.id === part.id) continue;
    const ob = partBox(o, tCm);
    if (cross.some((a) => overlap1D(pb.min[a], pb.max[a], ob.min[a], ob.max[a]) < MIN_CONTACT_CM)) continue;
    if (Math.abs(ob.max[axis] - pb.min[axis]) <= EPS) sides.min = true;
    if (Math.abs(ob.min[axis] - pb.max[axis]) <= EPS) sides.max = true;
  }
  return sides;
}

export interface Slot {
  /** Face the board can grow down to on the axis, and the one it can grow up to. */
  lo: number;
  hi: number;
}

/**
 * The clear run a board has along `axis`: from the nearest blocking face below
 * it to the nearest one above. Only boards sharing its cross-section can block
 * it — anything beside it is simply elsewhere in the piece. Where nothing
 * blocks, the run ends at the carcass face, inset by one board thickness the
 * same way a freshly added board is cut.
 */
export function fillSlot(
  part: Part,
  others: Part[],
  tCm: number,
  outerCm: Design["outerCm"],
  axis: Axis,
): Slot {
  const outer = outerCm[OUTER_DIM[axis]];
  const { lo, hi } = blockingFaces(part, others, tCm, axis);
  return {
    lo: clampN(lo ?? -outer / 2 + tCm, -outer / 2, outer / 2),
    hi: clampN(hi ?? outer / 2 - tCm, -outer / 2, outer / 2),
  };
}

/**
 * The nearest board face above and below this one along `axis`, or null on a
 * side where the board has a clear run to the carcass. Shared by fill and by
 * edge-stretching so the two always agree on how far a board may reach; they
 * differ only in what they do when nothing is in the way.
 */
function blockingFaces(
  part: Part,
  others: Part[],
  tCm: number,
  axis: Axis,
): { lo: number | null; hi: number | null } {
  const pb = partBox(part, tCm);
  const cross = AXES.filter((a) => a !== axis);
  let lo: number | null = null;
  let hi: number | null = null;

  for (const o of others) {
    if (o.id === part.id) continue;
    const ob = partBox(o, tCm);
    // Sharing a cross-section is what makes a board an obstacle rather than a
    // neighbour: boards whose faces merely touch sit alongside, they don't block.
    if (cross.some((a) => overlap1D(pb.min[a], pb.max[a], ob.min[a], ob.max[a]) <= EPS)) continue;
    if (ob.max[axis] <= pb.min[axis] + EPS) lo = lo === null ? ob.max[axis] : Math.max(lo, ob.max[axis]);
    if (ob.min[axis] >= pb.max[axis] - EPS) hi = hi === null ? ob.min[axis] : Math.min(hi, ob.min[axis]);
  }
  return { lo, hi };
}

/** Which end of a board an edge handle is attached to: its high face or its low one. */
export type StretchSide = 1 | -1;

/**
 * Drag one edge of a board. That edge follows the pointer to `leadingCm`; the
 * opposite edge stays exactly where it is — the handle the user grabbed says
 * which end is meant to move, so there is nothing to infer.
 *
 * The edge stops at the first board in its path (boards are solid) and snaps
 * flush to it, or to the carcass face, from within SNAP_CM. Returns null only
 * if the result would somehow still overlap.
 */
export function stretchedPart(
  part: Part,
  field: SizeField,
  side: StretchSide,
  leadingCm: number,
  others: Part[],
  tCm: number,
  outerCm: Design["outerCm"],
  /**
   * Where the anchored edge was when the gesture began. Pass it for a live
   * drag: re-reading it from the board every pointer event lets each step's
   * rounding feed into the next, and the "fixed" edge creeps across the piece
   * over the hundred events a single drag produces.
   */
  anchorCm?: number,
): Part | null {
  const axis = fieldAxis(part, field);
  const outer = outerCm[OUTER_DIM[axis]];
  const box = partBox(part, tCm);
  // The edge that was not grabbed is the anchor, and it does not move.
  const anchor = anchorCm ?? (side > 0 ? box.min[axis] : box.max[axis]);

  const faces = blockingFaces(part, others, tCm, axis);
  const bound = side > 0 ? (faces.hi ?? outer / 2) : (faces.lo ?? -outer / 2);

  // Never past the blocker, and flush to it once the edge is close enough that
  // the user clearly means to meet it.
  let leading = side > 0 ? Math.min(leadingCm, bound) : Math.max(leadingCm, bound);
  if (Math.abs(leading - bound) <= SNAP_CM) leading = bound;

  const size = clampN(round1(Math.abs(leading - anchor)), MIN_PART_CM, Math.min(outer, MAX_PART_CM));
  const candidate: Part = {
    ...part,
    [field]: size,
    // Two decimals, not one: half of a 0.1 cm size step is 0.05, and rounding
    // that away would shift the anchored edge by the same amount every event.
    pos: { ...part.pos, [axis]: round2(anchor + (side * size) / 2) },
  };
  return isClear(candidate, others, tCm) ? candidate : null;
}

export interface FillTarget {
  cm: number;
  /** True when the length came from a neighbour, false for the full inner span. */
  matched: boolean;
}

/**
 * What "fill" should resize this board to: the closest neighbour length below
 * its current one, or else the length of the clear slot it stands in.
 */
export function fillTarget(
  part: Part,
  field: SizeField,
  others: Part[],
  tCm: number,
  outerCm: Design["outerCm"],
): FillTarget {
  const axis = fieldAxis(part, field);
  const outer = outerCm[OUTER_DIM[axis]];
  const slot = fillSlot(part, others, tCm, outerCm, axis);
  const span = clampN(round1(slot.hi - slot.lo), MIN_PART_CM, Math.min(outer, MAX_PART_CM));
  const current = part[field];

  // Only a board with a real cut dimension along this axis offers a length worth
  // copying. Seen along its own thickness axis every board is ~2 cm wide, and
  // nobody clicking "fill" on a shelf means "as wide as that divider is thick".
  const neighbours = others
    .filter((o) => o.id !== part.id && o.axis !== axis && inContact(part, o, tCm))
    .map((o) => round1(boxSize(partBox(o, tCm), axis)))
    .filter((cm) => cm >= MIN_PART_CM && cm < current - EPS);

  return neighbours.length ? { cm: Math.max(...neighbours), matched: true } : { cm: span, matched: false };
}

/**
 * Resize one of a board's cut dimensions, holding whichever single joint it has
 * (see rule 1). Returns null when the result would sit inside another board, so
 * the caller can simply ignore an impossible size.
 */
export function resizedPart(
  part: Part,
  field: SizeField,
  value: number,
  others: Part[],
  tCm: number,
  outerCm: Design["outerCm"],
): Part | null {
  const axis = fieldAxis(part, field);
  const outer = outerCm[OUTER_DIM[axis]];
  const next = clampN(round1(value), MIN_PART_CM, Math.min(outer, MAX_PART_CM));
  const delta = next - part[field];
  const sides = contactSides(part, others, tCm, axis);

  // Exactly one side pinned: that face stays put and the free one travels the
  // whole delta (half of which the centre has to move to make that happen).
  const anchored = sides.min !== sides.max;
  const candidate: Part = {
    ...part,
    [field]: next,
    pos: anchored
      ? { ...part.pos, [axis]: round1(part.pos[axis] + (sides.min ? delta / 2 : -delta / 2)) }
      : part.pos,
  };

  // Keep it inside the carcass: a board that grew past a face slides back in.
  const box = partBox(candidate, tCm);
  const half = outer / 2;
  const over = Math.max(0, box.max[axis] - half, -half - box.min[axis]);
  if (over > 0) {
    const push = box.max[axis] - half > 0 ? -over : over;
    candidate.pos = { ...candidate.pos, [axis]: round1(candidate.pos[axis] + push) };
  }

  weldEnds(candidate, others, tCm, axis);
  return isClear(candidate, others, tCm) ? candidate : null;
}

/**
 * Pull an end that stops just short of a board it could join the rest of the
 * way, in place.
 *
 * A board resized by the panel used to land wherever the arithmetic put it, so
 * trimming a shelf by 4 cm left 2 cm of daylight in each corner: connected
 * enough that nothing warned about it, far too little to put a dowel through.
 * Dragging a board has always closed a gap this small; a size edit now does the
 * same, so the piece clicks together the same way however it was built.
 *
 * Only a gap under SNAP_CM counts. A deliberately short shelf is short by
 * 10 cm or more; a sliver is only ever a miss, and it is exactly the miss that
 * reads as a finished corner without being one.
 */
function weldEnds(part: Part, others: Part[], tCm: number, axis: Axis): void {
  const faces = blockingFaces(part, others, tCm, axis);
  const box = partBox(part, tCm);
  let lo = box.min[axis];
  let hi = box.max[axis];

  if (faces.hi !== null && faces.hi - hi > EPS && faces.hi - hi <= SNAP_CM) hi = faces.hi;
  if (faces.lo !== null && lo - faces.lo > EPS && lo - faces.lo <= SNAP_CM) lo = faces.lo;
  if (hi - box.max[axis] === 0 && box.min[axis] - lo === 0) return;

  const field: SizeField = fieldAxis(part, "aCm") === axis ? "aCm" : "bCm";
  part[field] = round1(hi - lo);
  part.pos = { ...part.pos, [axis]: round2((lo + hi) / 2) };
}

/**
 * "Fill" a board along one of its cut dimensions. Matching a neighbour (rule 2)
 * is an ordinary resize, so it keeps the board's joint; otherwise the board is
 * laid across its whole slot (rule 3), which both sizes and places it — a board
 * pushed off to one side has to move to reach the faces at both ends, not just
 * grow symmetrically around wherever it happens to sit.
 */
export function filledPart(
  part: Part,
  field: SizeField,
  others: Part[],
  tCm: number,
  outerCm: Design["outerCm"],
): Part | null {
  const { cm, matched } = fillTarget(part, field, others, tCm, outerCm);
  if (matched) return resizedPart(part, field, cm, others, tCm, outerCm);

  const axis = fieldAxis(part, field);
  const slot = fillSlot(part, others, tCm, outerCm, axis);
  const candidate: Part = {
    ...part,
    [field]: cm,
    pos: { ...part.pos, [axis]: round1((slot.lo + slot.hi) / 2) },
  };
  return isClear(candidate, others, tCm) ? candidate : null;
}
