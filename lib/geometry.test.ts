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
} from "./geometry";
import { boxWalls, legacyToDesign, presetDesign } from "./build";
import { partBox, thicknessCm } from "./model";

const base = (parts: Part[], outer = { w: 40, h: 40, d: 30 }): Design => ({
  colour: "white",
  thickness: 18,
  bandBack: true,
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

    const banded = bandedEdges(shelf, d);
    expect(banded.right).toBe(false);
    expect(banded.left).toBe(true);
  });

  it("'don't band the back' drops the rear edges only", () => {
    const lone: Part = { id: "s", role: "shelf", axis: "y", aCm: 40, bCm: 30, pos: { x: 0, y: 0, z: 0 } };
    const banded = bandedEdges(lone, { ...base([lone]), bandBack: false });
    // For an axis-y shelf, top/bottom run along x (the front/back depth edges):
    // the rear one (−z) is dropped, the others stay.
    expect(banded.bottom).toBe(false); // −z rear edge
    expect(banded.top).toBe(true); // +z front edge
    expect(banded.left).toBe(true);
    expect(banded.right).toBe(true);
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

describe("box walls", () => {
  it("builds four connected walls forming a ring", () => {
    const d = base(boxWalls({ w: 60, h: 100, d: 30 }), { w: 60, h: 100, d: 30 });
    expect(d.parts).toHaveLength(4);
    expect(contactGraph(d).components).toBe(1);
  });
});
