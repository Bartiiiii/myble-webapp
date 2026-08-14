// Evaluation context & evaluator contract (implementation task 3).
// Each rule is a pure evaluator `(design, ctx) → RawFinding[]` registered by
// rule_id. The JSON `condition` strings are documentation only — executable
// logic lives in evaluators/<RULE_ID>.ts, 1:1 with the catalogue (enforced by
// the conformance test).

import type { DesignModel } from "./design";
import type { CarrierProfile, PartnerProfile } from "./profiles";
import type { ValidationFinding, Verdict } from "./report";
import type { Hardware, LoadPresets, Material, Rule, RulesCatalogue } from "./types";
import type { PackagingResult } from "./calc/packaging";
import type { UnitMass } from "./calc/mass";

/**
 * Design-stage vs order-stage evaluation. Process rules that constrain the
 * order pipeline (labels, instructions, packing protection, acknowledgement
 * recording) are NOT expressible on a DesignModel; they evaluate against
 * OrderContext at order stage and report NOT_APPLICABLE at design stage.
 */
export type EvalStage = "design" | "order";

export interface OrderContext {
  /** Pipeline asserts every part gets a printed label with orientation marks. */
  labels_generated: boolean;
  /** Per-order instruction generation succeeded (exploded views, anchor step). */
  instructions_generated: boolean;
  /** Packaging spec (interleaf, corner protectors, HDF sandwich) attached. */
  protection_spec_applied: boolean;
  /** Stored severity-3 acknowledgement records for this order. */
  acknowledgements: { rule_id: string; inputs_hash: string; catalogue_version: string }[];
}

export interface RawFinding {
  verdict: Verdict;
  part_ids?: string[];
  computed?: Record<string, number | string | boolean | null>;
  /** Values the rule read, hashed into inputs_hash for audit + ack
   *  invalidation. Defaults to `computed` when omitted. */
  inputs?: unknown;
  requires_anchor?: boolean;
  /**
   * Per-finding severity, overriding the rule's catalogue default. Lets one
   * rule block on a genuine impossibility yet only advise on a soft limit —
   * e.g. MFG-MIN-001 blocks below the absolute physical floor (sev 4) but
   * advises between the floor and the unvalidated edgebander minimum (sev 3).
   * The engine clamps overrides to the rule's default severity as a ceiling in
   * "sales-first" mode so a rule can only ever soften, never escalate, itself.
   */
  severity_override?: 0 | 1 | 2 | 3 | 4 | 5;
  note?: string;
}

export interface EvalCtx {
  catalogue: RulesCatalogue;
  rule: Rule;
  materials: Map<string, Material>;
  hardware: Map<string, Hardware>;
  presets: LoadPresets;
  partner: PartnerProfile;
  carriers: CarrierProfile[];
  stage: EvalStage;
  order: OrderContext | null;
  /** Findings from earlier stages of this run, latest per rule_id (§6.2). */
  prior: Map<string, ValidationFinding>;
  /** Per-run memo cache for shared computations (mass, packaging). */
  cache: {
    massUpper?: UnitMass;
    massLower?: UnitMass;
    packaging?: PackagingResult;
  };
}

export type Evaluator = (design: DesignModel, ctx: EvalCtx) => RawFinding[];

export const ok = (computed?: RawFinding["computed"], note?: string): RawFinding => ({
  verdict: "OK",
  computed,
  note,
});

export const notApplicable = (note?: string): RawFinding => ({ verdict: "NOT_APPLICABLE", note });

export const violated = (
  fields: Omit<RawFinding, "verdict"> = {},
): RawFinding => ({ verdict: "VIOLATED", ...fields });

/**
 * A VIOLATED finding surfaced as an "Order anyway" recommendation rather than a
 * block. This is the sales-first default for quality/durability limits and for
 * checks resting on unvalidated numbers: it carries our expert recommendation
 * (via the rule's user_message + suggested_fix) but never stops the order.
 * Always emitted at severity 3 unless the rule's default is already lower.
 */
export const advisory = (fields: Omit<RawFinding, "verdict"> = {}): RawFinding => ({
  verdict: "VIOLATED",
  severity_override: 3,
  ...fields,
});

/**
 * Reserved for engine-integrity failures ONLY (missing evaluator, evaluator
 * exception, uncomputable input) — a human should look because the engine
 * could not decide. Under the sales-first policy this is NOT used for
 * unvalidated quality thresholds; those use `advisory` so they never gate an
 * order (policy point 5). See health.ts for how this maps to REQUIRES_REVIEW.
 */
export const blocked = (note: string, fields: Omit<RawFinding, "verdict" | "note"> = {}): RawFinding => ({
  verdict: "REQUIRES_VALIDATION_BLOCKED",
  note,
  ...fields,
});

/** Numeric threshold accessor — throws when the key is missing or non-numeric,
 *  so a malformed catalogue fails closed instead of inventing a limit. */
export function thresholdNum(rule: Rule, key: string): number {
  const t = rule.threshold;
  if (t !== null && typeof t === "object" && typeof t[key] === "number") return t[key] as number;
  throw new Error(`rule ${rule.rule_id}: numeric threshold "${key}" missing`);
}

/** Nullable threshold accessor for §7 handling (null = not yet validated). */
export function thresholdNumOrNull(rule: Rule, key: string): number | null {
  const t = rule.threshold;
  if (t !== null && typeof t === "object" && typeof t[key] === "number") return t[key] as number;
  return null;
}
