// Edging process constraints: 2 mm ABS needs the partner's premill capability.
// This is never a sale-blocker — 2 mm can always fall back to 1 mm banding —
// so both an unconfirmed capability and a partner that can't do 2 mm surface as
// a severity-3 advisory (offer the 1 mm substitution as the one-click fix).
// Cutting-list dimension compensation is generated downstream from the edge map.

import type { Evaluator } from "../context";
import { advisory, ok } from "../context";

export const evaluate: Evaluator = (design, ctx) => {
  const partsWith2mm = design.parts.filter((p) => p.edges.some((e) => e.banding_mm >= 2)).map((p) => p.id);
  if (partsWith2mm.length === 0) return [ok({ parts_with_2mm: 0 })];

  const capability = ctx.partner.capabilities.edging_2mm;
  if (capability === true) {
    return [ok({ parts_with_2mm: partsWith2mm.length, premill: ctx.partner.capabilities.premill ?? "unknown" })];
  }
  return [
    advisory({
      part_ids: partsWith2mm,
      computed: { parts_with_2mm: partsWith2mm.length, capability_confirmed: capability === false ? "no" : "pending" },
      note: capability === false ? "partner cannot apply 2 mm ABS — 1 mm substitution offered" : "2 mm ABS capability not yet confirmed",
    }),
  ];
};
