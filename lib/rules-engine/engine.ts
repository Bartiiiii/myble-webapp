// ─────────────────────────────────────────────────────────────────────────────
// The Myble Rules Engine (implementation task 3). Pure orchestration:
//   validate(design)              — full authoritative run (checkout)
//   validateIncremental(...)      — per-interaction subset run (configurator)
//   getUnvalidatedSafetyRules()   — ops/CI surface for §7 rules
//   proposeFixes / getValidRange  — auto-correction + slider clamps
//
// Determinism: same design + same catalogue version + same partner profile ⇒
// byte-identical report (hashes included). No randomness, no time, no LLM.
// Fail closed: unknown categories/materials, missing inputs and evaluator
// exceptions all surface as VIOLATED or REQUIRES_VALIDATION_BLOCKED findings.
// ─────────────────────────────────────────────────────────────────────────────

import { hashOf } from "./canonical";
import { ENGINE_VERSION } from "./constants";
import type { EvalCtx, EvalStage, Evaluator, OrderContext } from "./context";
import { sanitizeDesign, type DesignModel } from "./design";
import { EVALUATORS } from "./evaluators";
import { aggregateHealth } from "./health";
import { affectedRuleIds, buildInputIndex, type InputIndex } from "./incremental";
import { isAcknowledged } from "./acknowledgements";
import { loadCatalogue, unvalidatedSafetyRules } from "./loader";
import { proposeFixes, type DesignPatch } from "./fixes";
import { getValidRange, type RangeTarget, type ValidRange } from "./constraints";
import { DEFAULT_CARRIER_PROFILES, UNVALIDATED_PARTNER_PROFILE, type CarrierProfile, type PartnerProfile } from "./profiles";
import type { Rule, RuleCategory, RulesCatalogue, Severity } from "./types";
import type { ValidationFinding, ValidationReport } from "./report";

/** Evaluation stage order (schema §6.2). Later stages read earlier findings. */
export const STAGE_ORDER: readonly RuleCategory[] = [
  "product_scope",
  "material",
  "connection",
  "frameless_system",
  "structural",
  "stability",
  "manufacturing",
  "assembly",
  "shipping",
  "ux",
];

export interface EngineOptions {
  partner?: PartnerProfile;
  carriers?: CarrierProfile[];
}

export interface ValidateOptions {
  stage?: EvalStage;
  order?: OrderContext | null;
}

const VERDICT_RANK: Record<string, number> = {
  VIOLATED: 3,
  REQUIRES_VALIDATION_BLOCKED: 2,
  OK: 1,
  NOT_APPLICABLE: 0,
};

export class RulesEngine {
  readonly catalogue: RulesCatalogue;
  readonly engineVersion = ENGINE_VERSION;
  private readonly rulesById: Map<string, Rule>;
  private readonly orderedRules: Rule[];
  private readonly materials: EvalCtx["materials"];
  private readonly hardware: EvalCtx["hardware"];
  private readonly partner: PartnerProfile;
  private readonly carriers: CarrierProfile[];
  private readonly inputIndex: InputIndex;
  /** Memo: `${design_hash}:${stage}:${rule_id}` → findings (task 9 perf). */
  private readonly memo = new Map<string, ValidationFinding[]>();

  constructor(rawCatalogue: unknown, options: EngineOptions = {}) {
    this.catalogue = loadCatalogue(rawCatalogue);
    this.rulesById = new Map(this.catalogue.rules.map((r) => [r.rule_id, r]));
    // Stable order: stage first, catalogue order within a stage.
    this.orderedRules = [...this.catalogue.rules].sort(
      (a, b) => STAGE_ORDER.indexOf(a.rule_category) - STAGE_ORDER.indexOf(b.rule_category),
    );
    this.materials = new Map(this.catalogue.materials.map((m) => [m.material_id, m]));
    this.hardware = new Map(this.catalogue.hardware.map((h) => [h.hardware_id, h]));
    this.partner = options.partner ?? UNVALIDATED_PARTNER_PROFILE;
    this.carriers = options.carriers ?? DEFAULT_CARRIER_PROFILES;
    this.inputIndex = buildInputIndex(this.catalogue);
  }

  get catalogueVersion(): string {
    return this.catalogue.catalogue_version;
  }

  /** §7 / task 2: severity ≥ 4 rules not yet validated — ops & CI surface. */
  getUnvalidatedSafetyRules(): Rule[] {
    return unvalidatedSafetyRules(this.catalogue);
  }

  getValidRange(target: RangeTarget): ValidRange {
    return getValidRange(this.catalogue, target);
  }

  proposeFixes(design: DesignModel, report: ValidationReport): DesignPatch[] {
    return proposeFixes(design, report, this.catalogue);
  }

  /** Full authoritative validation — the only run checkout may trust. */
  validate(rawDesign: unknown, options: ValidateOptions = {}): ValidationReport {
    return this.run(rawDesign, null, options, null);
  }

  /**
   * Incremental validation for the configurator: re-runs only rules whose
   * inputs intersect `changedPaths` (top-level DesignModel paths), merging
   * over `previous`. UX aggregation rules always re-run. Not authoritative.
   */
  validateIncremental(
    rawDesign: unknown,
    changedPaths: string[],
    previous: ValidationReport,
    options: ValidateOptions = {},
  ): ValidationReport {
    const affected = affectedRuleIds(this.inputIndex, changedPaths);
    for (const rule of this.catalogue.rules) {
      if (rule.rule_category === "ux") affected.add(rule.rule_id); // aggregation stage
    }
    return this.run(rawDesign, affected, options, previous);
  }

  private run(
    rawDesign: unknown,
    onlyRuleIds: Set<string> | null,
    options: ValidateOptions,
    previous: ValidationReport | null,
  ): ValidationReport {
    const design = sanitizeDesign(rawDesign);
    const designHash = hashOf(design);
    const stage: EvalStage = options.stage ?? "design";
    const order = options.order ?? null;

    const prior = new Map<string, ValidationFinding>();
    // Seed prior with previous findings so later stages can read untouched
    // earlier-stage results during incremental runs.
    if (previous) {
      for (const finding of previous.findings) {
        this.recordPrior(prior, finding);
      }
    }

    const ctx: EvalCtx = {
      catalogue: this.catalogue,
      rule: this.catalogue.rules[0], // replaced per rule below
      materials: this.materials,
      hardware: this.hardware,
      presets: this.catalogue.load_presets,
      partner: this.partner,
      carriers: this.carriers,
      stage,
      order,
      prior,
      cache: {},
    };

    const findings: ValidationFinding[] = previous
      ? previous.findings.filter((f) => onlyRuleIds !== null && !onlyRuleIds.has(f.rule_id))
      : [];
    const evaluatedRuleIds: string[] = [];

    for (const rule of this.orderedRules) {
      if (onlyRuleIds !== null && !onlyRuleIds.has(rule.rule_id)) continue;
      evaluatedRuleIds.push(rule.rule_id);
      const ruleFindings = this.evaluateRule(rule, design, designHash, ctx);
      findings.push(...ruleFindings);
      for (const finding of ruleFindings) this.recordPrior(prior, finding);
    }

    const acks = order?.acknowledgements ?? [];
    const { health, unacknowledged } = aggregateHealth(
      findings,
      this.rulesById,
      design,
      (finding) => isAcknowledged(finding, this.catalogueVersion, acks),
    );

    return {
      engine_version: this.engineVersion,
      catalogue_version: this.catalogueVersion,
      design_hash: designHash,
      mode: onlyRuleIds === null ? "full" : "incremental",
      evaluated_rule_ids: evaluatedRuleIds,
      findings,
      health,
      unacknowledged,
    };
  }

  private evaluateRule(rule: Rule, design: DesignModel, designHash: string, ctx: EvalCtx): ValidationFinding[] {
    const memoKey = `${designHash}:${ctx.stage}:${rule.rule_id}`;
    const memoised = this.memo.get(memoKey);
    // Order-stage results depend on OrderContext, which is not in the memo
    // key — only design-stage results are memoised.
    if (memoised && ctx.stage === "design") return memoised;

    let findings: ValidationFinding[];
    if (!this.applies(rule, design)) {
      findings = [this.toFinding(rule, { verdict: "NOT_APPLICABLE", note: `category ${design.unit.category} not in scope` })];
    } else {
      const evaluator: Evaluator | undefined = EVALUATORS.get(rule.rule_id);
      if (!evaluator) {
        // Fail closed: a catalogue rule with no registered logic can't pass.
        findings = [this.toFinding(rule, { verdict: "REQUIRES_VALIDATION_BLOCKED", note: "no evaluator registered" })];
      } else {
        try {
          ctx.rule = rule;
          const raw = evaluator(design, ctx);
          findings = (raw.length === 0 ? [{ verdict: "NOT_APPLICABLE" as const }] : raw).map((r) => this.toFinding(rule, r));
        } catch (error) {
          // Fail closed on evaluation exceptions (principle 3).
          findings = [
            this.toFinding(rule, {
              verdict: "REQUIRES_VALIDATION_BLOCKED",
              note: `evaluator exception: ${error instanceof Error ? error.message : String(error)}`,
            }),
          ];
        }
      }
    }
    if (ctx.stage === "design") {
      this.memo.set(memoKey, findings);
      if (this.memo.size > 4096) this.memo.clear(); // crude bound; memo is a pure cache
    }
    return findings;
  }

  private applies(rule: Rule, design: DesignModel): boolean {
    if (rule.product_categories.includes("all")) return true;
    return (rule.product_categories as string[]).includes(design.unit.category);
  }

  private toFinding(
    rule: Rule,
    raw: {
      verdict: ValidationFinding["verdict"];
      part_ids?: string[];
      computed?: ValidationFinding["computed"];
      inputs?: unknown;
      requires_anchor?: boolean;
      severity_override?: 0 | 1 | 2 | 3 | 4 | 5;
      note?: string;
    },
  ): ValidationFinding {
    const computed = raw.computed ?? {};
    // A per-finding override may only SOFTEN a rule (sales-first): the rule's
    // catalogue severity is a ceiling, so an evaluator can advise instead of
    // block but can never silently escalate past its declared severity.
    const effectiveSeverity =
      raw.severity_override !== undefined ? (Math.min(raw.severity_override, rule.severity) as Severity) : rule.severity;
    return {
      rule_id: rule.rule_id,
      rule_category: rule.rule_category,
      severity: effectiveSeverity,
      rule_severity: rule.severity,
      verdict: raw.verdict,
      part_ids: raw.part_ids ?? [],
      computed,
      inputs_hash: hashOf({
        rule_id: rule.rule_id,
        catalogue_version: this.catalogueVersion,
        inputs: raw.inputs ?? computed,
      }),
      requires_anchor: raw.requires_anchor,
      suggested_fix: rule.suggested_fix ?? null,
      note: raw.note,
    };
  }

  private recordPrior(prior: Map<string, ValidationFinding>, finding: ValidationFinding): void {
    const existing = prior.get(finding.rule_id);
    if (!existing || VERDICT_RANK[finding.verdict] > VERDICT_RANK[existing.verdict]) {
      prior.set(finding.rule_id, finding);
    }
  }
}

export function createEngine(rawCatalogue: unknown, options?: EngineOptions): RulesEngine {
  return new RulesEngine(rawCatalogue, options);
}
