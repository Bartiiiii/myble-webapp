// Adjustable shelves must not dislodge (EN 14749: 100 N retention). Design
// provision: 4 pins with anti-slide engagement — locking/collared pin type.
// Plain pins have no anti-slide engagement ⇒ VIOLATED with a deterministic
// fix (switch to locking pins). Physical retention verification is a
// hardware-SKU test (requires_test), tracked by the validation owner.

import type { Evaluator, RawFinding } from "../context";
import { ok, violated } from "../context";

export const evaluate: Evaluator = (design) => {
  const findings: RawFinding[] = [];
  for (const shelf of design.shelves) {
    if (shelf.fixity !== "adjustable") continue;
    if (shelf.support_type !== "pins_locking") {
      findings.push(
        violated({
          part_ids: [shelf.part_id],
          computed: { support_type: shelf.support_type },
        }),
      );
    }
  }
  if (findings.length === 0) {
    return [ok({ adjustable_shelves: design.shelves.filter((s) => s.fixity === "adjustable").length })];
  }
  return findings;
};
