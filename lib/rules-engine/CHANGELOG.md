# Catalogue changelog

Every bundled catalogue release gets a section here. If a severity-4/5 rule's
threshold changed against the previous bundled version, the section MUST carry
a sign-off line (`validated_by: <owner>`) or CI blocks the release
(`scripts/check-catalogue-changelog.mjs`).

## Engine 1.1.0 — 2026-10-28 (catalogue unchanged, still 1.1.0)

Behaviour changes in the engine and its configurator adapter; no catalogue
threshold changed, so no `validated_by:` sign-off is needed.

- `MAT-THK-001` accepts the 36 mm board (`ltd_36_p2`, added in catalogue 1.1.0
  because the live product ships it) for every board role, and an LTD back or
  rail besides 3 mm HDF. Before, every 36 mm design and every design with a
  z-axis board was a severity-4 CANNOT_MANUFACTURE.
- Adapter: z-axis boards are the piece's own LTD board (that is what
  lib/quote.ts prices and lib/mebleExport.ts orders), not 3 mm HDF. A narrow
  z-board (≤ 25 cm tall, at least twice as wide) is a `rail` and is emitted as
  a brace (`top_rear` / `mid_rear` / `plinth`), so STRUCT-BACK-004 can see
  bracing that is designed in. Every joint is the standard cam + dowel system.
- Facade: findings whose rule has no catalogue message (MFG-EDGE-005 fires on
  every design) get a fallback message from `locales/fallback.ts` instead of
  an empty string.

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
