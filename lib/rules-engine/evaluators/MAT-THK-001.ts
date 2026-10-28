// Supported material set: board parts in LTD P2 (18 mm, or the 36 mm board the
// live product also ships — catalogue 1.1.0 added `ltd_36_p2` for exactly
// that), backs in 3 mm HDF or the same LTD board as the carcass (Myble's back
// panels and rails are cut from the piece's own sheet: lib/quote.ts prices
// them and lib/mebleExport.ts orders them that way).
// Unknown material or wrong thickness for the role ⇒ VIOLATED (fail closed).

import type { PartRole } from "../design";
import type { Evaluator } from "../context";
import { ok, violated } from "../context";

const LTD = ["ltd_18_p2", "ltd_36_p2"] as const;

const MATERIALS_FOR_ROLE: Record<PartRole, readonly string[]> = {
  side: LTD, top: LTD, bottom: LTD,
  shelf_fixed: LTD, shelf_adj: LTD, divider: LTD,
  back: ["hdf_back_3", ...LTD],
  door: LTD, drawer_front: LTD, drawer_side: LTD,
  drawer_back: LTD, drawer_bottom: ["hdf_back_3"],
  plinth: LTD, top_panel: LTD, rail: LTD,
};

export const evaluate: Evaluator = (design, ctx) => {
  const bad: string[] = [];
  for (const part of design.parts) {
    const allowed = MATERIALS_FOR_ROLE[part.role];
    const material = ctx.materials.get(part.material_id);
    if (!allowed || !material || !allowed.includes(part.material_id) || part.thickness_mm !== material.nominal_thickness_mm) {
      bad.push(part.id);
    }
  }
  if (bad.length > 0) {
    return [violated({ part_ids: bad, computed: { offending_parts: bad.length } })];
  }
  return [ok({ parts_checked: design.parts.length })];
};
