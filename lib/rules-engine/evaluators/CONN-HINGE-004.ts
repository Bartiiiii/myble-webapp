// Hinge count vs door mass/size (Blum guidance): ≤6 kg → 2, 6–12 kg → 3.
// Sales-first split (policy 2026-07-20): a door beyond ANY available hinge SKU
// (> width_abs_max or > the 12 kg 3-hinge ceiling) is physically un-hangable →
// BLOCKING via a per-finding override to the rule's full severity. A mere hinge
// COUNT shortfall (add one more of the same hinge) or a wider-than-tall
// proportion is quality guidance → advisory "Order anyway" with a one-click fix.
// Door mass = area × board area-mass at the UPPER density bound (handle
// allowance has no validated value and is deliberately not invented).

import { doorMassKg } from "../calc/mass";
import type { Evaluator, RawFinding } from "../context";
import { advisory, blocked, ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const hinges2Max = thresholdNum(ctx.rule, "hinges2_max_kg");
  const hinges3Max = thresholdNum(ctx.rule, "hinges3_max_kg");
  const widthStd = thresholdNum(ctx.rule, "width_std_max");
  const widthAbs = thresholdNum(ctx.rule, "width_abs_max");
  const findings: RawFinding[] = [];

  for (const door of design.doors) {
    const part = design.parts.find((p) => p.id === door.part_id);
    const material = part ? ctx.materials.get(part.material_id) : undefined;
    if (!part || !material) {
      findings.push(blocked(`door ${door.part_id} missing part/material data`, { part_ids: [door.part_id] }));
      continue;
    }
    const mass = doorMassKg(door.width_mm, door.height_mm, part.thickness_mm, material);
    const computed = {
      mass_kg: Math.round(mass * 100) / 100,
      width_mm: door.width_mm,
      height_mm: door.height_mm,
      hinge_count: door.hinge_count,
    };
    // Impossible to hang on any supported hinge configuration → block.
    if (door.width_mm > widthAbs || mass > hinges3Max) {
      findings.push(violated({ part_ids: [door.part_id], computed: { ...computed, problem: "door_beyond_any_hinge_sku" } }));
      continue;
    }
    // Aesthetic proportion — advise, never block.
    if (door.height_mm <= door.width_mm) {
      findings.push(advisory({ part_ids: [door.part_id], computed: { ...computed, problem: "door_wider_than_tall" } }));
      continue;
    }
    let required = mass <= hinges2Max ? 2 : 3;
    if (door.width_mm > widthStd) required += 1;
    if (door.hinge_count < required) {
      // Fixable by adding a hinge of the same SKU → advisory recommendation.
      findings.push(advisory({ part_ids: [door.part_id], computed: { ...computed, required_hinges: required } }));
    } else {
      findings.push(ok({ ...computed, required_hinges: required }));
    }
  }
  if (findings.length === 0) return [ok({ doors_checked: 0 })];
  return findings;
};
