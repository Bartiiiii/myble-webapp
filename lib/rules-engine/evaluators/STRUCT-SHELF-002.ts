// Shelf deflection: δ = 5wL⁴/(384EI) vs sag limit min(1.7·L/300, L/200),
// applied at 60 % while the creep factor is unvalidated (conservative mode).
// E = catalogue MOE (EN 312 P2 minimum 1600 N/mm²), load from the shelf's
// load class preset. Missing preset/material data ⇒ blocked (fail closed).

import { enforcedSagLimitMm, shelfDeflection } from "../calc/deflection";
import type { Evaluator, RawFinding } from "../context";
import { blocked, ok, violated } from "../context";

const LOAD_CLASS_KEY: Record<string, string> = { light: "light", book: "books_default", heavy: "heavy" };

export const evaluate: Evaluator = (design, ctx) => {
  const findings: RawFinding[] = [];
  for (const shelf of design.shelves) {
    const part = design.parts.find((p) => p.id === shelf.part_id);
    if (!part) {
      findings.push(blocked(`shelf references missing part ${shelf.part_id}`));
      continue;
    }
    const material = ctx.materials.get(part.material_id);
    const moe = material?.moe_bending_Nmm2?.value;
    const preset = ctx.presets.shelf_load_classes[LOAD_CLASS_KEY[shelf.load_class] ?? ""];
    if (!moe || !preset) {
      findings.push(blocked(`missing MOE or load preset for shelf ${shelf.part_id}`, { part_ids: [shelf.part_id] }));
      continue;
    }
    const { delta_mm } = shelfDeflection({
      span_mm: shelf.span_mm,
      depth_mm: shelf.depth_mm,
      thickness_mm: part.thickness_mm,
      moe_Nmm2: moe,
      load_kg_m2: preset.kg_m2,
    });
    const { limit_mm, conservative_mode } = enforcedSagLimitMm(shelf.span_mm);
    const computed = {
      delta: Math.round(delta_mm * 100) / 100,
      limit_mm: Math.round(limit_mm * 100) / 100,
      load_kg_m2: preset.kg_m2,
      conservative_mode,
      span_mm: shelf.span_mm,
    };
    if (delta_mm > limit_mm) {
      findings.push(violated({ part_ids: [shelf.part_id], computed }));
    } else {
      findings.push(ok(computed));
    }
  }
  if (findings.length === 0) return [ok({ shelves_checked: 0 })];
  return findings;
};
