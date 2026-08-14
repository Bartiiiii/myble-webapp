// Proportional resize of the whole piece (spec §6.1): scale positions and the
// in-plane cut dimensions by the per-axis factor, keep board thickness fixed,
// pin the outer walls to the new bounding box, then re-snap to close the small
// thickness-induced gaps so shelves stay wall-to-wall and connected.
import {
  type Axis,
  type Design,
  type Part,
  AABB,
  LIMITS,
  MIN_PART_CM,
  partBox,
  partSize,
  thicknessCm,
} from "../model";
import { AXES, EPS, MIN_CONTACT_CM, SNAP_CM, overlap1D, round1 } from "./core";

const aWorld = (p: Part): Axis => (p.axis === "x" ? "y" : "x");
const bWorld = (p: Part): Axis => (p.axis === "z" ? "y" : "z");

/** The world axes a part's `aCm` and `bCm` run along (never the thickness axis). */
function inPlaneAxes(p: Part): { ax: Axis; dim: "aCm" | "bCm" }[] {
  return [
    { ax: aWorld(p), dim: "aCm" },
    { ax: bWorld(p), dim: "bCm" },
  ];
}

function bounds(parts: Part[], tCm: number): AABB {
  const b: AABB = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };
  for (const p of parts) {
    const box = partBox(p, tCm);
    for (const a of AXES) {
      b.min[a] = Math.min(b.min[a], box.min[a]);
      b.max[a] = Math.max(b.max[a], box.max[a]);
    }
  }
  return b;
}

/** Move one in-plane end of a part to a target coordinate (grow/shrink + reposition). */
function setEnd(p: Part, ax: Axis, dim: "aCm" | "bCm", end: "lo" | "hi", target: number): void {
  const cur = p[dim];
  const lo = p.pos[ax] - cur / 2;
  const hi = p.pos[ax] + cur / 2;
  const nLo = end === "lo" ? target : lo;
  const nHi = end === "hi" ? target : hi;
  const newDim = Math.max(MIN_PART_CM, nHi - nLo);
  p[dim] = newDim;
  p.pos[ax] = (nHi + nLo) / 2;
}

/** Re-snap every part's in-plane ends to nearby opposing faces within SNAP_CM. */
function closeGaps(parts: Part[], tCm: number): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const p of parts) {
      const others = parts.filter((o) => o.id !== p.id);
      for (const { ax, dim } of inPlaneAxes(p)) {
        const perp = AXES.filter((a) => a !== ax) as Axis[];
        const pb = partBox(p, tCm);
        // Candidate opposing faces must overlap on both perpendicular axes.
        const fits = (ob: AABB) =>
          overlap1D(pb.min[perp[0]], pb.max[perp[0]], ob.min[perp[0]], ob.max[perp[0]]) > MIN_CONTACT_CM &&
          overlap1D(pb.min[perp[1]], pb.max[perp[1]], ob.min[perp[1]], ob.max[perp[1]]) > MIN_CONTACT_CM;

        let hiTarget: number | null = null;
        let loTarget: number | null = null;
        for (const o of others) {
          const ob = partBox(o, tCm);
          if (!fits(ob)) continue;
          // hi end meets the other part's lower face.
          const dHi = ob.min[ax] - pb.max[ax];
          if (dHi >= -EPS && dHi <= SNAP_CM && (hiTarget === null || ob.min[ax] < hiTarget)) hiTarget = ob.min[ax];
          // lo end meets the other part's upper face.
          const dLo = pb.min[ax] - ob.max[ax];
          if (dLo >= -EPS && dLo <= SNAP_CM && (loTarget === null || ob.max[ax] > loTarget)) loTarget = ob.max[ax];
        }
        if (hiTarget !== null) setEnd(p, ax, dim, "hi", hiTarget);
        if (loTarget !== null) setEnd(p, ax, dim, "lo", loTarget);
      }
    }
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function scaleParts(design: Design, newOuter: { w: number; h: number; d: number }): Design {
  const t = thicknessCm(design);
  const old = design.outerCm;
  const f = {
    x: old.w > 0 ? newOuter.w / old.w : 1,
    y: old.h > 0 ? newOuter.h / old.h : 1,
    z: old.d > 0 ? newOuter.d / old.d : 1,
  };
  const fByAxis = (a: Axis) => (a === "x" ? f.x : a === "y" ? f.y : f.z);

  // 1) Scale positions and the in-plane cut dims; thickness stays fixed.
  const parts: Part[] = design.parts.map((p) => {
    const np: Part = {
      ...p,
      pos: { x: p.pos.x * f.x, y: p.pos.y * f.y, z: p.pos.z * f.z },
      aCm: Math.max(MIN_PART_CM, p.aCm * fByAxis(aWorld(p))),
      bCm: Math.max(MIN_PART_CM, p.bCm * fByAxis(bWorld(p))),
    };
    return np;
  });

  // 2) Pin the outer walls exactly to the new bounding box on each axis.
  if (parts.length > 0) {
    const b = bounds(parts, t);
    const half = { x: newOuter.w / 2, y: newOuter.h / 2, z: newOuter.d / 2 };
    for (const p of parts) {
      const box = partBox(p, t);
      const [sx, sy, sz] = partSize(p, t);
      const s = { x: sx, y: sy, z: sz };
      for (const a of AXES) {
        if (Math.abs(box.max[a] - b.max[a]) < EPS) p.pos[a] = half[a] - s[a] / 2;
        if (Math.abs(box.min[a] - b.min[a]) < EPS) p.pos[a] = -half[a] + s[a] / 2;
      }
    }
  }

  // 3) Re-snap interior parts to the pinned walls / each other.
  closeGaps(parts, t);

  // 4) Clamp to limits + round.
  const outer = {
    w: clamp(Math.round(newOuter.w), LIMITS.w.min, LIMITS.w.max),
    h: clamp(Math.round(newOuter.h), LIMITS.h.min, LIMITS.h.max),
    d: clamp(Math.round(newOuter.d), LIMITS.d.min, LIMITS.d.max),
  };
  for (const p of parts) {
    p.aCm = round1(Math.max(MIN_PART_CM, p.aCm));
    p.bCm = round1(Math.max(MIN_PART_CM, p.bCm));
    p.pos = { x: round1(p.pos.x), y: round1(p.pos.y), z: round1(p.pos.z) };
  }

  return { ...design, outerCm: outer, parts };
}
