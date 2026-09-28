import { describe, it, expect } from "vitest";
import { type Design, type Part, LIMITS, MAX_PART_CM, PARCEL_MAX_SIDE_CM, SHEET_MAX_CM } from "./model";
import { boxWalls } from "./build";
import { capAtEdge, filledPart, resizedPart, scaleParts, stretchedPart } from "./geometry";

const outer = { w: 500, h: 300, d: 100 };
const big = (): Design => ({ colour: "white", thickness: 18, outerCm: outer, parts: boxWalls(outer) });
const t = 1.8;

const shelf = (aCm: number, bCm = 30, pos = { x: 0, y: 0, z: 0 }): Part => ({
  id: "s", role: "shelf", axis: "y", aCm, bCm, pos,
});

/** No board may be cut longer than one the partner can cut and a courier take. */
const withinCap = (p: Part) => Math.max(p.aCm, p.bCm) <= MAX_PART_CM + 1e-9;

describe("the board ceiling is the real one", () => {
  it("takes the lower of what can be cut and what can be shipped", () => {
    expect(MAX_PART_CM).toBe(Math.min(SHEET_MAX_CM.long, PARCEL_MAX_SIDE_CM));
    expect(MAX_PART_CM).toBe(200);
  });

  it("lets the whole piece run far past a single board", () => {
    // The point of the change: an envelope built from many boards, not one.
    expect(LIMITS.w.max).toBeGreaterThan(MAX_PART_CM * 2);
  });
});

describe("no operation can produce an uncuttable board", () => {
  it("a fresh carcass at full envelope stays within it", () => {
    for (const p of big().parts) expect(withinCap(p), `${p.axis} ${p.aCm}x${p.bCm}`).toBe(true);
  });

  it("the size panel cannot type one past the cap", () => {
    const out = resizedPart(shelf(100), "aCm", 480, [], t, outer)!;
    expect(out.aCm).toBe(MAX_PART_CM);
  });

  it("an edge drag cannot stretch one past the cap", () => {
    const out = stretchedPart(shelf(100), "aCm", 1, 400, [], t, outer)!;
    expect(out.aCm).toBe(MAX_PART_CM);
  });

  it("fill cannot span a bay wider than one board", () => {
    const out = filledPart(shelf(40), "aCm", [], t, outer)!;
    expect(out.aCm).toBe(MAX_PART_CM);
  });

  it("scaling the piece up stops stretching boards at the cap", () => {
    const small: Design = {
      colour: "white", thickness: 18, outerCm: { w: 80, h: 100, d: 40 }, parts: boxWalls({ w: 80, h: 100, d: 40 }),
    };
    const scaled = scaleParts(small, { w: 500, h: 300, d: 100 });
    for (const p of scaled.parts) expect(withinCap(p), `${p.aCm}x${p.bCm}`).toBe(true);
  });

  it("refuses to promote a cap on a piece wider than one board", () => {
    // A cap spans the whole piece, so on a 5 m run it would be an impossible board.
    const d = big();
    const shelfPart = d.parts.find((p) => p.axis === "y")!;
    expect(capAtEdge(d, shelfPart.id, "down", t)).toBeNull();
  });
});

describe("scaling a long way keeps the piece together", () => {
  it("shelves still reach their walls after a big proportional jump", () => {
    // Thickness cannot scale, so a large factor leaves slack the old fixed 3 cm
    // snap could not close — every shelf came away from its walls at once.
    const from = { w: 73, h: 118, d: 30 };
    const small: Design = { colour: "white", thickness: 18, outerCm: from, parts: boxWalls(from) };
    for (const target of [120, 160, 200]) {
      const scaled = scaleParts(small, { ...from, w: target });
      const walls = scaled.parts.filter((p) => p.axis === "x");
      const shelves = scaled.parts.filter((p) => p.axis === "y");
      const innerSpan = target - 2 * t;
      for (const sh of shelves) {
        expect(sh.aCm, `scaled to ${target}`).toBeCloseTo(Math.min(innerSpan, MAX_PART_CM), 1);
      }
      expect(walls).toHaveLength(2);
    }
  });
});
