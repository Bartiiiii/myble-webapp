// Customer toolkit is fixed: PZ2 screwdriver, supplied hex key, soft hammer.
// The DesignModel's joint vocabulary is toolkit-compatible by construction
// (cam/confirmat/screw/nail); this evaluator is the backstop that fails any
// future joint type that would need glue or a drill for furniture assembly.

import type { Evaluator } from "../context";
import { ok, violated } from "../context";
import type { JointType } from "../design";

const TOOLKIT_JOINTS: JointType[] = ["cam_dowel", "confirmat", "screw", "nail_staple"];

export const evaluate: Evaluator = (design) => {
  const offending = design.joints.filter((j) => !TOOLKIT_JOINTS.includes(j.type));
  if (offending.length > 0) {
    return [
      violated({
        part_ids: offending.flatMap((j) => [j.part_a, j.part_b]),
        computed: { offending_joint_types: [...new Set(offending.map((j) => j.type))].join(",") },
      }),
    ];
  }
  return [ok({ wall_anchor_drill_needed: design.wall_anchor.present })];
};
