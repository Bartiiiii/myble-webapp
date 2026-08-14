// Shippability economics (severity 1 tip): if shrinking a package's longest
// side by ≤ 30 mm would move it onto a (better) parcel carrier, surface the
// saving. The price-ratio notice needs pricing data the engine doesn't carry
// — the configurator layer computes it from the quote (documented limitation).

import { carrierFor, packDesign } from "../calc/packaging";
import type { Evaluator, RawFinding } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const window = thresholdNum(ctx.rule, "nudge_window_mm");
  ctx.cache.packaging ??= packDesign(design, ctx.materials, ctx.carriers);
  const result = ctx.cache.packaging;
  const findings: RawFinding[] = [];

  for (const pack of result.packages) {
    const currentRank = ctx.carriers.findIndex((c) => c.carrier_id === pack.carrier);
    const rank = currentRank === -1 ? ctx.carriers.length : currentRank; // pallet ranks last
    if (rank === 0) continue; // already on the preferred carrier
    const shrunk: [number, number, number] = [pack.dims_mm[0] - window, pack.dims_mm[1], pack.dims_mm[2]];
    const better = carrierFor(shrunk, pack.mass_kg, ctx.carriers);
    const betterRank = ctx.carriers.findIndex((c) => c.carrier_id === better);
    if (betterRank !== -1 && betterRank < rank) {
      findings.push(
        violated({
          part_ids: pack.part_ids,
          computed: { x: window, current_carrier: pack.carrier, better_carrier: better },
        }),
      );
    }
  }
  if (findings.length === 0) return [ok({ packages: result.packages.length })];
  return findings;
};
