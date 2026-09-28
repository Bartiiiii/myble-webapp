// Edge banding (spec §6.6). Myble bands every edge of every board — see
// `bandedEdges` for why — so what this module actually computes is which edges
// are EXPOSED, which the rules engine still needs to reason about a design.
import {
  type Design,
  type EdgeKey,
  type Part,
  EDGE_KEYS,
  edgeDir,
  faceAxes,
  partBox,
  thicknessCm,
} from "../model";
import { EPS } from "./core";

const OUT_DELTA = 0.3; // how far outside the edge to probe for a covering part
const SAMPLES = 5;

const aWorld = (p: Part) => faceAxes(p).a;
const bWorld = (p: Part) => faceAxes(p).b;

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

/**
 * Which of a part's four edges are banded: ALL FOUR, on every board, always.
 *
 * Myble bands every edge, including the ones buried inside a joint. It costs a
 * few percent more edge tape than banding only what shows, and buys three
 * things worth more than that:
 *   • meble will only drill a formatka online when all four edges are banded
 *     (meble.pl/plyty-informacje) — raw edges would push every order onto the
 *     manual cnc@meble.pl route,
 *   • their import CSV carries one banding code per DIMENSION, so a part
 *     banded on one edge of a pair can't be expressed in the file at all,
 *   • a sealed edge is what stops chipboard swelling, and the customer decides
 *     later which way the piece faces the room.
 *
 * It stays a function of the part so the exports, the price and the rules
 * engine all read the policy from one place instead of hard-coding `true`.
 */
export function bandedEdges(part: Part, design: Design): Record<EdgeKey, boolean> {
  void part;
  void design;
  const out = {} as Record<EdgeKey, boolean>;
  for (const e of EDGE_KEYS) out[e] = true;
  return out;
}

/** The exposed (un-buried) edges of a part — what a person actually sees. */
export function exposedEdges(part: Part, design: Design): Record<EdgeKey, boolean> {
  const t = thicknessCm(design);
  const others = design.parts.filter((p) => p.id !== part.id);
  const out = {} as Record<EdgeKey, boolean>;
  for (const e of EDGE_KEYS) out[e] = !edgeBuried(part, e, others, t);
  return out;
}
