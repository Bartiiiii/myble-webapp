// Out-of-template designs (template_id null) route to manual review (sev 5).

import type { Evaluator } from "../context";
import { ok, violated } from "../context";

export const evaluate: Evaluator = (design) => {
  if (design.unit.template_id === null) {
    return [violated({ computed: { template_id: null } })];
  }
  return [ok({ template_id: design.unit.template_id })];
};
