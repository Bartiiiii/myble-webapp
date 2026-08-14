// Standard MVP connection system. Structural joints = cam+dowel (2+2 per end,
// 3+2 on ≥600 mm deep panels — PROVISIONAL counts, see constants.ts);
// confirmats only on non-visible utility joints; screws/staples only for
// back fixing. Anything else ⇒ VIOLATED.

import { CAMS_PER_JOINT_END, DEEP_PANEL_CAM_COUNT, DEEP_PANEL_DEPTH_MM, DOWELS_PER_JOINT_END } from "../constants";
import type { Evaluator, RawFinding } from "../context";
import { ok, violated } from "../context";

export const evaluate: Evaluator = (design) => {
  const findings: RawFinding[] = [];
  const backIds = new Set(design.parts.filter((p) => p.role === "back").map((p) => p.id));

  for (const joint of design.joints) {
    const touchesBack = backIds.has(joint.part_a) || backIds.has(joint.part_b);
    if (joint.type === "screw" || joint.type === "nail_staple") {
      if (!touchesBack) {
        findings.push(violated({ part_ids: [joint.part_a, joint.part_b], computed: { joint: joint.id, problem: "screw_nail_outside_back_fixing" } }));
      }
      continue;
    }
    if (joint.type === "confirmat") {
      if (joint.visible) {
        findings.push(violated({ part_ids: [joint.part_a, joint.part_b], computed: { joint: joint.id, problem: "confirmat_on_visible_joint" } }));
      }
      continue;
    }
    // cam_dowel: check connector counts per joint end.
    const cams = joint.connectors.filter((c) => c.hardware_id === "minifix15_dowel8").length;
    const dowels = joint.connectors.filter((c) => c.hardware_id === "dowel_8x35").length;
    const deep = design.unit.depth_mm >= DEEP_PANEL_DEPTH_MM;
    const requiredCams = deep ? DEEP_PANEL_CAM_COUNT : CAMS_PER_JOINT_END;
    if (cams < requiredCams || dowels < DOWELS_PER_JOINT_END) {
      findings.push(
        violated({
          part_ids: [joint.part_a, joint.part_b],
          computed: { joint: joint.id, cams, dowels, required_cams: requiredCams, required_dowels: DOWELS_PER_JOINT_END },
        }),
      );
    }
  }
  if (findings.length === 0) return [ok({ joints_checked: design.joints.length })];
  return findings;
};
