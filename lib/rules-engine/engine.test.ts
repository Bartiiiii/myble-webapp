// Engine behaviour: determinism, fail-closed paths, health outcomes,
// incremental vs full consistency, constraint queries, fix proposals,
// order-stage gating and acknowledgement invalidation.

import { describe, expect, it } from "vitest";
import rawCatalogue from "./catalogue/catalogue.v1.1.0.json";
import { canonicalJson } from "./canonical";
import { createEngine } from "./engine";
import { DesignInputError } from "./design";
import { makeAcknowledgement, findingRequiresAcknowledgement } from "./acknowledgements";
import type { OrderContext } from "./context";
import { makeBookcase, makeValidBedside, TEST_PARTNER } from "./__tests__/fixtures";
import { clone } from "./__tests__/violated-cases";

const engine = createEngine(rawCatalogue, { partner: TEST_PARTNER });

const ORDER_READY: OrderContext = {
  labels_generated: true,
  instructions_generated: true,
  protection_spec_applied: true,
  acknowledgements: [],
};

describe("determinism & audit", () => {
  it("produces byte-identical reports for the same design", () => {
    const a = engine.validate(makeValidBedside());
    const b = createEngine(rawCatalogue, { partner: TEST_PARTNER }).validate(makeValidBedside());
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("stamps engine + catalogue versions and the design hash", () => {
    const report = engine.validate(makeValidBedside());
    expect(report.engine_version).toBe("1.0.0");
    expect(report.catalogue_version).toBe("1.1.0");
    expect(report.design_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.evaluated_rule_ids.length).toBe(55);
  });

  it("evaluates every rule exactly once per full run (audit completeness)", () => {
    const report = engine.validate(makeValidBedside());
    const seen = new Set(report.findings.map((f) => f.rule_id));
    expect(seen.size).toBe(55);
  });
});

describe("health outcomes", () => {
  it("small all-LTD bedside with bracing is VALID", () => {
    const report = engine.validate(makeValidBedside());
    const violated = report.findings.filter((f) => f.verdict === "VIOLATED").map((f) => f.rule_id);
    expect(violated, `unexpected violations: ${violated.join(",")}`).toEqual([]);
    expect(report.health).toBe("VALID");
  });

  it("bookcase with HDF back never hard-blocks: sales-first anchor/confirm path", () => {
    // Under v1.1.0 the loaded-tipping and durability findings are advisories,
    // and HDF now has a provisional density so nothing fails closed. The tall
    // narrow anchored bookcase resolves to a wall-anchor acknowledgement.
    const report = engine.validate(makeBookcase());
    expect(["REQUIRES_WALL_ANCHOR", "REQUIRES_CONFIRMATION"]).toContain(report.health);
    expect(report.findings.some((f) => f.verdict === "REQUIRES_VALIDATION_BLOCKED")).toBe(false);
  });

  it("unknown category fails closed as a blocking scope violation", () => {
    const design = makeValidBedside();
    design.unit.category = "spaceship";
    const report = engine.validate(design);
    const scope = report.findings.find((f) => f.rule_id === "SCOPE-CAT-001");
    expect(scope?.verdict).toBe("VIOLATED");
    expect(report.health).toBe("CANNOT_MANUFACTURE");
  });

  it("over-span shelf is now a severity-3 recommendation, not a block", () => {
    // Sales-first: STRUCT-SHELF-001 (over 900 mm) advises rather than blocks.
    const design = makeBookcase();
    design.unit.width_mm = 1000;
    design.shelves[0].span_mm = 950;
    const report = engine.validate(design);
    const shelf = report.findings.find((f) => f.rule_id === "STRUCT-SHELF-001");
    expect(shelf?.verdict).toBe("VIOLATED");
    expect(shelf?.severity).toBe(3);
    expect(report.health).not.toBe("UNSAFE");
  });

  it("a genuine stability impossibility (tips while empty) still maps to UNSAFE", () => {
    const design = makeValidBedside();
    design.unit.category = "cabinet";
    design.unit.width_mm = 1200;
    design.unit.height_mm = 700;
    design.unit.depth_mm = 150;
    design.parts = design.parts.filter((p) => p.role !== "rail");
    const keep = new Set(design.parts.map((p) => p.id));
    design.joints = design.joints.filter((j) => keep.has(j.part_a) && keep.has(j.part_b));
    design.braces = [];
    design.parts.push(
      { id: "door_l", role: "door", length_mm: 680, width_mm: 580, thickness_mm: 18, material_id: "ltd_18_p2", edges: [], holes: [] },
      { id: "door_r", role: "door", length_mm: 680, width_mm: 580, thickness_mm: 18, material_id: "ltd_18_p2", edges: [], holes: [] },
    );
    design.doors = [
      { part_id: "door_l", width_mm: 580, height_mm: 680, hinge_count: 2, hinge_id: "cup_hinge_35" },
      { part_id: "door_r", width_mm: 580, height_mm: 680, hinge_count: 2, hinge_id: "cup_hinge_35" },
    ];
    const report = engine.validate(design);
    expect(report.health).toBe("UNSAFE");
  });

  it("hostile input is rejected before evaluation", () => {
    const design = clone(makeValidBedside()) as { parts: { length_mm: number }[] };
    design.parts[0].length_mm = Number.NaN;
    expect(() => engine.validate(design)).toThrow(DesignInputError);
  });

  it("order stage blocks when pipeline invariants are missing", () => {
    const report = engine.validate(makeValidBedside(), {
      stage: "order",
      order: { ...ORDER_READY, labels_generated: false },
    });
    expect(report.health).toBe("CANNOT_MANUFACTURE");
  });

  it("order stage passes with pipeline flags set", () => {
    const report = engine.validate(makeValidBedside(), { stage: "order", order: ORDER_READY });
    expect(report.health).toBe("VALID");
  });
});

describe("acknowledgements", () => {
  it("severity-3 findings gate on stored acknowledgements and invalidate on edit", () => {
    const design = makeValidBedside();
    design.unit.room_intent = "bathroom"; // MAT-MOIST-006, severity 3
    const report = engine.validate(design);
    expect(report.health).toBe("REQUIRES_CONFIRMATION");
    const finding = report.unacknowledged.find((f) => f.rule_id === "MAT-MOIST-006");
    expect(finding && findingRequiresAcknowledgement(finding)).toBe(true);

    const ack = makeAcknowledgement(finding!, report, "msg-hash", "user-1", "2026-07-19T12:00:00Z");
    const acknowledged = engine.validate(design, {
      stage: "order",
      order: { ...ORDER_READY, acknowledgements: [ack] },
    });
    expect(acknowledged.health).toBe("VALID");

    // Changing the triggering input invalidates the stored acknowledgement.
    const edited = clone(design);
    edited.unit.room_intent = "utility";
    const reAsk = engine.validate(edited, { stage: "order", order: { ...ORDER_READY, acknowledgements: [ack] } });
    expect(reAsk.health).toBe("REQUIRES_CONFIRMATION");
  });
});

describe("incremental validation", () => {
  it("re-runs only affected rules and agrees with the full run", () => {
    const design = makeValidBedside();
    const full = engine.validate(design);

    const edited = clone(design);
    edited.unit.room_intent = "bathroom";
    const incremental = engine.validateIncremental(edited, ["unit.room_intent"], full);
    expect(incremental.mode).toBe("incremental");
    expect(incremental.evaluated_rule_ids.length).toBeLessThan(55);
    expect(incremental.evaluated_rule_ids).toContain("MAT-MOIST-006");

    const authoritative = engine.validate(edited);
    expect(incremental.health).toBe(authoritative.health);
    // Findings for the affected rule match the authoritative run.
    const inc = incremental.findings.filter((f) => f.rule_id === "MAT-MOIST-006");
    const auth = authoritative.findings.filter((f) => f.rule_id === "MAT-MOIST-006");
    expect(canonicalJson(inc)).toBe(canonicalJson(auth));
  });

  it("keeps untouched findings from the previous report", () => {
    const design = makeValidBedside();
    const full = engine.validate(design);
    const incremental = engine.validateIncremental(clone(design), ["unit.room_intent"], full);
    const seen = new Set(incremental.findings.map((f) => f.rule_id));
    expect(seen.size).toBe(55);
  });
});

describe("constraint queries & fixes", () => {
  it("exposes slider clamps straight from catalogue thresholds", () => {
    expect(engine.getValidRange({ kind: "unit_dimension", dim: "depth" })).toEqual({ min_mm: 150, max_mm: 600 });
    expect(engine.getValidRange({ kind: "shelf_span" }).max_mm).toBe(900);
    expect(engine.getValidRange({ kind: "shelf_position", unit_height_mm: 1200 }).snap_mm).toBe(32);
    expect(engine.getValidRange({ kind: "door_width" }).max_mm).toBe(650);
  });

  it("proposes patches only for auto-correctable violated rules", () => {
    const design = makeValidBedside();
    design.unit.category = "storage_unit"; // plinth rule scope
    design.unit.plinth = { depth_mm: 120, height_mm: 200 }; // SYS32-PLINTH-005, auto_correct
    design.unit.template_id = null; // SCOPE-REV-004, NOT auto-correctable
    const report = engine.validate(design);
    const patches = engine.proposeFixes(design, report);
    expect(patches.map((p) => p.rule_id)).toContain("SYS32-PLINTH-005");
    expect(patches.map((p) => p.rule_id)).not.toContain("SCOPE-REV-004");
  });

  it("lists unvalidated safety rules for the ops dashboard", () => {
    const ids = engine.getUnvalidatedSafetyRules().map((r) => r.rule_id);
    expect(ids).toContain("SCOPE-SIZE-003");
    expect(ids).not.toContain("STRUCT-SHELF-001"); // now severity 3 (advisory)
    expect(ids).not.toContain("SCOPE-CAT-001"); // validated product decision
  });
});
