// Edge & surface protection spec — ORDER-PIPELINE invariant: the packaging
// spec (face-to-face interleaf, corner protectors, HDF sandwich) must be
// attached to the order. The 20 mm dims allowance is already applied inside
// calc/packaging.ts so upstream carrier checks use protected dimensions.

import type { Evaluator } from "../context";
import { notApplicable, ok, violated } from "../context";

export const evaluate: Evaluator = (_design, ctx) => {
  if (ctx.stage !== "order") return [notApplicable("enforced at order stage (packaging pipeline)")];
  if (!ctx.order?.protection_spec_applied) {
    return [violated({ computed: { protection_spec_applied: false } })];
  }
  return [ok({ protection_spec_applied: true })];
};
