# Runbook: adding (or changing) a rule

Follow every step — CI enforces most of them.

1. **Catalogue entry** — add the rule to a NEW catalogue version file
   (`catalogue/catalogue.vX.Y.Z.json`, bump semver; keep the previous file —
   the engine bundles N and N−1 for stored-order replay). Fill every §2 field;
   `condition` is documentation only. Unknown limits stay `threshold: null`
   with `validation_status: "requires_validation"` — never guess a number.
2. **Evaluator** — create `evaluators/<RULE-ID>.ts` exporting
   `evaluate: Evaluator`, register it in `evaluators/index.ts`. Pure function;
   read thresholds via `thresholdNum`/`thresholdNumOrNull` (a missing numeric
   threshold must throw or block, not default). Missing inputs ⇒ `blocked(...)`.
3. **Tests** —
   - add at least one case to `__tests__/violated-cases.ts` (mandatory for
     severity ≥ 4 — the conformance test fails otherwise);
   - calc logic gets a hand-computed fixture in `calc.test.ts`;
   - regenerate goldens (`UPDATE_GOLDEN=1 npm test -- golden`) and REVIEW the
     diff — golden drift is the point, unreviewed drift is a bug.
4. **Auto-correct** — only if the catalogue sets `auto_correct: true`: add a
   patch builder in `fixes.ts`. Patches are declarative; the configurator
   applies them through the normal edit pipeline.
5. **Messages** — `user_message.en` with `{placeholders}` matching keys you put
   in `computed`; add the `cs` string to `locales/cs.ts` (native speaker).
6. **Docs & changelog** — regenerate `RULES.md`
   (`node lib/rules-engine/scripts/generate-rules-reference.mjs`); add a
   CHANGELOG section for the new version. If a severity-4/5 threshold changed,
   include `validated_by: <owner>` or CI blocks the release.
7. **Incremental index** — if the rule's `inputs` use vocabulary not yet in
   `incremental.ts` (`PREFIX_GROUPS`/`SPECIAL_INPUT_GROUPS`), map it. Unknown
   vocabulary falls back to "always re-run", which is safe but slow.
8. **Sign-off** — only Myble's validation process (engineer/partner/lab) may
   set `validation_status: "validated"`. Not the implementer, not an AI.
