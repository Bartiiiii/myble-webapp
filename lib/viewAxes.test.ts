import { describe, it, expect } from "vitest";
import { FRONT_FRAME, moveFrame, nudgeStep, worldDir, type MoveFrame } from "./viewAxes";

/** Camera basis for a view along `forward`, with the given right/up vectors. */
const view = (forward: [number, number, number], right: [number, number, number], up: [number, number, number]) =>
  [
    { x: forward[0], y: forward[1], z: forward[2] },
    { x: right[0], y: right[1], z: right[2] },
    { x: up[0], y: up[1], z: up[2] },
  ] as const;

describe("moveFrame", () => {
  it("locks depth when looking at the front", () => {
    const [f, r, u] = view([0, 0, -1], [1, 0, 0], [0, 1, 0]);
    expect(moveFrame(f, r, u)).toEqual({ locked: "z", h: "x", hSign: 1, v: "y", vSign: 1 });
  });

  it("flips the horizontal direction when looking from behind", () => {
    // Walked around the back: screen-right is now -x, so "→" must go -x too.
    const [f, r, u] = view([0, 0, 1], [-1, 0, 0], [0, 1, 0]);
    expect(moveFrame(f, r, u)).toMatchObject({ locked: "z", h: "x", hSign: -1, v: "y", vSign: 1 });
  });

  it("locks height when looking down from the top", () => {
    // Straight down: the screen plane is now the floor plan.
    const [f, r, u] = view([0, -1, 0], [1, 0, 0], [0, 0, -1]);
    expect(moveFrame(f, r, u)).toEqual({ locked: "y", h: "x", hSign: 1, v: "z", vSign: -1 });
  });

  it("locks width when looking from the side", () => {
    const [f, r, u] = view([-1, 0, 0], [0, 0, -1], [0, 1, 0]);
    expect(moveFrame(f, r, u)).toEqual({ locked: "x", h: "z", hSign: -1, v: "y", vSign: 1 });
  });

  it("holds the current plane near the crossover instead of flip-flopping", () => {
    // Just past 45° towards the top, but only barely: with the front plane
    // already in use it should stay there rather than switch on a tremor.
    const [f, r, u] = view([0, -0.71, -0.7], [1, 0, 0], [0, 0.7, -0.71]);
    expect(moveFrame(f, r, u, FRONT_FRAME).locked).toBe("z");
    // Committing to the top view does switch it.
    const [f2, r2, u2] = view([0, -0.95, -0.31], [1, 0, 0], [0, 0.31, -0.95]);
    expect(moveFrame(f2, r2, u2, FRONT_FRAME).locked).toBe("y");
  });
});

describe("nudgeStep", () => {
  it("moves along the screen from the front", () => {
    expect(nudgeStep(FRONT_FRAME, "up", 5)).toEqual({ x: 0, y: 5, z: 0 });
    expect(nudgeStep(FRONT_FRAME, "right", 5)).toEqual({ x: 5, y: 0, z: 0 });
    expect(nudgeStep(FRONT_FRAME, "down", 5)).toEqual({ x: 0, y: -5, z: 0 });
  });

  it("moves in depth, not height, from the top", () => {
    const top: MoveFrame = { locked: "y", h: "x", hSign: 1, v: "z", vSign: -1 };
    // Screen-up from above means further back into the piece.
    expect(nudgeStep(top, "up", 5)).toEqual({ x: 0, y: 0, z: -5 });
    expect(nudgeStep(top, "down", 5)).toEqual({ x: 0, y: 0, z: 5 });
    expect(nudgeStep(top, "right", 5)).toEqual({ x: 5, y: 0, z: 0 });
  });

  it("follows the camera around so the arrows never lie", () => {
    const behind: MoveFrame = { locked: "z", h: "x", hSign: -1, v: "y", vSign: 1 };
    expect(nudgeStep(behind, "right", 5)).toEqual({ x: -5, y: 0, z: 0 });
  });
});

describe("worldDir", () => {
  it("names what the button really does", () => {
    expect(worldDir(FRONT_FRAME, "up")).toBe("up");
    expect(worldDir(FRONT_FRAME, "left")).toBe("left");
    const top: MoveFrame = { locked: "y", h: "x", hSign: 1, v: "z", vSign: -1 };
    expect(worldDir(top, "up")).toBe("back");
    expect(worldDir(top, "down")).toBe("front");
  });
});
