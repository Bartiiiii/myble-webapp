// Which two axes a board may move along, decided by where the camera is.
//
// Three axes on a flat screen is one too many. With every direction always
// live, a drag that looked horizontal also slid the board through depth, and
// the arrow pad needed six buttons whose on-screen meaning changed with every
// orbit. So the view picks the plane: the world axis pointing most directly
// into the screen is locked, and the other two become screen-horizontal and
// screen-vertical — the two the user can actually see themselves moving along.
//
// Everything here is pure: it takes the camera's three basis vectors and says
// what they mean for movement. Nothing in it knows about React or three.js.
import type { Axis } from "./model";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MoveFrame {
  /** The axis running into the screen. Boards never move along it. */
  locked: Axis;
  /** World axis screen-horizontal maps to, and which way along it is right. */
  h: Axis;
  hSign: 1 | -1;
  /** World axis screen-vertical maps to, and which way along it is up. */
  v: Axis;
  vSign: 1 | -1;
}

/** Screen-relative direction a control asks for, before it means any world axis. */
export type Nudge = "up" | "down" | "left" | "right";

/** The six world directions, as the viewer's own labels already name them. */
export type WorldDir = "up" | "down" | "left" | "right" | "front" | "back";

export const AXES3: Axis[] = ["x", "y", "z"];

/** The camera pointing straight at the front of the piece — where it starts. */
export const FRONT_FRAME: MoveFrame = { locked: "z", h: "x", hSign: 1, v: "y", vSign: 1 };

/**
 * How much better a challenger has to be before it takes over as the locked
 * axis. Without it a camera parked near the 45° crossover would flip the whole
 * control scheme back and forth on the smallest nudge.
 */
const HYSTERESIS = 0.12;

const signOf = (n: number): 1 | -1 => (n < 0 ? -1 : 1);

/**
 * Read the movement plane off the camera's basis vectors. `forward` is where
 * the camera looks, `right` and `up` are its own axes in world space.
 */
export function moveFrame(forward: Vec3, right: Vec3, up: Vec3, previous?: MoveFrame | null): MoveFrame {
  const depth: Record<Axis, number> = {
    x: Math.abs(forward.x),
    y: Math.abs(forward.y),
    z: Math.abs(forward.z),
  };

  let locked = AXES3.reduce((best, a) => (depth[a] > depth[best] ? a : best));
  // Stay with the axis already in use unless the challenger is clearly better.
  if (previous && depth[previous.locked] + HYSTERESIS >= depth[locked]) locked = previous.locked;

  const free = AXES3.filter((a) => a !== locked);
  // Of the two that are left, the one the camera's right vector leans on is the
  // horizontal one; the other one is vertical.
  const horizontalFirst = Math.abs(right[free[0]]) >= Math.abs(right[free[1]]);
  const h = horizontalFirst ? free[0] : free[1];
  const v = horizontalFirst ? free[1] : free[0];

  return { locked, h, hSign: signOf(right[h]), v, vSign: signOf(up[v]) };
}

/** The world axis and direction a screen-relative nudge means under this frame. */
export function nudgeAxis(frame: MoveFrame, dir: Nudge): { axis: Axis; sign: 1 | -1 } {
  const horizontal = dir === "left" || dir === "right";
  const axis = horizontal ? frame.h : frame.v;
  const facing = horizontal ? frame.hSign : frame.vSign;
  const towards = dir === "right" || dir === "up" ? 1 : -1;
  return { axis, sign: (facing * towards) as 1 | -1 };
}

/** That nudge as a world-space step, ready for the existing move(dx, dy, dz). */
export function nudgeStep(frame: MoveFrame, dir: Nudge, stepCm: number): Vec3 {
  const { axis, sign } = nudgeAxis(frame, dir);
  const step: Vec3 = { x: 0, y: 0, z: 0 };
  step[axis] = sign * stepCm;
  return step;
}

/**
 * What that nudge actually does to the piece, so a button can still say "move
 * to the back" rather than a screen direction that means nothing out of context.
 */
export function worldDir(frame: MoveFrame, dir: Nudge): WorldDir {
  const { axis, sign } = nudgeAxis(frame, dir);
  if (axis === "y") return sign > 0 ? "up" : "down";
  if (axis === "x") return sign > 0 ? "right" : "left";
  return sign > 0 ? "front" : "back";
}
