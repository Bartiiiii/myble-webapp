// Filters and sorting for the Design Library: what a visitor can narrow the
// grid by besides the category pills (room, width, height, colour, assembly),
// and the order it comes in (hot, newest).
//
// No price here on purpose: the library shows designs, and the price appears
// only once a design is opened in the configurator.
//
// Every tag is derived from the item, so curated and community designs filter
// the same way: size bands from the design's outer size, colour from its
// board, assembly and the wall anchor from the rules engine. Curated pieces
// carry the engine's answer as card labels that CI keeps honest
// (lib/library.test.ts); community pieces get it from /api/library.

import type { ItemCategory, LibraryItem } from "./library";
import type { Colour } from "./model";

/** Rooms a visitor shops for (not the 3D scene a card is drawn in — see lib/rooms.ts). */
export const USE_ROOMS = ["living", "bedroom", "hallway", "office", "kids"] as const;
export type UseRoom = (typeof USE_ROOMS)[number];

/** Outer width: under 60, 60–120, over 120 cm. */
export const WIDTH_BANDS = ["narrow", "medium", "wide"] as const;
export type WidthBand = (typeof WIDTH_BANDS)[number];

/**
 * Outer height: low up to 60 cm (benches, tables, nightstands), mid, tall over
 * 100 cm. Tall is exactly the set the engine wants fixed to the wall; the
 * library test holds every curated piece to that.
 */
export const HEIGHT_BANDS = ["low", "mid", "tall"] as const;
export type HeightBand = (typeof HEIGHT_BANDS)[number];
export const LOW_MAX_CM = 60;
export const TALL_ABOVE_CM = 100;

export const COLOURS = ["white", "black"] as const satisfies readonly Colour[];

export const ASSEMBLY = ["one", "two"] as const;
export type Assembly = (typeof ASSEMBLY)[number];

export const SORTS = ["hot", "newest"] as const;
export type Sort = (typeof SORTS)[number];

/** Hand-picked rooms for the curated pieces; a bookcase suits more than one. */
export const CURATED_USE_ROOMS: Record<string, readonly UseRoom[]> = {
  police: ["living", "office", "bedroom"],
  grid: ["living", "office", "kids"],
  offset: ["living", "office"],
  slimtower: ["hallway", "living"],
  library: ["living", "office"],
  underwindow: ["living", "bedroom", "kids"],
  divider: ["living", "office"],
  podtable: ["living"],
  traytable: ["living"],
  arch: ["living"],
  nest: ["living", "bedroom"],
  utable: ["living", "bedroom"],
  stolek: ["bedroom"],
  lipstand: ["bedroom"],
  talltable: ["bedroom"],
  lowstand: ["bedroom", "kids"],
  tvbench: ["living", "bedroom"],
  record: ["living"],
  lpcube: ["living"],
  speakerbench: ["living"],
  worknook: ["office"],
  minidesk: ["office", "bedroom"],
  hutch: ["office"],
  printerstand: ["office"],
  kidsdesk: ["kids"],
  shoebench: ["hallway"],
  shoetower: ["hallway"],
  console: ["hallway", "living"],
  halltree: ["hallway"],
  steps: ["kids", "living"],
  windowseat: ["living", "bedroom", "kids"],
  toybox: ["kids"],
  wardrobe: ["bedroom"],
  den: ["kids"],
  catbench: ["living", "hallway"],
  plantsteps: ["living"],
  catclimber: ["living"],
};

/** Community designs: the rooms their category usually lives in. */
const CATEGORY_USE_ROOMS: Record<ItemCategory, readonly UseRoom[]> = {
  shelves: ["living", "office", "bedroom", "kids"],
  tables: ["living"],
  nightstands: ["bedroom"],
  media: ["living"],
  office: ["office"],
  hallway: ["hallway"],
  storage: ["living", "bedroom", "kids"],
  pets: ["living"],
  other: ["living"],
};

export interface ItemTags {
  rooms: readonly UseRoom[];
  width: WidthBand;
  height: HeightBand;
  colour: Colour;
  /** Null when nobody asked the engine (a community item from an older API response). */
  assembly: Assembly | null;
}

export function widthBand(cm: number): WidthBand {
  return cm < 60 ? "narrow" : cm <= 120 ? "medium" : "wide";
}

export function heightBand(cm: number): HeightBand {
  return cm <= LOW_MAX_CM ? "low" : cm <= TALL_ABOVE_CM ? "mid" : "tall";
}

export function itemTags(item: LibraryItem): ItemTags {
  const { w, h } = item.design.outerCm;
  return {
    rooms: (item.source === "curated" ? CURATED_USE_ROOMS[item.id] : undefined) ?? CATEGORY_USE_ROOMS[item.category],
    width: widthBand(w),
    height: heightBand(h),
    colour: item.design.colour,
    assembly: item.twoPeople == null ? null : item.twoPeople ? "two" : "one",
  };
}

/** One choice per filter; `undefined` means any. */
export interface LibraryFilters {
  room?: UseRoom;
  width?: WidthBand;
  height?: HeightBand;
  colour?: Colour;
  assembly?: Assembly;
}

export type FilterKey = keyof LibraryFilters;
export const FILTER_KEYS: readonly FilterKey[] = ["room", "width", "height", "colour", "assembly"];

export const FILTER_OPTIONS: { [K in FilterKey]-?: readonly NonNullable<LibraryFilters[K]>[] } = {
  room: USE_ROOMS,
  width: WIDTH_BANDS,
  height: HEIGHT_BANDS,
  colour: COLOURS,
  assembly: ASSEMBLY,
};

export function matches(tags: ItemTags, filters: LibraryFilters): boolean {
  if (filters.room && !tags.rooms.includes(filters.room)) return false;
  if (filters.width && tags.width !== filters.width) return false;
  if (filters.height && tags.height !== filters.height) return false;
  if (filters.colour && tags.colour !== filters.colour) return false;
  if (filters.assembly && tags.assembly !== filters.assembly) return false;
  return true;
}

/**
 * The grid: the pool narrowed to a category and the filters, then sorted.
 *  • hot    — most 🔥 first; ties keep the pool order (curated first), as before.
 *  • newest — shared designs by date, newest first, then the curated pieces,
 *             latest batch first (they carry no date of their own).
 */
export function browse(
  pool: LibraryItem[],
  tagsOf: (item: LibraryItem) => ItemTags,
  opts: { category?: ItemCategory | "all"; filters?: LibraryFilters; sort?: Sort; counts?: Record<string, number> },
): LibraryItem[] {
  const { category = "all", filters = {}, sort = "hot", counts = {} } = opts;
  const order = new Map(pool.map((item, i) => [item, i]));
  const pos = (item: LibraryItem) => order.get(item) ?? 0;
  const items = pool.filter((i) => (category === "all" || i.category === category) && matches(tagsOf(i), filters));
  const byPool = (a: LibraryItem, b: LibraryItem) => pos(a) - pos(b);
  switch (sort) {
    case "newest": {
      const time = (i: LibraryItem) => (i.createdAt ? Date.parse(i.createdAt) : NaN);
      return items.sort((a, b) => {
        const [ta, tb] = [time(a), time(b)];
        if (!Number.isNaN(ta) || !Number.isNaN(tb)) {
          if (Number.isNaN(ta)) return 1;
          if (Number.isNaN(tb)) return -1;
          if (tb !== ta) return tb - ta;
        }
        return pos(b) - pos(a);
      });
    }
    default:
      return items.sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || byPool(a, b));
  }
}

/** How many of `items` each option of a filter would leave (drives the counts and disabled options). */
export function optionCounts<K extends FilterKey>(
  items: LibraryItem[],
  tagsOf: (item: LibraryItem) => ItemTags,
  key: K,
  filters: LibraryFilters,
): Map<NonNullable<LibraryFilters[K]>, number> {
  const rest = { ...filters, [key]: undefined };
  const out = new Map<NonNullable<LibraryFilters[K]>, number>();
  for (const option of FILTER_OPTIONS[key] as readonly NonNullable<LibraryFilters[K]>[]) {
    const f = { ...rest, [key]: option } as LibraryFilters;
    out.set(option, items.filter((i) => matches(tagsOf(i), f)).length);
  }
  return out;
}
