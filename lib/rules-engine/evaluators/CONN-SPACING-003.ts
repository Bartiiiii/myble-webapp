// Connector spacing: joints > 450 mm need a third cam group (PROVISIONAL);
// back-fixing runs may not exceed 300 mm between fasteners.

import type { Evaluator, RawFinding } from "../context";
import { ok, thresholdNum, violated } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const thirdAbove = thresholdNum(ctx.rule, "third_connector_above_mm");
  const backPitch = thresholdNum(ctx.rule, "back_fix_pitch_mm");
  const backIds = new Set(design.parts.filter((p) => p.role === "back").map((p) => p.id));
  const findings: RawFinding[] = [];

  for (const joint of design.joints) {
    const touchesBack = backIds.has(joint.part_a) || backIds.has(joint.part_b);
    if (touchesBack) {
      // Max unfastened run along the back fixing line, including both ends.
      const positions = joint.connectors.map((c) => c.position_mm).sort((a, b) => a - b);
      let worst = joint.length_mm;
      if (positions.length > 0) {
        worst = positions[0]; // run from joint start to first fastener
        for (let i = 1; i < positions.length; i++) worst = Math.max(worst, positions[i] - positions[i - 1]);
        worst = Math.max(worst, joint.length_mm - positions[positions.length - 1]);
      }
      if (worst > backPitch) {
        findings.push(violated({ part_ids: [joint.part_a, joint.part_b], computed: { joint: joint.id, worst_run_mm: Math.round(worst) } }));
      }
      continue;
    }
    if (joint.type === "cam_dowel" && joint.length_mm > thirdAbove) {
      const cams = joint.connectors.filter((c) => c.hardware_id === "minifix15_dowel8").length;
      if (cams < 3) {
        findings.push(violated({ part_ids: [joint.part_a, joint.part_b], computed: { joint: joint.id, length_mm: joint.length_mm, cams } }));
      }
    }
  }
  if (findings.length === 0) return [ok({ joints_checked: design.joints.length })];
  return findings;
};
