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
