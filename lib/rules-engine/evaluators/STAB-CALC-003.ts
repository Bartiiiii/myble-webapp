// Tipping-moment screening (doors open 90°, drawers extended, pivot at the
// front toe line). Unloaded margin < 1.0 ⇒ VIOLATED (severity 4, UNSAFE) — a
// unit that tips while empty is a real safety failure and stays blocking. The
// loaded-margin threshold is null (requires_test), so the loaded check degrades
// to an anchor-required severity-3 advisory (never a hard block; policy 5).
//
// We only raise that anchor advisory when the unit actually has loaded-tipping
// exposure — extension elements (doors/drawers, which shift the COG forward
// when open) or a genuinely tall body. A short, plain open shelf has infinite
// unloaded margin and loading it with books lowers/centres the mass, so
// recommending an anchor there is noise, not safety.

import { tippingMargin } from "../calc/tipping";
import type { Evaluator } from "../context";
import { advisory, ok, violated } from "../context";

/** Body height (mm) above which loaded tipping is plausible even without
 *  doors/drawers. Mirrors STAB-ANCHOR-002's `anchor_if_height_mm`. PROVISIONAL. */
const LOADED_TIP_HEIGHT_MM = 1000;

export const evaluate: Evaluator = (design, ctx) => {
  const prior = ctx.prior.get("STAB-TRIG-001");
  const inRegime = prior ? prior.computed["in_stability_regime"] === true : true;
  if (!inRegime) return [ok({ in_stability_regime: false })];

  const result = tippingMargin(design, ctx.materials, ctx.rule);
  const computed = {
    margin_unloaded: Number.isFinite(result.margin_unloaded)
      ? Math.round(result.margin_unloaded * 100) / 100
      : "infinite",
    m_stab_Nmm: Math.round(result.m_stab_Nmm),
    m_tip_Nmm: Math.round(result.m_tip_Nmm),
    loaded_check: result.loaded_check,
  };

  // A unit that tips while standing EMPTY is a genuine safety failure → block.
  if (result.margin_unloaded < 1.0) {
    return [violated({ computed })];
  }

  const hasExtensionElements = design.doors.length > 0 || design.drawers.length > 0;
  const isTall = design.unit.height_mm > LOADED_TIP_HEIGHT_MM;
  const loadedTippingExposure = hasExtensionElements || isTall;

  // No overturning elements and not tall ⇒ loading can't tip it: pass quietly.
  if (!loadedTippingExposure) {
    return [ok({ ...computed, loaded_tipping_exposure: false })];
  }

  // The LOADED margin depends on margin_min_loaded, which is null (requires
  // validation). Per policy point 5 we never hard-block on that unvalidated
  // number: surface an anchor-required severity-3 acknowledgement instead. The
  // wall-anchor kit is auto-added to the BOM (STAB-ANCHOR-002 / fixes.ts).
  if (result.loaded_check === "blocked_unvalidated") {
    return [
      advisory({
        computed,
        requires_anchor: true,
        note: "loaded-margin threshold (margin_min_loaded) not yet validated — anchoring recommended",
      }),
    ];
  }
  if (result.loaded_check === "violated") {
    return [advisory({ computed, requires_anchor: true })];
  }
  return [ok(computed)];
};
