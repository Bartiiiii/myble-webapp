// Panel/package vs carrier limits. Runs the deterministic bin-packer and
// selects the first feasible carrier per package; any package that fits no
// parcel carrier routes the order to the pallet-freight path (manual review
// in MVP → severity 4 + manual_review on this rule).

import { packDesign } from "../calc/packaging";
import type { Evaluator } from "../context";
import { ok, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  ctx.cache.packaging ??= packDesign(design, ctx.materials, ctx.carriers);
  const result = ctx.cache.packaging;
  const computed = {
    packages: result.packages.length,
    total_mass_kg: Math.round(result.total_mass_kg * 10) / 10,
    carriers: result.packages.map((p) => p.carrier).join(","),
  };
  if (result.any_pallet) {
    const oversized = result.packages.filter((p) => p.carrier === "pallet_freight");
    return [
      violated({
        part_ids: oversized.flatMap((p) => p.part_ids),
        computed: { ...computed, oversize_packages: oversized.length },
      }),
    ];
  }
  return [ok(computed)];
};
