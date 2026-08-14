// Hard shelf-span cap for 18 mm LTD: no span > 900 mm, ever. Between 600 and
// 900 mm the deflection calc (STRUCT-SHELF-002) governs — noted in `computed`.

import type { Evaluator, RawFinding } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const hardMax = thresholdNum(ctx.rule, "hard_max_span");
  const calcZoneFrom = thresholdNum(ctx.rule, "calc_zone_from");
  const findings: RawFinding[] = [];
  for (const shelf of design.shelves) {
    if (shelf.span_mm > hardMax) {
      findings.push(
        violated({
          part_ids: [shelf.part_id],
          computed: { span_mm: shelf.span_mm, hard_max_span: hardMax },
        }),
      );
    } else {
      findings.push(
        ok({
          span_mm: shelf.span_mm,
          deflection_calc_governs: shelf.span_mm > calcZoneFrom && shelf.load_class !== "light",
        }),
      );
    }
  }
  if (findings.length === 0) return [ok({ shelves_checked: 0 })];
  return findings;
};
