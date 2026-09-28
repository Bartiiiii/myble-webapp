import { describe, it, expect } from "vitest";
import { DOWEL, drillingPlan, drillSignature, rowHoles } from "./drilling";
import { presetDesign } from "./build";
import { designToCutParts } from "./quote";
import { detectJoints } from "./geometry";

describe("drilling plan", () => {
  it("drills every board of a box, and only in joints", () => {
    const d = presetDesign("police"); // 4 walls + 3 shelves
    const plan = drillingPlan(d);
    expect(plan.byPart.size).toBe(d.parts.length);
    expect(plan.holeCount).toBeGreaterThan(0);
    // Every joint drills both of its boards, so holes = 2 × dowels.
    expect(plan.holeCount).toBe(plan.dowelCount * 2);
    expect(plan.warnings).toEqual([]);
  });

  it("a lone board has no joints, so no holes", () => {
    const d = presetDesign("police");
    const single = { ...d, parts: [d.parts[0]] };
    const plan = drillingPlan(single);
    expect(plan.rows).toEqual([]);
    expect(plan.dowelCount).toBe(0);
  });

  it("puts face holes in the panel and end holes in the board that butts into it", () => {
    const d = presetDesign("police");
    const shelf = d.parts.find((p) => p.role === "shelf")!;
    const wall = d.parts.find((p) => p.role === "wall" && p.axis === "x")!;

    // The shelf meets the side walls end-on: holes in its left and right ends.
    const shelfRows = drillingPlan(d).byPart.get(shelf.id)!;
    expect(shelfRows.every((r) => r.kind === "edge")).toBe(true);
    expect(new Set(shelfRows.map((r) => r.edge))).toEqual(new Set(["left", "right"]));

    // The side wall takes them in its face.
    const wallRows = drillingPlan(d).byPart.get(wall.id)!;
    expect(wallRows.some((r) => r.kind === "face")).toBe(true);
    expect(wallRows.filter((r) => r.kind === "face").every((r) => r.surface === "front" || r.surface === "back")).toBe(true);
  });

  it("keeps every hole inside its board, off the edges, and 8 mm wide", () => {
    for (const id of ["police", "skrinka", "stolek"] as const) {
      const d = presetDesign(id);
      const plan = drillingPlan(d);
      const byId = new Map(d.parts.map((p) => [p.id, p]));
      for (const row of plan.rows) {
        const part = byId.get(row.partId)!;
        const wMm = part.aCm * 10;
        const hMm = part.bCm * 10;
        expect(row.diameterMm).toBe(DOWEL.diameterMm);
        for (const hole of rowHoles(row)) {
          expect(hole.xMm).toBeGreaterThanOrEqual(0);
          expect(hole.yMm).toBeGreaterThanOrEqual(0);
          expect(hole.xMm).toBeLessThanOrEqual(wMm + 0.05);
          expect(hole.yMm).toBeLessThanOrEqual(hMm + 0.05);
        }
      }
      expect(plan.warnings).toEqual([]);
    }
  });

  it("never drills a blind face hole deeper than the board can take", () => {
    const d = presetDesign("police");
    for (const row of drillingPlan(d).rows) {
      if (row.kind === "face") {
        expect(row.depthMm + DOWEL.minWallMm).toBeLessThanOrEqual(d.thickness);
      }
    }
  });

  it("spaces the holes of a row at least meble's 5 mm apart", () => {
    const d = presetDesign("skrinka");
    for (const row of drillingPlan(d).rows) {
      if (row.count > 1) expect(row.pitchMm).toBeGreaterThanOrEqual(DOWEL.diameterMm + DOWEL.minHoleGapMm);
    }
  });

  it("describes one row per joint end, as a wielowiert group", () => {
    const d = presetDesign("police");
    const joints = detectJoints(d);
    // Each joint contributes exactly two rows (one per board).
    expect(drillingPlan(d).rows.length).toBe(joints.length * 2);
  });
});

describe("cut parts vs drilling", () => {
  it("does not merge the two side walls — their holes are on opposite faces", () => {
    const d = presetDesign("police");
    const plan = drillingPlan(d);
    const walls = d.parts.filter((p) => p.role === "wall" && p.axis === "x");
    expect(walls).toHaveLength(2);
    const [a, b] = walls.map((w) => drillSignature(plan.byPart.get(w.id)));
    expect(a).not.toBe(b);

    // …so they stay separate lines in the cut list, each with quantity 1.
    const groups = designToCutParts(d);
    const sameSize = groups.filter((g) => g.widthMm === walls[0].aCm * 10 && g.heightMm === walls[0].bCm * 10);
    expect(sameSize.reduce((n, g) => n + (g.quantity ?? 1), 0)).toBe(2);
    expect(sameSize.every((g) => (g.quantity ?? 1) === 1)).toBe(true);
  });

  it("still groups identical, identically-drilled boards", () => {
    // police: 3 shelves + the top and bottom walls are all the same board, and
    // all five butt into the side walls the same way ⇒ one line, quantity 5.
    const d = presetDesign("police");
    const inner = designToCutParts(d).filter((g) => g.widthMm === 694);
    expect(inner).toHaveLength(1);
    expect(inner[0].quantity).toBe(5);
    expect(inner[0].drilled).toBe(true);
  });

  it("carries the part ids of each group so the export can find its holes", () => {
    const d = presetDesign("police");
    for (const g of designToCutParts(d)) {
      expect((g.id ?? "").split(",").filter(Boolean)).toHaveLength(g.quantity ?? 1);
    }
  });
});
