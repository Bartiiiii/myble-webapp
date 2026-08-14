// Feasible assembly sequence screening. Derives the canonical order (carcass →
// fixed shelves/dividers → back → doors/drawers → adjustable shelves) and
// rejects detectable trapped-part topologies:
//  - fixed shelves cam-joined to anything other than vertical members
//    (side/divider) — a shelf jointed to another shelf has no insertion path;
//  - a back panel jointed to fewer than 2 perimeter members (can't be fixed);
//  - carcass joint graph that is not connected (parts unreachable from a side).
// Full 3D insertion-path analysis is future work; these checks are the
// deterministic screening net and err on the strict side.

import type { Evaluator, RawFinding } from "../context";
import { ok, violated } from "../context";
import type { PartRole } from "../design";

const VERTICAL_MEMBERS: PartRole[] = ["side", "divider"];
const CARCASS_ROLES: PartRole[] = ["side", "top", "bottom", "shelf_fixed", "divider", "plinth", "rail", "top_panel"];
const PERIMETER_ROLES: PartRole[] = ["side", "top", "bottom"];

export const evaluate: Evaluator = (design) => {
  const findings: RawFinding[] = [];
  const roleOf = new Map(design.parts.map((p) => [p.id, p.role]));

  // Fixed shelves must join vertical members only.
  for (const joint of design.joints) {
    const roleA = roleOf.get(joint.part_a);
    const roleB = roleOf.get(joint.part_b);
    if (roleA === "shelf_fixed" || roleB === "shelf_fixed") {
      const other = roleA === "shelf_fixed" ? roleB : roleA;
      const shelfId = roleA === "shelf_fixed" ? joint.part_a : joint.part_b;
      if (other === "shelf_fixed") {
        findings.push(violated({ part_ids: [joint.part_a, joint.part_b], computed: { problem: "shelf_joined_to_shelf" } }));
      } else if (other !== undefined && !VERTICAL_MEMBERS.includes(other) && other !== "top" && other !== "bottom") {
        // shelf→side/divider carries load; shelf→top/bottom is fine at the
        // extremes; anything else (back, door, …) has no insertion path.
        findings.push(violated({ part_ids: [shelfId], computed: { problem: "fixed_shelf_joined_to_non_vertical", other_role: other } }));
      }
    }
  }

  // Back must reach at least two perimeter members.
  const backParts = design.parts.filter((p) => p.role === "back");
  for (const back of backParts) {
    const fixedTo = design.joints.filter((j) => j.part_a === back.id || j.part_b === back.id);
    const perimeterCount = fixedTo.filter((j) => {
      const otherId = j.part_a === back.id ? j.part_b : j.part_a;
      const role = roleOf.get(otherId);
      return role !== undefined && PERIMETER_ROLES.includes(role);
    }).length;
    if (perimeterCount < 2) {
      findings.push(violated({ part_ids: [back.id], computed: { problem: "back_not_reaching_fixing_members", perimeter_joints: perimeterCount } }));
    }
  }

  // Carcass connectivity: every carcass part reachable from the first side.
  const carcass = design.parts.filter((p) => CARCASS_ROLES.includes(p.role));
  const sides = carcass.filter((p) => p.role === "side");
  if (carcass.length > 1 && sides.length > 0) {
    const adjacency = new Map<string, string[]>();
    for (const j of design.joints) {
      adjacency.set(j.part_a, [...(adjacency.get(j.part_a) ?? []), j.part_b]);
      adjacency.set(j.part_b, [...(adjacency.get(j.part_b) ?? []), j.part_a]);
    }
    const carcassIds = new Set(carcass.map((p) => p.id));
    const visited = new Set<string>([sides[0].id]);
    const queue = [sides[0].id];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      for (const next of adjacency.get(current) ?? []) {
        if (carcassIds.has(next) && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    const unreachable = carcass.filter((p) => !visited.has(p.id)).map((p) => p.id);
    if (unreachable.length > 0) {
      findings.push(violated({ part_ids: unreachable, computed: { problem: "carcass_not_connected" } }));
    }
  }

  if (findings.length === 0) {
    return [ok({ sequence: "carcass>fixed_shelves>back>doors_drawers>adjustable_shelves" })];
  }
  return findings;
};
