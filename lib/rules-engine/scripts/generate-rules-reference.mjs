#!/usr/bin/env node
// Generates RULES.md (rules reference table) from the bundled catalogue.
// Run from the repo root:  node lib/rules-engine/scripts/generate-rules-reference.mjs
// CI regenerates and diffs — a stale RULES.md fails the build.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(readFileSync(join(here, "..", "catalogue", "catalogue.v1.1.0.json"), "utf8"));

const esc = (s) => String(s ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const threshold = (t) =>
  t === null ? "—" : typeof t === "number" ? String(t) : Object.entries(t).map(([k, v]) => `${k}=${v ?? "∅"}`).join(", ");

const lines = [
  `# Myble Rules Reference`,
  ``,
  `Generated from \`catalogue.v${catalogue.catalogue_version}.json\` (${catalogue.generated}). Do not edit by hand —`,
  `run \`node lib/rules-engine/scripts/generate-rules-reference.mjs\`.`,
  ``,
  `> ${esc(catalogue.status)}`,
  ``,
  `| Rule | Name | Cat | Sev | Threshold | Prov. | Status | Auto-fix | Review |`,
  `|---|---|---|---|---|---|---|---|---|`,
];

for (const r of catalogue.rules) {
  lines.push(
    `| ${r.rule_id} | ${esc(r.name)} | ${r.rule_category} | ${r.severity} | ${esc(threshold(r.threshold))} | ` +
      `${r.provisional ? "yes" : "no"} | ${r.validation_status} | ${r.auto_correct ? "yes" : "no"} | ${r.manual_review ? "yes" : "no"} |`,
  );
}

lines.push(
  ``,
  `## Unvalidated safety rules (severity ≥ 4, not \`validated\`)`,
  ``,
  `These may not fire in the live product scope without a staffed manual-review workflow (schema §7).`,
  ``,
);
for (const r of catalogue.rules.filter((r) => r.severity >= 4 && r.validation_status !== "validated")) {
  lines.push(`- **${r.rule_id}** (${r.validation_status}, owner: ${r.validation_owner ?? "unassigned"}) — ${esc(r.name)}`);
}
lines.push("");

writeFileSync(join(here, "..", "RULES.md"), lines.join("\n"));
console.log(`RULES.md generated: ${catalogue.rules.length} rules`);
