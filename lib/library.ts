// The curated Design Library: real, orderable pieces authored in the same
// model the configurator uses — so every card can be opened and edited.
//
// The drawings live in lib/libraryDesigns.ts (made with lib/libraryKit.ts:
// exterior cm, boards as boxes, 18 or 36 mm). Every piece here must pass the
// nine library rules in lib/libraryRules.ts — load path to the floor, span,
// stability, racking, manufacturing, assembly, usefulness, no duplicates and
// style — and `lib/library.test.ts` runs the rules engine and all nine over
// every entry, so a design that breaks one fails CI instead of greeting a
// customer with a shelf that sags or a piece that wobbles.
//
// Names/descriptions live in lib/libraryCopy.ts (mounted in lib/i18n.tsx under
// `library.items.<id>`). This array is the curated seed; approved community
// submissions join it at runtime as `communityItem()`s (Supabase `designs`
// rows with share_status = 'published' — see /api/library and lib/community.ts).

import type { Design } from "./design";
import { type Author, curatedAuthor } from "./designers";
import type { PieceKind } from "./libraryRules";
import * as D from "./libraryDesigns";

/**
 * Browse categories. `all` is the default pseudo-category (never assigned to an
 * item). Labels live in i18n under `library.categories.<id>`; the glyph is the
 * only visual — it survives translation and reads instantly on a pill.
 *
 * Ids from the first library are kept where the meaning carries over
 * (`tables` is now coffee & side tables, `storage` modular & storage, `media`
 * TV & media, `office` desks & office, `pets` pets & plants), so community
 * designs already filed under them stay where they are.
 */
export const CATEGORIES = [
  { id: "all", emoji: "◆" },
  { id: "shelves", emoji: "▤" },
  { id: "tables", emoji: "▬" },
  { id: "nightstands", emoji: "☾" },
  { id: "media", emoji: "♪" },
  { id: "office", emoji: "✎" },
  { id: "hallway", emoji: "⌂" },
  { id: "storage", emoji: "▣" },
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
  /**
   * Curated only: what the piece is for. Drives the proportion and board
   * checks in lib/libraryRules.ts.
   */
  kind?: PieceKind;
  /** Curated only: people sit on its top (benches are always seats). */
  seat?: boolean;
  /** Curated only: the rules engine asks for the wall-anchor kit (card label; CI keeps it honest). */
  wallAnchor?: boolean;
  /** Curated only: two people recommended to assemble it (card label; CI keeps it honest). */
  twoPeople?: boolean;
}

interface CuratedSpec {
  kind: PieceKind;
  seat?: boolean;
  wallAnchor?: boolean;
  twoPeople?: boolean;
}

/** Curated entry helper — every one is authored by a house designer. */
function curated(id: string, category: ItemCategory, design: Design, spec: CuratedSpec): LibraryItem {
  return {
    id,
    category,
    design,
    source: "curated",
    author: curatedAuthor(id),
    kind: spec.kind,
    seat: spec.seat ?? false,
    wallAnchor: spec.wallAnchor ?? false,
    twoPeople: spec.twoPeople ?? false,
  };
}

export const LIBRARY: LibraryItem[] = [
  curated("police", "shelves", D.police(), { kind: "bookcase", wallAnchor: true }),
  curated("grid", "shelves", D.grid(), { kind: "bookcase", wallAnchor: true }),
  curated("stolek", "nightstands", D.stolek(), { kind: "nightstand" }),
  curated("tvbench", "media", D.tvbench(), { kind: "tv-bench" }),
  curated("record", "media", D.record(), { kind: "sideboard" }),
  curated("shoebench", "hallway", D.shoebench(), { kind: "bench" }),
  curated("catbench", "pets", D.catbench(), { kind: "pet", seat: true }),
  // Batch 1: shelves and storage
  curated("offset", "shelves", D.offset(), { kind: "bookcase", wallAnchor: true, twoPeople: true }),
  curated("slimtower", "shelves", D.slimtower(), { kind: "bookcase", wallAnchor: true }),
  curated("library", "shelves", D.library(), { kind: "bookcase", wallAnchor: true, twoPeople: true }),
  curated("underwindow", "shelves", D.underwindow(), { kind: "low-bookcase" }),
  curated("divider", "shelves", D.divider(), { kind: "room-divider", twoPeople: true }),
  curated("steps", "storage", D.steps(), { kind: "storage", wallAnchor: true }),
  curated("windowseat", "storage", D.windowseat(), { kind: "bench" }),
  curated("toybox", "storage", D.toybox(), { kind: "storage" }),
  curated("wardrobe", "storage", D.wardrobe(), { kind: "wardrobe", wallAnchor: true, twoPeople: true }),
  curated("plantsteps", "pets", D.plantsteps(), { kind: "plant-stand" }),
  // Batch 2: tables (36 mm), nightstands, the cat climber
  curated("podtable", "tables", D.podtable(), { kind: "coffee-table", twoPeople: true }),
  curated("traytable", "tables", D.traytable(), { kind: "coffee-table", twoPeople: true }),
  curated("arch", "tables", D.arch(), { kind: "coffee-table" }),
  curated("nest", "tables", D.nest(), { kind: "side-table", seat: true }),
  curated("utable", "tables", D.utable(), { kind: "side-table" }),
  curated("lipstand", "nightstands", D.lipstand(), { kind: "nightstand" }),
  curated("talltable", "nightstands", D.talltable(), { kind: "nightstand" }),
  curated("lowstand", "nightstands", D.lowstand(), { kind: "nightstand" }),
  curated("catclimber", "pets", D.catclimber(), { kind: "pet", wallAnchor: true }),
];

/** The curated ids, the only ones whose name/story come from the dictionary. */
export const LIBRARY_IDS: readonly string[] = LIBRARY.map((i) => i.id);

/**
 * The curated pieces with backstage's published edits laid over them (see
 * lib/curatedOverrides.ts). Anything without an edit keeps its code version.
 */
export function withCuratedOverrides(overrides: Record<string, Design> | null | undefined): LibraryItem[] {
  if (!overrides) return LIBRARY;
  return LIBRARY.map((item) => (overrides[item.id] ? { ...item, design: overrides[item.id] } : item));
}

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
