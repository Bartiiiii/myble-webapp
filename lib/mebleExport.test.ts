import { describe, it, expect } from "vitest";
import {
  MEBLE_NOTES,
  batchWarnings,
  drillFormFields,
  drillingSheetCSV,
  mebleBatchSummary,
  mebleBatches,
  mebleCutlistCSV,
  mirrorHints,
} from "./mebleExport";
import { presetDesign } from "./build";
import { drillingPlan, edgeOffsetMm } from "./drilling";

const police = () => ({ ref: "MB-1001", design: presetDesign("police") });
const skrinka = () => ({ ref: "MB-1002", design: presetDesign("skrinka") }); // black
const stolek = () => ({ ref: "MB-1003", design: presetDesign("stolek") }); // white

describe("meble batches", () => {
  it("puts every design of one material in a single batch", () => {
    const batches = mebleBatches([police(), stolek(), skrinka()]);
    expect(batches.map((b) => b.materialId).sort()).toEqual(["black_18", "white_18"]);
    const white = batches.find((b) => b.materialId === "white_18")!;
    expect(new Set(white.formatki.map((f) => f.ref))).toEqual(new Set(["MB-1001", "MB-1003"]));
  });

  it("counts pieces, holes and dowels across the batch", () => {
    const item = police();
    const plan = drillingPlan(item.design);
    const [batch] = mebleBatches([item]);
    expect(batch.totals.pieces).toBe(item.design.parts.length);
    expect(batch.totals.holes).toBe(plan.holeCount);
    expect(batch.totals.dowels).toBe(plan.dowelCount);
  });

  it("gives every formatka a unique, traceable name", () => {
    const batch = mebleBatches([police(), stolek()])[0];
    const codes = batch.formatki.map((f) => f.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => c.startsWith("MB-100"))).toBe(true);
    expect(codes.every((c) => c.length <= 40)).toBe(true);
  });
});

describe("cut list CSV (meble import format)", () => {
  const csv = () => mebleCutlistCSV(mebleBatches([police()])[0]);

  it("matches their sample: semicolons, CRLF, 8 columns, one header", () => {
    const lines = csv().trimEnd().split("\r\n");
    expect(lines[0].startsWith("Nazwa (nie wpływa na rozkrój);Szerokość;Oklejanie szerokości")).toBe(true);
    expect(lines).toHaveLength(1 + mebleBatches([police()])[0].formatki.length);
    for (const line of lines) expect(line.split(";")).toHaveLength(8);
    expect(csv().includes("\n\n")).toBe(false);
  });

  it("writes millimetre integers, real quantities and a banding code per dimension", () => {
    for (const line of csv().trimEnd().split("\r\n").slice(1)) {
      const [name, w, bw, h, bh, t, qty, grain] = line.split(";");
      expect(name).toMatch(/^MB-1001-\d\d /);
      expect(Number.isInteger(Number(w))).toBe(true);
      expect(Number.isInteger(Number(h))).toBe(true);
      expect(["=", "-"]).toContain(bw);
      expect(["=", "-"]).toContain(bh);
      expect(t).toBe("18");
      expect(Number(qty)).toBeGreaterThan(0);
      expect(grain).toBe("0"); // uni colours have no grain — let it rotate
    }
  });

  it("bands every formatka on all four edges, so meble will drill them", () => {
    for (const item of [police(), skrinka(), stolek()]) {
      for (const batch of mebleBatches([item])) {
        expect(batch.formatki.every((f) => f.bandWidth === "=" && f.bandHeight === "=")).toBe(true);
        expect(batch.formatki.every((f) => !f.bandRoundedUp)).toBe(true);
        // Nothing left for a human to reconcile after the import.
        expect(batch.warnings).toEqual([]);
      }
    }
  });
});

describe("drilling sheet", () => {
  it("has one line per row of holes, keyed by the formatka name", () => {
    const [batch] = mebleBatches([police()]);
    const lines = drillingSheetCSV(batch).trimEnd().split("\r\n");
    const expected = batch.formatki.reduce((n, f) => n + f.drills.length, 0);
    expect(expected).toBeGreaterThan(0);
    expect(lines).toHaveLength(1 + expected);
    expect(lines[0].startsWith("formatka;blok")).toBe(true);
    for (const line of lines.slice(1)) {
      const cells = line.split(";");
      expect(batch.formatki.some((f) => cells[0] === f.code)).toBe(true);
      expect(["Wiercenie w płaszczyźnie", "Wiercenie w czole (boku)"]).toContain(cells[1]);
    }
  });

  it("names the surface for face holes and the numbered edge for end holes", () => {
    const sheet = drillingSheetCSV(mebleBatches([police()])[0]);
    expect(sheet).toContain("Wiercenie w płaszczyźnie");
    expect(sheet).toMatch(/Przód|Tył/);
    expect(sheet).toContain("Wiercenie w czole (boku)");
    expect(sheet).toMatch(/Krawędź [1-4]/);
    expect(sheet).toContain("wielowiert");
  });

  it("gives each row exactly the fields meble's form asks for", () => {
    const [batch] = mebleBatches([police()]);
    const face = batch.formatki.flatMap((f) => f.drills).find((r) => r.kind === "face")!;
    const edge = batch.formatki.flatMap((f) => f.drills).find((r) => r.kind === "edge")!;

    expect(drillFormFields(face).map((f) => f.label)).toEqual([
      "Powierzchnia", "Wsp X", "Wsp Y", "Średnica nawiertu", "Głębokość nawiertu",
      "Typ nawiertu", "Ilość nawiertów", "Odległość między nimi", "Kierunek",
    ]);
    expect(drillFormFields(edge).map((f) => f.label)).toEqual([
      "Krawędź", "Odległość od 0", "Średnica nawiertu", "Głębokość nawiertu",
      "Typ nawiertu", "Ilość nawiertów", "Odległość między nimi",
    ]);
    // "Odległość od 0" runs from the left on edges 1/3 and from the bottom on 2/4.
    const off = drillFormFields(edge).find((f) => f.label === "Odległość od 0")!.value;
    expect(off).toBe(`${edgeOffsetMm(edge)} mm`);
  });

  it("spots the mirror-image rows you can make with Skopiuj i odbij", () => {
    // A carcass side takes its two end joints at x and width − x.
    const [batch] = mebleBatches([police()]);
    const wall = batch.formatki.find((f) => f.drills.some((r) => r.kind === "face"))!;
    const hints = mirrorHints(wall.drills, wall);
    expect(hints.size).toBeGreaterThan(0);
    for (const hint of hints.values()) expect(hint).toContain("Skopiuj i odbij");
  });

  it("survives a design with nothing to drill", () => {
    const d = presetDesign("police");
    const single = { ref: "MB-0001", design: { ...d, parts: [d.parts[0]] } };
    const [batch] = mebleBatches([single]);
    expect(batch.totals.holes).toBe(0);
    expect(drillingSheetCSV(batch)).toContain("no drilling");
    expect(mebleCutlistCSV(batch).trimEnd().split("\r\n")).toHaveLength(2);
  });
});

describe("covering note", () => {
  it("tells the operator what to do with the two files", () => {
    const summary = mebleBatchSummary(mebleBatches([police()])[0]);
    expect(summary).toContain("White 18 mm");
    expect(summary).toContain("Wczytaj listę formatek z CSV");
    expect(summary).toContain("Wręgowanie i nawierty");
    expect(summary).toContain("dowels");
    expect(summary).toContain("STEP 1");
    expect(summary).toContain("STEP 2");
    // The frame the numbers are in has to be stated, or they're unusable.
    expect(summary).toContain("Wsp X runs from the left edge");
  });

  it("carries meble's own conditions on both services", () => {
    const summary = mebleBatchSummary(mebleBatches([police()])[0]);
    for (const note of MEBLE_NOTES) expect(summary).toContain(note);
  });

  it("keeps the raw-edge guard armed in case the banding policy ever changes", () => {
    // Nothing produces a raw edge today; this proves the warning still fires if
    // something ever does, rather than silently shipping an undrillable part.
    const [batch] = mebleBatches([police()]);
    const doctored = {
      ...batch,
      formatki: batch.formatki.map((f, i) => (i === 0 ? { ...f, bandHeight: "-" as const } : f)),
      warnings: [],
    };
    expect(batchWarnings(doctored).some((w) => w.includes("cnc@meble.pl"))).toBe(true);
  });
});
