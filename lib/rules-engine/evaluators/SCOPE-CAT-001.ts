// Supported MVP product categories. Unknown category ⇒ VIOLATED (fail closed).

import type { Evaluator } from "../context";
import { ok, violated } from "../context";

export const SUPPORTED_CATEGORIES = [
  "shelving_unit",
  "bookcase",
  "cabinet",
  "bedside_table",
  "storage_unit",
  "desk_simple",
] as const;

export const evaluate: Evaluator = (design) => {
  const category = design.unit.category;
  if (!(SUPPORTED_CATEGORIES as readonly string[]).includes(category)) {
    return [violated({ computed: { category } })];
  }
  return [ok({ category })];
};
