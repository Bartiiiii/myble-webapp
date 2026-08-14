// Package mass caps and split logic: the packer targets ≤ 25 kg per pack;
// a pack over the 30 kg hard cap (single very heavy panel) violates. Also
// verifies split completeness: every part must land in exactly one pack.

import { packDesign } from "../calc/packaging";
import type { Evaluator } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const hardKg = thresholdNum(ctx.rule, "hard_kg");
  const targetKg = thresholdNum(ctx.rule, "target_kg");
  ctx.cache.packaging ??= packDesign(design, ctx.materials, ctx.carriers);
  const result = ctx.cache.packaging;

  const overweight = result.packages.filter((p) => p.mass_kg > hardKg);
  const packedIds = result.packages.flatMap((p) => p.part_ids);
  const missing = design.parts.filter((p) => !packedIds.includes(p.id)).map((p) => p.id);
  const duplicated = packedIds.length !== new Set(packedIds).size;

  const computed = {
    packages: result.packages.length,
    heaviest_kg: Math.round(Math.max(0, ...result.packages.map((p) => p.mass_kg)) * 10) / 10,
    target_kg: targetKg,
    hard_kg: hardKg,
  };
  if (overweight.length > 0 || missing.length > 0 || duplicated) {
    return [
      violated({
        part_ids: [...overweight.flatMap((p) => p.part_ids), ...missing],
        computed: { ...computed, overweight_packages: overweight.length, unpacked_parts: missing.length },
      }),
    ];
  }
  return [ok(computed)];
};
