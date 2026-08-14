// Re-assembly durability (severity 1, design tip). Cam+dowel joints are
// re-usable; confirmats degrade after ~2–3 cycles (PROVISIONAL) — recorded in
// computed so instructions can carry the warning. Never blocks.

import type { Evaluator } from "../context";
import { ok } from "../context";

export const evaluate: Evaluator = (design) => {
  const confirmatJoints = design.joints.filter((j) => j.type === "confirmat").length;
  const camJoints = design.joints.filter((j) => j.type === "cam_dowel").length;
  return [
    ok({
      cam_joints: camJoints,
      confirmat_joints: confirmatJoints,
      fully_reassemblable: confirmatJoints === 0,
    }),
  ];
};
