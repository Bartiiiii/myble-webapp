import { describe, expect, it } from "vitest";
import rawCatalogue from "./catalogue/catalogue.v1.1.0.json";
import { aggregateHealth } from "./health";
import { loadCatalogue } from "./loader";
import type { ValidationFinding } from "./report";
import type { RuleCategory, Severity } from "./types";
import { makeValidBedside } from "./__tests__/fixtures";
import { renderMessage } from "./messages";

const catalogue = loadCatalogue(rawCatalogue);
const rulesById = new Map(catalogue.rules.map((r) => [r.rule_id, r]));

function finding(
  rule_id: string,
  severity: Severity,
  rule_category: RuleCategory,
  verdict: ValidationFinding["verdict"] = "VIOLATED",
  requires_anchor = false,
): ValidationFinding {
  return { rule_id, rule_category, severity, rule_severity: severity, verdict, part_ids: [], computed: {}, inputs_hash: "h", requires_anchor };
}

const never = () => false;
const design = makeValidBedside();

describe("health aggregation (§8 precedence)", () => {
  it("UNSAFE beats everything", () => {
    const { health } = aggregateHealth(
      [
        finding("STRUCT-SHELF-001", 4, "structural"),
        finding("MFG-MIN-001", 4, "manufacturing"),
        finding("STAB-DRAWER-004", 5, "stability"),
      ],
      rulesById, design, never,
    );
    expect(health).toBe("UNSAFE");
  });

  it("CANNOT_MANUFACTURE beats review/confirmation", () => {
    const { health } = aggregateHealth(
      [finding("MFG-MIN-001", 4, "manufacturing"), finding("SCOPE-REV-004", 5, "product_scope")],
      rulesById, design, never,
    );
    expect(health).toBe("CANNOT_MANUFACTURE");
  });

  it("severity 5 routes to review", () => {
    const { health } = aggregateHealth([finding("MFG-COMPLEX-007", 5, "manufacturing")], rulesById, design, never);
    expect(health).toBe("REQUIRES_REVIEW");
  });

  it("blocked safety checks route to review (§7)", () => {
    const { health } = aggregateHealth(
      [finding("STRUCT-BACK-004", 4, "structural", "REQUIRES_VALIDATION_BLOCKED")],
      rulesById, design, never,
    );
    expect(health).toBe("REQUIRES_REVIEW");
  });

  it("anchor-flavoured blocked checks map to wall-anchor when the kit is present", () => {
    const anchored = { ...design, wall_anchor: { present: true } };
    const { health } = aggregateHealth(
      [finding("STAB-CALC-003", 4, "stability", "REQUIRES_VALIDATION_BLOCKED", true)],
      rulesById, anchored, never,
    );
    expect(health).toBe("REQUIRES_WALL_ANCHOR");
  });

  it("unacknowledged severity 3 requires confirmation; acknowledged clears", () => {
    const findings = [finding("MAT-MOIST-006", 3, "material")];
    expect(aggregateHealth(findings, rulesById, design, never).health).toBe("REQUIRES_CONFIRMATION");
    expect(aggregateHealth(findings, rulesById, design, () => true).health).toBe("VALID");
  });

  it("severity 2 yields VALID_WITH_RECOMMENDATIONS; 0/1 stay VALID", () => {
    expect(aggregateHealth([finding("MAT-EDGE-004", 2, "material")], rulesById, design, never).health).toBe(
      "VALID_WITH_RECOMMENDATIONS",
    );
    expect(aggregateHealth([finding("ASM-PEOPLE-004", 0, "assembly")], rulesById, design, never).health).toBe("VALID");
  });
});

describe("message rendering", () => {
  const shelfRule = rulesById.get("STRUCT-SHELF-002")!;

  it("fills placeholders from computed values", () => {
    const f = { ...finding("STRUCT-SHELF-002", 3, "structural"), computed: { delta: 4.37 } };
    const message = renderMessage(shelfRule, f, "en", () => {});
    expect(message).toContain("4.37 mm");
  });

  it("falls back to English with a warning when a cs translation is missing", () => {
    const warnings: string[] = [];
    const f = { ...finding("STRUCT-SHELF-002", 3, "structural"), computed: { delta: 4.37 } };
    const message = renderMessage(shelfRule, f, "cs", (m) => warnings.push(m));
    expect(message).toContain("4.37");
    expect(warnings.some((w) => w.includes("missing cs translation"))).toBe(true);
  });

  it("returns null for rules without a user message", () => {
    const rule = rulesById.get("MAT-THK-001")!;
    expect(renderMessage(rule, finding("MAT-THK-001", 4, "material"), "en", () => {})).toBeNull();
  });
});
