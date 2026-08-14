// Wall anchor mandatory for tall/narrow units: > 1500 mm always; > 1000 mm
// when height/depth > 3.0. Fires as a severity-3 acknowledgement WITH
// requires_anchor (feeds REQUIRES_WALL_ANCHOR health) — the kit itself is a
// non-removable backend addition proposed via auto-correct when absent.

import type { Evaluator } from "../context";
import { ok, thresholdNum, violated } from "../context";

export function anchorRequired(height_mm: number, depth_mm: number, always: number, ifHeight: number, ratio: number): boolean {
  if (height_mm > always) return true;
  return height_mm > ifHeight && height_mm / depth_mm > ratio;
}

export const evaluate: Evaluator = (design, ctx) => {
  const prior = ctx.prior.get("STAB-TRIG-001");
  const inRegime = prior ? prior.computed["in_stability_regime"] === true : design.unit.freestanding;
  if (!inRegime) return [ok({ in_stability_regime: false })];

  const always = thresholdNum(ctx.rule, "always_anchor_above_height_mm");
  const ifHeight = thresholdNum(ctx.rule, "anchor_if_height_mm");
  const ratio = thresholdNum(ctx.rule, "and_ratio_h_over_d");
  const { height_mm, depth_mm } = design.unit;

  const required = anchorRequired(height_mm, depth_mm, always, ifHeight, ratio);
  const computed = {
    height_mm,
    depth_mm,
    h_over_d: Math.round((height_mm / depth_mm) * 100) / 100,
    kit_present: design.wall_anchor.present,
  };
  if (required) {
    // Acknowledgement is required even when the kit is present.
    return [violated({ computed, requires_anchor: true })];
  }
  return [ok(computed)];
};
