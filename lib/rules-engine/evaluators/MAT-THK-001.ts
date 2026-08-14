// Supported material set: backs = 3 mm HDF, everything else = 18 mm LTD P2.
// Unknown material or wrong thickness for the role ⇒ VIOLATED (fail closed).

import type { PartRole } from "../design";
import type { Evaluator } from "../context";
import { ok, violated } from "../context";

const MATERIAL_FOR_ROLE: Record<PartRole, string> = {
  side: "ltd_18_p2", top: "ltd_18_p2", bottom: "ltd_18_p2",
  shelf_fixed: "ltd_18_p2", shelf_adj: "ltd_18_p2", divider: "ltd_18_p2",
  back: "hdf_back_3",
  door: "ltd_18_p2", drawer_front: "ltd_18_p2", drawer_side: "ltd_18_p2",
  drawer_back: "ltd_18_p2", drawer_bottom: "hdf_back_3",
  plinth: "ltd_18_p2", top_panel: "ltd_18_p2", rail: "ltd_18_p2",
};

export const evaluate: Evaluator = (design, ctx) => {
  const bad: string[] = [];
  for (const part of design.parts) {
    const expected = MATERIAL_FOR_ROLE[part.role];
    const material = ctx.materials.get(part.material_id);
    if (!expected || !material || part.material_id !== expected || part.thickness_mm !== material.nominal_thickness_mm) {
      bad.push(part.id);
    }
  }
  if (bad.length > 0) {
    return [violated({ part_ids: bad, computed: { offending_parts: bad.length } })];
  }
  return [ok({ parts_checked: design.parts.length })];
};
