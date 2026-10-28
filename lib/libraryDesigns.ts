// The drawings behind the curated Design Library (see lib/libraryKit.ts for the
// coordinate system: exterior cm, x from the left, y from the floor, z from
// the back). One function per piece; lib/library.ts files each one under a
// category with its card labels, and lib/library.test.ts holds every one of
// them to the nine library rules.
//
// House conventions, so the pieces read as one family:
//   • 18 mm board, except table tops and desks, which are 36 mm throughout
//     (one board thickness per design is all the model knows).
//   • Anything over 60 cm tall is braced with designed-in rails: a 10 cm rail
//     under the top and one on the bottom (and a middle one above 120 cm).
//     Uprights that pass a rail stand one board forward of the back.
//   • No flat board spans more than ~65 cm in 18 mm or ~130 cm in 36 mm
//     between supports, and every upright stands on something that is held.

import type { Design } from "./model";
import { carcass, evenBays, evenLevels, kit, piece, type Board, type Kit } from "./libraryKit";

/** Back rails under the top and on the bottom of a carcass `w` × `h` (cm), at x0. */
function rails(k: Kit, x0: number, w: number, h: number, height = 10): Board[] {
  const { t } = k;
  return [k.b("rail-top", x0 + t, x0 + w - t, h - t - height, h - t), k.b("rail-bottom", x0 + t, x0 + w - t, t, t + height)];
}

// ── Kept from the first library, fixed ──────────────────────────────────────

/**
 * Alcove classic: one column, three shelves. 68 cm wide because that is the
 * widest an 18 mm shelf spans without sagging under books (the old 73 cm
 * version sagged 2.5 mm against a 2.1 mm limit); wider alcoves take a divider.
 */
export function police(): Design {
  const w = 68;
  const h = 118;
  const k = kit(18, 35);
  const { t } = k;
  const levels = evenLevels(t, h - t, 3, t);
  return piece({
    colour: "white",
    thickness: 18,
    boards: [...carcass(k, w, h), ...levels.map((y, i) => k.h(`s${i + 1}`, t, w - t, y)), ...rails(k, 0, w, h)],
  });
}

/**
 * Grid bookcase: two columns, four rows of 27 cm, tall enough for hardbacks
 * (the old five rows were 21 cm). The centre divider is cut per row; the top
 * and bottom pieces stand one board forward to clear the rails.
 */
export function grid(): Design {
  const w = 82;
  const h = 118;
  const d = 36;
  const k = kit(18, d);
  const { t } = k;
  const levels = evenLevels(t, h - t, 3, t);
  const x = (w - t) / 2;
  const rows: [number, number][] = [
    [t, levels[0]],
    [levels[0] + t, levels[1]],
    [levels[1] + t, levels[2]],
    [levels[2] + t, h - t],
  ];
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      ...levels.map((y, i) => k.h(`s${i + 1}`, t, w - t, y)),
      ...rows.map(([y0, y1], i) => (i === 0 || i === rows.length - 1 ? k.v(`d${i + 1}`, x, y0, y1, t, d) : k.v(`d${i + 1}`, x, y0, y1))),
      ...rails(k, 0, w, h),
    ],
  });
}

/**
 * Record console: four slots sized for LPs (34 cm clear, 38 cm deep), a 49 cm
 * bay above for the amplifier, the turntable on top at 62 cm. The upper
 * upright stands on the middle record divider, so the top never spans more
 * than half the width.
 */
export function record(): Design {
  const w = 104;
  const h = 62;
  const d = 40;
  const k = kit(18, d);
  const { t } = k;
  const mid = t + 34; // shelf over the record slots
  const slots = evenBays(t, w - t, 3, t);
  const centre = slots[1];
  return piece({
    colour: "black",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.h("shelf", t, w - t, mid),
      ...slots.map((x, i) => k.v(`slot${i + 1}`, x, t, mid, t, d)),
      k.v("hifi", centre, mid + t, h - t, t, d),
      ...rails(k, 0, w, h),
    ],
  });
}

/** TV bench: three bays, the open middle one for the box, split shelves either side. Unchanged. */
export function tvbench(): Design {
  const w = 118;
  const h = 44;
  const k = kit(18, 40);
  const { t } = k;
  const shelfY = t + 19;
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.v("d1", 38.8, t, h - t),
      k.v("d2", 77.4, t, h - t),
      k.h("s1", t, 38.8, shelfY),
      k.h("s2", 79.2, w - t, shelfY),
    ],
  });
}

/**
 * Shoe bench: seat at 45 cm, two bays with a shelf for everyday shoes and one
 * full-height bay for boots. Bays are 30 cm, which also keeps the seat strong.
 */
export function shoebench(): Design {
  const w = 96;
  const h = 45;
  const k = kit(18, 32);
  const { t } = k;
  const [x1, x2] = evenBays(t, w - t, 2, t);
  const shelfY = evenLevels(t, h - t, 1, t)[0];
  return piece({
    colour: "black",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.v("d1", x1, t, h - t),
      k.v("d2", x2, t, h - t),
      k.h("s1", t, x1, shelfY),
      k.h("s2", x1 + t, x2, shelfY),
    ],
  });
}

/**
 * Cat box bench: the litter tray sits behind a front panel that stops 20 cm
 * above the bottom, so the cat walks in underneath and the tray slides out the
 * same way, while the room sees a plain bench. Next to it a tall bay for the
 * litter bags and one with a shelf for the scoop and the rest. 118 cm keeps it
 * inside the engine's 120 cm module width (SCOPE-SIZE-003).
 */
export function catbench(): Design {
  const w = 118;
  const h = 48;
  const d = 50;
  const k = kit(18, d);
  const { t } = k;
  const x1 = t + 54; // litter bay: 54 cm clear, takes a 52 cm tray
  const x2 = x1 + t + (w - t - (x1 + t) - t) / 2;
  const opening = 20.4;
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.v("d1", x1, t, h - t),
      k.v("d2", x2, t, h - t),
      k.b("front", t, x1, t + opening, h - t, d - t),
      k.h("s1", x2 + t, w - t, evenLevels(t, h - t, 1, t)[0]),
    ],
  });
}

/** Two-tier nightstand: a shallow tray under the top for the phone and glasses, a tall bay below. */
export function stolek(): Design {
  const w = 44;
  const h = 55;
  const k = kit(18, 38);
  const { t } = k;
  return piece({
    colour: "white",
    thickness: 18,
    boards: [...carcass(k, w, h), k.h("s1", t, w - t, t + 32)],
  });
}

// ── Batch 1: shelves and storage ────────────────────────────────────────────

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Offset bookcase: two columns, the right column's shelves halfway between
 * the left column's (the Myble mark). One continuous divider carries every
 * shelf at both ends, so nothing is cantilevered. Rails at top, middle and
 * bottom; the divider stands one board forward to clear them.
 */
export function offset(): Design {
  const w = 78;
  const h = 190;
  const d = 33;
  const k = kit(18, d);
  const { t } = k;
  const cx = (w - t) / 2;
  const left = evenLevels(t, h - t, 5, t);
  const right = left.slice(0, 4).map((y, i) => r1((y + left[i + 1]) / 2));
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.v("C", cx, t, h - t, t, d),
      ...left.map((y, i) => k.h(`l${i + 1}`, t, cx, y)),
      ...right.map((y, i) => k.h(`r${i + 1}`, cx + t, w - t, y)),
      ...rails(k, 0, w, h),
      k.b("rail-mid", t, w - t, 82.2, 92.2),
    ],
  });
}

/**
 * Slim tower: 40 cm for the gap beside a door or the fridge. Tall bays at the
 * bottom for boxes, a 40 cm bay at eye height, low ones at the top.
 */
export function slimtower(): Design {
  const w = 40;
  const h = 180;
  const k = kit(18, 30);
  const { t } = k;
  const openings = [32, 32, 40, 21.1, 21.1];
  const levels: number[] = [];
  let y = t;
  for (const o of openings) {
    y = r1(y + o);
    levels.push(y);
    y += t;
  }
  return piece({
    colour: "black",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      ...levels.map((ly, i) => k.h(`s${i + 1}`, t, w - t, ly)),
      ...rails(k, 0, w, h),
      k.b("rail-mid", t, w - t, 84.4, 94.4),
    ],
  });
}

/**
 * Three-bay library: 118 × 180 with five shelves in the outer bays and two in
 * the middle, so the middle bays are twice as tall. Continuous dividers,
 * standing forward of the top, middle and bottom rails.
 */
export function library(): Design {
  const w = 118;
  const h = 180;
  const d = 33;
  const k = kit(18, d);
  const { t } = k;
  const [x1, x2] = evenBays(t, w - t, 2, t);
  const levels = evenLevels(t, h - t, 5, t);
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.v("d1", x1, t, h - t, t, d),
      k.v("d2", x2, t, h - t, t, d),
      ...levels.map((y, i) => k.h(`a${i + 1}`, t, x1, y)),
      ...[levels[1], levels[3]].map((y, i) => k.h(`b${i + 1}`, x1 + t, x2, y)),
      ...levels.map((y, i) => k.h(`c${i + 1}`, x2 + t, w - t, y)),
      ...rails(k, 0, w, h),
      k.b("rail-mid", t, w - t, 100, 110),
    ],
  });
}

/**
 * Under-window bookcase: 72 cm, under the sill. The uprights run to the floor
 * as legs and the bays sit 10 cm up; shelves either side, a tall open bay in
 * the middle. A rail under the top and one behind the plinth brace it.
 */
export function underwindow(): Design {
  const w = 118;
  const h = 72;
  const d = 30;
  const k = kit(18, d);
  const { t } = k;
  const lift = 10;
  const [x1, x2] = evenBays(t, w - t, 2, t);
  const shelfY = evenLevels(lift + t, h - t, 1, t)[0];
  return piece({
    colour: "black",
    thickness: 18,
    boards: [
      k.v("L", 0, 0, h),
      k.v("R", w - t, 0, h),
      k.h("T", t, w - t, h - t),
      k.v("d1", x1, 0, h - t, t, d),
      k.v("d2", x2, 0, h - t, t, d),
      k.h("b1", t, x1, lift),
      k.h("b2", x1 + t, x2, lift),
      k.h("b3", x2 + t, w - t, lift),
      k.h("s1", t, x1, shelfY),
      k.h("s2", x2 + t, w - t, shelfY),
      k.b("rail-top", t, w - t, h - t - 10, h - t),
      k.b("rail-bottom", t, w - t, 0, lift),
    ],
  });
}

/**
 * Checkerboard divider: splits a room at 96 cm and looks finished from both
 * sides. The outer cubbies each get a back, on alternating sides; the middle
 * column stays open as a window. Backs stop 5 mm short of the shelf (a back
 * jointed to a fixed shelf has no assembly path).
 */
export function divider(): Design {
  const w = 118;
  const h = 96;
  const d = 38;
  const k = kit(18, d);
  const { t } = k;
  const [x1, x2] = evenBays(t, w - t, 2, t);
  const mid = evenLevels(t, h - t, 1, t)[0];
  const gap = 0.5;
  const back = 0;
  const front = d - t;
  return piece({
    colour: "black",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.v("d1", x1, t, h - t),
      k.v("d2", x2, t, h - t),
      k.h("s1", t, x1, mid),
      k.h("s2", x1 + t, x2, mid),
      k.h("s3", x2 + t, w - t, mid),
      k.b("p1", t, x1, t, mid - gap, back),
      k.b("p2", t, x1, mid + t + gap, h - t, front),
      k.b("p3", x2 + t, w - t, t, mid - gap, front),
      k.b("p4", x2 + t, w - t, mid + t + gap, h - t, back),
    ],
  });
}

/**
 * Step shelf: three columns climbing 40, 80 and 120 cm. Every top is held
 * between two uprights; the shelves line up across the columns. The tall
 * column carries the rails.
 */
export function steps(): Design {
  const bay = 36;
  const k = kit(18, 35);
  const { t } = k;
  const xs = [0, t + bay, 2 * (t + bay), 3 * (t + bay)];
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      k.v("u0", xs[0], 0, 40),
      k.v("u1", xs[1], t, 80),
      k.v("u2", xs[2], t, 120),
      k.v("u3", xs[3], 0, 120),
      k.h("B", t, xs[3], 0),
      k.h("t1", t, xs[1], 40 - t),
      k.h("t2", xs[1] + t, xs[2], 80 - t),
      k.h("t3", xs[2] + t, xs[3], 120 - t),
      k.h("s2", xs[1] + t, xs[2], 40 - t),
      k.h("s3a", xs[2] + t, xs[3], 40 - t),
      k.h("s3b", xs[2] + t, xs[3], 80 - t),
      k.b("rail-top", xs[2] + t, xs[3], 120 - t - 10, 120 - t),
      k.b("rail-bottom", xs[2] + t, xs[3], t, t + 10),
    ],
  });
}

/**
 * Window seat: a 47 cm bench with three cubbies for standard 33 cm storage
 * boxes. The uprights are the legs, the cubbies sit 10 cm up. Bays of 36 cm
 * keep the seat strong for a person sitting anywhere on it.
 */
export function windowseat(): Design {
  const w = 116;
  const h = 47;
  const d = 42;
  const k = kit(18, d);
  const { t } = k;
  const lift = 10;
  const [x1, x2] = evenBays(t, w - t, 2, t);
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      k.v("L", 0, 0, h),
      k.v("R", w - t, 0, h),
      k.h("T", t, w - t, h - t),
      k.v("d1", x1, 0, h - t),
      k.v("d2", x2, 0, h - t),
      k.h("b1", t, x1, lift),
      k.h("b2", x1 + t, x2, lift),
      k.h("b3", x2 + t, w - t, lift),
    ],
  });
}

/**
 * Toy garage: no bottom board, so toy bins slide straight out on the floor.
 * One shelf at 28 cm with books and favourites above. A low rail at the back
 * stops bins from leaving through the back and squares the frame.
 */
export function toybox(): Design {
  const w = 100;
  const h = 52;
  const d = 40;
  const k = kit(18, d);
  const { t } = k;
  const cx = (w - t) / 2;
  const shelfY = 28;
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      k.v("L", 0, 0, h),
      k.v("R", w - t, 0, h),
      k.h("T", t, w - t, h - t),
      k.h("s1", t, w - t, shelfY),
      k.v("c1", cx, 0, shelfY, t, d),
      k.v("c2", cx, shelfY + t, h - t),
      k.b("rail-bottom", t, w - t, 0, 10),
    ],
  });
}

/**
 * Open wardrobe: 42 cm deep for folded clothes (a 180 × 50 cm side would not
 * fit a parcel courier's girth). Five shelves on the left; on the right an
 * 87 cm bay for the laundry basket under three shelves. One continuous
 * divider, rails at top, middle and bottom.
 */
export function wardrobe(): Design {
  const w = 100;
  const h = 180;
  const d = 42;
  const k = kit(18, d);
  const { t } = k;
  const cx = (w - t) / 2;
  const levels = evenLevels(t, h - t, 5, t);
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.v("C", cx, t, h - t, t, d),
      ...levels.map((y, i) => k.h(`l${i + 1}`, t, cx, y)),
      ...levels.slice(2).map((y, i) => k.h(`r${i + 1}`, cx + t, w - t, y)),
      ...rails(k, 0, w, h),
      k.b("rail-mid", t, w - t, 100, 110),
    ],
  });
}

/**
 * Plant steps: two steps for pots, the lower 45 cm deep at 36 cm, the upper
 * 25 cm deep at 72 cm, with cubbies under both. The lower top runs over its
 * sides so the upper row stands on it directly above them.
 */
export function plantsteps(): Design {
  const w = 80;
  const k = kit(18, 45);
  const { t } = k;
  const low = 36;
  const high = 72;
  const upper = 25;
  const cx = (w - t) / 2;
  return piece({
    colour: "black",
    thickness: 18,
    boards: [
      k.v("L", 0, 0, low - t),
      k.v("R", w - t, 0, low - t),
      k.h("B", t, w - t, 0),
      k.v("c1", cx, t, low - t, t, 45),
      k.h("t1", 0, w, low - t),
      k.v("uL", 0, low, high - t, 0, upper),
      k.v("uR", w - t, low, high - t, 0, upper),
      k.v("c2", cx, low, high - t, t, upper),
      k.h("t2", 0, w, high - t, 0, upper),
      k.b("rail-top", t, w - t, high - t - 10, high - t),
      k.b("rail-bottom", t, w - t, t, t + 10),
    ],
  });
}

// ── Batch 2: tables (36 mm), nightstands, the cat climber ───────────────────

/**
 * Coffee table with a book pod (your picture 01): a 36 mm top over a long
 * magazine shelf, and at one end a 26 cm pod with two bays. The top runs from
 * wall to wall and rests on the pod's inner upright.
 */
export function podtable(): Design {
  const w = 110;
  const h = 42;
  const k = kit(36, 55);
  const { t } = k;
  const p = 76.4; // pod's inner upright
  const shelfY = t + (h - 3 * t) / 2;
  return piece({
    colour: "white",
    thickness: 36,
    boards: [
      k.v("L", 0, 0, h),
      k.v("R", w - t, 0, h),
      k.h("T", t, w - t, h - t),
      k.v("P", p, 0, h - t),
      k.h("pB", p + t, w - t, 0),
      k.h("pS", p + t, w - t, shelfY),
      k.h("S", t, p, shelfY),
    ],
  });
}

/**
 * Coffee table with a hideaway tray (your picture 02 without the lift): the
 * top rests on two slabs; under it, a half-depth tray at the back keeps the
 * remotes and the laptop out of sight; a floor shelf for baskets below.
 * 96 × 58 keeps the 36 mm shelves under the engine's 90 cm span cap and the
 * piece under the 60 cm depth where every joint needs a third cam.
 */
export function traytable(): Design {
  const w = 96;
  const h = 46;
  const d = 58;
  const k = kit(36, d);
  const { t } = k;
  const under = h - t;
  return piece({
    colour: "black",
    thickness: 36,
    boards: [
      k.v("L", 0, 0, under),
      k.v("R", w - t, 0, under),
      k.h("T", 0, w, under),
      k.h("tray", t, w - t, under - 12 - t, 0, 29),
      k.h("S", t, w - t, 12.5),
    ],
  });
}

/**
 * Nesting coffee table (your picture 05): two slabs and a top, with a
 * stretcher low at the back to keep it square. The nesting stool table
 * (`nest`) slides in under it: 82.8 cm wide, 40.4 high and 46.4 deep clear.
 */
export function arch(): Design {
  const w = 90;
  const h = 44;
  const k = kit(36, 50);
  const { t } = k;
  return piece({
    colour: "black",
    thickness: 36,
    boards: [k.v("L", 0, 0, h - t), k.v("R", w - t, 0, h - t), k.h("T", 0, w, h - t), k.b("stretcher", t, w - t, 0, 10)],
  });
}

/** Nesting stool table: a closed 36 mm frame that lives under the nesting coffee table. */
export function nest(): Design {
  const w = 40;
  const h = 38;
  const k = kit(36, 44);
  const { t } = k;
  return piece({
    colour: "black",
    thickness: 36,
    boards: [k.v("L", 0, 0, h), k.v("R", w - t, 0, h), k.h("T", t, w - t, h - t), k.h("B", t, w - t, 0)],
  });
}

/**
 * Slot side table (your picture 07): a 36 mm top resting on two slabs with a
 * 2 cm overhang each side, and an open 12 cm slot where the drawer would be.
 */
export function utable(): Design {
  const w = 46;
  const h = 50;
  const k = kit(36, 40);
  const { t } = k;
  const inset = 2;
  const under = h - t;
  return piece({
    colour: "white",
    thickness: 36,
    boards: [
      k.v("L", inset, 0, under),
      k.v("R", w - inset - t, 0, under),
      k.h("T", 0, w, under),
      k.h("slot", inset + t, w - inset - t, under - 12 - t),
    ],
  });
}

/**
 * Gallery nightstand (the raised top of your picture 06): the back panel and
 * the sides rise 10 cm above the top, so nothing slides down behind the bed.
 * The shelf stops 5 mm short of the back panel (no shelf-to-back joint).
 */
export function lipstand(): Design {
  const w = 45;
  const h = 64;
  const d = 36;
  const k = kit(18, d);
  const { t } = k;
  const topY = h - 10 - t;
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      k.v("L", 0, 0, h),
      k.v("R", w - t, 0, h),
      k.h("B", t, w - t, 0),
      k.b("back", t, w - t, t, h),
      k.h("T", t, w - t, topY, t, d),
      k.h("s1", t, w - t, t + 30, t + 0.5, d),
    ],
  });
}

/** Slim bedside: 32 cm for the gap between the bed and the wall, 70 cm tall, three tiers. */
export function talltable(): Design {
  const w = 32;
  const h = 70;
  const k = kit(18, 30);
  const { t } = k;
  return piece({
    colour: "black",
    thickness: 18,
    boards: [...carcass(k, w, h), ...evenLevels(t, h - t, 2, t).map((y, i) => k.h(`s${i + 1}`, t, w - t, y)), ...rails(k, 0, w, h)],
  });
}

/** Low bedside for platform beds: 46 cm, two small cubbies on one side, one tall bay on the other. */
export function lowstand(): Design {
  const w = 60;
  const h = 46;
  const k = kit(18, 35);
  const { t } = k;
  const [x] = evenBays(t, w - t, 1, t);
  return piece({
    colour: "white",
    thickness: 18,
    boards: [...carcass(k, w, h), k.v("d", x, t, h - t), k.h("s1", t, x, evenLevels(t, h - t, 1, t)[0])],
  });
}

/**
 * Cat climber: a 60 cm column beside a 112 cm one, so the cat goes floor, 60,
 * 112. Six cubbies; the lower-left one is a hidden house behind a low front
 * panel (the cat walks in under it). The divider runs the full height and
 * stands forward of the plinth rail.
 */
export function catclimber(): Design {
  const w = 78;
  const low = 60;
  const high = 112;
  const d = 40;
  const k = kit(18, d);
  const { t } = k;
  const cx = (w - t) / 2;
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      k.v("L", 0, 0, low),
      k.v("R", w - t, 0, high),
      k.h("B", t, w - t, 0),
      k.v("C", cx, t, high, t, d),
      k.h("t1", t, cx, low - t),
      k.h("t2", cx + t, w - t, high - t),
      k.h("l1", t, cx, 30),
      k.h("r1", cx + t, w - t, 30),
      k.h("r2", cx + t, w - t, low - t),
      k.h("r3", cx + t, w - t, 86),
      k.b("house", t, cx, 19.5, 29.5, d - t),
      k.b("rail-top", cx + t, w - t, high - t - 10, high - t),
      k.b("rail-bottom", t, w - t, t, t + 10),
    ],
  });
}

// ── Batch 3: TV & music, desks (36 mm), hallway, the reading den ────────────

/**
 * Record cube: four cubes sized for LPs (34 cm clear each way, 38 cm deep),
 * raised on its uprights so the turntable on top sits at 83 cm, a comfortable
 * height to cue a record standing. Rails under the top and behind the plinth;
 * the dividers stand forward of them.
 */
export function lpcube(): Design {
  const bay = 34;
  const lift = 10;
  const k = kit(18, 40);
  const { t, d } = k;
  const w = 3 * t + 2 * bay;
  const shelfY = lift + t + bay;
  const h = shelfY + t + bay + t;
  const cx = t + bay;
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      k.v("L", 0, 0, h),
      k.v("R", w - t, 0, h),
      k.h("T", t, w - t, h - t),
      k.h("b1", t, cx, lift),
      k.h("b2", cx + t, w - t, lift),
      k.v("c1", cx, 0, shelfY, t, d),
      k.h("s1", t, w - t, shelfY),
      k.v("c2", cx, shelfY + t, h - t, t, d),
      k.b("rail-top", t, w - t, h - t - 10, h - t),
      k.b("rail-bottom", t, w - t, 0, lift),
    ],
  });
}

/**
 * Speaker bench: a bay at each end for a bookshelf speaker (26 cm wide, 48 cm
 * tall, open at the back for the cables and the bass port), the receiver and
 * the streamer on two levels in the middle.
 */
export function speakerbench(): Design {
  const w = 118;
  const h = 52;
  const k = kit(18, 40);
  const { t } = k;
  const end = 26;
  const x1 = t + end;
  const x2 = w - t - end - t;
  return piece({
    colour: "black",
    thickness: 18,
    boards: [...carcass(k, w, h), k.v("d1", x1, t, h - t), k.v("d2", x2, t, h - t), k.h("s1", x1 + t, x2, t + 24)],
  });
}

/**
 * Work nook: a 36 mm desk whose right end is a bookcase pedestal, two 34 cm
 * bays for ring binders and books, open to the chair. The top runs over a
 * slab on the left and the pedestal; a rail under it and a stretcher at the
 * floor brace the 77 cm knee space at the back, a rail under the top braces
 * the pedestal. 50 cm deep, so every board comes out of one 36 mm sheet.
 */
export function worknook(): Design {
  const w = 118;
  const h = 75;
  const k = kit(36, 50);
  const { t } = k;
  const under = h - t;
  const p = w - t - 30 - t; // the pedestal's inner upright: a 30 cm bay
  return piece({
    colour: "white",
    thickness: 36,
    boards: [
      k.v("L", 0, 0, under),
      k.v("P", p, 0, under),
      k.v("R", w - t, 0, under),
      k.h("T", 0, w, under),
      k.h("S", p + t, w - t, 33.6),
      k.b("rail-top", t, p, under - 10, under),
      k.b("stretcher", t, p, 0, 10),
      k.b("p-rail-top", p + t, w - t, under - 10, under),
    ],
  });
}

/**
 * Compact desk for the 80–90 cm window nook: a 36 mm top on two slabs, with an
 * 11 cm cable tray at the back under the top for the power strip and the
 * chargers. A rail above the tray and a stretcher at the floor keep it square.
 * 78 cm wide: at 80 the quote's sheet packer bills a second 36 mm sheet.
 */
export function minidesk(): Design {
  const w = 78;
  const h = 75;
  const k = kit(36, 50);
  const { t } = k;
  const under = h - t;
  const trayY = under - 11 - t;
  return piece({
    colour: "black",
    thickness: 36,
    boards: [
      k.v("L", 0, 0, under),
      k.v("R", w - t, 0, under),
      k.h("T", 0, w, under),
      k.h("tray", t, w - t, trayY, 0, 15),
      k.b("rail", t, w - t, trayY + t + 0.5, under),
      k.b("stretcher", t, w - t, 0, 10),
    ],
  });
}

/**
 * Desk shelf: lifts the laptop or a small screen 20 cm toward eye level (20 cm
 * is also the lowest piece the configurator makes) and keeps paper, the router
 * and notebooks in three A4 bays underneath.
 */
export function hutch(): Design {
  const w = 100;
  const h = 20;
  const k = kit(18, 25);
  const { t } = k;
  const [x1, x2] = evenBays(t, w - t, 2, t);
  return piece({
    colour: "black",
    thickness: 18,
    boards: [...carcass(k, w, h), k.v("d1", x1, t, h - t), k.v("d2", x2, t, h - t)],
  });
}

/**
 * Printer stand: the printer on top at 66 cm, a 12 cm slot under it for reams
 * of paper, and below a 25 cm bay with a shelf for ink and envelopes beside a
 * 34 cm bay for the shredder or the paper bin.
 */
export function printerstand(): Design {
  const w = 64;
  const h = 66;
  const d = 42;
  const k = kit(18, d);
  const { t } = k;
  const slotY = h - t - 12 - t;
  const x = t + 25;
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.h("slot", t, w - t, slotY),
      k.v("d1", x, t, slotY, t, d),
      k.h("s1", t, x, evenLevels(t, slotY, 1, t)[0]),
      k.b("rail-top", t, w - t, slotY + t + 0.5, h - t),
      k.b("rail-bottom", t, w - t, t, t + 10),
    ],
  });
}

/**
 * Kids' desk: a 36 mm top at 52 cm (ages 4–7) with the sides and a back rail
 * rising 8 cm above it, so pencils and crayons stay on the desk. A stretcher
 * at the floor keeps it square.
 */
export function kidsdesk(): Design {
  const w = 70;
  const h = 60;
  const top = 52;
  const k = kit(36, 45);
  const { t, d } = k;
  return piece({
    colour: "white",
    thickness: 36,
    boards: [
      k.v("L", 0, 0, h),
      k.v("R", w - t, 0, h),
      k.h("T", t, w - t, top - t, t, d),
      k.b("gallery", t, w - t, top - t, h),
      k.b("stretcher", t, w - t, 0, 10),
    ],
  });
}

/**
 * Shoe tower: a 32 cm bay at the bottom for winter boots and four 18 cm tiers
 * above it, two pairs to a tier, on 52 cm of floor.
 */
export function shoetower(): Design {
  const w = 52;
  const h = 114;
  const k = kit(18, 32);
  const { t } = k;
  const boots = t + 32;
  const tiers = [boots, ...evenLevels(boots + t, h - t, 3, t)];
  return piece({
    colour: "black",
    thickness: 18,
    boards: [...carcass(k, w, h), ...tiers.map((y, i) => k.h(`s${i + 1}`, t, w - t, y)), ...rails(k, 0, w, h)],
  });
}

/**
 * Hall console for a narrow hallway: keys on top at 80 cm, a 12 cm slot for
 * the post and the gloves, two bays for bags or baskets and two for shoes. One
 * line of dividers down the middle carries every board at mid-span.
 */
export function hallConsole(): Design {
  const w = 100;
  const h = 80;
  const d = 32;
  const k = kit(18, d);
  const { t } = k;
  const cx = (w - t) / 2;
  const shoeY = t + 17;
  const slotY = h - t - 12 - t;
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.h("shoes", t, w - t, shoeY),
      k.h("slot", t, w - t, slotY),
      k.v("c1", cx, t, shoeY, t, d),
      k.v("c2", cx, shoeY + t, slotY),
      k.v("c3", cx, slotY + t, h - t, t, d),
      k.b("rail-top", t, w - t, slotY + t + 0.5, h - t),
      k.b("rail-bottom", t, w - t, t, t + 10),
    ],
  });
}

/**
 * Hall bench with a back: sit at 46 cm to put your shoes on and lean on the
 * back panel (it takes the coat hooks of your choice); hats and gloves on the
 * shelf above, four shoe cubbies under the seat. The back panel stops 5 mm
 * short of the seat and the shelf, so the two sides hold it.
 */
export function halltree(): Design {
  const w = 66;
  const h = 120;
  const d = 36;
  const k = kit(18, d);
  const { t } = k;
  const cx = (w - t) / 2;
  const seatY = 46 - t;
  const shoeY = evenLevels(t, seatY, 1, t)[0];
  const hatY = 98;
  const gap = 0.5;
  return piece({
    colour: "black",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.h("seat", t, w - t, seatY),
      k.v("c", cx, t, seatY, t, d),
      k.h("s1", t, cx, shoeY),
      k.h("s2", cx + t, w - t, shoeY),
      k.h("hat", t, w - t, hatY),
      k.b("back", t, w - t, seatY + t + gap, hatY - gap),
      ...rails(k, 0, w, h),
    ],
  });
}

/**
 * Reading den: two book towers joined by a seat at 40 cm and a top at 120 cm,
 * so a child sits inside the bookcase and leans on the back panel. A box of
 * toys or books goes under the seat. The back panel runs from the bottom to
 * the top (it braces the whole piece) and the seat stops 5 mm short of it; at
 * 42 cm the seat is strong enough for an adult.
 */
export function den(): Design {
  const tower = 30;
  const seat = 42;
  const h = 120;
  const k = kit(18, 40);
  const { t } = k;
  const u1 = t + tower;
  const u2 = u1 + t + seat;
  const w = u2 + t + tower + t;
  const seatY = 40 - t;
  const levels = [seatY, 80 - t];
  return piece({
    colour: "white",
    thickness: 18,
    boards: [
      ...carcass(k, w, h),
      k.v("u1", u1, t, h - t),
      k.v("u2", u2, t, h - t),
      k.h("seat", u1 + t, u2, seatY, t + 0.5, k.d),
      ...levels.map((y, i) => k.h(`l${i + 1}`, t, u1, y)),
      ...levels.map((y, i) => k.h(`r${i + 1}`, u2 + t, w - t, y)),
      k.b("back", u1 + t, u2, t, h - t),
    ],
  });
}
