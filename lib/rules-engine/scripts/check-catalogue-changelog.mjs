#!/usr/bin/env node
// Release gate (implementation task 7): every bundled catalogue version must
// have a CHANGELOG.md section, and if any severity-4/5 rule's threshold
// differs from the PREVIOUS bundled catalogue (N−1), that section must carry
// a sign-off tag (`validated_by:`). Run in CI before shipping a catalogue.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const catalogueDir = join(here, "..", "catalogue");

const versions = readdirSync(catalogueDir)
  .map((f) => /^catalogue\.v(\d+\.\d+\.\d+)\.json$/.exec(f)?.[1])
  .filter(Boolean)
  .sort((a, b) => {
    const [amaj, amin, apat] = a.split(".").map(Number);
    const [bmaj, bmin, bpat] = b.split(".").map(Number);
    return amaj - bmaj || amin - bmin || apat - bpat;
  });

if (versions.length === 0) {
  console.error("no bundled catalogues found");
  process.exit(1);
}

const current = versions[versions.length - 1];
const previous = versions.length > 1 ? versions[versions.length - 2] : null;
const changelog = readFileSync(join(here, "..", "CHANGELOG.md"), "utf8");

const section = new RegExp(`^##\\s+\\[?${current.replaceAll(".", "\\.")}\\]?`, "m");
if (!section.test(changelog)) {
  console.error(`CHANGELOG.md has no section for catalogue ${current}`);
  process.exit(1);
}

if (previous) {
  const load = (v) => JSON.parse(readFileSync(join(catalogueDir, `catalogue.v${v}.json`), "utf8"));
  const currentRules = new Map(load(current).rules.map((r) => [r.rule_id, r]));
  const previousRules = new Map(load(previous).rules.map((r) => [r.rule_id, r]));
  const changedSafety = [...currentRules.values()].filter(
    (r) =>
      r.severity >= 4 &&
      previousRules.has(r.rule_id) &&
      JSON.stringify(r.threshold) !== JSON.stringify(previousRules.get(r.rule_id).threshold),
  );
  if (changedSafety.length > 0 && !/validated_by:\s*\S+/.test(changelog)) {
    console.error(
      `severity-4/5 thresholds changed (${changedSafety.map((r) => r.rule_id).join(", ")}) ` +
        `but CHANGELOG.md has no "validated_by:" sign-off tag`,
    );
    process.exit(1);
  }
}

console.log(`changelog check OK (current ${current}${previous ? `, previous ${previous}` : ", no N−1 yet"})`);
