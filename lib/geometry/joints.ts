// Joint + dowel detection (spec §7 — data for meble's drilling / assembly).
import { type Axis, type Design, partBox, thicknessCm } from "../model";
import {
  AXES,
  DOWEL_END_INSET_CM,
  DOWEL_PITCH_CM,
  contactAxis,
  overlap1D,
} from "./core";

export interface Joint {
  aId: string;
  bId: string;
  /** Axis along which the two boards butt together. */
  axis: Axis;
  /** 8 mm dowel centres in carcass space (cm). */
  dowels: { x: number; y: number; z: number }[];
  /** The seam line (where the faces meet) in carcass space (cm) — for the accent edge. */
  seam: { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } };
}

function dowelOffsets(lengthCm: number): number[] {
  const usable = lengthCm - 2 * DOWEL_END_INSET_CM;
  if (usable <= 0) return [0]; // tiny joint: a single central dowel
  const count = Math.max(2, Math.floor(usable / DOWEL_PITCH_CM) + 1);
  const step = usable / (count - 1);
  return Array.from({ length: count }, (_, i) => -lengthCm / 2 + DOWEL_END_INSET_CM + i * step);
}

export function detectJoints(design: Design): Joint[] {
  const parts = design.parts;
  const t = thicknessCm(design);
  const joints: Joint[] = [];

  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const axis = contactAxis(parts[i], parts[j], t);
      if (!axis) continue;

      const ba = partBox(parts[i], t);
      const bb = partBox(parts[j], t);
      // Contact plane coordinate on the touching axis (midway between faces).
      const plane = (Math.min(ba.max[axis], bb.max[axis]) + Math.max(ba.min[axis], bb.min[axis])) / 2;

      // Shared overlap rectangle on the other two axes.
      const other = AXES.filter((a) => a !== axis) as Axis[];
      const ranges = other.map((a) => {
        const lo = Math.max(ba.min[a], bb.min[a]);
        const hi = Math.min(ba.max[a], bb.max[a]);
        return { axis: a, lo, hi, mid: (lo + hi) / 2, len: overlap1D(ba.min[a], ba.max[a], bb.min[a], bb.max[a]) };
      });
      // Dowels run along the longer overlap edge; the shorter one is centred.
      ranges.sort((p, q) => q.len - p.len);
      const along = ranges[0];
      const across = ranges[1];

      const dowels = dowelOffsets(along.len).map((off) => {
        const pt = { x: 0, y: 0, z: 0 };
        pt[axis] = plane;
        pt[along.axis] = along.mid + off;
        pt[across.axis] = across.mid;
        return pt;
      });

      const seamPt = (alongCoord: number) => {
        const pt = { x: 0, y: 0, z: 0 };
        pt[axis] = plane;
        pt[along.axis] = alongCoord;
        pt[across.axis] = across.mid;
        return pt;
      };
      const seam = { a: seamPt(along.lo), b: seamPt(along.hi) };

      joints.push({ aId: parts[i].id, bId: parts[j].id, axis, dowels, seam });
    }
  }
  return joints;
}
