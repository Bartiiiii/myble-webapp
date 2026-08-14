# Catalogue changelog

Every bundled catalogue release gets a section here. If a severity-4/5 rule's
threshold changed against the previous bundled version, the section MUST carry
a sign-off line (`validated_by: <owner>`) or CI blocks the release
(`scripts/check-catalogue-changelog.mjs`).

## 1.1.0 — 2026-07-20

Sales-first severity policy (`MYBLE-POLICY-2026-07-20`) + live-configurator
integration. **No rule threshold changed** — this release re-weights severities
and adds materials only, so no `validated_by:` sign-off is required.

- Severity 4 (blocking) is now reserved for physical impossibilities
  (manufacture / ship / assemble) and stability safety. Quality & durability
  limits become severity-3 "Order anyway" acknowledgements with an expert
  recommendation and a one-click fix, recorded with the order.
- Reclassified 4→3: `STRUCT-SHELF-001`, `STRUCT-BACK-003`, `STRUCT-BACK-004`,
  `STRUCT-FIX-006`, `STRUCT-DESK-008`.
- `CONN-HINGE-004`, `CONN-RUNNER-006`, `MFG-MIN-001` keep a severity-4 ceiling
  for the genuine impossibility but softly advise (per-finding override to
  severity 3) on the recoverable case (hinge count, load margin, generic
  edgebander minimum vs the absolute physical floor).
- `STAB-CALC-003` loaded-margin (null threshold) and `STRUCT-BACK-004`
  rail-width (null threshold) no longer route to review: they surface an
  anchor-required / advisory finding instead (policy point 5 — never hard-block
  on unvalidated numbers). `STAB-ANCHOR-002` auto-adds the wall-anchor kit.
- Added material `ltd_36_p2` (the live product ships 36 mm board) with a
  conservative MOE proxy, and a provisional density range for `hdf_back_3` so
  shipping/handling mass is computable instead of failing closed.
- Engine: per-finding `severity_override` (softening only) + `advisory()`
  verdict; `REQUIRES_VALIDATION_BLOCKED` is now reserved for engine-integrity
  failures (missing evaluator / exception), not unvalidated quality thresholds.

## 1.0.0 — 2026-07-19

- Initial catalogue import from `Myble_Rules_Catalogue_v1.json` (research
  deliverable, status DRAFT — pre-validation).
- 55 rules across 10 categories; 2 materials; 7 hardware records.
- No rule in this release is production-approved: every severity ≥ 4 rule with
  `validation_status != validated` fails closed (schema §7) and is listed in
  `RULES.md` under "Unvalidated safety rules".
