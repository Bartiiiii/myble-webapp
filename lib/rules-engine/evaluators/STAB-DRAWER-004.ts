// MVP restriction on stacked drawers in tall units: units > 800 mm may carry
// at most one drawer row; chest-of-drawers archetypes are excluded pending
// physical stability testing (severity 5 → manual review).

import type { Evaluator } from "../context";
import { ok, thresholdNum, violated } from "../context";

/** Height above which drawer rows are restricted, mm (from the rule text). */
const RESTRICTED_ABOVE_MM = 800;

export const evaluate: Evaluator = (design, ctx) => {
  const maxRows = thresholdNum(ctx.rule, "max_drawer_rows_above_800mm");
  const rows = new Set(design.drawers.map((d) => d.row_index)).size;
  const computed = { height_mm: design.unit.height_mm, drawer_rows: rows };
  if (design.unit.height_mm > RESTRICTED_ABOVE_MM && rows > maxRows) {
    return [violated({ computed })];
  }
  return [ok(computed)];
};
