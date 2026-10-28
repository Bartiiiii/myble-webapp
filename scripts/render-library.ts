// Contact sheet of the curated Design Library: one cell per piece with an
// axonometric view, a front elevation, its size, material, live price, card
// labels and the result of the nine library rules (boards that break a rule
// are drawn red). Every review round of the library is meant to be visual.
//
//   npm run library:render                         → library-contact-sheet.png
//   npm run library:render -- --out sheet.png --ids grid,police --title "Batch 1" --cols 4
//
// No browser, no canvas package: scripts/raster.ts draws and encodes the PNG.

import { writeFileSync } from "node:fs";
import { LIBRARY, type LibraryItem } from "../lib/library";
import { LIBRARY_ITEMS } from "../lib/libraryCopy";
import { quoteDesign } from "../lib/quote";
import { checkDesign, checkItem, engineVerdict, spans, type Violation } from "../lib/libraryRules";
import { type Design, partBox, thicknessCm } from "../lib/model";
import { Raster, type RGB, type V } from "./raster";

const args = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const CELL_W = 460;
const CELL_H = 600;
const HEAD_H = 70;
const PAD = 16;

const INK: RGB = [24, 24, 27];
const MUTED: RGB = [113, 113, 122];
const INDIGO: RGB = [79, 70, 229];
const RED: RGB = [220, 38, 38];
const GREEN: RGB = [22, 128, 61];
const AMBER: RGB = [180, 83, 9];
const CARD: RGB = [255, 255, 255];
const WALL: RGB = [236, 231, 223];
const PAGE: RGB = [244, 244, 245];

interface Shade {
  top: RGB;
  front: RGB;
  side: RGB;
  edge: RGB;
}
const WHITE_BOARD: Shade = { top: [250, 248, 243], front: [232, 228, 220], side: [206, 201, 192], edge: [120, 115, 108] };
const BLACK_BOARD: Shade = { top: [92, 92, 98], front: [64, 64, 70], side: [46, 46, 51], edge: [168, 168, 175] };
const BAD_BOARD: Shade = { top: [252, 165, 165], front: [239, 104, 104], side: [205, 70, 70], edge: [127, 29, 29] };

// View from the front-right, slightly above: yaw −32°, pitch 24°.
const YAW = (-32 * Math.PI) / 180;
const PITCH = (24 * Math.PI) / 180;
function project(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const x1 = x * Math.cos(YAW) + z * Math.sin(YAW);
  const z1 = -x * Math.sin(YAW) + z * Math.cos(YAW);
  const y2 = y * Math.cos(PITCH) - z1 * Math.sin(PITCH);
  const z2 = y * Math.sin(PITCH) + z1 * Math.cos(PITCH);
  return { x: x1, y: y2, z: z2 };
}

function boxCorners(design: Design) {
  const t = thicknessCm(design);
  return design.parts.map((p) => ({ part: p, box: partBox(p, t) }));
}

/** Axonometric view of a design into `r`, fitted to the region. */
function drawAxo(r: Raster, design: Design, bad: Set<string>, rx: number, ry: number, rw: number, rh: number): void {
  const boxes = boxCorners(design);
  const pts = boxes.flatMap(({ box }) =>
    [box.min.x, box.max.x].flatMap((x) =>
      [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) => project(x, y, z))),
    ),
  );
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  // One scale for everything up to ~180 cm, so pieces compare by size; only
  // the big ones shrink to fit.
  const scale = Math.min(1.9, (rw - 20) / (maxX - minX), (rh - 20) / (maxY - minY));
  const ox = rx + rw / 2 - ((minX + maxX) / 2) * scale;
  const oy = ry + rh / 2 + ((minY + maxY) / 2) * scale;
  const toScreen = (x: number, y: number, z: number): V => {
    const p = project(x, y, z);
    return { x: ox + p.x * scale, y: oy - p.y * scale, z: p.z };
  };

  // Floor shadow under the footprint.
  const floor = Math.min(...boxes.map((b) => b.box.min.y));
  const fx0 = Math.min(...boxes.map((b) => b.box.min.x)) - 3;
  const fx1 = Math.max(...boxes.map((b) => b.box.max.x)) + 3;
  const fz0 = Math.min(...boxes.map((b) => b.box.min.z)) - 3;
  const fz1 = Math.max(...boxes.map((b) => b.box.max.z)) + 3;
  r.clearDepth();
  r.quad(
    [toScreen(fx0, floor, fz0), toScreen(fx1, floor, fz0), toScreen(fx1, floor, fz1), toScreen(fx0, floor, fz1)].map((v) => ({ ...v, z: v.z - 1e4 })),
    [214, 208, 199],
  );

  const shadeOf = (id: string) => (bad.has(id) ? BAD_BOARD : design.colour === "black" ? BLACK_BOARD : WHITE_BOARD);
  const faces: { quad: V[]; col: RGB; edge: RGB }[] = [];
  for (const { part, box } of boxes) {
    const s = shadeOf(part.id);
    const { min: a, max: b } = box;
    // Visible faces from this view: top (+y), front (+z), right (+x).
    faces.push({ quad: [toScreen(a.x, b.y, a.z), toScreen(b.x, b.y, a.z), toScreen(b.x, b.y, b.z), toScreen(a.x, b.y, b.z)], col: s.top, edge: s.edge });
    faces.push({ quad: [toScreen(a.x, a.y, b.z), toScreen(b.x, a.y, b.z), toScreen(b.x, b.y, b.z), toScreen(a.x, b.y, b.z)], col: s.front, edge: s.edge });
    faces.push({ quad: [toScreen(b.x, a.y, a.z), toScreen(b.x, a.y, b.z), toScreen(b.x, b.y, b.z), toScreen(b.x, b.y, a.z)], col: s.side, edge: s.edge });
  }
  for (const f of faces) r.quad(f.quad, f.col);
  for (const f of faces) for (let i = 0; i < 4; i++) r.line(f.quad[i], f.quad[(i + 1) % 4], f.edge);
}

/** Front elevation (looking at the front, back boards first), fitted to the region. */
function drawFront(r: Raster, design: Design, bad: Set<string>, rx: number, ry: number, rw: number, rh: number): void {
  r.rect(rx, ry, rw, rh, WALL);
  const boxes = boxCorners(design).sort((p, q) => p.box.max.z - q.box.max.z);
  const minX = Math.min(...boxes.map((b) => b.box.min.x));
  const maxX = Math.max(...boxes.map((b) => b.box.max.x));
  const minY = Math.min(...boxes.map((b) => b.box.min.y));
  const maxY = Math.max(...boxes.map((b) => b.box.max.y));
  const scale = Math.min((rw - 16) / (maxX - minX), (rh - 16) / (maxY - minY));
  const ox = rx + rw / 2 - ((minX + maxX) / 2) * scale;
  const oy = ry + rh / 2 + ((minY + maxY) / 2) * scale;
  for (const { part, box } of boxes) {
    const s = bad.has(part.id) ? BAD_BOARD : design.colour === "black" ? BLACK_BOARD : WHITE_BOARD;
    const x = ox + box.min.x * scale;
    const y = oy - box.max.y * scale;
    const w = Math.max(1, (box.max.x - box.min.x) * scale);
    const h = Math.max(1, (box.max.y - box.min.y) * scale);
    r.rect(x, y, w, h, part.axis === "z" ? s.side : s.front);
    r.frame(x, y, w, h, s.edge);
  }
  r.rect(rx + 4, oy - minY * scale, rw - 8, 1, MUTED); // floor line
}

interface SheetItem {
  id: string;
  name: string;
  design: Design;
  item?: LibraryItem;
}

function renderCell(entry: SheetItem): { cell: Raster; violations: Violation[] } {
  const r = new Raster(CELL_W, CELL_H, CARD);
  const verdict = engineVerdict(entry.design);
  const violations = entry.item?.kind
    ? checkItem(
        { id: entry.id, kind: entry.item.kind, design: entry.design, wallAnchor: !!entry.item.wallAnchor, twoPeople: !!entry.item.twoPeople },
        verdict,
      )
    : checkDesign(entry.design, verdict);
  const bad = new Set(violations.flatMap((v) => v.partIds));

  r.text(PAD, 12, entry.id, INDIGO, 2);
  if (entry.item?.category) {
    const cat = entry.item.category.toUpperCase();
    r.text(CELL_W - PAD - Raster.textWidth(cat, 2), 12, cat, MUTED, 2);
  }
  r.text(PAD, 34, entry.name.slice(0, 36), INK, 2);

  r.rect(PAD, 58, CELL_W - 2 * PAD, 300, WALL);
  drawAxo(r, entry.design, bad, PAD, 58, CELL_W - 2 * PAD, 300);
  drawFront(r, entry.design, bad, PAD, 368, 150, 120);

  const { w, h, d } = entry.design.outerCm;
  const price = quoteDesign(entry.design).kitCZK;
  const worst = spans(entry.design).sort((a, b) => b.sagMm / b.limitMm - a.sagMm / a.limitMm)[0];
  const lines: { s: string; c: RGB }[] = [
    { s: `${fmt(w)}×${fmt(h)}×${fmt(d)} CM`, c: INK },
    { s: `${entry.design.colour} ${entry.design.thickness} MM · ${entry.design.parts.length} PARTS`, c: INK },
    { s: `${price.toLocaleString("en-US").replace(/,/g, " ")} KC`, c: INK },
    {
      s: [verdict.wallAnchor ? "ANCHOR" : "", verdict.twoPeople ? "2 PEOPLE" : ""].filter(Boolean).join(" · ") || "1 PERSON",
      c: verdict.wallAnchor ? AMBER : MUTED,
    },
    { s: worst ? `SAG ${worst.sagMm.toFixed(1)}/${worst.limitMm.toFixed(1)} MM` : "NO SPANS", c: MUTED },
  ];
  const rules = [...new Set(violations.map((v) => v.rule))];
  if (rules.length === 0) lines.push({ s: "9 RULES OK", c: GREEN });
  else lines.push({ s: `X ${rules.slice(0, 2).join(" ")}`, c: RED });
  if (rules.length > 2) lines.push({ s: `X ${rules.slice(2, 4).join(" ")}`, c: RED });
  lines.forEach((l, i) => r.text(178, 370 + i * 22, l.s.slice(0, 22), l.c, 2));

  // The first failures in words, small, across the bottom.
  violations.slice(0, 3).forEach((v, i) => r.text(PAD, 530 + i * 16, `${v.rule}: ${v.detail}`.slice(0, 70), RED, 1));
  return { cell: r, violations };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function renderSheet(entries: SheetItem[], title: string, cols: number): { png: Buffer; failing: Map<string, Violation[]> } {
  const rows = Math.ceil(entries.length / cols);
  const W = cols * CELL_W + (cols + 1) * PAD;
  const H = HEAD_H + rows * CELL_H + (rows + 1) * PAD;
  const sheet = new Raster(W, H, PAGE);
  const failing = new Map<string, Violation[]>();
  entries.forEach((e, i) => {
    const { cell, violations } = renderCell(e);
    if (violations.length > 0) failing.set(e.id, violations);
    const cx = PAD + (i % cols) * (CELL_W + PAD);
    const cy = HEAD_H + PAD + Math.floor(i / cols) * (CELL_H + PAD);
    sheet.blit(cell, cx, cy);
  });
  sheet.text(PAD, 18, title, INK, 3);
  const summary = `${entries.length} DESIGNS · ${entries.length - failing.size} PASS ALL 9 RULES · ${failing.size} FAIL`;
  sheet.text(PAD, 48, summary, failing.size > 0 ? RED : GREEN, 2);
  return { png: sheet.png(), failing };
}

function main(): void {
  const ids = arg("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
  const out = arg("out") ?? "library-contact-sheet.png";
  const cols = Number(arg("cols") ?? 4);
  const title = arg("title") ?? "MYBLE DESIGN LIBRARY";
  const names = (id: string) => LIBRARY_ITEMS.en[id]?.n ?? id;
  const pool = ids ? ids.map((id) => LIBRARY.find((i) => i.id === id)).filter((i): i is LibraryItem => !!i) : LIBRARY;
  const entries: SheetItem[] = pool.map((item) => ({ id: item.id, name: names(item.id), design: item.design, item }));
  const { png, failing } = renderSheet(entries, title, cols);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${entries.length} designs, ${failing.size} failing)`);
  for (const [id, vs] of failing) for (const v of vs) console.log(`  ✗ ${id} [${v.rule}] ${v.detail}`);
}

main();
