// A back panel braces a CLOSED carcass against racking. Myble's shelving_unit
// and bookcase products are open by design, so their lack of a back is normal —
// not a finding. For the closed-carcass categories (cabinet, storage_unit,
// bedside_table) a missing back is a rigidity/durability concern, surfaced as a
// severity-3 "Order anyway" recommendation with a one-click add-back fix (the
// rule is severity 3 under the 2026-07-20 sales-first policy — never blocks).

import type { Evaluator } from "../context";
import { ok, notApplicable, violated } from "../context";

const OPEN_BY_DESIGN = new Set(["shelving_unit", "bookcase"]);

export const evaluate: Evaluator = (design) => {
  if (design.unit.has_back) return [ok({ has_back: true })];
  if (OPEN_BY_DESIGN.has(design.unit.category)) {
    return [notApplicable("open-back shelving/bookcase — back panel not expected")];
  }
  // Closed carcass without a back: bracing can substitute (STRUCT-BACK-004).
  if (design.braces.length > 0) {
    return [ok({ has_back: false, braces: design.braces.length })];
  }
  return [violated({ computed: { has_back: false, braces: 0, category: design.unit.category } })];
};
