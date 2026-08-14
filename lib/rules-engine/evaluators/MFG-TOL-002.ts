// Tolerance table (severity 0): records which tolerance set every fit rule in
// this run assumed — partner profile when confirmed, catalogue provisional
// values otherwise. Informational; the values feed the audit trail.

import type { Evaluator } from "../context";
import { ok, thresholdNum } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const partnerTol = ctx.partner.tolerances;
  return [
    ok({
      cut_mm: partnerTol?.cut_mm ?? thresholdNum(ctx.rule, "cut_mm"),
      drill_mm: partnerTol?.drill_mm ?? thresholdNum(ctx.rule, "drill_mm"),
      source: partnerTol ? `partner:${ctx.partner.partner_id}` : "catalogue_provisional",
    }),
  ];
};
