// Adjustable-shelf pin capacity: design load (load class × area + shelf
// self-weight, upper bound) must stay ≤ 31 kg (4 × 15.6 kg/pin × SF 0.5,
// PROVISIONAL). Heavy loads on wide adjustable shelves recommend a fixed
// shelf (severity 3 acknowledgement).

import { areaMassKgM2 } from "../calc/mass";
import type { Evaluator, RawFinding } from "../context";
import { blocked, ok, thresholdNum, violated } from "../context";

const LOAD_CLASS_KEY: Record<string, string> = { light: "light", book: "books_default", heavy: "heavy" };

export const evaluate: Evaluator = (design, ctx) => {
  const maxLoad = thresholdNum(ctx.rule, "max_shelf_load_kg");
  const findings: RawFinding[] = [];

  for (const shelf of design.shelves) {
    if (shelf.fixity !== "adjustable") continue;
    const part = design.parts.find((p) => p.id === shelf.part_id);
    const material = part ? ctx.materials.get(part.material_id) : undefined;
    const preset = ctx.presets.shelf_load_classes[LOAD_CLASS_KEY[shelf.load_class] ?? ""];
    if (!part || !material || !preset) {
      findings.push(blocked(`missing data for adjustable shelf ${shelf.part_id}`, { part_ids: [shelf.part_id] }));
      continue;
    }
    const areaM2 = (shelf.span_mm / 1000) * (shelf.depth_mm / 1000);
    const selfKg = areaM2 * areaMassKgM2(part, material, "upper");
    const totalKg = areaM2 * preset.kg_m2 + selfKg;
    const computed = {
      total_load_kg: Math.round(totalKg * 10) / 10,
      max_shelf_load_kg: maxLoad,
      load_class: shelf.load_class,
    };
    if (totalKg > maxLoad) {
      findings.push(violated({ part_ids: [shelf.part_id], computed }));
    } else {
      findings.push(ok(computed));
    }
  }
  if (findings.length === 0) return [ok({ adjustable_shelves: 0 })];
  return findings;
};
