// Per-order generated instructions — an ORDER-PIPELINE invariant (like
// MFG-LABEL-006): instructions must be generated from the exact design,
// including the anchor step for anchor-required designs.

import type { Evaluator } from "../context";
import { notApplicable, ok, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  if (ctx.stage !== "order") return [notApplicable("enforced at order stage (instruction generation pipeline)")];
  if (!ctx.order?.instructions_generated) {
    return [violated({ computed: { instructions_generated: false } })];
  }
  return [ok({ instructions_generated: true, anchor_step_required: design.wall_anchor.present })];
};
