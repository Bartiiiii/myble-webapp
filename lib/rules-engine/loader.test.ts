import { describe, expect, it } from "vitest";
import rawCatalogue from "./catalogue/catalogue.v1.1.0.json";
import { CatalogueError, loadCatalogue, unvalidatedSafetyRules } from "./loader";
import type { Rule } from "./types";

function cloneCatalogue(): { rules: Rule[]; [k: string]: unknown } {
  return JSON.parse(JSON.stringify(rawCatalogue));
}

describe("catalogue loader", () => {
  it("loads the v1 catalogue", () => {
    const cat = loadCatalogue(rawCatalogue);
    expect(cat.catalogue_version).toBe("1.1.0");
    expect(cat.rules.length).toBe(55);
    expect(cat.materials.length).toBe(3); // + ltd_36_p2 (live product ships 36 mm)
    expect(cat.hardware.length).toBe(7);
  });

  it("rejects duplicate rule ids", () => {
    const cat = cloneCatalogue();
    cat.rules.push(JSON.parse(JSON.stringify(cat.rules[0])));
    expect(() => loadCatalogue(cat)).toThrow(CatalogueError);
    expect(() => loadCatalogue(cat)).toThrow(/duplicate rule_id/);
  });

  it("rejects unknown enum values", () => {
    const cat = cloneCatalogue();
    (cat.rules[0] as { rule_category: string }).rule_category = "vibes";
    expect(() => loadCatalogue(cat)).toThrow(/unknown rule_category/);
  });

  it("rejects out-of-range severity", () => {
    const cat = cloneCatalogue();
    (cat.rules[0] as { severity: number }).severity = 7;
    expect(() => loadCatalogue(cat)).toThrow(/severity/);
  });

  it("rejects severity-4 user-facing rules without a user message", () => {
    const cat = cloneCatalogue();
    const rule = cat.rules.find((r) => r.rule_id === "SCOPE-CAT-001") as Rule;
    (rule as { backend: boolean }).backend = false;
    (rule as { user_message: null }).user_message = null;
    expect(() => loadCatalogue(cat)).toThrow(/requires user_message/);
  });

  it("rejects malformed threshold shapes", () => {
    const cat = cloneCatalogue();
    (cat.rules[2] as { threshold: unknown }).threshold = [1, 2, 3];
    expect(() => loadCatalogue(cat)).toThrow(/threshold/);
  });

  it("surfaces unvalidated safety rules for ops/CI", () => {
    const cat = loadCatalogue(rawCatalogue);
    const unvalidated = unvalidatedSafetyRules(cat);
    expect(unvalidated.length).toBeGreaterThan(0);
    for (const rule of unvalidated) {
      expect(rule.severity).toBeGreaterThanOrEqual(4);
      expect(rule.validation_status).not.toBe("validated");
    }
    // STRUCT-SHELF-001 is now severity 3 (sales-first policy) so it is NOT an
    // unvalidated *safety* rule; the envelope limit still is (sev 4).
    expect(unvalidated.map((r) => r.rule_id)).toContain("SCOPE-SIZE-003");
    expect(unvalidated.map((r) => r.rule_id)).not.toContain("STRUCT-SHELF-001");
  });
});
