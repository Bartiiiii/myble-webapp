// Applied-top overhang ≤ 50 mm per side; desktop spans checked against the
// EN 12521-style deflection limit span/250 (evaluated when a free span is
// declared; the default book load preset is the screening load).

import { shelfDeflection } from "../calc/deflection";
import type { Evaluator, RawFinding } from "../context";
import { blocked, notApplicable, ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const overhangMax = thresholdNum(ctx.rule, "overhang_max_mm");
  const findings: RawFinding[] = [];
  const overhang = design.unit.top_overhang_mm;
  const span = design.unit.top_free_span_mm;
  if (overhang === undefined && span === undefined) {
    return [notApplicable("no applied top / desktop span declared")];
  }

  if (overhang !== undefined) {
    if (overhang > overhangMax) findings.push(violated({ computed: { overhang_mm: overhang, overhang_max_mm: overhangMax } }));
    else findings.push(ok({ overhang_mm: overhang }));
  }

  if (span !== undefined) {
    const top = design.parts.find((p) => p.role === "top" || p.role === "top_panel");
    const material = top ? ctx.materials.get(top.material_id) : undefined;
    const moe = material?.moe_bending_Nmm2?.value;
    const load = ctx.presets.shelf_load_classes["books_default"]?.kg_m2;
    if (!top || !moe || !load) {
      findings.push(blocked("desktop span declared but top part/material data missing"));
    } else {
      const { delta_mm } = shelfDeflection({
        span_mm: span,
        depth_mm: design.unit.depth_mm,
        thickness_mm: top.thickness_mm,
        moe_Nmm2: moe,
        load_kg_m2: load,
      });
      const limit = span / 250;
      const computed = { span_mm: span, delta: Math.round(delta_mm * 100) / 100, limit_mm: Math.round(limit * 100) / 100 };
      findings.push(delta_mm > limit ? violated({ part_ids: [top.id], computed }) : ok(computed));
    }
  }
  return findings;
};
