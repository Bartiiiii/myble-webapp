import { describe, it, expect } from "vitest";
import { type Part, partBox } from "./model";
import { alignParts, distributeParts } from "./geometry";

const t = 1.8;
/** A shelf: thickness on y, aCm along x, bCm along z. */
const shelf = (id: string, x: number, y: number, aCm = 60): Part => ({
  id, role: "shelf", axis: "y", aCm, bCm: 30, pos: { x, y, z: 0 },
});
const spanX = (p: Part) => {
  const b = partBox(p, t);
  return [Math.round(b.min.x * 100) / 100, Math.round(b.max.x * 100) / 100];
};
const yOf = (parts: Part[], id: string) => parts.find((p) => p.id === id)!.pos.y;
const byId = (parts: Part[], id: string) => parts.find((p) => p.id === id)!;

describe("align", () => {
  it("lines boards up on their left edges", () => {
    // Three shelves at different heights, staggered sideways.
    const parts = [shelf("a", 0, 0), shelf("b", 20, 20), shelf("c", -10, 40)];
    const out = alignParts(parts, ["a", "b", "c"], "x", "min", t);
    const left = spanX(byId(out, "c"))[0];
    for (const id of ["a", "b", "c"]) expect(spanX(byId(out, id))[0]).toBe(left);
  });

  it("lines them up on their right edges", () => {
    const parts = [shelf("a", 0, 0), shelf("b", 20, 20), shelf("c", -10, 40)];
    const out = alignParts(parts, ["a", "b", "c"], "x", "max", t);
    const right = spanX(byId(out, "b"))[1];
    for (const id of ["a", "b", "c"]) expect(spanX(byId(out, id))[1]).toBe(right);
  });

  it("centres them on the group, not on the origin", () => {
    // Group spans x[-40, 50] → centre 5, so every board centres on 5.
    const parts = [shelf("a", -10, 0), shelf("b", 20, 20)];
    const out = alignParts(parts, ["a", "b"], "x", "centre", t);
    expect(byId(out, "a").pos.x).toBe(5);
    expect(byId(out, "b").pos.x).toBe(5);
  });

  it("aligns boards of different sizes by edge, not by centre", () => {
    const parts = [shelf("a", 0, 0, 60), shelf("b", 0, 20, 30)];
    const out = alignParts(parts, ["a", "b"], "x", "min", t);
    expect(spanX(byId(out, "a"))[0]).toBe(spanX(byId(out, "b"))[0]);
    expect(byId(out, "a").pos.x).not.toBe(byId(out, "b").pos.x);
  });

  it("leaves unselected boards alone", () => {
    const parts = [shelf("a", 0, 0), shelf("b", 20, 20), shelf("other", 45, 40)];
    const out = alignParts(parts, ["a", "b"], "x", "min", t);
    expect(byId(out, "other").pos.x).toBe(45);
  });

  it("does nothing with fewer than two boards", () => {
    const parts = [shelf("a", 10, 0)];
    expect(alignParts(parts, ["a"], "x", "min", t)).toBe(parts);
  });

  it("refuses an alignment that would stack boards inside each other", () => {
    // Two shelves at the SAME height: aligning them sideways would merge them,
    // so the design comes back untouched rather than overlapping.
    const parts = [shelf("a", 0, 0), shelf("b", 61, 0)];
    expect(alignParts(parts, ["a", "b"], "x", "min", t)).toEqual(parts);
  });
});

describe("distribute", () => {
  it("gives every gap the same clear height", () => {
    // Shelves bunched up; the outer two must not move.
    const parts = [shelf("a", 0, 0), shelf("b", 0, 10), shelf("c", 0, 15), shelf("d", 0, 90)];
    const out = distributeParts(parts, ["a", "b", "c", "d"], "y", t);
    expect(yOf(out, "a")).toBe(0);
    expect(yOf(out, "d")).toBe(90);

    const sorted = ["a", "b", "c", "d"].map((id) => partBox(byId(out, id), t)).sort((p, q) => p.min.y - q.min.y);
    const gaps = sorted.slice(1).map((b, i) => Math.round((b.min.y - sorted[i].max.y) * 100) / 100);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 6);
  });

  it("equal gaps, not equal centres, when the boards differ in thickness", () => {
    // A divider stands 40 tall between two thin shelves: measuring centres
    // would leave the compartments visibly unequal.
    const divider: Part = { id: "mid", role: "divider", axis: "x", aCm: 40, bCm: 30, pos: { x: 0, y: 30, z: 0 } };
    const parts = [shelf("a", 0, 0), divider, shelf("c", 0, 100)];
    const out = distributeParts(parts, ["a", "mid", "c"], "y", t);
    const boxes = ["a", "mid", "c"].map((id) => partBox(byId(out, id), t)).sort((p, q) => p.min.y - q.min.y);
    const g1 = boxes[1].min.y - boxes[0].max.y;
    const g2 = boxes[2].min.y - boxes[1].max.y;
    expect(g1).toBeCloseTo(g2, 6);
  });

  it("needs three boards to mean anything", () => {
    const parts = [shelf("a", 0, 0), shelf("b", 0, 50)];
    expect(distributeParts(parts, ["a", "b"], "y", t)).toBe(parts);
  });

  it("leaves boards already stacked solid exactly where they are", () => {
    // Touching boards have no slack to share out: every gap is already 0.
    const parts = [shelf("a", 0, 0), shelf("b", 0, 1.8), shelf("c", 0, 3.6)];
    expect(distributeParts(parts, ["a", "b", "c"], "y", t)).toEqual(parts);
  });

  it("refuses when the boards would have to pass through each other", () => {
    // Overlapping input: no arrangement of it is buildable.
    const parts = [shelf("a", 0, 0), shelf("b", 0, 0.5), shelf("c", 0, 1)];
    expect(distributeParts(parts, ["a", "b", "c"], "y", t)).toEqual(parts);
  });
});
