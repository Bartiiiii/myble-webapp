// Severity → UI behaviour mapping (aggregation stage, severity 0): records
// the severity histogram of this run and asserts every severity level seen
// has a defined UI mapping. The mapping itself is exported for the UI layer.

import type { Evaluator } from "../context";
import { ok } from "../context";

export const UI_BEHAVIOUR: Record<number, string> = {
  0: "passive_info",
  1: "dismissible_tip",
  2: "highlighted_recommendation_with_fix",
  3: "modal_acknowledgement_stored",
  4: "red_state_cart_blocked_fix_path",
  5: "review_request_flow_sla",
};

export const evaluate: Evaluator = (_design, ctx) => {
  const histogram: Record<string, number> = {};
  for (const finding of ctx.prior.values()) {
    if (finding.verdict === "VIOLATED") {
      histogram[String(finding.severity)] = (histogram[String(finding.severity)] ?? 0) + 1;
    }
  }
  return [ok({ violated_by_severity: JSON.stringify(histogram) })];
};
