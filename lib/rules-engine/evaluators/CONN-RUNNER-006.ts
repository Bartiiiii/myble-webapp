// Drawer size vs runner rating: content (internal volume × density preset)
// + box self-weight must stay under the 30 kg dynamic class; width ≤ 900 mm;
// runner length ≤ cabinet depth − 10 mm clearance (PROVISIONAL).

import { DRAWER_LOAD_PRESET_KG_PER_L } from "../constants";
import type { Evaluator, RawFinding } from "../context";
import { advisory, blocked, ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const dynamicMax = thresholdNum(ctx.rule, "dynamic_load_kg");
  const widthMax = thresholdNum(ctx.rule, "drawer_width_max_mm");
  const clearance = thresholdNum(ctx.rule, "runner_clearance_mm");
  const findings: RawFinding[] = [];

  for (const drawer of design.drawers) {
    const runner = ctx.hardware.get(drawer.runner_id);
    if (!runner) {
      findings.push(blocked(`unknown runner ${drawer.runner_id} on drawer ${drawer.id}`));
      continue;
    }
    const density = DRAWER_LOAD_PRESET_KG_PER_L[drawer.load_preset];
    if (density === undefined) {
      findings.push(blocked(`unknown load preset ${drawer.load_preset} on drawer ${drawer.id}`));
      continue;
    }
    const volumeL = (drawer.width_mm * drawer.depth_mm * drawer.height_mm) / 1e6;
    const contentKg = volumeL * density;
    const computed = {
      drawer: drawer.id,
      content_kg: Math.round(contentKg * 10) / 10,
      width_mm: drawer.width_mm,
      depth_mm: drawer.depth_mm,
    };
    // Physically won't fit any runner / the carcass → block (rule ceiling).
    if (drawer.width_mm > widthMax) {
      findings.push(violated({ computed: { ...computed, problem: "width_over_max" } }));
      continue;
    }
    if (drawer.depth_mm > design.unit.depth_mm - clearance) {
      findings.push(violated({ computed: { ...computed, problem: "runner_too_long_for_depth" } }));
      continue;
    }
    // Load margin is a soft/quality limit (loading is user behaviour) → advise.
    if (contentKg > dynamicMax) {
      findings.push(advisory({ computed: { ...computed, problem: "load_over_runner_rating" } }));
      continue;
    }
    findings.push(ok(computed));
  }
  if (findings.length === 0) return [ok({ drawers_checked: 0 })];
  return findings;
};
