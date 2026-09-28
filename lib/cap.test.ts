import { describe, it, expect } from "vitest";
import { type Design, type Part } from "./model";
import { boxWalls } from "./build";
import { capAtEdge, uncap, isCap, isAtEdgeSlot, dragCapIntent, OVERSHOOT_CM, intersecting, thicknessCm } from "./design";

const T = 1.8;

function shelfAt(y: number, w: number, d: number): Part {
  return { id: "s1", role: "shelf", axis: "y", aCm: w - 2 * T, bCm: d, pos: { x: 0, y, z: 0 } };
}

/** A plain bookcase: full-height sides, inner-width top/bottom, one loose shelf. */
function bookcase(shelfY: number): Design {
  const outerCm = { w: 73, h: 118, d: 30 };
  return { outerCm, colour: "white", thickness: 18, parts: [...boxWalls(outerCm, T), shelfAt(shelfY, outerCm.w, outerCm.d)] } as Design;
}

describe("cap promotion", () => {
  it("does nothing for a shelf in the middle of the piece", () => {
    const d = bookcase(0);
    expect(capAtEdge(d, "s1", "up", T)).toBeNull();
  });

  it("promotes a shelf sitting flush under the top", () => {
    // top wall centre is h/2 - T/2, so the slot under it is one thickness lower
    const d = bookcase(118 / 2 - T - T / 2);
    const next = capAtEdge(d, "s1", "up", T);
    expect(next).not.toBeNull();
    const cap = next!.parts.find((p) => p.id === "s1")!;
    expect(cap.aCm).toBe(73); // spans the full outer width
    expect(cap.pos.y).toBeCloseTo(118 / 2 - T / 2, 2); // flush with the outer top
    expect(isCap(cap, next!, "up", T)).toBe(true);
  });

  it("keeps the outer envelope and absorbs the old top", () => {
    const d = bookcase(118 / 2 - T - T / 2);
    const next = capAtEdge(d, "s1", "up", T)!;
    // Same part count: the old inner top is absorbed by the promoted board.
    expect(next.parts.length).toBe(d.parts.length - 1);
    expect(next.outerCm).toEqual(d.outerCm);
    const top = Math.max(...next.parts.map((p) => p.pos.y + (p.axis === "y" ? T : p.aCm) / 2));
    expect(top).toBeCloseTo(118 / 2, 2); // nothing pokes past the stated height
  });

  it("shortens the side walls so they end under the cap", () => {
    const d = bookcase(118 / 2 - T - T / 2);
    const next = capAtEdge(d, "s1", "up", T)!;
    const sides = next.parts.filter((p) => p.axis === "x");
    expect(sides).toHaveLength(2);
    for (const s of sides) {
      expect(s.aCm).toBeCloseTo(118 - T, 2);
      expect(s.pos.y + s.aCm / 2).toBeCloseTo(118 / 2 - T, 2);
    }
  });

  it("never leaves boards overlapping", () => {
    const d = bookcase(118 / 2 - T - T / 2);
    const next = capAtEdge(d, "s1", "up", T)!;
    const t = thicknessCm(next);
    for (const p of next.parts) expect(intersecting(p, next.parts, t)).toEqual([]);
  });

  it("refuses a board lying the wrong way", () => {
    const d = bookcase(0);
    const upright: Part = { id: "v1", role: "divider", axis: "x", aCm: 50, bCm: 30, pos: { x: 0, y: 118 / 2 - 25 - T, z: 0 } };
    const withUpright = { ...d, parts: [...d.parts, upright] };
    expect(capAtEdge(withUpright, "v1", "up", T)).toBeNull();
  });

  it("round-trips: uncap restores the inner board and the full-height sides", () => {
    const d = bookcase(118 / 2 - T - T / 2);
    const capped = capAtEdge(d, "s1", "up", T)!;
    const back = uncap(capped, "s1", "up", T)!;
    const board = back.parts.find((p) => p.id === "s1")!;
    expect(board.aCm).toBeCloseTo(73 - 2 * T, 2);
    for (const s of back.parts.filter((p) => p.axis === "x")) expect(s.aCm).toBeCloseTo(118, 2);
  });

  it("caps the bottom too", () => {
    const d = bookcase(-118 / 2 + T + T / 2);
    const next = capAtEdge(d, "s1", "down", T)!;
    const cap = next.parts.find((p) => p.id === "s1")!;
    expect(cap.pos.y).toBeCloseTo(-118 / 2 + T / 2, 2);
    expect(cap.aCm).toBe(73);
  });

  it("treats a full-height board already flush with a face as the cap", () => {
    const outerCm = { w: 73, h: 118, d: 30 };
    const upright: Part = { id: "v1", role: "wall", axis: "x", aCm: 118, bCm: 30, pos: { x: -73 / 2 + T / 2, y: 0, z: 0 } };
    const d = { outerCm, colour: "white", thickness: 18, parts: [upright] } as Design;
    expect(isCap(upright, d, "left", T)).toBe(true);
    expect(capAtEdge(d, "v1", "left", T)).toBeNull(); // nothing left to promote
  });

  it("caps a side with an upright board", () => {
    const outerCm = { w: 73, h: 118, d: 30 };
    // A bare piece: one horizontal board plus an upright flush against the left.
    const shelf: Part = { id: "h1", role: "shelf", axis: "y", aCm: 73, bCm: 30, pos: { x: 0, y: 0, z: 0 } };
    // The upright stands one board in from the left face, so it has a promotion left to make.
    const upright: Part = { id: "v1", role: "divider", axis: "x", aCm: 118, bCm: 30, pos: { x: -73 / 2 + T + T / 2, y: 0, z: 0 } };
    const d = { outerCm, colour: "white", thickness: 18, parts: [shelf, upright] } as Design;
    const next = capAtEdge(d, "v1", "left", T);
    expect(next).not.toBeNull();
    const cap = next!.parts.find((p) => p.id === "v1")!;
    expect(cap.aCm).toBe(118);
    expect(cap.pos.x).toBeCloseTo(-73 / 2 + T / 2, 2);
    // the horizontal board it now covers is one thickness shorter
    expect(next!.parts.find((p) => p.id === "h1")!.aCm).toBeCloseTo(73 - T, 2);
  });
});

describe("drag intent at the edges", () => {
  const limitFor = (h: number) => ({ x: 73 / 2 - (69.4) / 2, y: h / 2 - T / 2 });

  it("stays out of the way for an ordinary drag inside the piece", () => {
    const d = bookcase(0);
    const part = d.parts.find((p) => p.id === "s1")!;
    expect(dragCapIntent({ x: 0, y: 10 }, limitFor(118), part, d, T)).toBeNull();
  });

  it("ignores a nudge just past the edge", () => {
    const d = bookcase(0);
    const part = d.parts.find((p) => p.id === "s1")!;
    const lim = limitFor(118);
    expect(dragCapIntent({ x: 0, y: lim.y + OVERSHOOT_CM - 0.5 }, lim, part, d, T)).toBeNull();
  });

  it("asks to promote once the drag pushes well past the edge", () => {
    const d = bookcase(0);
    const part = d.parts.find((p) => p.id === "s1")!;
    const lim = limitFor(118);
    expect(dragCapIntent({ x: 0, y: lim.y + OVERSHOOT_CM + 1 }, lim, part, d, T)).toEqual({ dir: "up", back: false });
  });

  it("takes two gestures: one to reach the edge, the next to become the top", () => {
    // A board in the middle is not in the last slot, so the drag that carries it
    // to the top can only land it flush there (the caller gates on this).
    const d = bookcase(0);
    const middle = d.parts.find((p) => p.id === "s1")!;
    expect(isAtEdgeSlot(middle, d, "up", T)).toBe(false);

    // Once it is parked flush under the top, the next gesture promotes it.
    const landed = { ...d, parts: d.parts.map((p) => (p.id === "s1" ? { ...p, pos: { ...p.pos, y: 118 / 2 - T - T / 2 } } : p)) };
    expect(isAtEdgeSlot(landed.parts.find((p) => p.id === "s1")!, landed, "up", T)).toBe(true);
    expect(capAtEdge(landed, "s1", "up", T)).not.toBeNull();
  });

  it("does not treat a board one slot short of the edge as parked there", () => {
    // Two thicknesses off the top: still an ordinary move, never a promotion.
    const d = bookcase(118 / 2 - 2 * T - T / 2);
    expect(isAtEdgeSlot(d.parts.find((p) => p.id === "s1")!, d, "up", T)).toBe(false);
    expect(capAtEdge(d, "s1", "up", T)).toBeNull();
  });

  it("asks to demote when a cap is pulled back off its face", () => {
    const capped = capAtEdge(bookcase(118 / 2 - T - T / 2), "s1", "up", T)!;
    const cap = capped.parts.find((p) => p.id === "s1")!;
    const lim = limitFor(118);
    expect(dragCapIntent({ x: 0, y: cap.pos.y - OVERSHOOT_CM - 1 }, lim, cap, capped, T)).toEqual({ dir: "up", back: true });
    // held against its own face: nothing happens
    expect(dragCapIntent({ x: 0, y: cap.pos.y }, lim, cap, capped, T)).toBeNull();
  });

  it("ignores overshoot on an axis the board cannot cap", () => {
    // A drag under an orbited camera drifts sideways: a horizontal board pushed
    // up must still read as "up", never as the much larger sideways overshoot.
    const d = bookcase(0);
    const part = d.parts.find((p) => p.id === "s1")!;
    const lim = { x: 73 / 2 - 69.4 / 2, y: 118 / 2 - T / 2 };
    expect(dragCapIntent({ x: -250, y: lim.y + 30 }, lim, part, d, T)).toEqual({ dir: "up", back: false });
    // and a sideways-only drift promotes nothing at all
    expect(dragCapIntent({ x: -250, y: 0 }, lim, part, d, T)).toBeNull();
  });
});
