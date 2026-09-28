// ─────────────────────────────────────────────────────────────────────────────
// Dowel drilling plan — the holes meble drills so a flat-pack kit assembles into
// a rigid piece. This is the production half of geometry/joints.ts.
// ─────────────────────────────────────────────────────────────────────────────
// `detectJoints()` already finds every butt joint and the 8 mm dowel centres, in
// CARCASS space (cm, centre-origin). meble cannot use that: their cut planner
// works one formatka at a time, in that board's own 2-D frame, in millimetres.
// This module does the translation.
//
// Every joint drills TWO boards:
//   • the board whose THICKNESS runs along the joint axis takes the holes in its
//     FACE      → meble "wiercenie w płaszczyźnie" (Powierzchnia + Wsp X/Y)
//   • the board that butts into it end-on takes the holes in its END
//     → meble "wiercenie w czole" (edge 1–4 + position along that edge)
// A dowel then spans the two, which is what makes the joint rigid — the shelf
// can't sag out of the wall and the box can't rack.
//
// FORMATKA FRAME — matches meble's own, verified against their preview code:
//   The board is the rectangle meble bills: X = `aCm` (Szerokość) measured from
//   the LEFT edge, Y = `bCm` (Wysokość) measured from the BOTTOM edge, origin
//   bottom-left. Their edge numbering on that rectangle is 1 = top, 2 = right,
//   3 = bottom, 4 = left. The board's `+axis` face is "front" (Przód), the
//   other "back" (Tył); coordinates are the same for both (see
//   MIRROR_BACK_SURFACE_X).

import {
  type Axis,
  type Design,
  type EdgeKey,
  type Part,
  faceAxes,
} from "./model";
import { detectJoints } from "./geometry";

// --- Hardware & machine limits ----------------------------------------------
// One place for every number meble's drilling form wants. The depths assume a
// 8 × 30 mm dowel: 12 mm buried in the panel face + 20 mm in the butting end
// leaves 2 mm of glue clearance. UNVERIFIED against meble's depth dropdown —
// confirm on the first order (their form only offers certain fixed depths).
export const DOWEL = {
  diameterMm: 8,
  lengthMm: 30,
  /** Blind hole into the panel face. */
  faceDepthMm: 12,
  /** Hole into the butting board's end. */
  edgeDepthMm: 20,
  /** Material that must remain behind a blind face hole. */
  minWallMm: 5,
  /** meble: "Minimalna odległość między nawiertami to 5mm." */
  minHoleGapMm: 5,
  /** Hole centre to the formatka's edge — a hole any closer blows out. */
  minEdgeMarginMm: 8,
} as const;

/**
 * The limits meble's own form enforces, read off their validator (rozkroj.js).
 * Ours are stricter, but a design that trips one of these is rejected at their
 * counter, so the plan checks against theirs rather than only against ours.
 */
export const MEBLE_LIMITS = {
  /** Face hole: centre must be ≥ the bit's RADIUS from either edge. */
  faceMarginIsRadius: true,
  /** Edge ("w czole") hole: "Odległość od 0" must be ≥ 20 mm and ≤ len − 20 mm. */
  edgeOffsetMinMm: 20,
} as const;

/**
 * Does meble read Wsp X mirrored when Powierzchnia = Tył?
 *
 * NO — verified in their own preview code (rozkroj.js): a hole is drawn at
 * `cx = wspX`, `cy = height − wspY` for BOTH surfaces, and only the colour
 * changes (black = Przód, red = Tył). So the frame is fixed, bottom-left
 * origin, and Tył holes are given in exactly the same coordinates as Przód.
 * Kept as a switch only because it would be the one-line fix if that ever
 * stopped being true.
 */
export const MIRROR_BACK_SURFACE_X = false;

// --- Types -------------------------------------------------------------------

/** "face" = wiercenie w płaszczyźnie · "edge" = wiercenie w czole. */
export type DrillKind = "face" | "edge";
/** Which side of the board the drill enters. front = the `+axis` face. */
export type Surface = "front" | "back";

/**
 * One row of holes on one board — exactly what meble's form takes as a single
 * entry: a start position plus `count` holes at `pitchMm` ("wielowiert").
 */
export interface DrillRow {
  partId: string;
  kind: DrillKind;
  /** Face rows only. */
  surface?: Surface;
  /** Edge rows only: which of the formatka's four edges is drilled. */
  edge?: EdgeKey;
  /** Centre of the FIRST hole, mm from the formatka's left (X) / bottom (Y). */
  xMm: number;
  yMm: number;
  /** Which way the row of holes runs in the formatka frame. */
  along: "x" | "y";
  count: number;
  /** Centre-to-centre spacing, mm. 0 when `count` is 1. */
  pitchMm: number;
  diameterMm: number;
  depthMm: number;
  /** The part this row joins to — for the assembly sheet, not for meble. */
  mateId: string;
}

export type DrillWarningCode =
  | "edgeMargin" // hole centre too close to a formatka edge
  | "holeGap" // two holes closer than meble's 5 mm minimum
  | "depth" // blind face hole too deep for the board
  | "unsupported"; // a contact we can't express as dowels

export interface DrillWarning {
  code: DrillWarningCode;
  partId: string;
  /** Human-readable detail for the backstage (English — production-facing). */
  detail: string;
}

export interface DrillingPlan {
  rows: DrillRow[];
  byPart: Map<string, DrillRow[]>;
  warnings: DrillWarning[];
  /** Total holes across the whole piece (both boards of every joint). */
  holeCount: number;
  /** Dowels to ship in the fittings bag — one per joint hole PAIR. */
  dowelCount: number;
}

// --- Helpers -----------------------------------------------------------------

const mm = (cm: number) => Math.round(cm * 100) / 10; // cm → mm, 0.1 mm precision
const round1 = (n: number) => Math.round(n * 10) / 10;

/** A carcass-space point in the part's own formatka frame (mm from its corner). */
function toFormatka(part: Part, pt: { x: number; y: number; z: number }) {
  const { a, b } = faceAxes(part);
  return {
    xMm: round1(mm(pt[a] - (part.pos[a] - part.aCm / 2))),
    yMm: round1(mm(pt[b] - (part.pos[b] - part.bCm / 2))),
  };
}

/**
 * Which formatka edge faces the mate, for a board that butts in end-on.
 * `axis` is the joint axis; the mate sits on its `+`/`-` side.
 */
function endEdge(part: Part, axis: Axis, mateIsPositive: boolean): EdgeKey | null {
  const { a, b } = faceAxes(part);
  if (axis === a) return mateIsPositive ? "right" : "left";
  if (axis === b) return mateIsPositive ? "top" : "bottom";
  return null; // the joint axis is the board's thickness — that's a face contact
}

/** Collapse a line of hole centres into meble's start + count + pitch form. */
function toRow(
  base: Omit<DrillRow, "xMm" | "yMm" | "along" | "count" | "pitchMm">,
  points: { xMm: number; yMm: number }[],
): DrillRow {
  const spreadX = Math.max(...points.map((p) => p.xMm)) - Math.min(...points.map((p) => p.xMm));
  const spreadY = Math.max(...points.map((p) => p.yMm)) - Math.min(...points.map((p) => p.yMm));
  const along: "x" | "y" = spreadX >= spreadY ? "x" : "y";
  const sorted = [...points].sort((p, q) => (along === "x" ? p.xMm - q.xMm : p.yMm - q.yMm));
  const first = sorted[0];
  const span = along === "x" ? spreadX : spreadY;
  return {
    ...base,
    xMm: first.xMm,
    yMm: first.yMm,
    along,
    count: sorted.length,
    pitchMm: sorted.length > 1 ? round1(span / (sorted.length - 1)) : 0,
  };
}

// --- The plan ----------------------------------------------------------------

/**
 * Every hole meble has to drill, board by board. Pure: same design in, same
 * plan out, so the export, the price and the assembly sheet can't drift apart.
 */
export function drillingPlan(design: Design): DrillingPlan {
  const tMm = design.thickness;
  const byId = new Map(design.parts.map((p) => [p.id, p]));
  const rows: DrillRow[] = [];
  const warnings: DrillWarning[] = [];
  let dowelCount = 0;

  for (const joint of detectJoints(design)) {
    const a = byId.get(joint.aId);
    const b = byId.get(joint.bId);
    if (!a || !b || joint.dowels.length === 0) continue;
    dowelCount += joint.dowels.length;

    for (const [part, mate] of [
      [a, b],
      [b, a],
    ] as const) {
      const mateIsPositive = mate.pos[joint.axis] > part.pos[joint.axis];

      if (part.axis === joint.axis) {
        // Thickness runs along the joint → the dowel enters this board's face.
        const points = joint.dowels.map((d) => toFormatka(part, d));
        rows.push(
          toRow(
            {
              partId: part.id,
              kind: "face",
              surface: mateIsPositive ? "front" : "back",
              diameterMm: DOWEL.diameterMm,
              depthMm: DOWEL.faceDepthMm,
              mateId: mate.id,
            },
            points,
          ),
        );
        if (DOWEL.faceDepthMm + DOWEL.minWallMm > tMm) {
          warnings.push({
            code: "depth",
            partId: part.id,
            detail: `${DOWEL.faceDepthMm} mm blind hole leaves under ${DOWEL.minWallMm} mm behind it in a ${tMm} mm board.`,
          });
        }
        continue;
      }

      const edge = endEdge(part, joint.axis, mateIsPositive);
      if (!edge) {
        // Neither board presents a face or an end to this contact — a corner
        // kiss the dowel model can't hold. Flag it rather than invent holes.
        warnings.push({
          code: "unsupported",
          partId: part.id,
          detail: `Contact with ${mate.id} on the ${joint.axis} axis can't be dowelled; needs a bracket or a redesign.`,
        });
        continue;
      }

      // The board butts in end-on: hole down the middle of its 18/36 mm end.
      // The dowel centres already sit in the joint plane, so projecting them
      // into this board's frame lands them on that end edge.
      const points = joint.dowels.map((d) => {
        const p = toFormatka(part, d);
        const alongEdge = edge === "left" || edge === "right";
        return {
          xMm: alongEdge ? (edge === "left" ? 0 : mm(part.aCm)) : p.xMm,
          yMm: alongEdge ? p.yMm : edge === "bottom" ? 0 : mm(part.bCm),
        };
      });
      rows.push(
        toRow(
          {
            partId: part.id,
            kind: "edge",
            edge,
            diameterMm: DOWEL.diameterMm,
            depthMm: DOWEL.edgeDepthMm,
            mateId: mate.id,
          },
          points,
        ),
      );
    }
  }

  const byPart = new Map<string, DrillRow[]>();
  for (const row of rows) {
    const list = byPart.get(row.partId);
    if (list) list.push(row);
    else byPart.set(row.partId, [row]);
  }

  for (const [partId, list] of byPart) {
    const part = byId.get(partId);
    if (part) warnings.push(...checkPart(part, list));
  }

  return {
    rows,
    byPart,
    warnings,
    holeCount: rows.reduce((n, r) => n + r.count, 0),
    dowelCount,
  };
}

/**
 * The single number meble's "Odległość od 0" field wants for an end hole.
 * Verified from their preview: on edges 1/3 (top/bottom) it runs from the LEFT,
 * on edges 2/4 (right/left) from the BOTTOM.
 */
export function edgeOffsetMm(row: DrillRow): number {
  return row.edge === "left" || row.edge === "right" ? row.yMm : row.xMm;
}

/** Expand a row back into individual hole centres (validation + preview). */
export function rowHoles(row: DrillRow): { xMm: number; yMm: number }[] {
  return Array.from({ length: row.count }, (_, i) => ({
    xMm: round1(row.xMm + (row.along === "x" ? i * row.pitchMm : 0)),
    yMm: round1(row.yMm + (row.along === "y" ? i * row.pitchMm : 0)),
  }));
}

/** meble rejects holes too close to each other; blow-out is on us to avoid. */
function checkPart(part: Part, list: DrillRow[]): DrillWarning[] {
  const out: DrillWarning[] = [];
  const wMm = mm(part.aCm);
  const hMm = mm(part.bCm);

  for (const row of list) {
    for (const hole of rowHoles(row)) {
      // An END hole sits ON its edge by construction; only the other axis and
      // the face rows have a margin to keep.
      const nearX = row.kind === "edge" && (row.edge === "left" || row.edge === "right");
      const nearY = row.kind === "edge" && (row.edge === "top" || row.edge === "bottom");
      const tooClose =
        (!nearX && Math.min(hole.xMm, wMm - hole.xMm) < DOWEL.minEdgeMarginMm) ||
        (!nearY && Math.min(hole.yMm, hMm - hole.yMm) < DOWEL.minEdgeMarginMm);
      if (tooClose) {
        out.push({
          code: "edgeMargin",
          partId: part.id,
          detail: `Hole at ${hole.xMm}×${hole.yMm} mm sits under ${DOWEL.minEdgeMarginMm} mm from the edge of a ${wMm}×${hMm} mm board.`,
        });
      }
    }
  }

  // meble reject an end hole closer than 20 mm to either end of that edge.
  for (const row of list) {
    if (row.kind !== "edge") continue;
    const alongEdge = row.edge === "left" || row.edge === "right";
    const edgeLenMm = alongEdge ? hMm : wMm;
    for (let i = 0; i < row.count; i++) {
      const off = edgeOffsetMm(row) + i * row.pitchMm;
      if (off < MEBLE_LIMITS.edgeOffsetMinMm || off > edgeLenMm - MEBLE_LIMITS.edgeOffsetMinMm) {
        out.push({
          code: "edgeMargin",
          partId: part.id,
          detail: `End hole ${off} mm along a ${edgeLenMm} mm edge; meble need ${MEBLE_LIMITS.edgeOffsetMinMm}–${edgeLenMm - MEBLE_LIMITS.edgeOffsetMinMm} mm.`,
        });
      }
    }
  }

  // Pairwise gap check, per drilled surface (holes on opposite faces can't clash).
  for (const [, group] of groupBySurface(list)) {
    const holes = group.flatMap(rowHoles);
    for (let i = 0; i < holes.length; i++) {
      for (let j = i + 1; j < holes.length; j++) {
        const gap = Math.hypot(holes[i].xMm - holes[j].xMm, holes[i].yMm - holes[j].yMm);
        if (gap > 0 && gap < DOWEL.diameterMm + DOWEL.minHoleGapMm) {
          out.push({
            code: "holeGap",
            partId: part.id,
            detail: `Two holes ${round1(gap)} mm apart (centre to centre); meble needs ${DOWEL.diameterMm + DOWEL.minHoleGapMm} mm.`,
          });
        }
      }
    }
  }
  return dedupe(out);
}

function groupBySurface(list: DrillRow[]): Map<string, DrillRow[]> {
  const out = new Map<string, DrillRow[]>();
  for (const row of list) {
    const key = row.kind === "face" ? `face:${row.surface}` : `edge:${row.edge}`;
    const group = out.get(key);
    if (group) group.push(row);
    else out.set(key, [row]);
  }
  return out;
}

function dedupe(warnings: DrillWarning[]): DrillWarning[] {
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const key = `${w.code}|${w.partId}|${w.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * A stable fingerprint of one board's drilling. Two boards may only be billed
 * as "same formatka × 2" when their holes land in the same places — otherwise
 * meble would drill the second one to the first one's pattern.
 */
export function drillSignature(rows: DrillRow[] | undefined): string {
  if (!rows || rows.length === 0) return "none";
  return rows
    .map((r) =>
      [
        r.kind,
        r.surface ?? r.edge ?? "",
        r.xMm,
        r.yMm,
        r.along,
        r.count,
        r.pitchMm,
        r.diameterMm,
        r.depthMm,
      ].join(":"),
    )
    .sort()
    .join("|");
}

/** Convenience for the price/cut list: which parts get drilled at all. */
export function drilledPartIds(design: Design): Set<string> {
  return new Set(drillingPlan(design).byPart.keys());
}

// --- Localised labels for the export -----------------------------------------
// meble's form is Polish; the operator entering this reads Polish. The export
// files are supplier-facing, so they carry BOTH terms.

export const SURFACE_PL: Record<Surface, string> = { front: "Przód", back: "Tył" };

/** meble numbers a formatka's edges 1 = top, 2 = right, 3 = bottom, 4 = left. */
export const EDGE_NUMBER: Record<EdgeKey, number> = { top: 1, right: 2, bottom: 3, left: 4 };
export const EDGE_PL: Record<EdgeKey, string> = {
  top: "góra",
  right: "prawa",
  bottom: "dół",
  left: "lewa",
};

/**
 * A plain-language anchor for the drilling sheet, so whoever types this into
 * meble's form can sanity-check the numbers against the physical board.
 */
export function describeRow(row: DrillRow, part: Part | undefined): string {
  // Positions are named after the edges meble numbers on the formatka drawing —
  // "bottom" would mean the bottom of the DRAWING, which on a shelf is its back.
  const from = (edge: EdgeKey) => `edge ${EDGE_NUMBER[edge]} (${EDGE_PL[edge]})`;
  const holes =
    row.count > 1 ? `${row.count}× ⌀${row.diameterMm} mm @ ${row.pitchMm} mm` : `1× ⌀${row.diameterMm} mm`;
  const size = part ? `${mm(part.aCm)}×${mm(part.bCm)} mm board, ` : "";

  if (row.kind === "face") {
    return (
      `${size}${holes}, ${row.depthMm} mm deep into the ${row.surface === "front" ? "front" : "back"} face; ` +
      `first hole ${row.xMm} mm from ${from("left")}, ${row.yMm} mm from ${from("bottom")}, ` +
      `row runs towards ${from(row.along === "x" ? "right" : "top")}`
    );
  }
  const edge = row.edge ?? "left";
  const alongEdge = edge === "left" || edge === "right";
  return (
    `${size}${holes}, ${row.depthMm} mm deep into ${from(edge)}; ` +
    `first hole ${alongEdge ? row.yMm : row.xMm} mm from ${from(alongEdge ? "bottom" : "left")}, ` +
    `centred in the ${part ? "board's " : ""}thickness`
  );
}
