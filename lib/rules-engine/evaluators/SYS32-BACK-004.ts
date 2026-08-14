// Back-panel integration method must be one the manufacturing partner supports
// (one method frozen per partner profile). When the partner capability is not
// yet confirmed we do NOT hard-block a sale (policy point 5): we advise, so the
// order can proceed while ops confirms the method. A back method the partner
// explicitly cannot produce is a real manufacturability constraint → block
// (rule severity 4 ceiling); the substitution is a one-click fix.

import type { Evaluator } from "../context";
import { advisory, notApplicable, ok, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  if (!design.unit.has_back) return [notApplicable("no back panel")];
  const supported = ctx.partner.capabilities.back_methods;
  if (supported === null) {
    return [advisory({ computed: { back_method: design.unit.back_method }, note: "partner back-method capability not yet confirmed" })];
  }
  const method = design.unit.back_method;
  if (method === null || !supported.includes(method)) {
    return [violated({ computed: { back_method: method, supported: supported.join(",") } })];
  }
  return [ok({ back_method: method })];
};
