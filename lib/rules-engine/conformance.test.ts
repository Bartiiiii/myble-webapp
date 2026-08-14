// Catalogue-conformance gates (implementation tasks 3 & 12):
//  1. every catalogue rule has exactly one registered evaluator, and vice versa
//  2. every severity-4/5 rule has at least one VIOLATED case in the manifest
//  3. every manifest case produces its expected verdict

import { describe, expect, it } from "vitest";
import rawCatalogue from "./catalogue/catalogue.v1.1.0.json";
import { createEngine } from "./engine";
import { EVALUATORS } from "./evaluators";
import { loadCatalogue } from "./loader";
import { RULE_CASES } from "./__tests__/violated-cases";

const catalogue = loadCatalogue(rawCatalogue);

describe("catalogue ↔ evaluator conformance", () => {
  it("has a 1:1 mapping between rules and evaluators", () => {
    const ruleIds = catalogue.rules.map((r) => r.rule_id).sort();
    const evaluatorIds = [...EVALUATORS.keys()].sort();
    expect(evaluatorIds).toEqual(ruleIds);
  });

  it("has at least one VIOLATED case for every severity-4/5 rule", () => {
    const covered = new Set(RULE_CASES.filter((c) => c.expect === "VIOLATED").map((c) => c.rule_id));
    const missing = catalogue.rules
      .filter((r) => r.severity >= 4)
      .map((r) => r.rule_id)
      .filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });
});

describe("rule cases", () => {
  for (const ruleCase of RULE_CASES) {
    it(`${ruleCase.rule_id}: ${ruleCase.label} → ${ruleCase.expect}`, () => {
      const engine = createEngine(rawCatalogue, { partner: ruleCase.partner });
      const report = engine.validate(ruleCase.build(), {
        stage: ruleCase.stage ?? "design",
        order: ruleCase.order ?? null,
      });
      const verdicts = report.findings
        .filter((f) => f.rule_id === ruleCase.rule_id)
        .map((f) => f.verdict);
      expect(verdicts, `findings for ${ruleCase.rule_id}: ${verdicts.join(",")}`).toContain(ruleCase.expect);
    });
  }
});
