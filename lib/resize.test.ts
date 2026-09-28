import { describe, it, expect } from "vitest";
import { type Design, type Part, partBox, thicknessCm } from "./model";
import { contactSides, fillSlot, fillTarget, filledPart, resizedPart, stretchedPart } from "./geometry";

const design = (parts: Part[], outer = { w: 120, h: 120, d: 40 }): Design => ({
  colour: "white",
  thickness: 18,
  outerCm: outer,
  parts,
});

const shelf = (id: string, aCm: number, pos: Part["pos"], bCm = 30): Part => ({
  id,
  role: "shelf",
  axis: "y",
  aCm,
  bCm,
  pos,
});

/** A vertical divider: thickness on x, aCm = height, bCm = depth. */
const divider = (id: string, aCm: number, pos: Part["pos"], bCm = 30): Part => ({
  id,
  role: "divider",
  axis: "x",
  aCm,
  bCm,
  pos,
});

const t = thicknessCm(design([]));
const spanX = (p: Part) => {
  const b = partBox(p, t);
  return [Math.round(b.min.x * 10) / 10, Math.round(b.max.x * 10) / 10];
};

describe("contactSides", () => {
  it("sees a board flush against one face only", () => {
    // Shelf spanning x[-40,40] with a divider hard against its left end.
    const s = shelf("s", 80, { x: 0, y: 0, z: 0 });
    const d = divider("d", 40, { x: -40 - t / 2, y: 0, z: 0 });
    expect(contactSides(s, [d], t, "x")).toEqual({ min: true, max: false });
  });

  it("ignores a board that only kisses a corner", () => {
    const s = shelf("s", 80, { x: 0, y: 0, z: 0 });
    // Flush on x, but pushed out of the shelf's depth so they share no face area.
    const d = divider("d", 40, { x: -40 - t / 2, y: 0, z: 90 });
    expect(contactSides(s, [d], t, "x")).toEqual({ min: false, max: false });
  });
});

describe("anchored resize (rule 1)", () => {
  it("keeps the touching side put and shrinks from the free side", () => {
    const s = shelf("s", 80, { x: 0, y: 0, z: 0 }); // x[-40, 40]
    const d = divider("d", 40, { x: -40 - t / 2, y: 0, z: 0 }); // against the left end
    const out = resizedPart(s, "aCm", 60, [d], t, design([]).outerCm)!;
    expect(out).not.toBeNull();
    // Left edge unmoved at -40; the right edge is the one that came in.
    expect(spanX(out)).toEqual([-40, 20]);
  });

  it("keeps the touching side put when it grows, too", () => {
    const s = shelf("s", 80, { x: 0, y: 0, z: 0 });
    const d = divider("d", 40, { x: -40 - t / 2, y: 0, z: 0 });
    const out = resizedPart(s, "aCm", 100, [d], t, design([]).outerCm)!;
    expect(spanX(out)).toEqual([-40, 60]);
  });

  it("anchors on the right when that is the side in contact", () => {
    const s = shelf("s", 80, { x: 0, y: 0, z: 0 });
    const d = divider("d", 40, { x: 40 + t / 2, y: 0, z: 0 });
    const out = resizedPart(s, "aCm", 60, [d], t, design([]).outerCm)!;
    expect(spanX(out)).toEqual([-20, 40]);
  });

  it("stays centred when both sides are pinned", () => {
    const s = shelf("s", 80, { x: 0, y: 0, z: 0 });
    const left = divider("l", 40, { x: -40 - t / 2, y: 0, z: 0 });
    const right = divider("r", 40, { x: 40 + t / 2, y: 0, z: 0 });
    const out = resizedPart(s, "aCm", 60, [left, right], t, design([]).outerCm)!;
    expect(spanX(out)).toEqual([-30, 30]);
  });

  it("stays centred when nothing is touching it", () => {
    const s = shelf("s", 80, { x: 0, y: 0, z: 0 });
    const out = resizedPart(s, "aCm", 60, [], t, design([]).outerCm)!;
    expect(spanX(out)).toEqual([-30, 30]);
  });

  it("refuses a size that would land inside another board", () => {
    // Free on both sides, so it grows symmetrically — straight into the blocker.
    const s = shelf("s", 40, { x: 0, y: 0, z: 0 });
    const blocker = shelf("b", 20, { x: 35, y: 0, z: 0 });
    expect(resizedPart(s, "aCm", 90, [blocker], t, design([]).outerCm)).toBeNull();
  });
});

describe("fill matches a neighbour (rule 2)", () => {
  it("trims to the length of the shorter board it touches", () => {
    const s = shelf("s", 100, { x: 0, y: 0, z: 0 });
    const below = shelf("b", 60, { x: 0, y: -t, z: 0 }); // stacked flush underneath
    const target = fillTarget(s, "aCm", [below], t, design([]).outerCm);
    expect(target).toEqual({ cm: 60, matched: true });
  });

  it("takes the closest length below its own, not the shortest", () => {
    const s = shelf("s", 100, { x: 0, y: 0, z: 0 });
    const below = shelf("b", 60, { x: 0, y: -t, z: 0 });
    const above = shelf("a", 90, { x: 0, y: t, z: 0 });
    expect(fillTarget(s, "aCm", [below, above], t, design([]).outerCm).cm).toBe(90);
  });

  it("ignores neighbours that are longer than it already is", () => {
    const s = shelf("s", 60, { x: 0, y: 0, z: 0 });
    const below = shelf("b", 100, { x: 0, y: -t, z: 0 });
    // Nothing shorter to match, so fill still means "span the carcass".
    const target = fillTarget(s, "aCm", [below], t, { w: 120, h: 120, d: 40 });
    expect(target.matched).toBe(false);
    expect(target.cm).toBe(120 - 2 * t);
  });

  it("never matches a board's thickness (a divider seen edge-on)", () => {
    // The divider touches the shelf, and is ~1.8 cm across x — matching that
    // would collapse the shelf to a sliver. It bounds the slot instead.
    const s = shelf("s", 100, { x: 0, y: 0, z: 0 });
    const d = divider("d", 40, { x: -50 - t / 2, y: 0, z: 0 });
    const target = fillTarget(s, "aCm", [d], t, { w: 120, h: 120, d: 40 });
    expect(target.matched).toBe(false);
    // Slot runs from the divider's face (-50) to the far carcass face (58.2).
    expect(target.cm).toBe(108.2);
  });

  it("only looks at boards it actually touches", () => {
    const s = shelf("s", 100, { x: 0, y: 0, z: 0 });
    const far = shelf("f", 60, { x: 0, y: 50, z: 0 }); // nowhere near it
    expect(fillTarget(s, "aCm", [far], t, { w: 120, h: 120, d: 40 }).matched).toBe(false);
  });

  it("matching a neighbour keeps the joint the board already has", () => {
    // Shelf x[-50,50], divider hard against its left end, shorter shelf below.
    const s = shelf("s", 100, { x: 0, y: 0, z: 0 });
    const d = divider("d", 40, { x: -50 - t / 2, y: 0, z: 0 });
    const below = shelf("b", 60, { x: 0, y: -t, z: 0 });
    const out = filledPart(s, "aCm", [d, below], t, { w: 120, h: 120, d: 40 })!;
    expect(out.aCm).toBe(60);
    expect(spanX(out)).toEqual([-50, 10]); // left edge held against the divider
  });

  it("spanning the carcass still recentres an off-centre board", () => {
    const s = shelf("s", 40, { x: 30, y: 0, z: 0 });
    const out = filledPart(s, "aCm", [], t, { w: 120, h: 120, d: 40 })!;
    expect(out.aCm).toBe(120 - 2 * t);
    expect(out.pos.x).toBe(0);
  });
});

describe("fill spans the slot (rule 3)", () => {
  const outer = { w: 120, h: 120, d: 60 };
  const wall = (id: string, x: number): Part => ({
    id,
    role: "wall",
    axis: "x",
    aCm: 110,
    bCm: 60,
    pos: { x, y: 0, z: 0 },
  });

  it("reaches the board it faces instead of doing nothing", () => {
    // Reported case: a narrow board against the left wall, with a second wall
    // standing well inside the carcass to its right. Aiming at the full inner
    // span drove straight through that wall, so fill was rejected outright.
    const left = wall("L", -59.1); // inner face at -58.2
    const right = wall("R", 10.9); // inner face at  10
    const s = shelf("s", 26, { x: -45.2, y: 20, z: 0 }, 50); // x[-58.2, -32.2]

    const out = filledPart(s, "aCm", [left, right], t, outer)!;
    expect(out).not.toBeNull();
    expect(out.aCm).toBe(68.2); // -58.2 → 10
    expect(spanX(out)).toEqual([-58.2, 10]);
  });

  it("fills a compartment between two dividers", () => {
    const l = divider("l", 40, { x: -20 - t / 2, y: 0, z: 0 });
    const r = divider("r", 40, { x: 20 + t / 2, y: 0, z: 0 });
    const s = shelf("s", 12, { x: 0, y: 0, z: 0 });
    const out = filledPart(s, "aCm", [l, r], t, outer)!;
    expect(spanX(out)).toEqual([-20, 20]);
  });

  it("only counts boards standing in the path, not ones beside it", () => {
    // Same height band as the shelf? No — this one sits well above it, so it
    // must not shorten the slot.
    const above = shelf("a", 40, { x: 40, y: 50, z: 0 });
    const s = shelf("s", 20, { x: 0, y: 0, z: 0 });
    expect(fillSlot(s, [above], t, outer, "x")).toEqual({ lo: -58.2, hi: 58.2 });
  });

  it("still spans the whole carcass when nothing is in the way", () => {
    const s = shelf("s", 20, { x: 15, y: 0, z: 0 });
    const out = filledPart(s, "aCm", [], t, outer)!;
    expect(out.aCm).toBe(120 - 2 * t);
    expect(out.pos.x).toBe(0);
  });
});

describe("stretching one edge", () => {
  const outer = { w: 120, h: 120, d: 60 };

  it("moves the grabbed edge and leaves the opposite one alone", () => {
    const s = shelf("s", 40, { x: 0, y: 0, z: 0 }); // x[-20, 20]
    const out = stretchedPart(s, "aCm", 1, 50, [], t, outer)!;
    expect(spanX(out)).toEqual([-20, 50]); // left edge untouched
    expect(out.aCm).toBe(70);
  });

  it("works the same grabbing the other end", () => {
    const s = shelf("s", 40, { x: 0, y: 0, z: 0 });
    const out = stretchedPart(s, "aCm", -1, -50, [], t, outer)!;
    expect(spanX(out)).toEqual([-50, 20]); // right edge untouched
    expect(out.aCm).toBe(70);
  });

  it("shrinks as happily as it grows", () => {
    const s = shelf("s", 40, { x: 0, y: 0, z: 0 });
    const out = stretchedPart(s, "aCm", 1, 0, [], t, outer)!;
    expect(spanX(out)).toEqual([-20, 0]);
    expect(out.aCm).toBe(20);
  });

  it("stops at the board in its way rather than running through it", () => {
    const s = shelf("s", 40, { x: 0, y: 0, z: 0 });
    const wall = divider("w", 40, { x: 30 + t / 2, y: 0, z: 0 }); // inner face at 30
    const out = stretchedPart(s, "aCm", 1, 90, [wall], t, outer)!; // asked for far past it
    expect(spanX(out)).toEqual([-20, 30]);
  });

  it("snaps flush to a face it is reaching for", () => {
    const s = shelf("s", 40, { x: 0, y: 0, z: 0 });
    const wall = divider("w", 40, { x: 30 + t / 2, y: 0, z: 0 });
    // Stopped 1 cm short — close enough that meeting the wall is the intent.
    const out = stretchedPart(s, "aCm", 1, 29, [wall], t, outer)!;
    expect(spanX(out)).toEqual([-20, 30]);
  });

  it("stops at the carcass when nothing blocks it", () => {
    const s = shelf("s", 40, { x: 0, y: 0, z: 0 });
    const out = stretchedPart(s, "aCm", 1, 500, [], t, outer)!;
    expect(spanX(out)).toEqual([-20, 60]);
  });

  it("never shrinks below the shortest board we can cut", () => {
    const s = shelf("s", 40, { x: 0, y: 0, z: 0 });
    const out = stretchedPart(s, "aCm", 1, -19, [], t, outer)!;
    expect(out.aCm).toBe(10);
    expect(spanX(out)).toEqual([-20, -10]); // still anchored on the left
  });

  it("holds the anchored edge exactly across a long drag", () => {
    // A real drag fires ~100 move events. Each one re-derives the board from the
    // last, so any rounding in the anchored edge compounds; it must not move.
    let p = shelf("s", 40, { x: 0, y: 0, z: 0 }); // x[-20, 20]
    for (let i = 0; i < 120; i++) {
      const leading = 20 + Math.sin(i / 7) * 15; // wobble the grabbed edge about
      p = stretchedPart(p, "aCm", 1, leading, [], t, outer, -20)!;
      expect(spanX(p)[0]).toBe(-20);
    }
  });

  it("stretches depth through the b dimension", () => {
    const s = shelf("s", 40, { x: 0, y: 0, z: 0 }, 30); // z[-15, 15]
    const out = stretchedPart(s, "bCm", -1, -25, [], t, outer)!;
    expect(out.bCm).toBe(40);
    expect(out.pos.z).toBe(-5); // z[-25, 15]
  });
});

describe("corners click shut (near-miss welding)", () => {
  const outer = { w: 120, h: 120, d: 60 };

  it("closes the sliver a small trim would have left in both corners", () => {
    // The reported case: a bottom board trimmed a few cm inside its bay ends up
    // looking seated while neither corner can take a dowel.
    const left = divider("l", 110, { x: -58.2 - t / 2, y: 0, z: 0 }); // face at -58.2
    const right = divider("r", 110, { x: 58.2 + t / 2, y: 0, z: 0 }); // face at  58.2
    const bottom = shelf("b", 116.4, { x: 0, y: -50, z: 0 });
    const out = resizedPart(bottom, "aCm", 112.4, [left, right], t, outer)!;
    expect(spanX(out)).toEqual([-58.2, 58.2]); // pulled back onto both faces
  });

  it("leaves a deliberately short board alone", () => {
    // 20 cm short of the wall is a design, not a miss.
    const left = divider("l", 110, { x: -58.2 - t / 2, y: 0, z: 0 });
    const right = divider("r", 110, { x: 58.2 + t / 2, y: 0, z: 0 });
    const bottom = shelf("b", 116.4, { x: 0, y: -50, z: 0 });
    const out = resizedPart(bottom, "aCm", 76.4, [left, right], t, outer)!;
    expect(out.aCm).toBe(76.4);
    expect(spanX(out)).toEqual([-38.2, 38.2]);
  });

  it("welds only the free end when the other is already seated", () => {
    const left = divider("l", 110, { x: -58.2 - t / 2, y: 0, z: 0 });
    const right = divider("r", 110, { x: 58.2 + t / 2, y: 0, z: 0 });
    // Sitting against the left wall, 2 cm shy of the right one.
    const board = shelf("b", 114.4, { x: -57.2 + 57.2 - 1, y: -50, z: 0 });
    const seated = resizedPart(board, "aCm", 114.4, [left, right], t, outer)!;
    expect(spanX(seated)[1]).toBe(58.2);
  });

  it("does not reach for a board it shares no face with", () => {
    // Same x-gap, but at a different height: nothing to join, nothing to weld.
    const far = divider("f", 10, { x: 58.2 + t / 2, y: 55, z: 0 });
    const bottom = shelf("b", 116.4, { x: 0, y: -50, z: 0 });
    const out = resizedPart(bottom, "aCm", 112.4, [far], t, outer)!;
    expect(out.aCm).toBe(112.4);
  });
});
