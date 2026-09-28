// ─────────────────────────────────────────────────────────────────────────────
// meble.pl order files — the cut list as THEIR CSV, plus the drilling schedule.
// ─────────────────────────────────────────────────────────────────────────────
// meble's cut planner (/rozkroj,plyty-meblowe) imports a list of formatki from
// a CSV ("Obsługujemy CSV z PRO100"). Their own sample file defines the format:
//
//   Nazwa;Szerokość;Oklejanie szerokości;Wysokość;Oklejanie wysokość;
//   Grubość płyty;Ilość sztuk;Słoje
//   ;100;=;220;=;18;2;1
//
// Semicolons, CRLF, millimetres, one header row.
//
// WHAT THE CSV CANNOT CARRY: drilling. Their format has no columns for it — the
// holes are entered per formatka in the form (Szablon nawiertów → Wręgowanie i
// nawierty → Wiercenie w płaszczyźnie / w czole). So one upload can't be the
// whole order. The split this module produces:
//
//   1. cut list CSV   → uploaded; creates every formatka at the right size,
//                       banding, thickness and quantity, each one NAMED
//   2. drilling sheet → one line per row of holes, keyed by that name, in the
//                       exact fields their form asks for
//
// Both come out of `designToCutParts()` and `drillingPlan()`, so the file, the
// price and the assembly instructions can never disagree.

import { type Design, type EdgeKey, type Role, materialId } from "./model";
import {
  type DrillRow,
  DOWEL,
  EDGE_NUMBER,
  EDGE_PL,
  MIRROR_BACK_SURFACE_X,
  SURFACE_PL,
  describeRow,
  drillingPlan,
  edgeOffsetMm,
} from "./drilling";
import { designToCutParts } from "./quote";

// --- CSV dialect -------------------------------------------------------------

/** Verbatim from meble's sample file — their parser skips it, humans don't. */
const MEBLE_HEADER = [
  "Nazwa (nie wpływa na rozkrój)",
  "Szerokość",
  "Oklejanie szerokości",
  "Wysokość",
  "Oklejanie wysokość",
  "Grubość płyty",
  "Ilość sztuk",
  "Słoje [0 = bez znaczenia / 1 = po drugim wymiarze (po wysokości) /  2 lub puste = po pierwszym wymiarze (po szerokości) ]",
].join(";");

/**
 * Banding codes as they appear in meble's sample file: "=" on a banded pair,
 * "-" on a raw one. One code covers BOTH edges of that dimension, so a board
 * banded on one edge only can't be expressed — see `bandCode`.
 */
export type BandCode = "=" | "-";

/**
 * Uni-colour boards have no grain, so let the optimiser rotate freely:
 * 0 = "bez znaczenia". Worth revisiting the day we stock a wood decor.
 */
const GRAIN_FREE = 0;

// --- meble's drilling form ---------------------------------------------------
// Verified field-by-field against their live form and its validator. A row of
// our plan is one entry in one of their two blocks:
//
//   "Wiercenie w płaszczyźnie"  Powierzchnia · Wsp X · Wsp Y · Średnica ·
//                               Głębokość · Typ nawiertu (+ Ilość · Odległość ·
//                               Kierunek when Typ = wielowiert)
//   "Wiercenie w czole (boku)"  Krawędź · Odległość od 0 · Średnica ·
//                               Głębokość · Typ nawiertu (+ Ilość · Odległość)
//
// Their own notes on the form: face positions are "liczona od środka nawiertu",
// end holes are "robiony na środku grubości płyty" — both match what we emit.

/** One field of their form, ready to be typed in. */
export interface MebleField {
  /** The label exactly as it reads on meble.pl. Files use this. */
  label: string;
  /**
   * The same field with the repeated "nawiertu/nawiertów" dropped, for narrow
   * on-screen columns. Still unmistakable against their form, and it keeps the
   * label on one line so the values form a clean column. Omitted when `label`
   * is already short.
   */
  short?: string;
  value: string;
  /** True for the fields that only appear once Typ nawiertu = wielowiert. */
  multiOnly?: boolean;
}

/** What to show when space is tight. */
export function fieldLabel(f: MebleField, compact = false): string {
  return compact ? (f.short ?? f.label) : f.label;
}

/** Which of their two drilling blocks a row belongs to. */
export function drillBlock(row: DrillRow): string {
  return row.kind === "face" ? "Wiercenie w płaszczyźnie" : "Wiercenie w czole (boku)";
}

/**
 * A drill row as the exact sequence of fields to fill in on meble.pl, in the
 * order their form presents them. This is the single definition the drilling
 * sheet, the covering note and the backstage panel all render.
 */
export function drillFormFields(row: DrillRow, formatka?: MebleFormatka): MebleField[] {
  const multi = row.count > 1;
  const common: MebleField[] = [
    { label: "Średnica nawiertu", short: "Średnica", value: `${row.diameterMm} mm` },
    { label: "Głębokość nawiertu", short: "Głębokość", value: `${row.depthMm} mm` },
    { label: "Typ nawiertu", short: "Typ", value: multi ? "wielowiert" : "pojedynczy" },
    { label: "Ilość nawiertów", short: "Ilość", value: `${row.count}`, multiOnly: true },
    { label: "Odległość między nimi", short: "Odległość", value: `${row.pitchMm} mm`, multiOnly: true },
  ];

  if (row.kind === "face") {
    return [
      { label: "Powierzchnia", value: SURFACE_PL[row.surface ?? "front"] },
      { label: "Wsp X", value: `${faceX(row, formatka)} mm` },
      { label: "Wsp Y", value: `${row.yMm} mm` },
      ...common,
      { label: "Kierunek", value: row.along.toUpperCase(), multiOnly: true },
    ];
  }

  const edge = row.edge ?? "left";
  return [
    { label: "Krawędź", value: `Krawędź ${EDGE_NUMBER[edge]} (${EDGE_PL[edge]})` },
    { label: "Odległość od 0", value: `${edgeOffsetMm(row)} mm` },
    ...common,
  ];
}

/** Wsp X, honouring the back-surface question settled in lib/drilling.ts. */
function faceX(row: DrillRow, formatka?: MebleFormatka): number {
  if (MIRROR_BACK_SURFACE_X && formatka && row.kind === "face" && row.surface === "back") {
    return Math.round((formatka.widthMm - row.xMm) * 10) / 10;
  }
  return row.xMm;
}

/**
 * Rows that are each other's mirror image across the middle of the board, so
 * the second can be made with meble's "Skopiuj i odbij" button instead of being
 * typed out. Returns the index of the row to copy FROM, per row index.
 *
 * This is most of the typing on a carcass side: its two end joints sit at
 * x and width − x, which is exactly what that button produces.
 */
export function mirrorHints(rows: DrillRow[], formatka: MebleFormatka): Map<number, string> {
  const hints = new Map<number, string>();
  const taken = new Set<number>();

  const sameShape = (a: DrillRow, b: DrillRow) =>
    a.kind === b.kind &&
    a.surface === b.surface &&
    a.count === b.count &&
    a.pitchMm === b.pitchMm &&
    a.along === b.along &&
    a.depthMm === b.depthMm &&
    a.diameterMm === b.diameterMm;

  for (let i = 0; i < rows.length; i++) {
    if (taken.has(i)) continue;
    for (let j = i + 1; j < rows.length; j++) {
      if (taken.has(j) || !sameShape(rows[i], rows[j])) continue;
      const a = rows[i];
      const b = rows[j];
      if (a.kind !== "face") continue;
      const mirroredX = Math.abs(formatka.widthMm - a.xMm - b.xMm) < 0.2 && Math.abs(a.yMm - b.yMm) < 0.2;
      const mirroredY = Math.abs(formatka.heightMm - a.yMm - b.yMm) < 0.2 && Math.abs(a.xMm - b.xMm) < 0.2;
      if (mirroredX || mirroredY) {
        hints.set(j, `Skopiuj i odbij w ${mirroredX ? "X (w pionie)" : "Y (w poziomie)"} from row ${i + 1}`);
        taken.add(j);
        break;
      }
    }
  }
  return hints;
}

/**
 * What meble publish about these two services (meble.pl/plyty-informacje) plus
 * what was read off their live form, and what still has to be confirmed on the
 * first real order. These ride along with every export rather than living in
 * someone's head.
 */
export const MEBLE_NOTES = [
  "CSV import is a wholesale-account service (konta hurtowe) — check the account can see \"Wczytaj listę formatek z CSV\".",
  "meble print the FILE NAME and each formatka name on the label stuck to that part, so these names are what the workshop and the customer will read.",
  "Set Obrzeże for the whole board before importing (their sidebar: 0,8 mm / 1,0 mm bezspoinowe / 2,0 mm). The CSV says WHICH edges are banded, never how thick.",
  "Confirm whether the sizes in the CSV are read as the FINISHED size (after banding) or the bare board. Interior parts are cut to fit between their neighbours, so if meble add the band on top, every shelf comes back ~1.6 mm too long.",
  `Confirm ⌀${DOWEL.diameterMm} mm and the ${DOWEL.faceDepthMm}/${DOWEL.edgeDepthMm} mm depths are in BOTH dropdowns — the form defaults are ⌀5/10 mm in the face and ⌀4/20 mm in the edge, so the lists may differ between the two blocks.`,
  "Drilling is assumed to be billed per PIECE, not per hole — the price model depends on it, and a piece can carry a lot of holes.",
  "For non-standard drilling meble prefer a DWG/DXF drill plan by e-mail (cnc@meble.pl) — the fallback if typing rows in gets old.",
] as const;

const MATERIAL_LABEL: Record<string, string> = {
  white_18: "White 18 mm",
  black_18: "Black 18 mm",
  white_36: "White 36 mm",
  black_36: "Black 36 mm",
};
const ROLE_LABEL: Record<Role, string> = { wall: "Wall", shelf: "Shelf", divider: "Divider" };

// --- Types -------------------------------------------------------------------

/** One design in the batch, tagged with the reference it ships under. */
export interface MebleItem {
  /** Order number, design slug — whatever you'll recognise on the invoice. */
  ref: string;
  design: Design;
}

export interface MebleFormatka {
  /** Goes in the Nazwa column and keys the drilling sheet. Unique in the batch. */
  code: string;
  ref: string;
  role: Role;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  quantity: number;
  bandWidth: BandCode;
  bandHeight: BandCode;
  /** The exact per-edge truth, for the sheet (the CSV only carries the pair). */
  banded: Record<EdgeKey, boolean>;
  /** True when banding differs within a pair, so the CSV had to round up. */
  bandRoundedUp: boolean;
  /** Holes on ONE piece of this formatka (every piece is drilled alike). */
  drills: DrillRow[];
}

export interface MebleBatch {
  materialId: string;
  materialLabel: string;
  thicknessMm: number;
  formatki: MebleFormatka[];
  totals: { formatki: number; pieces: number; holes: number; dowels: number };
  /** Anything a human must check before or after the upload. */
  warnings: string[];
}

// --- Building the batch ------------------------------------------------------

/**
 * meble's importer loads into ONE selected board (płyta), and the board is the
 * colour + thickness. So a batch is per material: designs in White 18 go in one
 * upload, Black 36 in another. Everything of one material lands in ONE file —
 * which is the point of batching orders in the first place.
 */
export function mebleBatches(items: MebleItem[]): MebleBatch[] {
  const batches = new Map<string, MebleBatch>();

  for (const item of items) {
    const id = materialId(item.design);
    let batch = batches.get(id);
    if (!batch) {
      batch = {
        materialId: id,
        materialLabel: MATERIAL_LABEL[id] ?? id,
        thicknessMm: item.design.thickness,
        formatki: [],
        totals: { formatki: 0, pieces: 0, holes: 0, dowels: 0 },
        warnings: [],
      };
      batches.set(id, batch);
    }

    const plan = drillingPlan(item.design);
    const groups = designToCutParts(item.design);

    groups.forEach((group, i) => {
      // `id` holds the design part ids in this group; they're drilled alike by
      // construction (the drill signature is part of the grouping key), so one
      // member's rows describe every piece.
      const partIds = (group.id ?? "").split(",").filter(Boolean);
      const drills = partIds.length ? (plan.byPart.get(partIds[0]) ?? []) : [];
      const banded = {
        top: group.edgeBanding?.top ?? true,
        bottom: group.edgeBanding?.bottom ?? true,
        left: group.edgeBanding?.left ?? true,
        right: group.edgeBanding?.right ?? true,
      };
      const width = bandCode(banded.top, banded.bottom);
      const height = bandCode(banded.left, banded.right);
      const role = (group.name ?? "shelf") as Role;

      batch.formatki.push({
        code: formatkaCode(item.ref, i + 1, role),
        ref: item.ref,
        role,
        widthMm: group.widthMm,
        heightMm: group.heightMm,
        thicknessMm: item.design.thickness,
        quantity: group.quantity ?? 1,
        bandWidth: width.code,
        bandHeight: height.code,
        banded,
        bandRoundedUp: width.roundedUp || height.roundedUp,
        drills,
      });
    });

    for (const w of plan.warnings) batch.warnings.push(`${item.ref}: ${w.code} — ${w.detail}`);
    batch.totals.dowels += plan.dowelCount;
  }

  for (const batch of batches.values()) {
    batch.totals.formatki = batch.formatki.length;
    batch.totals.pieces = batch.formatki.reduce((n, f) => n + f.quantity, 0);
    batch.totals.holes = batch.formatki.reduce(
      (n, f) => n + f.quantity * f.drills.reduce((m, r) => m + r.count, 0),
      0,
    );
    batch.warnings.push(...batchWarnings(batch));
  }

  return [...batches.values()];
}

/**
 * Everything about a batch a human has to reconcile before ordering.
 *
 * Myble bands every edge (see geometry/edges.ts), so in normal operation this
 * returns nothing at all — which is the point: an empty list means the upload
 * is ready to go. The checks stay because they are cheap and because a raw
 * edge is exactly the kind of thing that would otherwise be discovered at
 * meble's counter rather than here.
 */
export function batchWarnings(batch: MebleBatch): string[] {
  const out: string[] = [];

  if (batch.formatki.some((f) => f.bandRoundedUp)) {
    out.push(
      "Some formatki are banded on one edge of a pair only. The CSV can't say that, so they upload banded on both; check the rows flagged in the drilling sheet and fix them in the form if the extra band matters.",
    );
  }

  const rawAndDrilled = batch.formatki.filter(
    (f) => f.drills.length > 0 && (f.bandWidth === "-" || f.bandHeight === "-"),
  );
  if (rawAndDrilled.length) {
    out.push(
      `${rawAndDrilled.length} formatka(s) are drilled but not banded on all four edges (${rawAndDrilled
        .map((f) => f.code)
        .slice(0, 4)
        .join(", ")}${rawAndDrilled.length > 4 ? ", …" : ""}). meble's page says online drilling needs every edge banded — if the fields don't show up, band all four or send the plan to cnc@meble.pl.`,
    );
  }

  if (batch.formatki.some((f) => f.bandWidth !== f.bandHeight)) {
    out.push(
      'This batch mixes banded and raw edges, so it relies on which column meble reads as which pair. Check the first import against their on-screen formatka preview (their own advice: "Zweryfikuj dane po wczytaniu!").',
    );
  }

  return out;
}

/**
 * The CSV carries one code per DIMENSION, not per edge. Banded-on-both is "=",
 * raw is "-", and a half-banded pair rounds UP: an extra 2 mm band costs cents,
 * a missing one on a visible edge costs a remake.
 */
function bandCode(a: boolean, b: boolean): { code: BandCode; roundedUp: boolean } {
  if (a && b) return { code: "=", roundedUp: false };
  if (!a && !b) return { code: "-", roundedUp: false };
  return { code: "=", roundedUp: true };
}

/** Short, unique, and readable in meble's formatka header: "MB-1042-03 Shelf". */
function formatkaCode(ref: string, index: number, role: Role): string {
  const n = String(index).padStart(2, "0");
  return `${ref}-${n} ${ROLE_LABEL[role]}`.slice(0, 40);
}

// --- The files ---------------------------------------------------------------

const csv = (rows: (string | number)[][]) =>
  rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v);
          return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
        })
        .join(";"),
    )
    .join("\r\n");

/**
 * The file to upload at meble.pl → Rozkrój płyt → "Wczytaj listę formatek z
 * CSV". Pick the matching board first: the CSV sets sizes, banding, thickness
 * and quantities, not the decor.
 */
export function mebleCutlistCSV(batch: MebleBatch): string {
  const rows = batch.formatki.map((f) => [
    f.code,
    f.widthMm,
    f.bandWidth,
    f.heightMm,
    f.bandHeight,
    f.thicknessMm,
    f.quantity,
    GRAIN_FREE,
  ]);
  return [MEBLE_HEADER, csv(rows)].join("\r\n") + "\r\n";
}

const DRILL_HEADER = [
  "formatka",
  "blok",
  "powierzchnia / krawedz",
  "wsp_x_lub_odleglosc_od_0_mm",
  "wsp_y_mm",
  "srednica_mm",
  "glebokosc_mm",
  "typ_nawiertu",
  "ilosc_nawiertow",
  "odleglosc_miedzy_nimi_mm",
  "kierunek",
  "skrot",
  "opis",
].join(";");

/**
 * The half meble's CSV can't take: per formatka, the rows of holes to enter
 * under "Wręgowanie i nawierty". One line per entry in their form, columns
 * named after their fields, so it transcribes straight across. `skrot` names
 * the rows you can make with their "Skopiuj i odbij" button instead of typing;
 * `opis` restates the row in words as a cross-check against the board.
 */
export function drillingSheetCSV(batch: MebleBatch): string {
  const rows: (string | number)[][] = [];
  for (const f of batch.formatki) {
    const hints = mirrorHints(f.drills, f);
    f.drills.forEach((row, i) => {
      const fields = new Map(drillFormFields(row, f).map((x) => [x.label, x.value]));
      const num = (label: string) => (fields.get(label) ?? "").replace(" mm", "");
      const isFace = row.kind === "face";
      rows.push([
        f.code,
        drillBlock(row),
        isFace ? (fields.get("Powierzchnia") ?? "") : (fields.get("Krawędź") ?? ""),
        isFace ? num("Wsp X") : num("Odległość od 0"),
        isFace ? num("Wsp Y") : "",
        num("Średnica nawiertu"),
        num("Głębokość nawiertu"),
        fields.get("Typ nawiertu") ?? "",
        row.count > 1 ? row.count : "",
        row.count > 1 ? row.pitchMm : "",
        isFace && row.count > 1 ? (fields.get("Kierunek") ?? "") : "",
        hints.get(i) ?? "",
        describeRow(row, undefined),
      ]);
    });
  }
  if (rows.length === 0) return `${DRILL_HEADER}\r\n# no drilling in this batch\r\n`;
  return [DRILL_HEADER, csv(rows)].join("\r\n") + "\r\n";
}

/** Everything about a batch in one readable block — the covering note. */
export function mebleBatchSummary(batch: MebleBatch): string {
  const drilled = batch.formatki.filter((f) => f.drills.length > 0);
  const lines = [
    `Myble → meble.pl · ${batch.materialLabel}`,
    `${batch.totals.formatki} formatki · ${batch.totals.pieces} pieces · ` +
      `${batch.totals.holes} holes · ${batch.totals.dowels} dowels (${DOWEL.diameterMm} × ${DOWEL.lengthMm} mm)`,
    "",
    "STEP 1 — the cut list",
    "  Rozkrój płyt → pick the board, set Obrzeże, then Wczytaj listę formatek z CSV",
    "  (zastąp bieżącą listę). Check the imported sizes against the list below.",
    "",
    ...batch.formatki.map(
      (f) =>
        `  ${f.code}: ${f.widthMm}×${f.heightMm} mm ×${f.quantity} · ` +
        `banding ${f.bandWidth}/${f.bandHeight} · ${f.drills.reduce((n, r) => n + r.count, 0)} holes`,
    ),
    "",
    "STEP 2 — the drilling, one formatka at a time",
    "  Szablon nawiertów → Wręgowanie i nawierty, tick Wiercenie w płaszczyźnie",
    "  and/or Wiercenie w czole (boku), then + dodaj nawiert for each entry below.",
    "  Edges are numbered on their drawing: 1 = top, 2 = right, 3 = bottom, 4 = left.",
    "  Wsp X runs from the left edge, Wsp Y from the bottom edge.",
  ];

  for (const f of drilled) {
    const hints = mirrorHints(f.drills, f);
    lines.push("", `  ${f.code}  (${f.widthMm}×${f.heightMm} mm, ×${f.quantity})`);
    let block = "";
    f.drills.forEach((row, i) => {
      const b = drillBlock(row);
      if (b !== block) {
        lines.push(`    ${b}:`);
        block = b;
      }
      const fields = drillFormFields(row, f)
        .filter((x) => !x.multiOnly || row.count > 1)
        .map((x) => `${x.label} ${x.value}`)
        .join(" · ");
      lines.push(`      ${i + 1}. ${fields}`);
      const hint = hints.get(i);
      if (hint) lines.push(`         ↳ or just: ${hint}`);
    });
  }

  if (batch.warnings.length) {
    lines.push("", "Check on this batch:", ...batch.warnings.map((w) => `• ${w}`));
  }
  lines.push("", "Before the first order:", ...MEBLE_NOTES.map((n) => `• ${n}`));
  return lines.join("\n");
}
