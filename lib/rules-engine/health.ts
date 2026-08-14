// Design health aggregation (schema §8) with the exact precedence:
// UNSAFE > CANNOT_MANUFACTURE > REQUIRES_REVIEW > REQUIRES_WALL_ANCHOR >
// REQUIRES_CONFIRMATION > VALID_WITH_RECOMMENDATIONS > VALID.

import type { DesignModel } from "./design";
import { HEALTH_PRECEDENCE, type DesignHealthStatus, type ValidationFinding } from "./report";
import type { Rule } from "./types";

export interface HealthResult {
  health: DesignHealthStatus;
  unacknowledged: ValidationFinding[];
}

export function aggregateHealth(
  findings: ValidationFinding[],
  rulesById: Map<string, Rule>,
  design: DesignModel,
  isAcknowledged: (finding: ValidationFinding) => boolean,
): HealthResult {
  const candidates = new Set<DesignHealthStatus>(["VALID"]);
  const unacknowledged: ValidationFinding[] = [];

  for (const finding of findings) {
    const rule = rulesById.get(finding.rule_id);

    if (finding.verdict === "REQUIRES_VALIDATION_BLOCKED") {
      // §7: an unvalidated safety limit can never pass. Anchor-flavoured
      // blocks (tipping loaded check) become "anchor required" when the kit
      // is present; everything else escalates to review.
      if (finding.requires_anchor && design.wall_anchor.present) {
        candidates.add("REQUIRES_WALL_ANCHOR");
      } else {
        candidates.add("REQUIRES_REVIEW");
      }
      continue;
    }

    if (finding.verdict !== "VIOLATED") continue;

    if (finding.severity === 5) candidates.add("REQUIRES_REVIEW");
    if (rule?.manual_review && finding.severity >= 4) candidates.add("REQUIRES_REVIEW");

    if (finding.severity === 4) {
      if (finding.rule_category === "structural" || finding.rule_category === "stability") {
        candidates.add("UNSAFE");
      } else {
        candidates.add("CANNOT_MANUFACTURE");
      }
    }

    if (finding.requires_anchor) candidates.add("REQUIRES_WALL_ANCHOR");

    if (finding.severity === 3) {
      if (!isAcknowledged(finding)) {
        unacknowledged.push(finding);
        candidates.add("REQUIRES_CONFIRMATION");
      }
    }

    if (finding.severity === 2) candidates.add("VALID_WITH_RECOMMENDATIONS");
  }

  for (const status of HEALTH_PRECEDENCE) {
    if (candidates.has(status)) return { health: status, unacknowledged };
  }
  return { health: "VALID", unacknowledged };
}
