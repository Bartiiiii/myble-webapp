// Edge-banding geometry (spec §6.6): exposed edges get banded, buried (jointed)
// edges stay raw; the "don't band the back" lever drops the wall-facing edges.
import {
  type Design,
  type EdgeKey,
  type Part,
  EDGE_KEYS,
  edgeDir,
  partBox,
  thicknessCm,
} from "../model";
import { EPS } from "./core";

const OUT_DELTA = 0.3; // how far outside the edge to probe for a covering part
const SAMPLES = 5;

const aWorld = (p: Part) => (p.axis === "x" ? "y" : "x");
const bWorld = (p: Part) => (p.axis === "z" ? "y" : "z");

function pointInBox(
  pt: { x: number; y: number; z: number },
  box: ReturnType<typeof partBox>,
): boolean {
  return (
    pt.x >= box.min.x - EPS &&
    pt.x <= box.max.x + EPS &&
    pt.y >= box.min.y - EPS &&
    pt.y <= box.max.y + EPS &&
    pt.z >= box.min.z - EPS &&
    pt.z <= box.max.z + EPS
  );
}

/** Is this edge buried by (flush against the face of) another part? */
function edgeBuried(part: Part, edge: EdgeKey, others: Part[], tCm: number): boolean {
  const dir = edgeDir(part, edge); // outward unit vector
  const spanAxis = edge === "left" || edge === "right" ? bWorld(part) : aWorld(part);
  const spanLen = edge === "top" || edge === "bottom" ? part.aCm : part.bCm;
  const { pos } = part;

  // Edge midpoint = part centre offset outward by half the in-plane dim it sits on.
  const outHalf = (edge === "top" || edge === "bottom" ? part.bCm : part.aCm) / 2;
  const mid = {
    x: pos.x + dir.x * outHalf,
    y: pos.y + dir.y * outHalf,
    z: pos.z + dir.z * outHalf,
  };

  const boxes = others.map((o) => partBox(o, tCm));
  let buriedSamples = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const f = i / (SAMPLES - 1) - 0.5; // -0.5..0.5 across the edge span
    const along = f * spanLen;
    const probe = {
      x: mid.x + dir.x * OUT_DELTA + (spanAxis === "x" ? along : 0),
      y: mid.y + dir.y * OUT_DELTA + (spanAxis === "y" ? along : 0),
      z: mid.z + dir.z * OUT_DELTA + (spanAxis === "z" ? along : 0),
    };
    if (boxes.some((b) => pointInBox(probe, b))) buriedSamples++;
  }
  return buriedSamples * 2 >= SAMPLES; // majority covered ⇒ buried
}

const isBackEdge = (part: Part, edge: EdgeKey) => edgeDir(part, edge).z <= -0.99;

/**
 * Which of a part's four edges are banded, given the whole design.
 * exposed → banded; buried → raw; "don't band the back" drops rear edges;
 * an explicit `bandOverride` always wins.
 */
export function bandedEdges(part: Part, design: Design): Record<EdgeKey, boolean> {
  const t = thicknessCm(design);
  const others = design.parts.filter((p) => p.id !== part.id);
  const out = {} as Record<EdgeKey, boolean>;
  for (const e of EDGE_KEYS) {
    const override = part.bandOverride?.[e];
    if (override !== undefined) {
      out[e] = override;
      continue;
    }
    let banded = !edgeBuried(part, e, others, t); // exposed ⇒ banded
    if (banded && !design.bandBack && isBackEdge(part, e)) banded = false;
    out[e] = banded;
  }
  return out;
}

/** The exposed (un-buried) edges of a part, ignoring bandBack/overrides. */
export function exposedEdges(part: Part, design: Design): Record<EdgeKey, boolean> {
  const t = thicknessCm(design);
  const others = design.parts.filter((p) => p.id !== part.id);
  const out = {} as Record<EdgeKey, boolean>;
  for (const e of EDGE_KEYS) out[e] = !edgeBuried(part, e, others, t);
  return out;
}
