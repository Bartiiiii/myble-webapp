// Part labelling & orientation marks — an ORDER-PIPELINE invariant: the label
// generator must run for every order. Not expressible on a DesignModel, so
// design-stage runs report NOT_APPLICABLE and the order-stage run enforces it.

import type { Evaluator } from "../context";
import { notApplicable, ok, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  if (ctx.stage !== "order") return [notApplicable("enforced at order stage (label generation pipeline)")];
  if (!ctx.order?.labels_generated) {
    return [violated({ computed: { labels_generated: false } })];
  }
  return [ok({ labels_generated: true, parts: design.parts.length })];
};
