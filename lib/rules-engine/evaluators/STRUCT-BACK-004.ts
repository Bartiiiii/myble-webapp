// Open-back shelving benefits from triangulating rails: a top rear rail +
// plinth/kick rail, and a second rear rail on tall units. Under the 2026-07-20
// sales-first policy this rule is severity 3: a missing rail is an "Order
// anyway" recommendation with a one-click add-rails fix, never a block.
// The rail-WIDTH minimum is an unvalidated null threshold — per policy point 5
// it never gates an order: rails present ⇒ OK with a note that width refinement
// is pending validation (recorded in `computed` for audit).

import { OPEN_BACK_RAIL_PLACEHOLDER_WIDTH_MM } from "../constants";
import type { Evaluator } from "../context";
import { notApplicable, ok, thresholdNumOrNull, violated } from "../context";

/** Units taller than this need a second rear rail. PROVISIONAL (tier 6). */
export const TALL_UNIT_SECOND_RAIL_MM = 1200;

export const evaluate: Evaluator = (design, ctx) => {
  if (design.unit.has_back) return [notApplicable("unit has a back panel")];

  const topRear = design.braces.filter((b) => b.position === "top_rear").length;
  const midRear = design.braces.filter((b) => b.position === "mid_rear").length;
  const plinth = design.braces.filter((b) => b.position === "plinth").length;
  const needsSecondRail = design.unit.height_mm > TALL_UNIT_SECOND_RAIL_MM;

  const computed = {
    top_rear: topRear,
    mid_rear: midRear,
    plinth,
    needs_second_rail: needsSecondRail,
  };

  // Missing rails → severity-3 recommendation (rule severity is 3).
  if (topRear < 1 || plinth < 1 || (needsSecondRail && midRear < 1)) {
    return [violated({ computed })];
  }

  // Rails present. Width minimum is unvalidated → never block on it (policy 5).
  const minRailWidth = thresholdNumOrNull(ctx.rule, "min_rail_width_mm");
  if (minRailWidth === null) {
    return [
      ok(
        { ...computed, min_rail_width_pending: OPEN_BACK_RAIL_PLACEHOLDER_WIDTH_MM },
        "rail width minimum pending validation — advisory only, not enforced",
      ),
    ];
  }
  const thin = design.braces.filter((b) => b.width_mm < minRailWidth).map((b) => b.part_id);
  if (thin.length > 0) return [violated({ part_ids: thin, computed })];
  return [ok(computed)];
};
