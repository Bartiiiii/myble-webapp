import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES, LIBRARY, type LibraryItem } from "./library";
import {
  ASSEMBLY,
  COLOURS,
  CURATED_USE_ROOMS,
  FILTER_KEYS,
  FILTER_OPTIONS,
  HEIGHT_BANDS,
  SORTS,
  USE_ROOMS,
  browse,
  heightBand,
  itemTags,
  optionCounts,
  widthBand,
} from "./libraryFilters";
import { tList } from "./i18n";

const tags = new Map(LIBRARY.map((item) => [item.id, itemTags(item)]));
const tagsOf = (item: LibraryItem) => tags.get(item.id) ?? itemTags(item);
const curated = (id: string) => LIBRARY.find((i) => i.id === id)!;

describe("library filter tags", () => {
  it("bands sizes at the stated edges", () => {
    expect([59.9, 60, 120, 120.1].map(widthBand)).toEqual(["narrow", "medium", "medium", "wide"]);
    expect([60, 60.1, 100, 100.1].map(heightBand)).toEqual(["low", "mid", "mid", "tall"]);
  });

  it("calls a curated piece tall exactly when the engine wants it fixed to the wall", () => {
    for (const item of LIBRARY) expect([item.id, tagsOf(item).height === "tall"]).toEqual([item.id, !!item.wallAnchor]);
  });

  it("gives every curated piece hand-picked rooms and the engine's assembly answer", () => {
    for (const item of LIBRARY) {
      expect(CURATED_USE_ROOMS[item.id], item.id).toBeDefined();
      const t = tagsOf(item);
      expect(t.assembly).toBe(item.twoPeople ? "two" : "one");
    }
  });

  it("never offers a room, height, colour or assembly choice with fewer than three curated pieces", () => {
    const options = { room: USE_ROOMS, height: HEIGHT_BANDS, colour: COLOURS, assembly: ASSEMBLY };
    for (const [key, values] of Object.entries(options) as [keyof typeof options, readonly string[]][]) {
      const counts = optionCounts(LIBRARY, tagsOf, key, {});
      for (const value of values) expect([key, value, (counts.get(value as never) ?? 0) >= 3]).toEqual([key, value, true]);
    }
  });
});

describe("browsing the library", () => {
  it("narrows by category and every filter at once", () => {
    const kidsTall = browse(LIBRARY, tagsOf, { category: "storage", filters: { room: "kids", height: "tall" } });
    expect(kidsTall.map((i) => i.id).sort()).toEqual(["den", "steps"]);
    const blackLow = browse(LIBRARY, tagsOf, { filters: { colour: "black", height: "low" } });
    expect(blackLow.length).toBeGreaterThan(0);
    for (const item of blackLow) {
      expect(item.design.colour).toBe("black");
      expect(item.design.outerCm.h).toBeLessThanOrEqual(60);
    }
  });

  it("puts shared designs first by date when sorting by newest, then the latest curated batch", () => {
    const shared = (id: string, createdAt: string): LibraryItem => ({ ...curated("police"), id, source: "community", createdAt });
    const pool = [...LIBRARY, shared("older", "2026-09-01T10:00:00Z"), shared("newer", "2026-10-20T10:00:00Z")];
    const ids = browse(pool, tagsOf, { sort: "newest" }).map((i) => i.id);
    expect(ids.slice(0, 3)).toEqual(["newer", "older", LIBRARY[LIBRARY.length - 1].id]);
  });

  it("sorts hottest first and keeps the pool order on ties", () => {
    const ids = browse(LIBRARY, tagsOf, { counts: { den: 3, police: 1 } }).map((i) => i.id);
    expect(ids.slice(0, 3)).toEqual(["den", "police", LIBRARY.find((i) => i.id !== "police" && i.id !== "den")!.id]);
  });

  it("counts what each option would leave, ignoring the filter's own current choice", () => {
    const counts = optionCounts(LIBRARY, tagsOf, "colour", { colour: "white", room: "hallway" });
    const hallway = LIBRARY.filter((i) => CURATED_USE_ROOMS[i.id].includes("hallway"));
    expect(counts.get("white")! + counts.get("black")!).toBe(hallway.length);
  });
});

describe("categories", () => {
  it("match the designs.category check in the Supabase migration", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0012_design_category_check.sql"), "utf8");
    const lists = [...sql.matchAll(/in \(([^)]*)\)/g)].map((m) => [...m[1].matchAll(/'([a-z]+)'/g)].map((q) => q[1]).sort());
    const ids = CATEGORIES.map((c) => c.id as string).filter((id) => id !== "all").sort();
    expect(lists).toEqual([ids, ids]); // the re-file update and the check itself
  });
});

describe("filter labels", () => {
  // tList falls back to English, so a missing Czech label shows up as the English text.
  const SAME_IN_BOTH = new Set(["library.filters.width.medium"]); // "60–120 cm"
  it("exist in English and Czech for every filter, option and sort", () => {
    const keys = [
      "library.filters.label",
      "library.filters.clear",
      "library.filters.none",
      "library.filters.sort",
      "library.anchor",
      "library.anchorNote",
      "library.twoPeople",
      "library.assembly",
      ...SORTS.map((s) => `library.filters.sorts.${s}`),
      ...FILTER_KEYS.flatMap((k) => [`library.filters.${k}.label`, ...FILTER_OPTIONS[k].map((o) => `library.filters.${k}.${o}`)]),
    ];
    for (const key of keys) {
      const [en, cs] = [tList("en", key), tList("cs", key)];
      expect(typeof en, key).toBe("string");
      expect(cs === en && !SAME_IN_BOTH.has(key) ? `${key}: Czech missing` : "ok").toBe("ok");
    }
  });
});
