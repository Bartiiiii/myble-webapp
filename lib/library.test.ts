// Every curated design must open in the configurator clean — no red boxes, no
// amber floaters — and must pass the nine library rules (lib/libraryRules.ts):
// load path, span, stability, racking, manufacturing, assembly, usefulness,
// duplicates and style. A customer who taps a card in the Design Library
// expects a piece they can order, not a homework assignment.
import { describe, expect, it } from "vitest";
import { LIBRARY } from "./library";
import { CURATED_AUTHOR, SEED_DESIGNERS } from "./designers";
import { intersecting, thicknessCm, validate } from "./design";
import { LIMITS, MIN_PART_CM } from "./model";
import { checkDesign, checkItem, checkLibrary, engineVerdict } from "./libraryRules";

const curated = LIBRARY.filter((i) => i.source === "curated");

/**
 * Pieces from the old library that still break a rule. Step 2 of the library
 * rebuild deletes or fixes each one; the list may only shrink, and every id on
 * it must still fail (so a fixed piece cannot hide here).
 */
const KNOWN_FAILING = new Set(["staggered", "record", "police", "coffee", "grid", "skrinka", "worknook"]);
/** Same story for the one duplicate pair: step 2 deletes nightstand and keeps stolek. */
const KNOWN_DUPLICATE = new Set(["nightstand"]);

describe("design library", () => {
  it.each(LIBRARY.map((i) => [i.id, i] as const))("%s validates clean", (_id, item) => {
    const v = validate(item.design);
    expect(v.errors).toEqual([]);
    expect(v.floatingIds).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it.each(LIBRARY.map((i) => [i.id, i] as const))("%s fits the parcel", (_id, item) => {
    const { w, h, d } = item.design.outerCm;
    expect(w).toBeLessThanOrEqual(LIMITS.w.max);
    expect(h).toBeLessThanOrEqual(LIMITS.h.max);
    expect(d).toBeLessThanOrEqual(LIMITS.d.max);
  });

  // Boards are solid: a divider crossing a shelf is a piece meble cannot cut.
  it.each(LIBRARY.map((i) => [i.id, i] as const))("%s has no crossing boards", (_id, item) => {
    const t = thicknessCm(item.design);
    for (const part of item.design.parts) {
      expect({ part: part.id, hits: intersecting(part, item.design.parts, t) }).toEqual({
        part: part.id,
        hits: [],
      });
    }
  });

  it.each(LIBRARY.map((i) => [i.id, i] as const))("%s cuts no offcut boards", (_id, item) => {
    for (const part of item.design.parts) {
      expect(Math.min(part.aCm, part.bCm)).toBeGreaterThanOrEqual(MIN_PART_CM);
    }
  });

  // Every card credits somebody, and that somebody has a profile to link to.
  // Without this, a new curated design silently falls back to the studio and
  // its author chip points at a handle that may not exist.
  it.each(LIBRARY.map((i) => [i.id, i] as const))("%s names a real designer", (id, item) => {
    expect(CURATED_AUTHOR[id]).toBeTruthy();
    expect(SEED_DESIGNERS.map((d) => d.handle)).toContain(item.author.handle);
    expect(item.author.name.length).toBeGreaterThan(1);
  });
});

describe("the nine library rules", () => {
  const passing = curated.filter((i) => !KNOWN_FAILING.has(i.id));

  it.each(passing.map((i) => [i.id, i] as const))("%s passes all nine rules", (_id, item) => {
    const verdict = engineVerdict(item.design);
    const violations = item.kind
      ? checkItem(
          { id: item.id, kind: item.kind, design: item.design, wallAnchor: !!item.wallAnchor, twoPeople: !!item.twoPeople },
          verdict,
        )
      : checkDesign(item.design, verdict);
    expect(violations.map((v) => `[${v.rule}] ${v.detail}`)).toEqual([]);
  });

  it.each([...KNOWN_FAILING].map((id) => [id] as const))("%s is still on the known-failing list for a reason", (id) => {
    const item = curated.find((i) => i.id === id);
    if (!item) return; // deleted: nothing left to fail
    expect(checkDesign(item.design).length).toBeGreaterThan(0);
  });

  it("holds no two pieces that are the same design", () => {
    const pool = passing.filter((i) => !KNOWN_DUPLICATE.has(i.id)).map((i) => ({ id: i.id, design: i.design }));
    const found = checkLibrary(pool).filter((v) => v.rule === "duplicates");
    expect(found.map((v) => v.detail)).toEqual([]);
  });

  // The colour mix is judged on the whole set, so only once the set is whole.
  it("mixes white and black near 60/40", () => {
    const pool = passing.map((i) => ({ id: i.id, design: i.design }));
    if (pool.length < 30) return;
    expect(checkLibrary(pool).filter((v) => v.rule === "style").map((v) => v.detail)).toEqual([]);
  });
});
