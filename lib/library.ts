// The curated Design Library: real, orderable pieces authored in the same
// model the configurator uses — so every card can be opened and edited.
//
// Authoring rules (= production constraints, enforced by the model itself):
//   • boards are axis-aligned only (h shelves / v dividers) — no diagonal cuts
//   • colours: white / black; thickness 18 mm for all curated pieces
//   • legacy plank coordinates are interior cm from bottom-left; BOARD = 1.8 cm
//
// Names/descriptions live in lib/i18n.tsx under `library.items.<id>`.
// User-submitted designs will join this list later via the backstage
// approval flow (Supabase `designs` table) — this array is the curated seed.

import { type Design, legacyToDesign, type LegacyDesign, presetDesign } from "./design";

/**
 * Browse categories. `all` is the default pseudo-category (never assigned to an
 * item). Labels live in i18n under `library.categories.<id>`; the emoji is the
 * only visual — it survives translation and reads instantly on a pill.
 */
export const CATEGORIES = [
  { id: "all", emoji: "◆" },
  { id: "shelves", emoji: "▤" },
  { id: "tables", emoji: "▬" },
  { id: "storage", emoji: "▣" },
  { id: "media", emoji: "♪" },
  { id: "office", emoji: "✎" },
  { id: "pets", emoji: "🐱" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
/** Every category a design can actually be filed under (excludes `all`). */
export type ItemCategory = Exclude<CategoryId, "all">;

export interface LibraryItem {
  /** Stable id — also the i18n key (`library.items.<id>`). */
  id: string;
  /** Primary browse category. One per design keeps the pill counts honest. */
  category: ItemCategory;
  design: Design;
}

/** Legacy-format sources for the curated pieces (BOARD = 1.8 cm). */
const L: Record<string, LegacyDesign> = {
  // ── The five hero-showcase pieces, unchanged ─────────────────────────────
  staggered: {
    widthCm: 72, heightCm: 132, depthCm: 34, decor: "bila",
    planks: [
      { id: "cat-1", o: "h", x: 0, y: 28, len: 36 },
      { id: "cat-2", o: "h", x: 34, y: 52, len: 34 },
      { id: "cat-3", o: "h", x: 0, y: 78, len: 36 },
      { id: "cat-4", o: "h", x: 34, y: 102, len: 34 },
      { id: "cat-den", o: "v", x: 40, y: 0, len: 28 },
    ],
  },
  record: {
    widthCm: 100, heightCm: 58, depthCm: 42, decor: "grafit",
    planks: [
      { id: "vin-mid", o: "h", x: 0, y: 27, len: 96 },
      { id: "vin-1", o: "v", x: 30, y: 0, len: 25 },
      { id: "vin-2", o: "v", x: 50, y: 0, len: 25 },
      { id: "vin-3", o: "v", x: 70, y: 0, len: 25 },
    ],
  },
  grid: {
    widthCm: 82, heightCm: 122, depthCm: 33, decor: "bila",
    planks: [
      { id: "cube-v", o: "v", x: 38, y: 0, len: 118 },
      { id: "cube-1", o: "h", x: 0, y: 23, len: 78 },
      { id: "cube-2", o: "h", x: 0, y: 47, len: 78 },
      { id: "cube-3", o: "h", x: 0, y: 71, len: 78 },
      { id: "cube-4", o: "h", x: 0, y: 95, len: 78 },
    ],
  },
  tvbench: {
    widthCm: 130, heightCm: 44, depthCm: 40, decor: "bila",
    planks: [
      { id: "tv-v1", o: "v", x: 42, y: 0, len: 40 },
      { id: "tv-v2", o: "v", x: 84, y: 0, len: 40 },
      { id: "tv-hl", o: "h", x: 0, y: 20, len: 42 },
      { id: "tv-hr", o: "h", x: 86, y: 20, len: 40 },
    ],
  },
  worknook: {
    widthCm: 112, heightCm: 134, depthCm: 45, decor: "grafit",
    planks: [
      { id: "desk-top", o: "h", x: 0, y: 70, len: 108 },
      { id: "desk-vr", o: "v", x: 72, y: 70, len: 60 },
      { id: "desk-u1", o: "h", x: 74, y: 96, len: 34 },
      { id: "desk-u2", o: "h", x: 74, y: 116, len: 34 },
      { id: "desk-vl", o: "v", x: 36, y: 0, len: 70 },
      { id: "desk-l1", o: "h", x: 0, y: 34, len: 36 },
    ],
  },

  // ── New pieces (community-style inspiration) ─────────────────────────────
  /** Hallway bench: open litter-box bay on the left, shelf storage right. */
  catbench: {
    widthCm: 110, heightCm: 48, depthCm: 50, decor: "bila",
    planks: [
      { id: "cb-d", o: "v", x: 64, y: 0, len: 44.4 },
      { id: "cb-s", o: "h", x: 65.8, y: 19, len: 40.6 },
    ],
  },
  /** Low coffee table with a magazine shelf under the top. */
  coffee: {
    widthCm: 100, heightCm: 42, depthCm: 55, decor: "grafit",
    planks: [{ id: "ct-s", o: "h", x: 0, y: 10, len: 96.4 }],
  },
  /** Bedside cubby: open tray up top, closed-feeling bay below. */
  nightstand: {
    widthCm: 42, heightCm: 55, depthCm: 38, decor: "bila",
    planks: [{ id: "ns-s", o: "h", x: 0, y: 30, len: 38.4 }],
  },
  /** Three-bay shoe bench for the hallway. */
  shoebench: {
    widthCm: 96, heightCm: 45, depthCm: 32, decor: "grafit",
    planks: [
      { id: "sb-d1", o: "v", x: 29.5, y: 0, len: 41.4 },
      { id: "sb-d2", o: "v", x: 61, y: 0, len: 41.4 },
    ],
  },
};

export const LIBRARY: LibraryItem[] = [
  { id: "staggered", category: "shelves", design: legacyToDesign(L.staggered) },
  { id: "catbench", category: "pets", design: legacyToDesign(L.catbench) },
  { id: "record", category: "media", design: legacyToDesign(L.record) },
  // The three configurator presets belong here too — same source of truth.
  { id: "police", category: "shelves", design: presetDesign("police") },
  { id: "coffee", category: "tables", design: legacyToDesign(L.coffee) },
  { id: "grid", category: "shelves", design: legacyToDesign(L.grid) },
  { id: "nightstand", category: "tables", design: legacyToDesign(L.nightstand) },
  { id: "tvbench", category: "media", design: legacyToDesign(L.tvbench) },
  { id: "skrinka", category: "storage", design: presetDesign("skrinka") },
  { id: "shoebench", category: "storage", design: legacyToDesign(L.shoebench) },
  { id: "worknook", category: "office", design: legacyToDesign(L.worknook) },
  { id: "stolek", category: "tables", design: presetDesign("stolek") },
];

/** Server-side allowlist: only these ids may receive reactions. */
export const LIBRARY_IDS: readonly string[] = LIBRARY.map((i) => i.id);

/** How many designs sit in each category (drives the pill counts). */
export function categoryCount(id: CategoryId): number {
  return id === "all" ? LIBRARY.length : LIBRARY.filter((i) => i.category === id).length;
}

/**
 * Designs in a category, hottest first. Ties keep the curated array order, so
 * the grid is stable before any reactions exist.
 */
export function sortedByHeat(
  counts: Record<string, number>,
  category: CategoryId = "all",
): LibraryItem[] {
  const pool = category === "all" ? LIBRARY : LIBRARY.filter((i) => i.category === category);
  return [...pool].sort((a, b) => {
    const diff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
    return diff !== 0 ? diff : LIBRARY.indexOf(a) - LIBRARY.indexOf(b);
  });
}
