import { describe, it, expect } from "vitest";
import { type Design, partBox, thicknessCm } from "./model";
import { boxWalls } from "./build";
import { resizedPart } from "./geometry";

const AX = ["x", "y", "z"] as const;

function nearMisses(d: Design) {
  const t = thicknessCm(d);
  const out: string[] = [];
  for (const p of d.parts) {
    const pb = partBox(p, t);
    for (const ax of AX.filter((a) => a !== p.axis)) {
      const perp = AX.filter((a) => a !== ax);
      for (const o of d.parts) {
        if (o.id === p.id) continue;
        const ob = partBox(o, t);
        if (!perp.every((a) => Math.min(pb.max[a], ob.max[a]) - Math.max(pb.min[a], ob.min[a]) > 0.5)) continue;
        for (const g of [ob.min[ax] - pb.max[ax], pb.min[ax] - ob.max[ax]]) {
          if (g > 0.02 && g <= 3) out.push(`gap ${g.toFixed(3)} on ${ax}`);
        }
      }
    }
  }
  return out;
}

describe("the reported corner, after the fix", () => {
  it("a trimmed bottom board can no longer leave slivers in its corners", () => {
    const outer = { w: 120, h: 120, d: 60 };
    const d: Design = { colour: "white", thickness: 18, outerCm: outer, parts: boxWalls(outer) };
    const t = thicknessCm(d);
    const bottom = d.parts[2];
    // Every trim from a hair to 3 cm — the whole pathological band.
    for (const trim of [0.1, 0.5, 1, 2, 2.9, 3]) {
      const next = resizedPart(bottom, "aCm", bottom.aCm - trim, d.parts.filter((p) => p.id !== bottom.id), t, outer)!;
      const after: Design = { ...d, parts: d.parts.map((p) => (p.id === bottom.id ? next : p)) };
      expect(nearMisses(after), `trim of ${trim}cm`).toEqual([]);
    }
  });
});
