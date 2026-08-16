// App-facing facade: one place the configurator + checkout import to validate a
// cm-based `Design` against the current catalogue. Wraps engine construction,
// the cm→mm adapter, message rendering and fix proposals so callers never touch
// engine internals or juggle catalogue versions.

import type { Design } from "../model";
import { CURRENT_CATALOGUE, catalogueForVersion } from "./catalogue";
import { createEngine, type RulesEngine } from "./engine";
import { ENGINE_VERSION } from "./constants";
import { designToEngineModel, type AdapterOptions } from "./adapter";
import { renderMessage, type Locale } from "./messages";
import { MYBLE_PARTNER_PROFILE } from "./myble-profile";
import type { OrderContext } from "./context";
import type { DesignPatch } from "./fixes";
import type { DesignModel } from "./design";
import type { ValidationFinding, ValidationReport } from "./report";
import type { Rule } from "./types";

/** A finding enriched with the rendered, localized message + fix for the UI. */
export interface UiFinding extends ValidationFinding {
  message: string | null;
  rule_name: string;
  auto_correctable: boolean;
}

export interface UiReport {
  report: ValidationReport;
  findings: UiFinding[];
  /** Severity-3 recommendations the customer must acknowledge to order. */
  acknowledgements: UiFinding[];
  patches: DesignPatch[];
  /** Always true. Sales-first policy: the rules engine never stops a sale —
   *  it advises. Concerns are surfaced as recommendations and, when serious,
   *  flagged via `needsReview` for our team to confirm before production. */
  orderable: boolean;
  /** Health says our team should look at this design before it goes to
   *  production. Internal routing only — it never disables the Order button. */
  needsReview: boolean;
}

let cachedEngine: RulesEngine | null = null;
function engine(): RulesEngine {
  cachedEngine ??= createEngine(CURRENT_CATALOGUE, { partner: MYBLE_PARTNER_PROFILE });
  return cachedEngine;
}

/** Health states our team reviews before production. The customer still orders
 *  normally — this only routes the order to a human check on our side. */
const REVIEW_HEALTH = new Set(["REQUIRES_REVIEW", "CANNOT_MANUFACTURE", "UNSAFE"]);

/** Three identical shelves produce three identical findings — same rule, same
 *  inputs hash, same sentence. The audit report keeps them all; the customer
 *  should read the advice once, with every affected part highlighted. */
function dedupe(findings: UiFinding[]): UiFinding[] {
  const byKey = new Map<string, UiFinding>();
  for (const f of findings) {
    const key = `${f.rule_id}:${f.inputs_hash}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { ...f, part_ids: [...f.part_ids] });
      continue;
    }
    for (const id of f.part_ids) if (!seen.part_ids.includes(id)) seen.part_ids.push(id);
  }
  return [...byKey.values()];
}

function enrich(report: ValidationReport, rulesById: Map<string, Rule>, locale: Locale): UiFinding[] {
  const enriched = report.findings
    .filter((f) => f.verdict === "VIOLATED" || f.verdict === "REQUIRES_VALIDATION_BLOCKED")
    .map((f) => {
      const rule = rulesById.get(f.rule_id);
      return {
        ...f,
        message: rule ? renderMessage(rule, f, locale) : null,
        rule_name: rule?.name ?? f.rule_id,
        auto_correctable: rule?.auto_correct ?? false,
      };
    });
  return dedupe(enriched).sort((a, b) => b.severity - a.severity);
}

export interface ValidateConfiguratorOptions extends AdapterOptions {
  locale?: Locale;
  stage?: "design" | "order";
  order?: OrderContext | null;
}

/** Validate a configurator design and return a UI-ready report. */
export function validateConfiguratorDesign(design: Design, options: ValidateConfiguratorOptions = {}): UiReport {
  const model = designToEngineModel(design, options);
  const eng = engine();
  const report = eng.validate(model, { stage: options.stage ?? "design", order: options.order ?? null });
  const rulesById = new Map(eng.catalogue.rules.map((r) => [r.rule_id, r]));
  const findings = enrich(report, rulesById, options.locale ?? "cs");
  const acknowledgements = findings.filter((f) => f.severity === 3 && f.verdict === "VIOLATED");
  return {
    report,
    findings,
    acknowledgements,
    patches: eng.proposeFixes(model, report),
    orderable: true,
    needsReview: REVIEW_HEALTH.has(report.health),
  };
}

/**
 * The UI's entry point. The engine validates its inputs strictly and throws on
 * a model it cannot describe — correct for the server, fatal in a render pass,
 * where it would white-screen the checkout over advisory copy. Sales-first: an
 * unmappable design still orders, and comes to us marked for review.
 */
export function safeValidateConfiguratorDesign(
  design: Design,
  options: ValidateConfiguratorOptions = {},
): UiReport {
  try {
    return validateConfiguratorDesign(design, options);
  } catch (err) {
    if (typeof console !== "undefined") {
      console.error("[rules] validation failed, routing design to manual review", err);
    }
    return {
      report: {
        engine_version: ENGINE_VERSION,
        catalogue_version: CURRENT_CATALOGUE.catalogue_version,
        design_hash: "unvalidated",
        mode: "full",
        evaluated_rule_ids: [],
        findings: [],
        health: "REQUIRES_REVIEW",
        unacknowledged: [],
      },
      findings: [],
      acknowledgements: [],
      patches: [],
      orderable: true,
      needsReview: true,
    };
  }
}

/** Server-side re-validation against the exact stored catalogue version
 *  (stored-order replay / checkout authority — implementation task 7/10). */
export function revalidateForOrder(
  model: DesignModel,
  order: OrderContext,
  catalogueVersion: string = CURRENT_CATALOGUE.catalogue_version,
): UiReport {
  const raw = catalogueForVersion(catalogueVersion);
  const eng = createEngine(raw, { partner: MYBLE_PARTNER_PROFILE });
  const report = eng.validate(model, { stage: "order", order });
  const rulesById = new Map(eng.catalogue.rules.map((r) => [r.rule_id, r]));
  const findings = enrich(report, rulesById, "cs");
  return {
    report,
    findings,
    acknowledgements: findings.filter((f) => f.severity === 3 && f.verdict === "VIOLATED"),
    patches: [],
    orderable: true,
    needsReview: REVIEW_HEALTH.has(report.health),
  };
}

export { designToEngineModel } from "./adapter";
