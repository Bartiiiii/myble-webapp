import { describe, it, expect } from "vitest";
import { type Design, type Part } from "./model";
import {
  validate,
  connectivity,
  contactGraph,
  scaleParts,
  bandedEdges,
  exposedEdges,
  detectJoints,
  snap,
  slide,
  intersects,
  intersecting,
  isClear,
  nudgeClear,
} from "./geometry";
import { boxWalls, legacyToDesign, presetDesign } from "./build";
import { partBox, thicknessCm } from "./model";

const base = (parts: Part[], outer = { w: 40, h: 40, d: 30 }): Design => ({
  colour: "white",
  thickness: 18,
  outerCm: outer,
  parts,
});

describe("connectivity / contact graph", () => {
  it("a box (4 walls + a shelf) is one connected component and valid", () => {
    const d = presetDesign("stolek"); // 4 walls + 1 shelf
    expect(d.parts.length).toBe(5);
    expect(contactGraph(d).components).toBe(1);
    const v = validate(d);
    expect(v.ok).toBe(true);
    expect(v.floatingIds).toHaveLength(0);
  });

  it("a detached part makes the design invalid and is flagged as floating", () => {
    const d = presetDesign("stolek");
    const floater: Part = { id: "float", role: "shelf", axis: "y", aCm: 20, bCm: 20, pos: { x: 300, y: 300, z: 0 } };
    const d2: Design = { ...d, parts: [...d.parts, floater] };
    expect(connectivity(d2).connected).toBe(false);
    const v = validate(d2);
    expect(v.ok).toBe(false);
    expect(v.floatingIds).toContain("float");
  });

  it("a single part is trivially valid (one cut board)", () => {
    const shelf: Part = { id: "s", role: "shelf", axis: "y", aCm: 38, bCm: 28, pos: { x: 0, y: 0, z: 0 } };
    const d = base([shelf]);
    expect(connectivity(d).connected).toBe(true);
    expect(validate(d).ok).toBe(true);
  });
});

describe("scaleParts", () => {
  it("scaling a 3-shelf unit 60→90 cm keeps shelves full-width, spaced and connected", () => {
    const d = legacyToDesign({
      widthCm: 60,
      heightCm: 118,
      depthCm: 30,
      planks: [
        { id: "a", o: "h", x: 0, y: 38, len: 56.4 },
        { id: "b", o: "h", x: 0, y: 58, len: 56.4 },
        { id: "c", o: "h", x: 0, y: 78, len: 56.4 },
      ],
    });
    const scaled = scaleParts(d, { w: 90, h: 118, d: 30 });
    expect(scaled.outerCm.w).toBe(90);

    const shelves = scaled.parts.filter((p) => p.role === "shelf");
    expect(shelves).toHaveLength(3);
    // Inner width at 90 cm = 90 - 2×1.8 = 86.4; shelves should span it (±~1).
    for (const s of shelves) {
      expect(s.aCm).toBeGreaterThan(85);
      expect(s.aCm).toBeLessThan(87.5);
      expect(Math.abs(s.pos.x)).toBeLessThan(0.5); // stays centred
    }
    // Side walls re-pinned to the new outer box.
    const t = thicknessCm(scaled);
    const xs = scaled.parts.filter((p) => p.role === "wall" && p.axis === "x").map((p) => p.pos.x);
    expect(Math.max(...xs)).toBeCloseTo(45 - t / 2, 1);

    expect(connectivity(scaled).connected).toBe(true);
    expect(validate(scaled).ok).toBe(true);
  });
});

describe("exposed edges + joints (L-corner)", () => {
  // A shelf whose right END butts into the inner face of a right-hand wall.
  const wall: Part = { id: "wall", role: "wall", axis: "x", aCm: 40, bCm: 30, pos: { x: 19.1, y: 0, z: 0 } };
  const shelf: Part = { id: "shelf", role: "shelf", axis: "y", aCm: 38.2, bCm: 30, pos: { x: -0.9, y: 0, z: 0 } };
  const d = base([wall, shelf], { w: 40, h: 40, d: 30 });

  it("detects exactly one joint between the two boards", () => {
    const joints = detectJoints(d);
    expect(joints).toHaveLength(1);
    expect(joints[0].dowels.length).toBeGreaterThanOrEqual(2);
  });

  it("buries the shelf edge in the joint but bands its three exposed edges", () => {
    const ex = exposedEdges(shelf, d);
    expect(ex.right).toBe(false); // buried against the wall
    expect(ex.left).toBe(true);
    expect(ex.top).toBe(true);
    expect(ex.bottom).toBe(true);

    // Banding no longer follows exposure: Myble bands the buried edge too, so
    // meble will drill the part and the CSV can express it.
    const banded = bandedEdges(shelf, d);
    expect(banded.right).toBe(true);
    expect(banded.left).toBe(true);
  });

  it("bands all four edges of every board, buried or not", () => {
    const lone: Part = { id: "s", role: "shelf", axis: "y", aCm: 40, bCm: 30, pos: { x: 0, y: 0, z: 0 } };
    for (const part of [lone, shelf, ...d.parts]) {
      const banded = bandedEdges(part, part === lone ? base([lone]) : d);
      expect(banded).toEqual({ top: true, bottom: true, left: true, right: true });
    }
  });
});

describe("snap", () => {
  it("pulls a part with a small gap flush against a neighbour and reports a contact point", () => {
    const wall: Part = { id: "wall", role: "wall", axis: "x", aCm: 40, bCm: 30, pos: { x: 19.1, y: 0, z: 0 } };
    // shelf right end at x = 17.2, i.e. a 1 cm gap before the wall inner face (18.2).
    const shelf: Part = { id: "shelf", role: "shelf", axis: "y", aCm: 38.2, bCm: 30, pos: { x: -1.9, y: 0, z: 0 } };
    const t = thicknessCm(base([wall, shelf]));
    const res = snap(shelf, [wall], t);
    expect(res.snapped).toBe(true);
    expect(res.contact).toBeDefined();
    // After applying the snap the boxes touch (gap closed within tolerance).
    const snappedShelf = { ...shelf, pos: res.pos };
    const sb = partBox(snappedShelf, t);
    const wb = partBox(wall, t);
    expect(Math.abs(sb.max.x - wb.min.x)).toBeLessThan(0.2);
  });
});

describe("collision (boards are solid)", () => {
  const t = thicknessCm(base([]));
  // A vertical divider standing at x = 0, 40 cm tall, 30 deep.
  const divider: Part = { id: "div", role: "divider", axis: "x", aCm: 40, bCm: 30, pos: { x: 0, y: 0, z: 0 } };
  // A shelf to its left, 20 cm wide (right end at x = -0.9 + 10 = ... see pos).
  const shelf = (x: number, y = 0): Part => ({
    id: "shelf",
    role: "shelf",
    axis: "y",
    aCm: 20,
    bCm: 30,
    pos: { x, y, z: 0 },
  });

  it("flush faces are a joint, not an intersection", () => {
    // Shelf right end exactly at the divider's left face (x = -0.9).
    const flush = shelf(-10.9);
    expect(intersects(flush, divider, t)).toBe(false);
    expect(isClear(flush, [divider], t)).toBe(true);
  });

  it("reports a real overlap", () => {
    expect(intersects(shelf(0), divider, t)).toBe(true);
    expect(intersecting(shelf(0), [divider], t)).toEqual(["div"]);
  });

  it("a move through a board stops flush against it instead of passing through", () => {
    const from = shelf(-20);
    const res = slide(from, { x: 20, y: 0, z: 0 }, [divider], t);
    expect(res.blocked).toBe(true);
    // Right end of the shelf lands on the divider's left face.
    const sb = partBox({ ...from, pos: res.pos }, t);
    const db = partBox(divider, t);
    expect(Math.abs(sb.max.x - db.min.x)).toBeLessThan(0.01);
    expect(isClear({ ...from, pos: res.pos }, [divider], t)).toBe(true);
  });

  it("does not tunnel on a long flick past a thin board", () => {
    const from = shelf(-40);
    const res = slide(from, { x: 200, y: 0, z: 0 }, [divider], t);
    expect(res.pos.x).toBeLessThan(divider.pos.x);
    expect(isClear({ ...from, pos: res.pos }, [divider], t)).toBe(true);
  });

  it("slides freely along a board it is resting against", () => {
    const resting = shelf(-10.9);
    const res = slide(resting, { x: -10.9, y: 15, z: 0 }, [divider], t);
    expect(res.blocked).toBe(false);
    expect(res.pos.y).toBeCloseTo(15);
  });

  it("an unobstructed move reaches its target", () => {
    const from = shelf(-40);
    const res = slide(from, { x: -30, y: 5, z: 0 }, [divider], t);
    expect(res.blocked).toBe(false);
    expect(res.pos.x).toBeCloseTo(-30);
    expect(res.pos.y).toBeCloseTo(5);
  });

  it("a part that starts overlapped can still move back out", () => {
    const stuck = shelf(0);
    const res = slide(stuck, { x: -30, y: 0, z: 0 }, [divider], t);
    expect(res.pos.x).toBeCloseTo(-30);
  });

  it("nudgeClear finds a free slot for a board dropped into occupied space", () => {
    const a: Part = { id: "a", role: "shelf", axis: "y", aCm: 40, bCm: 30, pos: { x: 0, y: 0, z: 0 } };
    const dropped: Part = { ...a, id: "b" };
    const placed = nudgeClear(dropped, [a], t, { min: -20, max: 20 });
    expect(placed.pos.y).not.toBe(0);
    expect(isClear(placed, [a], t)).toBe(true);
  });

  it("nudgeClear never pushes a board outside the piece", () => {
    // Every slot above and below is taken, so the only free space is outside
    // the range — the board must stay put rather than float off the carcass.
    const occupied: Part[] = [-1.8, 0, 1.8].map((y, i) => ({
      id: `o${i}`,
      role: "shelf",
      axis: "y",
      aCm: 40,
      bCm: 30,
      pos: { x: 0, y, z: 0 },
    }));
    const dropped: Part = { id: "b", role: "shelf", axis: "y", aCm: 40, bCm: 30, pos: { x: 0, y: 0, z: 0 } };
    const placed = nudgeClear(dropped, occupied, t, { min: -2, max: 2 });
    expect(placed.pos.y).toBeGreaterThanOrEqual(-2);
    expect(placed.pos.y).toBeLessThanOrEqual(2);
  });
});

describe("box walls", () => {
  it("builds four connected walls forming a ring", () => {
    const d = base(boxWalls({ w: 60, h: 100, d: 30 }), { w: 60, h: 100, d: 30 });
    expect(d.parts).toHaveLength(4);
    expect(contactGraph(d).components).toBe(1);
  });
});

describe("contact survives the 0.1 cm position rounding", () => {
  // Moves round a board's centre to 0.1 cm. A board whose length ends in an odd
  // tenth (45.5 → half 22.75) that slides left into a wall lands on a centre
  // ending in .x5, and rounding that walks it 0.05 cm off the face: visibly
  // touching, but it used to read as floating.
  it("a shelf slid left against a wall and rounded is still connected", () => {
    const wall: Part = { id: "wall", role: "wall", axis: "x", aCm: 60, bCm: 30, pos: { x: -39.1, y: 0, z: 0 } };
    // Every one of these lengths used to strand the shelf 0.05 cm off the wall.
    for (const len of [20.5, 21.5, 22.5, 45.5]) {
      const shelf: Part = { id: "s", role: "shelf", axis: "y", aCm: len, bCm: 25, pos: { x: 10, y: -10, z: 0 } };
      const d = base([wall, shelf], { w: 80, h: 60, d: 30 });
      const slid = slide(shelf, { ...shelf.pos, x: -40 }, [wall], thicknessCm(d)).pos;
      const landed: Part = { ...shelf, pos: { ...shelf.pos, x: Math.round(slid.x * 10) / 10 } };
      expect(validate({ ...d, parts: [wall, landed] }).floatingIds).toEqual([]);
    }
  });

  it("a real gap (a few millimetres) still floats", () => {
    const wall: Part = { id: "wall", role: "wall", axis: "x", aCm: 60, bCm: 30, pos: { x: -39.1, y: 0, z: 0 } };
    const shelf: Part = { id: "s", role: "shelf", axis: "y", aCm: 40, bCm: 25, pos: { x: -38.2 + 20 + 0.5, y: 0, z: 0 } };
    const other: Part = { id: "o", role: "shelf", axis: "y", aCm: 20, bCm: 25, pos: { x: -28.2, y: 20, z: 0 } };
    const v = validate(base([wall, other, shelf], { w: 80, h: 60, d: 30 }));
    expect(v.floatingIds).toEqual(["s"]);
  });
});
