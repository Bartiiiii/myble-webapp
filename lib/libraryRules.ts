// The nine rules every curated Design Library piece has to pass.
//
// The rules engine (lib/rules-engine) judges what a customer builds, and it is
// deliberately forgiving: it advises, it never blocks. The library is the
// opposite case — these are OUR designs, shown as the best the system can do —
// so a library piece has to clear a higher bar, and some of that bar is
// physics the engine does not model at all: a shelf held by one wall (the
// engine assumes both ends are supported), a divider standing on nothing
// (its check only looks at other dividers), a table top's span (only fixed
// shelves get a deflection check). `lib/library.test.ts` runs all of this over
// every curated piece, so a design that breaks a rule fails `npm test`.
//
//   1 load path      every board carries its load down to the floor
//   2 span           no board sags past the engine's own limit
//   3 stability      no tipping while empty; tall pieces say "anchor"
//   4 racking        pieces over 60 cm carry designed-in back boards
//   5 manufacturing  cuttable, drillable, shippable, ≤ 40 parts
//   6 assembly       every joint reachable, assembly sequence exists
//   7 usefulness     real-world proportions for what the piece is for
//   8 duplicates     no two pieces share a layout within 10 cm
//   9 style          36 mm reads as a table; both colours in the mix

import { type Axis, type Design, type Part, MAX_PART_CM, MAX_PARTS, MIN_PART_CM, partBox, thicknessCm } from "./model";
import { intersecting, validate } from "./geometry";
import { drillingPlan } from "./drilling";
import { validateConfiguratorDesign, type UiReport } from "./rules-engine/configurator";
import { enforcedSagLimitMm, shelfDeflection } from "./rules-engine/calc/deflection";
import { CURRENT_CATALOGUE } from "./rules-engine/catalogue";

export type LibraryRule =
  | "load-path"
  | "span"
  | "stability"
  | "racking"
  | "manufacturing"
  | "assembly"
  | "usefulness"
  | "duplicates"
  | "style";

export interface Violation {
  rule: LibraryRule;
  /** The boards at fault (empty for whole-piece findings). */
  partIds: string[];
  detail: string;
}

/** Faces this close count as touching (matches the geometry engine's joint gap). */
const TOUCH = 0.15;
/** How far a support may sit from a board's end, and a divider from the support under it (cm). */
const SUPPORT_REACH_CM = 5;
/** Racking bracing is required above this height (cm) — decision 3 (low benches and tables stay open). */
export const RACKING_FROM_CM = 60;

type Box = ReturnType<typeof partBox>;
interface Board {
  part: Part;
  box: Box;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
const near = (a: number, b: number) => Math.abs(a - b) <= TOUCH;
const centre = (b: Box, axis: Axis) => (b.min[axis] + b.max[axis]) / 2;

/** Two boxes share a face (touching on one axis, real overlap on the other two). */
function touching(a: Box, b: Box): boolean {
  const ov = (["x", "y", "z"] as Axis[]).map((k) => overlap(a.min[k], a.max[k], b.min[k], b.max[k]));
  if (ov.some((o) => o < -TOUCH)) return false;
  return ov.filter((o) => o >= 0.5).length >= 2;
}

function boards(design: Design): Board[] {
  const t = thicknessCm(design);
  return design.parts.map((part) => ({ part, box: partBox(part, t) }));
}

function floorOf(all: Board[]): number {
  return Math.min(...all.map((b) => b.box.min.y));
}

// ── 1 + 2: load path and span ────────────────────────────────────────────────

/** Is upright `v` holding flat board `h` at one end, by a butt joint or from below? */
function holdsEnd(h: Box, v: Box, end: "lo" | "hi"): boolean {
  const zShare = overlap(h.min.z, h.max.z, v.min.z, v.max.z) >= 0.5 * (h.max.z - h.min.z);
  if (!zShare) return false;
  const tip = end === "lo" ? h.min.x : h.max.x;
  // Butt joint: the shelf's end against the upright's face, the upright
  // running past the shelf's full thickness.
  const butt =
    (end === "lo" ? near(v.max.x, tip) : near(v.min.x, tip)) && v.min.y <= h.min.y + TOUCH && v.max.y >= h.max.y - TOUCH;
  if (butt) return true;
  // Bearing: the board rests on the upright's top edge, close to its end.
  const under = near(v.max.y, h.min.y) && overlap(h.min.x, h.max.x, v.min.x, v.max.x) > 0;
  if (!under) return false;
  return end === "lo" ? v.min.x <= h.min.x + SUPPORT_REACH_CM : v.max.x >= h.max.x - SUPPORT_REACH_CM;
}

/** Uprights standing under flat board `h` (their tops touching its underside). */
function uprightsUnder(h: Box, uprights: Board[]): Board[] {
  return uprights.filter(
    (u) =>
      near(u.box.max.y, h.min.y) &&
      overlap(h.min.x, h.max.x, u.box.min.x, u.box.max.x) > 0 &&
      overlap(h.min.z, h.max.z, u.box.min.z, u.box.max.z) > 0,
  );
}

/**
 * Walk the load path up from the floor. A board is grounded when it rests on
 * the floor, or when what holds it is itself grounded:
 *   • a flat board needs a grounded upright at BOTH ends (no cantilevers);
 *   • an upright stands on a grounded flat board, with a grounded upright under
 *     that board within 5 cm (or the board on the floor, or the upright right
 *     at the board's supported end) — a divider mid-span on a shelf is a point
 *     load the shelf was never sized for;
 *   • a back panel, front panel or rail is fixed to two grounded boards.
 */
export function groundedIds(design: Design): Set<string> {
  const all = boards(design);
  const floor = floorOf(all);
  const flat = all.filter((b) => b.part.axis === "y");
  const upright = all.filter((b) => b.part.axis === "x");
  const panel = all.filter((b) => b.part.axis === "z");
  const grounded = new Set<string>(all.filter((b) => near(b.box.min.y, floor) && b.part.axis !== "z").map((b) => b.part.id));
  const isGrounded = (b: Board) => grounded.has(b.part.id);

  for (let changed = true; changed; ) {
    changed = false;
    for (const h of flat) {
      if (isGrounded(h)) continue;
      const support = upright.filter(isGrounded);
      if (support.some((v) => holdsEnd(h.box, v.box, "lo")) && support.some((v) => holdsEnd(h.box, v.box, "hi"))) {
        grounded.add(h.part.id);
        changed = true;
      }
    }
    for (const v of upright) {
      if (isGrounded(v)) continue;
      const stands = flat.filter(
        (h) =>
          isGrounded(h) &&
          near(h.box.max.y, v.box.min.y) &&
          overlap(h.box.min.x, h.box.max.x, v.box.min.x, v.box.max.x) > 0 &&
          overlap(h.box.min.z, h.box.max.z, v.box.min.z, v.box.max.z) >= 0.5 * (v.box.max.z - v.box.min.z),
      );
      const cx = centre(v.box, "x");
      const carried = stands.some((h) => {
        if (near(h.box.min.y, floor)) return true;
        const below = uprightsUnder(h.box, upright).filter(isGrounded);
        if (below.some((u) => Math.abs(centre(u.box, "x") - cx) <= SUPPORT_REACH_CM)) return true;
        // Right at a supported end: the load goes straight into that joint.
        const t = v.box.max.x - v.box.min.x;
        const atLo = cx - h.box.min.x <= SUPPORT_REACH_CM + t && upright.some((u) => isGrounded(u) && holdsEnd(h.box, u.box, "lo"));
        const atHi = h.box.max.x - cx <= SUPPORT_REACH_CM + t && upright.some((u) => isGrounded(u) && holdsEnd(h.box, u.box, "hi"));
        return atLo || atHi;
      });
      if (carried) {
        grounded.add(v.part.id);
        changed = true;
      }
    }
    for (const p of panel) {
      if (isGrounded(p)) continue;
      // A panel carries only itself: fixed along two edges to grounded boards
      // (a back between two uprights, a valance under a top and on a divider)
      // it cannot move.
      const fixedTo = all.filter((o) => o !== p && isGrounded(o) && touching(p.box, o.box));
      if (fixedTo.length >= 2) {
        grounded.add(p.part.id);
        changed = true;
      }
    }
  }
  return grounded;
}

function loadPath(design: Design): Violation[] {
  const grounded = groundedIds(design);
  return design.parts
    .filter((p) => !grounded.has(p.id))
    .map((p) => ({
      rule: "load-path" as const,
      partIds: [p.id],
      detail:
        p.axis === "y"
          ? `${p.id} is not held at both ends by something standing on the floor`
          : p.axis === "x"
            ? `${p.id} does not stand on a supported point`
            : `${p.id} is not fixed between two uprights`,
    }));
}

const MATERIALS = new Map(
  (CURRENT_CATALOGUE as { materials: { material_id: string; moe_bending_Nmm2?: { value: number | null } }[] }).materials.map(
    (m) => [m.material_id, m],
  ),
);
const BOOK_LOAD_KG_M2 = (CURRENT_CATALOGUE as { load_presets: { shelf_load_classes: { books_default: { kg_m2: number } } } })
  .load_presets.shelf_load_classes.books_default.kg_m2;

export interface SpanReport {
  partId: string;
  spanCm: number;
  sagMm: number;
  limitMm: number;
  overhangCm: number;
}

/**
 * Every flat board off the floor, judged like the engine judges a fixed shelf
 * (STRUCT-SHELF-002: book load, conservative sag limit) — tops and desk
 * surfaces included, which the engine itself never checks.
 */
export function spans(design: Design): SpanReport[] {
  const all = boards(design);
  const floor = floorOf(all);
  const upright = all.filter((b) => b.part.axis === "x");
  const moe = MATERIALS.get(design.thickness === 36 ? "ltd_36_p2" : "ltd_18_p2")?.moe_bending_Nmm2?.value ?? 1600;
  const out: SpanReport[] = [];
  for (const h of all.filter((b) => b.part.axis === "y" && !near(b.box.min.y, floor))) {
    const xs: number[] = [];
    for (const v of upright) {
      if (holdsEnd(h.box, v.box, "lo") && near(v.box.max.x, h.box.min.x)) xs.push(h.box.min.x);
      if (holdsEnd(h.box, v.box, "hi") && near(v.box.min.x, h.box.max.x)) xs.push(h.box.max.x);
    }
    for (const u of uprightsUnder(h.box, upright)) xs.push(centre(u.box, "x"));
    if (xs.length < 2) continue; // no span to speak of; the load path rule reports it
    xs.sort((a, b) => a - b);
    let span = 0;
    for (let i = 1; i < xs.length; i++) span = Math.max(span, xs[i] - xs[i - 1]);
    const overhang = Math.max(xs[0] - h.box.min.x, h.box.max.x - xs[xs.length - 1]);
    const spanMm = span * 10;
    const sag =
      spanMm > 0
        ? shelfDeflection({
            span_mm: spanMm,
            depth_mm: (h.box.max.z - h.box.min.z) * 10,
            thickness_mm: design.thickness,
            moe_Nmm2: moe,
            load_kg_m2: BOOK_LOAD_KG_M2,
          }).delta_mm
        : 0;
    out.push({
      partId: h.part.id,
      spanCm: Math.round(span * 10) / 10,
      sagMm: Math.round(sag * 100) / 100,
      limitMm: Math.round(enforcedSagLimitMm(spanMm).limit_mm * 100) / 100,
      overhangCm: Math.round(overhang * 10) / 10,
    });
  }
  return out;
}

/** EN 312 P2 bending strength (N/mm²): the catalogue's 13–20 mm value; the
 *  standard's lower requirement for the 32–40 mm class is used for 36 mm,
 *  which the catalogue does not list yet. */
const BENDING_STRENGTH_NMM2: Record<number, number> = { 18: 11, 36: 8.5 };
/** A person sitting down hard on a seat, as a point load mid-span (N). */
const SEAT_LOAD_N = 1000;
/** Margin a seat keeps against the board's bending strength. */
const SEAT_SAFETY = 2;

export interface SeatReport {
  partId: string;
  spanCm: number;
  /** Bending stress under SEAT_LOAD_N at mid-span, N/mm². */
  stress: number;
  allowed: number;
}

/**
 * Seats (benches, the cat bench): the top surface must take a person sitting
 * in the middle of its longest span with a safety factor of 2 on the board's
 * bending strength: σ = 3PL / (2bt²). Depth (b) matters here, unlike for the
 * spread book load.
 */
export function seatChecks(design: Design): SeatReport[] {
  const all = boards(design);
  const top = Math.max(...all.map((b) => b.box.max.y));
  const allowed = (BENDING_STRENGTH_NMM2[design.thickness] ?? 8.5) / SEAT_SAFETY;
  const bySeat = new Map(spans(design).map((s) => [s.partId, s]));
  return all
    .filter((b) => b.part.axis === "y" && near(b.box.max.y, top) && bySeat.has(b.part.id))
    .map((b) => {
      const s = bySeat.get(b.part.id)!;
      const L = s.spanCm * 10;
      const depth = (b.box.max.z - b.box.min.z) * 10;
      const stress = (3 * SEAT_LOAD_N * L) / (2 * depth * design.thickness ** 2);
      return { partId: b.part.id, spanCm: s.spanCm, stress: Math.round(stress * 100) / 100, allowed };
    });
}

function span(design: Design, seat = false): Violation[] {
  const out: Violation[] = [];
  for (const s of spans(design)) {
    if (s.sagMm > s.limitMm) {
      out.push({ rule: "span", partIds: [s.partId], detail: `${s.partId} spans ${s.spanCm} cm and sags ${s.sagMm} mm under books (limit ${s.limitMm} mm)` });
    }
    if (s.overhangCm > SUPPORT_REACH_CM) {
      out.push({ rule: "span", partIds: [s.partId], detail: `${s.partId} overhangs its last support by ${s.overhangCm} cm (max ${SUPPORT_REACH_CM})` });
    }
  }
  if (seat) {
    for (const c of seatChecks(design)) {
      if (c.stress > c.allowed) {
        out.push({ rule: "span", partIds: [c.partId], detail: `seat ${c.partId} spans ${c.spanCm} cm: ${c.stress} N/mm² under a sitter (max ${c.allowed})` });
      }
    }
  }
  return out;
}

// ── 3: stability ─────────────────────────────────────────────────────────────

/** What the engine says about anchoring and helpers, read the same way everywhere. */
export interface EngineVerdict {
  /** STAB-ANCHOR-002 or STAB-CALC-003 ask for the wall-anchor kit. */
  wallAnchor: boolean;
  /** ASM-PEOPLE-004: two people recommended for assembly. */
  twoPeople: boolean;
  report: UiReport;
}

export function engineVerdict(design: Design): EngineVerdict {
  const report = validateConfiguratorDesign(design, { locale: "en" });
  const fired = (id: string) => report.findings.some((f) => f.rule_id === id && f.verdict === "VIOLATED");
  return {
    wallAnchor: report.report.findings.some((f) => f.requires_anchor && f.verdict === "VIOLATED"),
    twoPeople: fired("ASM-PEOPLE-004"),
    report,
  };
}

function stability(design: Design, verdict: EngineVerdict): Violation[] {
  const out: Violation[] = [];
  // Centre of mass over the floor footprint, with a margin, in both directions.
  const all = boards(design);
  const floor = floorOf(all);
  const feet = all.filter((b) => near(b.box.min.y, floor));
  let m = 0;
  const c = { x: 0, z: 0 };
  for (const b of all) {
    const vol = (b.box.max.x - b.box.min.x) * (b.box.max.y - b.box.min.y) * (b.box.max.z - b.box.min.z);
    m += vol;
    c.x += vol * centre(b.box, "x");
    c.z += vol * centre(b.box, "z");
  }
  c.x /= m;
  c.z /= m;
  for (const axis of ["x", "z"] as const) {
    const lo = Math.min(...feet.map((b) => b.box.min[axis]));
    const hi = Math.max(...feet.map((b) => b.box.max[axis]));
    const margin = Math.max(2, 0.1 * (hi - lo));
    if (c[axis] < lo + margin || c[axis] > hi - margin) {
      out.push({ rule: "stability", partIds: [], detail: `centre of mass sits outside the middle of its footprint on ${axis}` });
    }
  }
  for (const f of verdict.report.findings) {
    if (f.rule_category === "stability" && f.severity >= 4 && f.verdict === "VIOLATED") {
      out.push({ rule: "stability", partIds: f.part_ids, detail: `${f.rule_id}: ${f.message ?? f.rule_name}` });
    }
  }
  return out;
}

// ── 4: racking ───────────────────────────────────────────────────────────────

function racking(design: Design, verdict: EngineVerdict): Violation[] {
  if (design.outerCm.h <= RACKING_FROM_CM) return [];
  return verdict.report.findings
    .filter((f) => (f.rule_id === "STRUCT-BACK-003" || f.rule_id === "STRUCT-BACK-004") && f.verdict === "VIOLATED")
    .map((f) => ({ rule: "racking" as const, partIds: f.part_ids, detail: `${f.rule_id}: needs designed-in back boards or rails above ${RACKING_FROM_CM} cm` }));
}

// ── 5 + 6: manufacturing and assembly ────────────────────────────────────────

/** Engine rule families each library rule owns. */
const ASSEMBLY_RULES = new Set(["ASM-SEQ-001", "ASM-TOOL-002", "ASM-TOOLKIT-003"]);

function manufacturing(design: Design, verdict: EngineVerdict): Violation[] {
  const out: Violation[] = [];
  const v = validate(design);
  if (!v.ok) out.push({ rule: "manufacturing", partIds: v.floatingIds, detail: `geometry: ${v.errors.map((e) => e.code).join(", ")}` });
  if (design.parts.length > MAX_PARTS) out.push({ rule: "manufacturing", partIds: [], detail: `${design.parts.length} parts (max ${MAX_PARTS})` });
  const t = thicknessCm(design);
  for (const p of design.parts) {
    const hits = intersecting(p, design.parts, t);
    if (hits.length > 0) out.push({ rule: "manufacturing", partIds: [p.id, ...hits], detail: `${p.id} crosses ${hits.join(", ")}` });
    if (Math.min(p.aCm, p.bCm) < MIN_PART_CM) out.push({ rule: "manufacturing", partIds: [p.id], detail: `${p.id} is under ${MIN_PART_CM} cm on its short side` });
    if (Math.max(p.aCm, p.bCm) > MAX_PART_CM) out.push({ rule: "manufacturing", partIds: [p.id], detail: `${p.id} is over ${MAX_PART_CM} cm` });
  }
  for (const w of drillingPlan(design).warnings) {
    out.push({ rule: "manufacturing", partIds: [w.partId], detail: `drilling ${w.code}: ${w.detail}` });
  }
  // The outer size the size panel shows must be the boards' real envelope.
  const all = boards(design);
  const env = {
    w: Math.max(...all.map((b) => b.box.max.x)) - Math.min(...all.map((b) => b.box.min.x)),
    h: Math.max(...all.map((b) => b.box.max.y)) - Math.min(...all.map((b) => b.box.min.y)),
    d: Math.max(...all.map((b) => b.box.max.z)) - Math.min(...all.map((b) => b.box.min.z)),
  };
  for (const k of ["w", "h", "d"] as const) {
    if (Math.abs(env[k] - design.outerCm[k]) > 0.11) {
      out.push({ rule: "manufacturing", partIds: [], detail: `outerCm.${k} ${design.outerCm[k]} ≠ boards ${env[k].toFixed(1)}` });
    }
  }
  for (const f of verdict.report.findings) {
    if (f.verdict !== "VIOLATED" && f.verdict !== "REQUIRES_VALIDATION_BLOCKED") continue;
    if (ASSEMBLY_RULES.has(f.rule_id)) continue;
    // Every engine finding at severity 4, plus the manufacturing/shipping
    // advisories that point at a real problem (an under-size board, a pallet).
    const mfgAdvice = f.rule_id === "MFG-MIN-001" || f.rule_id.startsWith("SHIP-") || f.rule_id.startsWith("MAT-");
    if (f.severity >= 4 || (mfgAdvice && f.rule_id !== "SHIP-ECON-004")) {
      out.push({ rule: "manufacturing", partIds: f.part_ids, detail: `${f.rule_id}: ${f.message ?? f.rule_name}` });
    }
  }
  return out;
}

function assembly(verdict: EngineVerdict): Violation[] {
  return verdict.report.findings
    .filter((f) => ASSEMBLY_RULES.has(f.rule_id) && (f.verdict === "VIOLATED" || f.verdict === "REQUIRES_VALIDATION_BLOCKED"))
    .map((f) => ({ rule: "assembly" as const, partIds: f.part_ids, detail: `${f.rule_id}: ${f.message ?? f.rule_name}` }));
}

/** Engine STRUCT-* findings the library rules above do not already own. */
function structural(design: Design, verdict: EngineVerdict): Violation[] {
  return verdict.report.findings
    .filter((f) => f.rule_category === "structural" && (f.verdict === "VIOLATED" || f.verdict === "REQUIRES_VALIDATION_BLOCKED"))
    .filter((f) => !(design.outerCm.h <= RACKING_FROM_CM && f.rule_id === "STRUCT-BACK-004"))
    .filter((f) => f.rule_id !== "STRUCT-BACK-003" && f.rule_id !== "STRUCT-BACK-004")
    .map((f) => ({ rule: (f.rule_id.startsWith("STRUCT-SHELF") ? "span" : "load-path") as LibraryRule, partIds: f.part_ids, detail: `${f.rule_id}: ${f.message ?? f.rule_name}` }));
}

/** Rules 1–6: everything that can be judged from the design alone. `seat`: people sit on its top. */
export function checkDesign(design: Design, verdict: EngineVerdict = engineVerdict(design), seat = false): Violation[] {
  return [
    ...loadPath(design),
    ...span(design, seat),
    ...structural(design, verdict),
    ...stability(design, verdict),
    ...racking(design, verdict),
    ...manufacturing(design, verdict),
    ...assembly(verdict),
  ];
}

// ── 7 + 9: usefulness and style, per kind of piece ───────────────────────────

/** What a piece is for. Drives the proportion check and the board thickness. */
export type PieceKind =
  | "bookcase"
  | "low-bookcase"
  | "cube-shelf"
  | "room-divider"
  | "coffee-table"
  | "side-table"
  | "nightstand"
  | "tv-bench"
  | "sideboard"
  | "desk"
  | "desk-shelf"
  | "bench"
  | "shoe-rack"
  | "console"
  | "storage"
  | "wardrobe"
  | "tv-unit"
  | "kids-desk"
  | "pet"
  | "plant-stand";

interface Envelope {
  /** Outer height range, cm (for desks and tables: the work / top surface). */
  h: [number, number];
  w: [number, number];
  d: [number, number];
  /** Kinds whose top is a table surface are made in 36 mm board (decision 7). */
  thick: boolean;
}

// Ranges from the inspiration sweep (_fable/packet/research/INSPIRATION_SHEET.md):
// seat 42–50, desk 72–76, coffee table 35–48, nightstand 45–70, TV bench 35–60.
export const ENVELOPES: Record<PieceKind, Envelope> = {
  bookcase: { h: [100, 200], w: [40, 160], d: [25, 45], thick: false },
  "low-bookcase": { h: [55, 100], w: [60, 200], d: [25, 45], thick: false },
  "cube-shelf": { h: [35, 160], w: [35, 160], d: [28, 45], thick: false },
  // Half-height dividers stand free; above 100 cm a divider needs fixing.
  "room-divider": { h: [80, 200], w: [70, 200], d: [30, 45], thick: false },
  "coffee-table": { h: [35, 48], w: [60, 140], d: [40, 80], thick: true },
  // Nesting tables run low: the small one of a pair lives under the big one.
  "side-table": { h: [34, 65], w: [30, 65], d: [30, 60], thick: true },
  nightstand: { h: [45, 70], w: [30, 65], d: [28, 45], thick: false },
  "tv-bench": { h: [35, 60], w: [100, 200], d: [30, 50], thick: false },
  sideboard: { h: [55, 95], w: [80, 200], d: [30, 50], thick: false },
  desk: { h: [72, 76], w: [70, 160], d: [45, 80], thick: true },
  "desk-shelf": { h: [15, 45], w: [50, 140], d: [18, 35], thick: false },
  bench: { h: [42, 50], w: [60, 200], d: [30, 50], thick: false },
  "shoe-rack": { h: [30, 120], w: [40, 140], d: [25, 40], thick: false },
  console: { h: [70, 95], w: [60, 160], d: [25, 45], thick: false },
  storage: { h: [30, 120], w: [40, 160], d: [25, 50], thick: false },
  wardrobe: { h: [120, 200], w: [60, 120], d: [40, 60], thick: false },
  // A low TV bench with a tall bay at one end: the bench sets the seat, the tower the height.
  "tv-unit": { h: [40, 140], w: [80, 200], d: [30, 50], thick: false },
  "kids-desk": { h: [50, 60], w: [50, 100], d: [40, 60], thick: true },
  pet: { h: [35, 120], w: [40, 160], d: [30, 60], thick: false },
  "plant-stand": { h: [40, 120], w: [30, 120], d: [25, 45], thick: false },
};

export interface ItemMeta {
  id: string;
  kind: PieceKind;
  design: Design;
  /** People sit on it (benches always do). */
  seat?: boolean;
  /** Card labels — must match what the engine says. */
  wallAnchor: boolean;
  twoPeople: boolean;
}

export function checkItem(item: ItemMeta, verdict: EngineVerdict = engineVerdict(item.design)): Violation[] {
  const out = checkDesign(item.design, verdict, item.seat || item.kind === "bench");
  const env = ENVELOPES[item.kind];
  const { w, h, d } = item.design.outerCm;
  for (const [k, v] of [["h", h], ["w", w], ["d", d]] as const) {
    const [lo, hi] = env[k];
    if (v < lo || v > hi) out.push({ rule: "usefulness", partIds: [], detail: `${item.kind} ${k} ${v} cm is outside ${lo}–${hi}` });
  }
  if ((item.design.thickness === 36) !== env.thick) {
    out.push({ rule: "style", partIds: [], detail: `${item.kind} should be ${env.thick ? 36 : 18} mm` });
  }
  if (item.wallAnchor !== verdict.wallAnchor) {
    out.push({ rule: "stability", partIds: [], detail: `wall-anchor label says ${item.wallAnchor}, engine says ${verdict.wallAnchor}` });
  }
  if (item.twoPeople !== verdict.twoPeople) {
    out.push({ rule: "assembly", partIds: [], detail: `two-person label says ${item.twoPeople}, engine says ${verdict.twoPeople}` });
  }
  return out;
}

// ── 8: duplicates, and the library-wide part of 9 ────────────────────────────

/** Every board of `a` has a twin in `b` under `match` (one-to-one). */
function twins(a: Design, b: Design, match: (p: Part, q: Part) => boolean): boolean {
  if (a.parts.length !== b.parts.length) return false;
  const used = new Set<number>();
  for (const p of a.parts) {
    const i = b.parts.findIndex((q, j) => !used.has(j) && q.axis === p.axis && match(p, q));
    if (i < 0) return false;
    used.add(i);
  }
  return true;
}

/**
 * Same layout: envelopes within 10 cm on every axis and every board with a
 * twin within 10 cm (centre and size) — a resize of one design, not two.
 */
export function sameLayout(a: Design, b: Design, tolCm = 10): boolean {
  for (const k of ["w", "h", "d"] as const) if (Math.abs(a.outerCm[k] - b.outerCm[k]) > tolCm) return false;
  const close = (p: Part, q: Part) =>
    Math.abs(q.pos.x - p.pos.x) <= tolCm &&
    Math.abs(q.pos.y - p.pos.y) <= tolCm &&
    Math.abs(q.pos.z - p.pos.z) <= tolCm &&
    Math.abs(q.aCm - p.aCm) <= tolCm &&
    Math.abs(q.bCm - p.bCm) <= tolCm;
  return twins(a, b, close);
}

/**
 * Same idea: the boards match once each piece is scaled to a unit box — the
 * "box with one shelf" drawn at three sizes. Variants must differ by at least
 * one structural idea, not just size.
 */
export function sameIdea(a: Design, b: Design, tol = 0.06): boolean {
  const norm = (d: Design, p: Part) => {
    const box = partBox(p, thicknessCm(d));
    const { w, h, d: depth } = d.outerCm;
    return [box.min.x / w, box.max.x / w, box.min.y / h, box.max.y / h, box.min.z / depth, box.max.z / depth];
  };
  return twins(a, b, (p, q) => {
    const np = norm(a, p);
    const nq = norm(b, q);
    return np.every((v, i) => Math.abs(v - nq[i]) <= tol);
  });
}

export function checkLibrary(items: { id: string; design: Design }[]): Violation[] {
  const out: Violation[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const [a, b] = [items[i], items[j]];
      if (sameLayout(a.design, b.design)) {
        out.push({ rule: "duplicates", partIds: [], detail: `${a.id} and ${b.id} share one layout` });
      } else if (sameIdea(a.design, b.design)) {
        out.push({ rule: "duplicates", partIds: [], detail: `${a.id} and ${b.id} are one idea at two sizes` });
      }
    }
  }
  const white = items.filter((i) => i.design.colour === "white").length / Math.max(1, items.length);
  if (white < 0.5 || white > 0.7) {
    out.push({ rule: "style", partIds: [], detail: `${Math.round(white * 100)} % white; the mix should sit near 60/40` });
  }
  return out;
}
