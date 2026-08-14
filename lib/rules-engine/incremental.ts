// Static input→rules index for incremental re-validation (task 3). Built once
// from each rule's declared `inputs`; validateIncremental re-runs only rules
// whose input groups intersect the changed model groups. The full run at
// checkout remains authoritative.

import type { Rule, RulesCatalogue } from "./types";

/** Top-level DesignModel groups a changed path can belong to. */
export type ModelGroup =
  | "unit" | "parts" | "shelves" | "doors" | "drawers" | "joints"
  | "dividers" | "braces" | "wall_anchor" | "order" | "*";

/** Full-key special cases first (composite/derived inputs), prefix fallback after. */
const SPECIAL_INPUT_GROUPS: Record<string, ModelGroup[]> = {
  "unit.geometry_graph": ["unit", "parts", "joints", "shelves", "doors", "drawers"],
  "unit.mass_est": ["parts"],
  "unit.part_stats": ["parts"],
  "unit.fixed_shelves[]": ["shelves"],
  "unit.dividers[]": ["dividers"],
  "unit.braces[]": ["braces"],
  "unit.compartments": ["shelves", "unit"],
  "unit.required_tools": ["joints"],
  "unit.cog": ["parts"],
  "unit.neighbours": ["unit"],
  "findings[]": ["*"],
  // The catalogue names it order.room_intent; the model carries it on unit.
  "order.room_intent (optional)": ["unit"],
};

const PREFIX_GROUPS: Record<string, ModelGroup[]> = {
  unit: ["unit"],
  part: ["parts"],
  shelf: ["shelves", "parts"],
  door: ["doors", "parts"],
  doors: ["doors", "parts"],
  drawer: ["drawers"],
  drawers: ["drawers"],
  joint: ["joints"],
  top: ["unit", "parts", "braces"],
  package: ["parts", "drawers", "unit"],
  order: ["order"],
  room: ["unit"],
  wall_anchor: ["wall_anchor"],
  material: ["parts"],
  hardware: ["joints"],
  partner: [],
  pricing: [],
  findings: ["*"],
  "n/a": [],
};

function groupsForInput(input: string): ModelGroup[] {
  const cleaned = input.trim();
  if (SPECIAL_INPUT_GROUPS[cleaned]) return SPECIAL_INPUT_GROUPS[cleaned];
  const prefix = cleaned.split(/[.[\s]/, 1)[0].toLowerCase();
  return PREFIX_GROUPS[prefix] ?? ["*"]; // unknown input vocab ⇒ always re-run (fail closed)
}

export function groupsForRule(rule: Rule): Set<ModelGroup> {
  const groups = new Set<ModelGroup>();
  for (const input of rule.inputs) for (const g of groupsForInput(input)) groups.add(g);
  return groups;
}

export type InputIndex = Map<string, Set<ModelGroup>>;

export function buildInputIndex(catalogue: RulesCatalogue): InputIndex {
  const index: InputIndex = new Map();
  for (const rule of catalogue.rules) index.set(rule.rule_id, groupsForRule(rule));
  return index;
}

/** Group of a changed model path, e.g. "parts[3].length_mm" → "parts". */
export function groupOfPath(path: string): ModelGroup {
  const head = path.split(/[.[]/, 1)[0];
  const known: ModelGroup[] = ["unit", "parts", "shelves", "doors", "drawers", "joints", "dividers", "braces", "wall_anchor", "order"];
  return (known as string[]).includes(head) ? (head as ModelGroup) : "*";
}

export function affectedRuleIds(index: InputIndex, changedPaths: string[]): Set<string> {
  const changedGroups = new Set(changedPaths.map(groupOfPath));
  const affected = new Set<string>();
  for (const [ruleId, groups] of index) {
    if (groups.has("*") || changedGroups.has("*")) {
      affected.add(ruleId);
      continue;
    }
    for (const g of groups) {
      if (changedGroups.has(g)) {
        affected.add(ruleId);
        break;
      }
    }
  }
  return affected;
}
