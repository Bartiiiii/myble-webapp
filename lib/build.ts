// Builders: box carcass, preset templates, and the legacy planks→parts migration.
import {
  type Colour,
  type Design,
  type Part,
  type Thickness,
  makeId,
} from "./model";

const BOARD = 1.8; // 18 mm default board, in cm (preset/legacy authoring)
const round1 = (n: number) => Math.round(n * 10) / 10; // authoring coords (mm-ish)
// Derived part centres get 0.01 cm. Rounding them to 0.1 like the authoring
// coords costs up to 0.05 cm — exactly the geometry engine's flush tolerance —
// so a board meant to sit against a wall could land a hair off it and read as
// floating, or a hair into its neighbour and read as a clash.
const round2 = (n: number) => Math.round(n * 100) / 100;

// --- Carcass ----------------------------------------------------------------
/**
 * The four carcass walls (left/right/top/bottom) for an outer box, centre-origin.
 * Side walls run the full height and define the left/right exterior; top/bottom
 * are inner-width and sit BETWEEN them (a real flat-pack carcass), so the side
 * walls are the sole x-extremes — which keeps proportional scaling well-behaved.
 */
export function boxWalls(
  outer: { w: number; h: number; d: number },
  tCm = BOARD,
): Part[] {
  const { w, h, d } = outer;
  const inner = Math.max(0, w - 2 * tCm); // top/bottom span the gap between sides
  return [
    { id: makeId(), role: "wall", axis: "x", aCm: h, bCm: d, pos: { x: -w / 2 + tCm / 2, y: 0, z: 0 } },
    { id: makeId(), role: "wall", axis: "x", aCm: h, bCm: d, pos: { x: w / 2 - tCm / 2, y: 0, z: 0 } },
    { id: makeId(), role: "wall", axis: "y", aCm: inner, bCm: d, pos: { x: 0, y: -h / 2 + tCm / 2, z: 0 } },
    { id: makeId(), role: "wall", axis: "y", aCm: inner, bCm: d, pos: { x: 0, y: h / 2 - tCm / 2, z: 0 } },
  ];
}

// --- Legacy plank model (pre-Phase-2) --------------------------------------
export type Orientation = "h" | "v";
export interface LegacyPlank {
  id: string;
  o: Orientation;
  x: number; // cm from interior left
  y: number; // cm from interior bottom
  len: number; // cm along the plank's axis
}
export interface LegacyDesign {
  widthCm: number;
  heightCm: number;
  depthCm: number;
  decor?: "bila" | "dub" | "grafit";
  shelves?: number; // oldest {shelves:N} shape
  planks?: LegacyPlank[];
}

function colourFromDecor(decor: LegacyDesign["decor"]): Colour {
  return decor === "grafit" ? "black" : "white"; // dub/bila → white, grafit → black
}

/** Convert one legacy plank (interior, floor-origin) into a centre-origin Part. */
function plankToPart(pl: LegacyPlank, w: number, h: number, d: number): Part {
  const ix0 = -w / 2 + BOARD; // interior left inner face (centre-origin x)
  if (pl.o === "h") {
    // Horizontal shelf: thickness on Y.
    const xC = ix0 + pl.x + pl.len / 2;
    const yC = BOARD + pl.y + BOARD / 2 - h / 2;
    return { id: pl.id || makeId(), role: "shelf", axis: "y", aCm: pl.len, bCm: d, pos: { x: round2(xC), y: round2(yC), z: 0 } };
  }
  // Vertical divider: thickness on X.
  const xC = ix0 + pl.x + BOARD / 2;
  const yC = BOARD + pl.y + pl.len / 2 - h / 2;
  return { id: pl.id || makeId(), role: "divider", axis: "x", aCm: pl.len, bCm: d, pos: { x: round2(xC), y: round2(yC), z: 0 } };
}

// Build N evenly-spaced full-width shelves (legacy authoring helper).
function evenShelves(widthCm: number, heightCm: number, n: number): LegacyPlank[] {
  const iw = round1(Math.max(0, widthCm - 2 * BOARD));
  const ih = Math.max(0, heightCm - 2 * BOARD);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    o: "h" as const,
    x: 0,
    len: iw,
    y: round1(clamp((ih * (i + 1)) / (n + 1) - BOARD / 2, 0, ih - BOARD)),
  }));
}

function skrinkaPlanks(widthCm: number, heightCm: number): LegacyPlank[] {
  const iw = round1(Math.max(0, widthCm - 2 * BOARD));
  const ih = round1(Math.max(0, heightCm - 2 * BOARD));
  const shelves = evenShelves(widthCm, heightCm, 4);
  // The centre divider is cut into one board per bay. A single full-height plank
  // would have to pass through every shelf — boards are solid, so meble can't
  // make that and the editor would flag it the moment you moved anything.
  const x = round1(iw / 2 - BOARD / 2);
  const dividers: LegacyPlank[] = [];
  let from = 0;
  shelves.forEach((s, i) => {
    dividers.push({ id: `d${i}`, o: "v", x, y: from, len: round1(s.y - from) });
    from = round1(s.y + BOARD);
  });
  dividers.push({ id: `d${shelves.length}`, o: "v", x, y: from, len: round1(ih - from) });
  return [...shelves, ...dividers];
}

/** Migrate any legacy design (carcass + planks, or {shelves:N}) → parts model. */
export function legacyToDesign(legacy: LegacyDesign, thickness: Thickness = 18): Design {
  const w = legacy.widthCm;
  const h = legacy.heightCm;
  const d = legacy.depthCm;
  const planks = Array.isArray(legacy.planks)
    ? legacy.planks
    : evenShelves(w, h, Math.max(0, legacy.shelves ?? 0));
  return {
    colour: colourFromDecor(legacy.decor),
    thickness,
    bandBack: true,
    outerCm: { w, h, d },
    parts: [...boxWalls({ w, h, d }), ...planks.map((pl) => plankToPart(pl, w, h, d))],
  };
}

// --- Presets (quick starts) -------------------------------------------------
export interface Preset {
  id: "police" | "skrinka" | "stolek";
  label: string;
  desc: string;
  colour: Colour;
  legacy: LegacyDesign;
}

export const PRESETS: Preset[] = [
  {
    id: "police",
    label: "Police do niky",
    desc: "Klasika do komínové niky nebo mezi stěny.",
    colour: "white",
    legacy: { widthCm: 73, heightCm: 118, depthCm: 30, decor: "dub", planks: evenShelves(73, 118, 3) },
  },
  {
    id: "skrinka",
    label: "Úzká skříňka",
    desc: "Police i svislá příčka — víc úložného prostoru.",
    colour: "black",
    legacy: { widthCm: 60, heightCm: 118, depthCm: 35, decor: "grafit", planks: skrinkaPlanks(60, 118) },
  },
  {
    id: "stolek",
    label: "Odkládací stolek",
    desc: "Noční nebo do koutu k pohovce.",
    colour: "white",
    legacy: { widthCm: 45, heightCm: 50, depthCm: 45, decor: "bila", planks: evenShelves(45, 50, 1) },
  },
];

export function presetDesign(id: Preset["id"]): Design {
  const p = PRESETS.find((x) => x.id === id)!;
  return legacyToDesign(p.legacy);
}

export const DEFAULT_DESIGN: Design = presetDesign("police");

/** An empty carcass (parts added freely) — the "from scratch" starting point. */
export function emptyDesign(base?: Partial<Pick<Design, "colour" | "thickness" | "outerCm">>): Design {
  const outer = base?.outerCm ?? { w: DEFAULT_DESIGN.outerCm.w, h: DEFAULT_DESIGN.outerCm.h, d: DEFAULT_DESIGN.outerCm.d };
  return {
    colour: base?.colour ?? "white",
    thickness: base?.thickness ?? 18,
    bandBack: true,
    outerCm: { ...outer },
    parts: boxWalls(outer),
  };
}
