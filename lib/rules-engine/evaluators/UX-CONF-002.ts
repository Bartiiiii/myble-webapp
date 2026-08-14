// Acknowledgements are recorded (severity 0, order stage): every severity-3
// VIOLATED finding of this run must have a stored acknowledgement matching
// rule_id + catalogue_version + inputs_hash (edits invalidate by hash — see
// acknowledgements.ts). Design-stage runs report the pending count only.

import type { Evaluator } from "../context";
import { notApplicable, ok, violated } from "../context";

export const evaluate: Evaluator = (_design, ctx) => {
  const sev3 = [...ctx.prior.values()].filter((f) => f.severity === 3 && f.verdict === "VIOLATED");
  if (ctx.stage !== "order") {
    return [notApplicable(`acknowledgement recording enforced at order stage (${sev3.length} sev-3 finding(s) pending)`)];
  }
  const acks = ctx.order?.acknowledgements ?? [];
  const missing = sev3.filter(
    (f) =>
      !acks.some(
        (a) =>
          a.rule_id === f.rule_id &&
          a.inputs_hash === f.inputs_hash &&
          a.catalogue_version === ctx.catalogue.catalogue_version,
      ),
  );
  if (missing.length > 0) {
    return [violated({ computed: { missing_acknowledgements: missing.map((f) => f.rule_id).join(",") } })];
  }
  return [ok({ acknowledged: sev3.length })];
};
