// Shared geometry helpers + tolerances for the Myble part engine.
import { type AABB, type Axis, type Part, partBox } from "../model";

// Tolerances / constants (cm unless noted).
export const EPS = 0.05; // "flush" tolerance — faces this close count as touching
// How far apart two faces may sit and still count as a joint. Positions are
// kept to 0.1 cm, so a board whose half-length ends in .x5 lands up to 0.05 cm
// off a face it was pushed flush against, and float noise tips that past EPS:
// visibly touching, yet flagged as floating. A millimetre and a half absorbs
// every rounding artefact while a gap anyone could see still reads as a gap.
export const CONTACT_GAP_CM = 0.15;
export const SNAP_CM = 3; // drag snap threshold
export const MIN_CONTACT_CM = 0.5; // a real joint must share at least this much edge
export const DOWEL_PITCH_CM = 11; // dowel spacing along a joint (~96–128 mm)
export const DOWEL_END_INSET_CM = 5; // first/last dowel inset from the joint ends
export const DOWEL_DIAM_MM = 8; // 8 mm dowels per the meble sheet

export const AXES: Axis[] = ["x", "y", "z"];

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Signed overlap of two 1-D ranges; negative = gap between them. */
export function overlap1D(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

export function boxCenter(b: AABB, axis: Axis): number {
  return (b.min[axis] + b.max[axis]) / 2;
}
export function boxSize(b: AABB, axis: Axis): number {
  return b.max[axis] - b.min[axis];
}

/**
 * Do two parts form a butt joint (faces flush within EPS on one axis and
 * meaningfully overlapping on the other two)? Also true if their boxes overlap
 * (parts pushed together). Returns the touching axis, or null.
 */
export function contactAxis(a: Part, b: Part, tCm: number): Axis | null {
  const ba = partBox(a, tCm);
  const bb = partBox(b, tCm);
  // Overlap on every axis must be >= -CONTACT_GAP_CM (touching or overlapping,
  // no real gap).
  const ov = {
    x: overlap1D(ba.min.x, ba.max.x, bb.min.x, bb.max.x),
    y: overlap1D(ba.min.y, ba.max.y, bb.min.y, bb.max.y),
    z: overlap1D(ba.min.z, ba.max.z, bb.min.z, bb.max.z),
  };
  if (ov.x < -CONTACT_GAP_CM || ov.y < -CONTACT_GAP_CM || ov.z < -CONTACT_GAP_CM) return null;
  // The "touching" axis is the one with the smallest (near-zero) overlap; the
  // other two must share real area so it's a face joint, not an edge/corner kiss.
  let touch: Axis = "x";
  for (const ax of AXES) if (ov[ax] < ov[touch]) touch = ax;
  for (const ax of AXES) {
    if (ax === touch) continue;
    if (ov[ax] < MIN_CONTACT_CM) return null;
  }
  return touch;
}

export function inContact(a: Part, b: Part, tCm: number): boolean {
  return contactAxis(a, b, tCm) !== null;
}
