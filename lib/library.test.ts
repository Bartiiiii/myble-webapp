// Every curated design must open in the configurator clean — no red boxes, no
// amber floaters. A customer who taps a card in the Design Library expects a
// piece they can order, not a homework assignment.
import { describe, expect, it } from "vitest";
import { LIBRARY } from "./library";
import { CURATED_AUTHOR, SEED_DESIGNERS } from "./designers";
import { intersecting, thicknessCm, validate } from "./design";
import { LIMITS, MIN_PART_CM } from "./model";

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
