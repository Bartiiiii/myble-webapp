// Hard-block safety-critical categories (chairs, beds, cots, children's…).
// Primary control is the category system; the catalogue notes geometric
// step/ladder heuristics are assistive only — MVP relies on the category and
// on templates (SCOPE-REV-004) which cannot express ladder archetypes.

import type { Evaluator } from "../context";
import { ok, violated } from "../context";

const BLOCKED_CATEGORIES = [
  "chair", "stool", "seating",
  "bed", "bunk_bed", "loft_bed",
  "cot", "crib", "children_furniture",
  "ladder", "step_stool", "steps",
];

export const evaluate: Evaluator = (design) => {
  const category = design.unit.category.toLowerCase();
  if (BLOCKED_CATEGORIES.includes(category)) {
    return [violated({ computed: { category } })];
  }
  return [ok({ category })];
};
