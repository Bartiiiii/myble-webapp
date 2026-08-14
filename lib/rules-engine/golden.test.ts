// Golden-file corpus (implementation task 12): reference designs with frozen
// expected reports. CI diffs these on every change — any behavioural drift in
// the engine or catalogue shows up as a golden diff that must be reviewed.
//
// To regenerate after an INTENTIONAL change:
//   UPDATE_GOLDEN=1 npm test -- golden
// then review the diff like any code change.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import rawCatalogue from "./catalogue/catalogue.v1.1.0.json";
import { createEngine } from "./engine";
import type { DesignModel } from "./design";
import { makeBookcase, makeValidBedside, TEST_PARTNER } from "./__tests__/fixtures";
import { RULE_CASES } from "./__tests__/violated-cases";

const GOLDEN_DIR = join(__dirname, "__tests__", "golden");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

function caseBuild(rule_id: string): () => DesignModel {
  const found = RULE_CASES.find((c) => c.rule_id === rule_id && c.expect === "VIOLATED");
  if (!found) throw new Error(`no VIOLATED case for ${rule_id}`);
  return found.build;
}

/** name → design; the corpus from the implementation prompt. */
const CORPUS: Record<string, () => DesignModel> = {
  valid_bedside: makeValidBedside,
  bookcase_with_back: makeBookcase,
  over_span_shelf: caseBuild("STRUCT-SHELF-001"),
  tall_narrow_no_anchor: caseBuild("STAB-ANCHOR-002"),
  trapped_assembly: caseBuild("ASM-SEQ-001"),
  oversize_panel: caseBuild("MAT-SIZE-002"),
  over_mass_package: caseBuild("SHIP-MASS-002"),
};

interface GoldenSnapshot {
  health: string;
  design_hash: string;
  findings: { rule_id: string; verdict: string; severity: number }[];
}

function snapshot(design: DesignModel): GoldenSnapshot {
  const engine = createEngine(rawCatalogue, { partner: TEST_PARTNER });
  const report = engine.validate(design);
  return {
    health: report.health,
    design_hash: report.design_hash,
    findings: report.findings
      .map((f) => ({ rule_id: f.rule_id, verdict: f.verdict, severity: f.severity }))
      .sort((a, b) => a.rule_id.localeCompare(b.rule_id) || a.verdict.localeCompare(b.verdict)),
  };
}

describe("golden corpus", () => {
  for (const [name, build] of Object.entries(CORPUS)) {
    it(name, () => {
      const actual = snapshot(build());
      const file = join(GOLDEN_DIR, `${name}.json`);
      if (UPDATE) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(actual, null, 2) + "\n");
        return;
      }
      const expected = JSON.parse(readFileSync(file, "utf8")) as GoldenSnapshot;
      expect(actual).toEqual(expected);
    });
  }
});
