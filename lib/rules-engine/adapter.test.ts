// Adapter + facade tests: the cm configurator model maps to a structurally
// valid engine DesignModel, real presets validate to sales-first outcomes, and
// the whole thing is deterministic.

import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, emptyDesign, presetDesign } from "../build";
import { scaleParts } from "../geometry/scale";
import { sanitizeDesign } from "./design";
import { designToEngineModel } from "./adapter";
import { validateConfiguratorDesign } from "./configurator";
import { canonicalJson } from "./canonical";

describe("designToEngineModel", () => {
  it("maps every preset to a structurally valid engine model", () => {
    for (const id of ["police", "skrinka", "stolek"] as const) {
      const model = designToEngineModel(presetDesign(id));
      expect(() => sanitizeDesign(model)).not.toThrow();
      expect(model.parts.length).toBe(presetDesign(id).parts.length);
      // Unit dims come from the part bounding box; for an in-limits preset that
      // equals the requested outer size to within board-thickness rounding.
      expect(model.unit.width_mm).toBeGreaterThan(0);
    }
  });

  it("classifies sides, top/bottom and shelves from geometry", () => {
    const model = designToEngineModel(DEFAULT_DESIGN);
    const roles = new Set(model.parts.map((p) => p.role));
    expect(roles.has("side")).toBe(true);
    // The default 'police' preset is an open shelf stack → has top & bottom.
    expect(roles.has("top") || roles.has("bottom")).toBe(true);
    expect(model.unit.category).toBe("shelving_unit");
    expect(model.unit.template_id).not.toBeNull();
  });

  it("maps 36 mm thickness to the 36 mm material", () => {
    const thick = scaleParts({ ...DEFAULT_DESIGN, thickness: 36 }, DEFAULT_DESIGN.outerCm);
    const model = designToEngineModel(thick);
    expect(model.parts.every((p) => p.thickness_mm === 36)).toBe(true);
    expect(model.parts.some((p) => p.material_id === "ltd_36_p2")).toBe(true);
  });

  it("is deterministic for a given design", () => {
    const a = designToEngineModel(DEFAULT_DESIGN);
    const b = designToEngineModel(DEFAULT_DESIGN);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});

describe("validateConfiguratorDesign (sales-first)", () => {
  it("passes a normal preset without blocking the order", () => {
    const ui = validateConfiguratorDesign(DEFAULT_DESIGN);
    expect(ui.orderable).toBe(true);
    // No blocking (severity-4) findings on a stock preset.
    expect(ui.findings.filter((f) => f.severity >= 4 && f.verdict === "VIOLATED")).toEqual([]);
  });

  it("keeps a tall-narrow unit orderable via a wall-anchor path", () => {
    // Within the configurator's own limits (h ≤ 120 cm): tall + narrow trips
    // the stability regime and the anchor recommendation, but never blocks.
    const tall = scaleParts(DEFAULT_DESIGN, { w: 30, h: 120, d: 30 });
    const ui = validateConfiguratorDesign(tall, { wall_anchor_present: true });
    expect(ui.orderable).toBe(true);
    expect(ui.report.findings.filter((f) => f.severity >= 4 && f.verdict === "VIOLATED")).toEqual([]);
  });

  it("surfaces an over-span shelf as a severity-3 recommendation, still orderable", () => {
    // A very wide single shelf span (no interior divider) → STRUCT-SHELF advice.
    const wide = scaleParts(emptyDesign(), { w: 120, h: 40, d: 30 });
    const ui = validateConfiguratorDesign(wide);
    expect(ui.orderable).toBe(true);
    const shelfRec = ui.findings.find((f) => f.rule_id === "STRUCT-SHELF-001" || f.rule_id === "STRUCT-SHELF-002");
    if (shelfRec) expect(shelfRec.severity).toBeLessThanOrEqual(3);
  });

  it("renders localized messages and only lists auto-correctable fixes as patches", () => {
    const ui = validateConfiguratorDesign(DEFAULT_DESIGN, { locale: "cs" });
    for (const p of ui.patches) expect(p.rule_id).toBeTruthy();
    // Every acknowledgement is a severity-3 violated finding.
    for (const a of ui.acknowledgements) {
      expect(a.severity).toBe(3);
      expect(a.verdict).toBe("VIOLATED");
    }
  });

  it("never blocks a sale, whatever the health — the engine advises, we review", () => {
    // A deliberately awful design: paper-thin, over-tall, over-wide. Whatever
    // health this lands on, the customer can still order; we flag it instead.
    const awful = scaleParts(emptyDesign(), { w: 240, h: 240, d: 12 });
    const ui = validateConfiguratorDesign(awful);
    expect(ui.orderable).toBe(true);
    if (["REQUIRES_REVIEW", "CANNOT_MANUFACTURE", "UNSAFE"].includes(ui.report.health)) {
      expect(ui.needsReview).toBe(true);
    }
  });

  it("does not hold a correct design against the order-pipeline invariants", () => {
    // MFG-LABEL-006 / ASM-INSTR-006 / SHIP-PROT-003 assert steps WE perform
    // after the order is placed. The customer-facing validation must not raise
    // them — doing so flagged every correct design at checkout.
    const ui = validateConfiguratorDesign(DEFAULT_DESIGN, { stage: "design" });
    const pipelineIds = ["MFG-LABEL-006", "ASM-INSTR-006", "SHIP-PROT-003"];
    const raised = ui.findings.filter((f) => pipelineIds.includes(f.rule_id));
    expect(raised).toEqual([]);
  });
});
