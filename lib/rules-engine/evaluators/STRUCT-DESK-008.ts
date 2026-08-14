// Desk support spacing (stiffness/quality). Under the sales-first policy this
// rule is severity 3: every over-span case is an "Order anyway" recommendation
// with a one-click add-rail fix — never a block, and the thresholds are
// provisional/requires_test so they can't hard-block anyway (policy 5).
// A desk that declares no free span isn't assessable → NOT_APPLICABLE (a
// missing optional input must not gate a sale).

import type { Evaluator } from "../context";
import { advisory, notApplicable, ok, thresholdNum } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const span = design.unit.top_free_span_mm;
  if (span === undefined) return [notApplicable("no desktop free span declared")];
  const freeMax = thresholdNum(ctx.rule, "free_span_max");
  const railAbove = thresholdNum(ctx.rule, "rail_required_above");
  const hardAbove = thresholdNum(ctx.rule, "hard_block_above");
  const hasRail = design.braces.some((b) => b.position === "top_rear" || b.position === "mid_rear");
  const computed = { span_mm: span, has_rail: hasRail };
  if (span > hardAbove) return [advisory({ computed: { ...computed, hard_block_above: hardAbove } })];
  if (span <= freeMax) return [ok(computed)];
  if (span > railAbove && !hasRail) return [advisory({ computed })];
  return [ok(computed)];
};
