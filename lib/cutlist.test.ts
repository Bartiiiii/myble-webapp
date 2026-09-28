import { describe, it, expect } from "vitest";
import { cutListData, cutListCSV, cutListJSON } from "./cutlist";
import { presetDesign } from "./build";

describe("cut list", () => {
  it("lists every board in mm with material + drilling for a preset", () => {
    const d = presetDesign("police"); // 4 walls + 3 shelves = 7 boards
    const data = cutListData(d);
    expect(data.materialId).toBe("white_18");
    expect(data.thicknessMm).toBe(18);
    expect(data.totalBoards).toBe(7);
    // Dimensions are millimetre integers.
    expect(data.rows.every((r) => Number.isInteger(r.widthMm) && r.widthMm > 0)).toBe(true);
    // In a box every part joins something ⇒ drilled.
    expect(data.rows.every((r) => r.drilled)).toBe(true);
  });

  it("CSV has a header row and one data row per grouped part", () => {
    const d = presetDesign("stolek");
    const csv = cutListCSV(d);
    const lines = csv.split("\n");
    expect(lines.some((l) => l.startsWith("part,width_mm"))).toBe(true);
    expect(csv).toContain("White 18 mm");
    // total non-comment, non-header rows == grouped parts
    const rows = cutListData(d).rows.length;
    const dataLines = lines.filter((l) => !l.startsWith("#") && !l.startsWith("part,"));
    expect(dataLines.filter(Boolean).length).toBe(rows);
  });

  it("JSON round-trips and carries colour + thickness", () => {
    const d = presetDesign("police");
    const parsed = JSON.parse(cutListJSON(d));
    expect(parsed.thicknessMm).toBe(18);
    expect(parsed.colour).toBe("White");
    expect(parsed.outerCm).toEqual(d.outerCm);
    expect(Array.isArray(parsed.rows)).toBe(true);
  });
});
