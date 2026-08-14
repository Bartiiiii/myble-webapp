// Findings, reports and health aggregation types (schema §3, §6.3, §8).

import type { RuleCategory, Severity } from "./types";

export type Verdict = "OK" | "VIOLATED" | "NOT_APPLICABLE" | "REQUIRES_VALIDATION_BLOCKED";

export type DesignHealthStatus =
  | "VALID"
  | "VALID_WITH_RECOMMENDATIONS"
  | "REQUIRES_CONFIRMATION"
  | "REQUIRES_WALL_ANCHOR"
  | "REQUIRES_REVIEW"
  | "CANNOT_MANUFACTURE"
  | "UNSAFE";

/** Precedence when several statuses apply (schema §8) — index 0 wins. */
export const HEALTH_PRECEDENCE: readonly DesignHealthStatus[] = [
  "UNSAFE",
  "CANNOT_MANUFACTURE",
  "REQUIRES_REVIEW",
  "REQUIRES_WALL_ANCHOR",
  "REQUIRES_CONFIRMATION",
  "VALID_WITH_RECOMMENDATIONS",
  "VALID",
];

export interface ValidationFinding {
  rule_id: string;
  rule_category: RuleCategory;
  /** Effective severity of this finding: the rule's catalogue severity unless
   *  the evaluator applied a (softening) per-finding override. */
  severity: Severity;
  /** The rule's unmodified catalogue severity, for audit/debugging. */
  rule_severity: Severity;
  verdict: Verdict;
  /** Part ids the UI should highlight. */
  part_ids: string[];
  /** Computed values for message placeholders + audit (e.g. deflection mm). */
  computed: Record<string, number | string | boolean | null>;
  /** SHA-256 of the canonical inputs this finding was computed from. */
  inputs_hash: string;
  /** True when the rule demands wall anchoring (feeds REQUIRES_WALL_ANCHOR). */
  requires_anchor?: boolean;
  /** Deterministic fix the UI can offer, from the catalogue. */
  suggested_fix?: string | null;
  /** Extra note for audit (e.g. why a check was blocked). */
  note?: string;
}

export interface ValidationReport {
  engine_version: string;
  catalogue_version: string;
  design_hash: string;
  mode: "full" | "incremental";
  /** Rules evaluated in this run (incremental runs evaluate a subset). */
  evaluated_rule_ids: string[];
  findings: ValidationFinding[];
  health: DesignHealthStatus;
  /** Severity-3 findings lacking a stored acknowledgement. */
  unacknowledged: ValidationFinding[];
}

/** Per-evaluation audit record (schema §6.3) persisted with the design/order. */
export interface AuditRecord {
  rule_id: string;
  catalogue_version: string;
  engine_version: string;
  inputs_hash: string;
  verdict: Verdict;
  computed: Record<string, number | string | boolean | null>;
}

export function toAuditRecords(report: ValidationReport): AuditRecord[] {
  return report.findings.map((f) => ({
    rule_id: f.rule_id,
    catalogue_version: report.catalogue_version,
    engine_version: report.engine_version,
    inputs_hash: f.inputs_hash,
    verdict: f.verdict,
    computed: f.computed,
  }));
}
