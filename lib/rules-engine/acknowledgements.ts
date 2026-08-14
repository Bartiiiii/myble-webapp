// Severity-3 acknowledgement store contract (implementation task 5).
// An acknowledgement binds (rule_id, catalogue_version, message_hash,
// design_hash, inputs_hash, user, timestamp). Invalidation is by inputs_hash:
// when a design edit changes the inputs of the triggering finding, the stored
// hash no longer matches and the acknowledgement must be re-collected.

import type { ValidationFinding, ValidationReport } from "./report";

export interface Acknowledgement {
  rule_id: string;
  catalogue_version: string;
  /** Hash of the exact message text the customer saw (messages.ts). */
  message_hash: string;
  /** Design hash at acknowledgement time (context for audit). */
  design_hash: string;
  /** Hash of the finding's inputs — the invalidation key. */
  inputs_hash: string;
  user: string;
  /** ISO-8601; supplied by the caller — the engine itself is time-free. */
  timestamp: string;
}

export function findingRequiresAcknowledgement(finding: ValidationFinding): boolean {
  return finding.severity === 3 && finding.verdict === "VIOLATED";
}

/** Valid = same rule, same catalogue version, same inputs (edit-invalidated). */
export function isAcknowledged(
  finding: ValidationFinding,
  catalogueVersion: string,
  acks: readonly Pick<Acknowledgement, "rule_id" | "catalogue_version" | "inputs_hash">[],
): boolean {
  return acks.some(
    (a) =>
      a.rule_id === finding.rule_id &&
      a.catalogue_version === catalogueVersion &&
      a.inputs_hash === finding.inputs_hash,
  );
}

export function makeAcknowledgement(
  finding: ValidationFinding,
  report: ValidationReport,
  messageHashValue: string,
  user: string,
  timestamp: string,
): Acknowledgement {
  if (!findingRequiresAcknowledgement(finding)) {
    throw new Error(`finding ${finding.rule_id} does not require acknowledgement`);
  }
  return {
    rule_id: finding.rule_id,
    catalogue_version: report.catalogue_version,
    message_hash: messageHashValue,
    design_hash: report.design_hash,
    inputs_hash: finding.inputs_hash,
    user,
    timestamp,
  };
}
