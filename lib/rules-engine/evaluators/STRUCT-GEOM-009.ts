// Geometric integrity screening on the declarative model: parts must fit the
// unit envelope, doors/shelves must fit their openings, and (excluding parts
// that legitimately float — adjustable shelves, doors, drawer boxes) every
// part must be connected to something via the joint graph.
// Full solid-intersection checks live in the configurator's geometry engine;
// this evaluator is the backend fail-closed net.

import type { Evaluator, RawFinding } from "../context";
import { ok, violated } from "../context";
import type { PartRole } from "../design";

const FLOATING_ROLES: PartRole[] = ["shelf_adj", "door", "drawer_front", "drawer_side", "drawer_back", "drawer_bottom"];

export const evaluate: Evaluator = (design) => {
  const { unit } = design;
  const findings: RawFinding[] = [];
  const envelope = Math.max(unit.width_mm, unit.height_mm, unit.depth_mm);

  const oversize = design.parts.filter((p) => Math.max(p.length_mm, p.width_mm) > envelope + 1).map((p) => p.id);
  if (oversize.length > 0) {
    findings.push(violated({ part_ids: oversize, computed: { problem: "part_exceeds_unit_envelope" } }));
  }

  const wideDoors = design.doors.filter((d) => d.width_mm > unit.width_mm).map((d) => d.part_id);
  if (wideDoors.length > 0) {
    findings.push(violated({ part_ids: wideDoors, computed: { problem: "door_wider_than_unit" } }));
  }

  const wideShelves = design.shelves.filter((s) => s.span_mm > unit.width_mm).map((s) => s.part_id);
  if (wideShelves.length > 0) {
    findings.push(violated({ part_ids: wideShelves, computed: { problem: "shelf_span_exceeds_unit_width" } }));
  }

  // Connectivity: joint graph must touch every structural part.
  const jointed = new Set<string>();
  for (const j of design.joints) {
    jointed.add(j.part_a);
    jointed.add(j.part_b);
  }
  const orphans = design.parts
    .filter((p) => !FLOATING_ROLES.includes(p.role) && !jointed.has(p.id))
    .map((p) => p.id);
  if (orphans.length > 0 && design.joints.length > 0) {
    findings.push(violated({ part_ids: orphans, computed: { problem: "part_connected_to_nothing" } }));
  }
  if (design.joints.length === 0 && design.parts.length > 1) {
    findings.push(violated({ computed: { problem: "no_joints_in_multi_part_design" } }));
  }

  if (findings.length === 0) return [ok({ parts: design.parts.length, joints: design.joints.length })];
  return findings;
};
