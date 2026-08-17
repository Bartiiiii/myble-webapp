// The curated Design Library: real, orderable pieces authored in the same
// model the configurator uses — so every card can be opened and edited.
//
// Authoring rules (= production constraints, enforced by the model itself):
//   • boards are axis-aligned only (h shelves / v dividers) — no diagonal cuts
//   • colours: white / black; thickness 18 mm for all curated pieces
//   • legacy plank coordinates are interior cm from bottom-left; BOARD = 1.8 cm
//   • width and height stay within LIMITS (≤ 120 cm) so the piece ships in one parcel
//   • every plank butts against a wall or another plank — nothing floats
//   • planks never cross each other; a divider spanning several bays is cut into
//     one board per bay, exactly as the workshop would make it
//
// `lib/library.test.ts` runs the real validator over every entry below, so a
// design that breaks any of the above fails CI instead of greeting a customer
// with red boxes the moment they open it.
//
// Interior span for a piece is (w - 3.6) × (h - 3.6): a plank at x = 0 meets the
// left wall, one ending at w - 3.6 meets the right wall.
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
  /** Half-width shelves alternating left/right, each anchored to its own wall. */
  staggered: {
    widthCm: 72, heightCm: 118, depthCm: 34, decor: "bila",
    planks: [
      { id: "cat-den", o: "v", x: 33.4, y: 0, len: 28 },
      { id: "cat-1", o: "h", x: 0, y: 28, len: 33.4 },
      { id: "cat-2", o: "h", x: 35.2, y: 28, len: 33.2 },
      { id: "cat-3", o: "h", x: 0, y: 57, len: 40 },
      { id: "cat-4", o: "h", x: 28.4, y: 85, len: 40 },
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
  /** 2 × 5 cube grid: full-width shelves, with the centre divider cut per bay. */
  grid: {
    widthCm: 82, heightCm: 118, depthCm: 33, decor: "bila",
    planks: [
      { id: "cube-1", o: "h", x: 0, y: 21.4, len: 78.4 },
      { id: "cube-2", o: "h", x: 0, y: 44.6, len: 78.4 },
      { id: "cube-3", o: "h", x: 0, y: 67.8, len: 78.4 },
      { id: "cube-4", o: "h", x: 0, y: 91, len: 78.4 },
      { id: "cube-v0", o: "v", x: 38.3, y: 0, len: 21.4 },
      { id: "cube-v1", o: "v", x: 38.3, y: 23.2, len: 21.4 },
      { id: "cube-v2", o: "v", x: 38.3, y: 46.4, len: 21.4 },
      { id: "cube-v3", o: "v", x: 38.3, y: 69.6, len: 21.4 },
      { id: "cube-v4", o: "v", x: 38.3, y: 92.8, len: 21.6 },
    ],
  },
  /** Three bays: a tall open middle for the box, split shelves either side. */
  tvbench: {
    widthCm: 118, heightCm: 44, depthCm: 40, decor: "bila",
    planks: [
      { id: "tv-v1", o: "v", x: 37, y: 0, len: 40.4 },
      { id: "tv-v2", o: "v", x: 75.6, y: 0, len: 40.4 },
      { id: "tv-hl", o: "h", x: 0, y: 19, len: 37 },
      { id: "tv-hr", o: "h", x: 77.4, y: 19, len: 37 },
    ],
  },
  /** Desk surface at 73.6 cm off the floor, storage below it and shelves above. */
  worknook: {
    widthCm: 112, heightCm: 118, depthCm: 45, decor: "grafit",
    planks: [
      { id: "desk-vl", o: "v", x: 36.3, y: 0, len: 70 },
      { id: "desk-l1", o: "h", x: 0, y: 34, len: 36.3 },
      { id: "desk-top", o: "h", x: 0, y: 70, len: 108.4 },
      { id: "desk-vr", o: "v", x: 71.8, y: 71.8, len: 42.6 },
      { id: "desk-u1", o: "h", x: 73.6, y: 85, len: 34.8 },
      { id: "desk-u2", o: "h", x: 73.6, y: 100, len: 34.8 },
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
