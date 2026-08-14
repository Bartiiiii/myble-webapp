// Two-person recommendation flag (severity 0, informational): any panel
// > 15 kg or > 1800 mm, or assembled unit > 35 kg. Uses UPPER mass bound
// (handling safety is the conservative direction).

import { unitMassKg } from "../calc/mass";
import type { Evaluator } from "../context";
import { thresholdNum, violated, ok } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const panelKg = thresholdNum(ctx.rule, "panel_kg");
  const panelMm = thresholdNum(ctx.rule, "panel_mm");
  const unitKg = thresholdNum(ctx.rule, "unit_kg");

  ctx.cache.massUpper ??= unitMassKg(design, ctx.materials, "upper");
  const mass = ctx.cache.massUpper;

  const heavyOrLong = design.parts.filter((p) => {
    const m = mass.by_part.get(p.id) ?? 0;
    return m > panelKg || Math.max(p.length_mm, p.width_mm) > panelMm;
  });
  const computed = {
    unit_mass_kg: Math.round(mass.total_kg * 10) / 10,
    flagged_panels: heavyOrLong.length,
  };
  if (heavyOrLong.length > 0 || mass.total_kg > unitKg) {
    return [violated({ part_ids: heavyOrLong.map((p) => p.id), computed })];
  }
  return [ok(computed)];
};
