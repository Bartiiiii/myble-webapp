// Every exposed cut edge must be banded (raw PB edges absorb moisture, chip).

import type { Evaluator } from "../context";
import { ok, violated } from "../context";

export const evaluate: Evaluator = (design) => {
  const bad: string[] = [];
  let exposedRaw = 0;
  for (const part of design.parts) {
    for (const edge of part.edges) {
      if (edge.exposed && edge.banding_mm <= 0) {
        exposedRaw++;
        if (!bad.includes(part.id)) bad.push(part.id);
      }
    }
  }
  if (bad.length > 0) return [violated({ part_ids: bad, computed: { exposed_raw_edges: exposedRaw } })];
  return [ok()];
};
