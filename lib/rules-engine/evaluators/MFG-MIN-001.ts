// Minimum machinable part size: edgebanded parts ≥ 160 × 85 mm (edgebander
// minima); absolute minimum for ANY part 100 × 50 mm pending partner
// confirmation (from the rule text). Severity 4 with manual_review.

import type { Evaluator, RawFinding } from "../context";
import { advisory, ok, thresholdNum, violated } from "../context";

/** Absolute minimum any part, mm (rule description; pending confirmation). A
 *  part below this is unhandleable/unbandable by any machine → hard block. */
const ABSOLUTE_MIN_LONG_MM = 100;
const ABSOLUTE_MIN_SHORT_MM = 50;

export const evaluate: Evaluator = (design, ctx) => {
  // The 160×85 generic edgebander minimum is NOT Myble's confirmed partner spec
  // (rule is requires_validation), so a banded part between the absolute floor
  // and this minimum only ADVISES (policy point 5); below the floor it blocks.
  const minLength = thresholdNum(ctx.rule, "min_length_mm");
  const minWidth = thresholdNum(ctx.rule, "min_width_mm");
  const blocking: string[] = [];
  const advising: string[] = [];
  for (const part of design.parts) {
    const long = Math.max(part.length_mm, part.width_mm);
    const short = Math.min(part.length_mm, part.width_mm);
    const banded = part.edges.some((e) => e.banding_mm > 0);
    if (long < ABSOLUTE_MIN_LONG_MM || short < ABSOLUTE_MIN_SHORT_MM) {
      blocking.push(part.id);
    } else if (banded && (long < minLength || short < minWidth)) {
      advising.push(part.id);
    }
  }
  const findings: RawFinding[] = [];
  if (blocking.length > 0) {
    findings.push(violated({ part_ids: blocking, computed: { below_absolute_floor: blocking.length } }));
  }
  if (advising.length > 0) {
    findings.push(advisory({ part_ids: advising, computed: { below_generic_edgebander_min: advising.length } }));
  }
  if (findings.length === 0) return [ok({ parts_checked: design.parts.length })];
  return findings;
};
