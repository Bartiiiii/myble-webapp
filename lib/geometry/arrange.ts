// Aligning and distributing a group of boards — the drawing-app operations,
// read in furniture terms.
//
// Two things make them mean something here rather than being borrowed UI:
//
//   • They work on the axes the camera has put on screen (see lib/viewAxes),
//     so "align left" is always the left the user is looking at, whatever angle
//     the piece has been turned to.
//   • Distribute equalises the CLEAR GAPS between boards, not their centres.
//     For a stack of shelves that is the difference between "evenly spaced" and
//     "equal compartments", and only the second one is what anybody wants from
//     a bookcase.
//
// Boards are solid here as everywhere else: an arrangement that would push one
// board inside another is dropped rather than applied.
import { type Axis, type Part, partBox, partSize } from "../model";
import { round2 } from "./core";
import { isClear } from "./collide";

/** Which end of the axis a group lines up on. */
export type AlignTo = "min" | "centre" | "max";

/** Below two boards there is nothing to align to. */
export const MIN_TO_ALIGN = 2;
/** Below three, distributing cannot move anything: the ends stay put. */
export const MIN_TO_DISTRIBUTE = 3;

const SIZE_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const sizeAlong = (p: Part, tCm: number, axis: Axis) => partSize(p, tCm)[SIZE_INDEX[axis]];

/** Move a board so its extent along `axis` starts at `min`. */
function placedAt(part: Part, axis: Axis, min: number, tCm: number): Part {
  return { ...part, pos: { ...part.pos, [axis]: round2(min + sizeAlong(part, tCm, axis) / 2) } };
}

/**
 * Commit an arrangement only if it leaves a piece that could actually be built:
 * first as computed, then dropping the individual boards that do not fit, and
 * failing that leaving the design exactly as it was. Never a broken piece.
 */
function commitArrangement(parts: Part[], moved: Map<string, Part>, tCm: number): Part[] {
  const allClear = (candidate: Part[]) =>
    candidate.every((p) => isClear(p, candidate.filter((o) => o.id !== p.id), tCm));

  const full = parts.map((p) => moved.get(p.id) ?? p);
  if (allClear(full)) return full;

  // Keep whatever fits; a board that cannot take its place stays where it is.
  const partial = parts.map((p) => {
    const next = moved.get(p.id);
    if (!next) return p;
    const rest = full.filter((o) => o.id !== p.id);
    return isClear(next, rest, tCm) ? next : p;
  });
  return allClear(partial) ? partial : parts;
}

/**
 * Line the selected boards up on one end — or their shared centre — along
 * `axis`. Boards not in `ids` are left alone.
 */
export function alignParts(
  parts: Part[],
  ids: string[],
  axis: Axis,
  to: AlignTo,
  tCm: number,
): Part[] {
  const chosen = parts.filter((p) => ids.includes(p.id));
  if (chosen.length < MIN_TO_ALIGN) return parts;

  const boxes = chosen.map((p) => partBox(p, tCm));
  const lo = Math.min(...boxes.map((b) => b.min[axis]));
  const hi = Math.max(...boxes.map((b) => b.max[axis]));
  const mid = (lo + hi) / 2;

  const moved = new Map<string, Part>();
  for (const p of chosen) {
    const size = sizeAlong(p, tCm, axis);
    const min = to === "min" ? lo : to === "max" ? hi - size : mid - size / 2;
    moved.set(p.id, placedAt(p, axis, min, tCm));
  }
  return commitArrangement(parts, moved, tCm);
}

/**
 * Space the selected boards evenly along `axis`, keeping the outermost two
 * where they are and giving every gap between them the same clear width.
 */
export function distributeParts(parts: Part[], ids: string[], axis: Axis, tCm: number): Part[] {
  const chosen = parts
    .filter((p) => ids.includes(p.id))
    .sort((a, b) => partBox(a, tCm).min[axis] - partBox(b, tCm).min[axis]);
  if (chosen.length < MIN_TO_DISTRIBUTE) return parts;

  const first = partBox(chosen[0], tCm);
  const last = partBox(chosen[chosen.length - 1], tCm);
  const span = last.max[axis] - first.min[axis];
  const solid = chosen.reduce((sum, p) => sum + sizeAlong(p, tCm, axis), 0);
  const gap = (span - solid) / (chosen.length - 1);
  // Boards already packed tighter than solid: there is no spacing to share out.
  if (gap < 0) return parts;

  const moved = new Map<string, Part>();
  let cursor = first.min[axis];
  for (const p of chosen) {
    moved.set(p.id, placedAt(p, axis, cursor, tCm));
    cursor += sizeAlong(p, tCm, axis) + gap;
  }
  return commitArrangement(parts, moved, tCm);
}
