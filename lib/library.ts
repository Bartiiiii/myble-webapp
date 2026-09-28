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
// This array is the curated seed; approved community submissions join it at
// runtime as `communityItem()`s (Supabase `designs` rows with
// share_status = 'published' — see /api/library and lib/community.ts).

import { type Design, legacyToDesign, type LegacyDesign, presetDesign } from "./design";
import { type Author, curatedAuthor } from "./designers";

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
  // Last on purpose: the catch-all for what the list above doesn't name. In the
  // share dialog, picking it reveals a free-text "add a new type" field.
  { id: "other", emoji: "◇" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
/** Every category a design can actually be filed under (excludes `all`). */
export type ItemCategory = Exclude<CategoryId, "all">;

export interface LibraryItem {
  /** Curated: the i18n key (`library.items.<id>`). Community: the design slug. */
  id: string;
  /** Primary browse category. One per design keeps the pill counts honest. */
  category: ItemCategory;
  design: Design;
  /**
   * Where the piece came from. Curated entries take their name and story from
   * the i18n dictionary; community entries carry their own title/note, written
   * by the person who shared them.
   */
  source: "curated" | "community";
  /** Who designed it — drawn on the card and linking to /u/<handle>. */
  author: Author;
  /** Community only. */
  title?: string;
  note?: string;
  createdAt?: string;
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

/** Curated entry helper — every one is authored by a house designer. */
function curated(id: string, category: ItemCategory, design: Design): LibraryItem {
  return { id, category, design, source: "curated", author: curatedAuthor(id) };
}

export const LIBRARY: LibraryItem[] = [
  curated("staggered", "shelves", legacyToDesign(L.staggered)),
  curated("catbench", "pets", legacyToDesign(L.catbench)),
  curated("record", "media", legacyToDesign(L.record)),
  curated("police", "shelves", presetDesign("police")),
  curated("coffee", "tables", legacyToDesign(L.coffee)),
  curated("grid", "shelves", legacyToDesign(L.grid)),
  curated("nightstand", "tables", legacyToDesign(L.nightstand)),
  curated("tvbench", "media", legacyToDesign(L.tvbench)),
  curated("skrinka", "storage", presetDesign("skrinka")),
  curated("shoebench", "storage", legacyToDesign(L.shoebench)),
  curated("worknook", "office", legacyToDesign(L.worknook)),
  curated("stolek", "tables", presetDesign("stolek")),
];

/** The curated ids, the only ones whose name/story come from the dictionary. */
export const LIBRARY_IDS: readonly string[] = LIBRARY.map((i) => i.id);

/**
 * A community piece someone shared and backstage approved. Same shape as a
 * curated item, so every card, dialog and sort works on both without knowing
 * which is which — only the name/story lookup differs (see `itemName`).
 */
export interface CommunityDesign {
  slug: string;
  title: string | null;
  note: string | null;
  category: string | null;
  design: Design;
  createdAt: string;
  author: Author;
}

/** The categories a submission may actually claim (everything but `all`). */
const CATEGORY_IDS = new Set<string>(
  CATEGORIES.map((c) => c.id).filter((id): id is ItemCategory => id !== "all"),
);

export function communityItem(d: CommunityDesign): LibraryItem {
  return {
    id: d.slug,
    category: (d.category && CATEGORY_IDS.has(d.category) ? d.category : "shelves") as ItemCategory,
    design: d.design,
    source: "community",
    author: d.author,
    title: d.title ?? undefined,
    note: d.note ?? undefined,
    createdAt: d.createdAt,
  };
}

/** Display name for either kind of item (curated names are translated). */
export function itemName(item: LibraryItem, t: (key: string) => string): string {
  return item.source === "curated" ? t(`library.items.${item.id}.n`) : item.title || t("library.untitled");
}

/** The story under the name. Community pieces may have none. */
export function itemNote(item: LibraryItem, t: (key: string) => string): string {
  return item.source === "curated" ? t(`library.items.${item.id}.d`) : item.note ?? "";
}

/** How many designs sit in each category (drives the pill counts). */
export function categoryCount(id: CategoryId, pool: LibraryItem[] = LIBRARY): number {
  return id === "all" ? pool.length : pool.filter((i) => i.category === id).length;
}

/**
 * Designs in a category, hottest first. Ties keep the pool's own order, so the
 * grid is stable before any reactions exist.
 */
export function sortedByHeat(
  counts: Record<string, number>,
  category: CategoryId = "all",
  pool: LibraryItem[] = LIBRARY,
): LibraryItem[] {
  const filtered = category === "all" ? [...pool] : pool.filter((i) => i.category === category);
  return filtered.sort((a, b) => {
    const diff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
    return diff !== 0 ? diff : pool.indexOf(a) - pool.indexOf(b);
  });
}
