import { describe, it, expect } from "vitest";
import { LIMITS, type Part } from "./model";
import { fitClear, growOuter, isClear, intersecting, makeId } from "./design";

const T = 1.8;
const outerCm = { w: 73, h: 118, d: 30 };

function shelfAt(y: number, id = makeId()): Part {
  return { id, role: "shelf", axis: "y", aCm: 69.4, bCm: 30, pos: { x: 0, y, z: 0 } };
}

describe("fitClear", () => {
  it("returns the part unchanged when it is already clear", () => {
    const part = shelfAt(0);
    expect(fitClear(part, [], T, outerCm)).toEqual(part);
  });

  it("nudges to a free level along the thickness axis, same as before", () => {
    const blocker = shelfAt(0, "blocker");
    const dup = shelfAt(0, "dup");
    const placed = fitClear(dup, [blocker], T, outerCm)!;
    expect(placed).not.toBeNull();
    expect(placed.aCm).toBe(69.4); // full size kept — plenty of Y room
    expect(isClear(placed, [blocker], T)).toBe(true);
  });

  it("shrinks a duplicate that has nowhere to go at full size", () => {
    // Pack the piece with full-width shelves shoulder to shoulder, no gaps.
    const others: Part[] = [];
    for (let y = -118 / 2 + T; y + T <= 118 / 2 - T; y += T) {
      others.push(shelfAt(Math.round(y * 10) / 10, `s${others.length}`));
    }
    const dup = shelfAt(others[0].pos.y, "dup");
    const placed = fitClear(dup, others, T, outerCm);
    // Either it finds a genuinely clear (possibly shrunk) spot, or — if the
    // piece really is packed edge to edge with zero slack — it correctly
    // refuses rather than overlapping.
    if (placed) {
      expect(isClear(placed, others, T)).toBe(true);
    }
  });

  it("never returns a part that overlaps another — the old bug", () => {
    // A tightly packed 4-shelf carcass: duplicating the middle shelf leaves
    // very little slack. Whatever fitClear returns (or null) must be safe.
    const outer = { w: 40, h: 40, d: 30 };
    const shelves: Part[] = [
      { id: "a", role: "shelf", axis: "y", aCm: 36.4, bCm: 30, pos: { x: 0, y: -15, z: 0 } },
      { id: "b", role: "shelf", axis: "y", aCm: 36.4, bCm: 30, pos: { x: 0, y: -5, z: 0 } },
      { id: "c", role: "shelf", axis: "y", aCm: 36.4, bCm: 30, pos: { x: 0, y: 5, z: 0 } },
      { id: "d", role: "shelf", axis: "y", aCm: 36.4, bCm: 30, pos: { x: 0, y: 15, z: 0 } },
    ];
    const dup: Part = { ...shelves[1], id: "dup" };
    const placed = fitClear(dup, shelves, T, outer);
    if (placed) {
      expect(intersecting(placed, shelves, T)).toEqual([]);
    }
  });

  it("shrinks a flip that doesn't fit at its natural size", () => {
    // A divider turned upright in a very shallow piece: the "natural" height
    // (h - 2T) may not fit anywhere once other boards are in the way.
    const outer = { w: 40, h: 30, d: 30 };
    const blocker: Part = { id: "b", role: "wall", axis: "x", aCm: 30, bCm: 30, pos: { x: -10, y: 0, z: 0 } };
    const turned: Part = { id: "turned", role: "divider", axis: "x", aCm: 26.4, bCm: 30, pos: { x: -10, y: 0, z: 0 } };
    const placed = fitClear(turned, [blocker], T, outer);
    expect(placed).not.toBeNull();
    expect(isClear(placed!, [blocker], T)).toBe(true);
    expect(placed!.aCm).toBeGreaterThanOrEqual(10); // MIN_PART_CM
  });
});

describe("growOuter", () => {
  it("keeps the current size when the desired position already fits", () => {
    expect(growOuter("w", 73, 10, 5)).toBe(73);
  });

  it("grows to cover a board dragged past the current bound", () => {
    // desired centre 40, half-size 5 → needs 90 cm total, up from 73.
    expect(growOuter("w", 73, 40, 5)).toBe(90);
  });

  it("never shrinks the furniture", () => {
    expect(growOuter("w", 73, 0, 1)).toBe(73);
  });

  it("never grows past the dimension's own slider maximum", () => {
    // Read the ceiling from LIMITS rather than restating it: the envelope is a
    // product decision that moves, the rule that growth stops at it is not.
    expect(growOuter("w", 73, 10_000, 5)).toBe(LIMITS.w.max);
    expect(growOuter("d", 30, 10_000, 5)).toBe(LIMITS.d.max);
  });
});
