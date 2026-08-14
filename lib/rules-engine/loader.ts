// Catalogue loading & validation (implementation task 2). Rejects malformed
// catalogues at startup — a bad catalogue must never reach evaluation.

import type { ProductCategory, Rule, RuleCategory, RulesCatalogue } from "./types";

const RULE_CATEGORIES: readonly RuleCategory[] = [
  "product_scope", "material", "structural", "stability", "connection",
  "frameless_system", "manufacturing", "assembly", "shipping", "ux",
];

const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  "shelving_unit", "bookcase", "cabinet", "bedside_table", "storage_unit", "desk_simple", "all",
];

const CONFIDENCES = ["high", "medium", "low"] as const;
const VALIDATION_STATUSES = ["validated", "requires_validation", "requires_test"] as const;

export class CatalogueError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid rules catalogue: ${problems.slice(0, 8).join("; ")}${problems.length > 8 ? " …" : ""}`);
    this.name = "CatalogueError";
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkThresholdShape(problems: string[], rule_id: string, t: unknown): void {
  if (t === null || typeof t === "number") return;
  if (isPlainObject(t)) {
    for (const [k, v] of Object.entries(t)) {
      if (v !== null && typeof v !== "number" && typeof v !== "string") {
        problems.push(`${rule_id}: threshold.${k} must be number|string|null`);
      }
    }
    return;
  }
  problems.push(`${rule_id}: threshold must be number, object or null`);
}

/**
 * Validates raw JSON and returns a typed catalogue. Throws CatalogueError on:
 * duplicate rule_id, unknown enum values, severity-4/5 user-facing rules with
 * no user_message, or malformed thresholds (implementation task 2).
 */
export function loadCatalogue(raw: unknown): RulesCatalogue {
  const problems: string[] = [];
  if (!isPlainObject(raw)) throw new CatalogueError(["catalogue must be an object"]);
  const cat = raw as unknown as RulesCatalogue;

  if (typeof cat.catalogue_version !== "string" || !/^\d+\.\d+\.\d+$/.test(cat.catalogue_version)) {
    problems.push("catalogue_version must be semver");
  }
  if (!Array.isArray(cat.rules) || cat.rules.length === 0) {
    throw new CatalogueError(["rules must be a non-empty array"]);
  }
  if (!Array.isArray(cat.materials)) problems.push("materials must be an array");
  if (!Array.isArray(cat.hardware)) problems.push("hardware must be an array");
  if (!isPlainObject(cat.load_presets)) problems.push("load_presets missing");

  const seen = new Set<string>();
  for (const rule of cat.rules as Rule[]) {
    const id = rule?.rule_id;
    if (typeof id !== "string" || !/^[A-Z0-9]+-[A-Z0-9]+-\d{3}$/.test(id)) {
      problems.push(`rule_id malformed: ${String(id)}`);
      continue;
    }
    if (seen.has(id)) problems.push(`duplicate rule_id: ${id}`);
    seen.add(id);

    if (!RULE_CATEGORIES.includes(rule.rule_category)) {
      problems.push(`${id}: unknown rule_category ${String(rule.rule_category)}`);
    }
    if (!Array.isArray(rule.product_categories) || rule.product_categories.length === 0) {
      problems.push(`${id}: product_categories must be non-empty`);
    } else {
      for (const c of rule.product_categories) {
        if (!PRODUCT_CATEGORIES.includes(c)) problems.push(`${id}: unknown product_category ${String(c)}`);
      }
    }
    if (!Number.isInteger(rule.severity) || rule.severity < 0 || rule.severity > 5) {
      problems.push(`${id}: severity must be an integer 0–5`);
    }
    if (typeof rule.backend !== "boolean") problems.push(`${id}: backend must be boolean`);
    if (typeof rule.provisional !== "boolean") problems.push(`${id}: provisional must be boolean`);
    if (typeof rule.auto_correct !== "boolean") problems.push(`${id}: auto_correct must be boolean`);
    if (typeof rule.manual_review !== "boolean") problems.push(`${id}: manual_review must be boolean`);
    if (!CONFIDENCES.includes(rule.confidence)) problems.push(`${id}: unknown confidence ${String(rule.confidence)}`);
    if (!VALIDATION_STATUSES.includes(rule.validation_status)) {
      problems.push(`${id}: unknown validation_status ${String(rule.validation_status)}`);
    }
    if (!("threshold" in rule)) problems.push(`${id}: threshold field required (may be null)`);
    else checkThresholdShape(problems, id, rule.threshold);

    // Severity 4/5 rules that face the user (backend:false) must explain themselves.
    const msg = rule.user_message?.en;
    if (rule.severity >= 4 && rule.backend === false && (typeof msg !== "string" || msg.length === 0)) {
      problems.push(`${id}: severity ${rule.severity} with backend:false requires user_message.en`);
    }
    if (!Array.isArray(rule.inputs) || rule.inputs.length === 0) problems.push(`${id}: inputs must be non-empty`);
    if (!Array.isArray(rule.sources) || rule.sources.length === 0) problems.push(`${id}: sources must be non-empty`);
  }

  const matIds = new Set<string>();
  for (const m of cat.materials ?? []) {
    if (typeof m?.material_id !== "string") problems.push("material missing material_id");
    else if (matIds.has(m.material_id)) problems.push(`duplicate material_id ${m.material_id}`);
    else matIds.add(m.material_id);
  }
  const hwIds = new Set<string>();
  for (const h of cat.hardware ?? []) {
    if (typeof h?.hardware_id !== "string") problems.push("hardware missing hardware_id");
    else if (hwIds.has(h.hardware_id)) problems.push(`duplicate hardware_id ${h.hardware_id}`);
    else hwIds.add(h.hardware_id);
  }

  if (problems.length > 0) throw new CatalogueError(problems);
  return cat;
}

/** Rules that could fire in production while their safety limit is unvalidated
 *  (severity ≥ 4 and not yet validated) — ops dashboard & CI must surface these. */
export function unvalidatedSafetyRules(cat: RulesCatalogue): Rule[] {
  return cat.rules.filter((r) => r.severity >= 4 && r.validation_status !== "validated");
}
