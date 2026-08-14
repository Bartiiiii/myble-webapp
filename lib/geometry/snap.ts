// Drag-snap: pull a part's face flush against a nearby part (a butt joint).
import { type Axis, type Part, partBox } from "../model";
import { AXES, SNAP_CM, overlap1D } from "./core";

export interface SnapResult {
  pos: { x: number; y: number; z: number };
  snapped: boolean;
  /** Axis the snap closed along, if any. */
  axis?: Axis;
  /** Contact point in carcass space (cm) — where the glow burst plays. */
  contact?: { x: number; y: number; z: number };
}

/**
 * Snap `part` (at its current pos) to the nearest flush face among `others`,
 * within SNAP_CM. Picks the smallest gap closure that lands a real face joint.
 */
export function snap(part: Part, others: Part[], tCm: number): SnapResult {
  const pa = partBox(part, tCm);
  let best: { axis: Axis; delta: number; abs: number; contact: { x: number; y: number; z: number } } | null = null;

  for (const o of others) {
    const pb = partBox(o, tCm);
    for (const axis of AXES) {
      const others2 = AXES.filter((a) => a !== axis) as Axis[];
      // Require real overlap on the two non-touching axes (so it's a face joint).
      const ov0 = overlap1D(pa.min[others2[0]], pa.max[others2[0]], pb.min[others2[0]], pb.max[others2[0]]);
      const ov1 = overlap1D(pa.min[others2[1]], pa.max[others2[1]], pb.min[others2[1]], pb.max[others2[1]]);
      if (ov0 <= 0 || ov1 <= 0) continue;

      // Two ways the faces can meet on this axis.
      const candidates = [pb.min[axis] - pa.max[axis], pb.max[axis] - pa.min[axis]];
      for (const delta of candidates) {
        const abs = Math.abs(delta);
        if (abs > SNAP_CM) continue;
        if (!best || abs < best.abs) {
          const c = { x: part.pos.x, y: part.pos.y, z: part.pos.z };
          c[axis] = c[axis] + delta;
          // Contact point: centre of the shared overlap, on the touching plane.
          const contact = { x: 0, y: 0, z: 0 };
          contact[axis] = (Math.min(pa.max[axis] + delta, pb.max[axis]) + Math.max(pa.min[axis] + delta, pb.min[axis])) / 2;
          contact[others2[0]] = (Math.max(pa.min[others2[0]], pb.min[others2[0]]) + Math.min(pa.max[others2[0]], pb.max[others2[0]])) / 2;
          contact[others2[1]] = (Math.max(pa.min[others2[1]], pb.min[others2[1]]) + Math.min(pa.max[others2[1]], pb.max[others2[1]])) / 2;
          best = { axis, delta, abs, contact };
        }
      }
    }
  }

  if (!best) return { pos: { ...part.pos }, snapped: false };
  const pos = { ...part.pos };
  pos[best.axis] = pos[best.axis] + best.delta;
  return { pos, snapped: true, axis: best.axis, contact: best.contact };
}
