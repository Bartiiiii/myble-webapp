# Myble Rules Engine v1

Deterministic validation core for the Myble 3D furniture configurator
(made-to-measure flat-pack furniture, 18/36 mm laminated particleboard, CZ
market). Implements `Myble_Rules_Schema_v1.md` against the bundled catalogue
(current: `catalogue/catalogue.v1.1.0.json`).

Lives in `lib/rules-engine/` so it typechecks and tests with the existing repo
tooling and imports cleanly in both the Next.js backend and a browser Web
Worker. It has **zero dependencies** (own SHA-256, own canonical JSON) and can
be extracted to an `@myble/rules-engine` workspace package unchanged.

## Sales-first severity policy (v1.1.0, `MYBLE-POLICY-2026-07-20`)

Blocking a sale is reserved for designs Myble physically **cannot make, ship or
assemble**, plus stability safety. Everything else — quality, durability,
appearance — is an **"Order anyway" recommendation**, surfaced with our expert
tip and a one-click fix, and recorded with the order when the customer proceeds.

- **Severity 4 (blocks the order)** only for: manufacturability impossibilities
  (part > sheet, below the absolute machinable floor, infeasible drilling /
  geometry), shipping impossibilities (no carrier fits), assembly
  impossibilities (trapped parts / no tool access), and a unit that tips while
  standing **empty**.
- **Severity 3 (advisory acknowledgement)** for quality/durability limits
  (shelf span & sag, desk span, hinge/runner soft limits, open-back bracing,
  wall anchoring). Never blocks; the customer confirms "Order anyway".
- **Per-finding softening**: a single rule can keep a severity-4 ceiling for the
  genuine impossibility yet `advisory()` the recoverable case (e.g. MFG-MIN-001
  blocks below the physical floor, advises below the unvalidated edgebander
  minimum; CONN-HINGE-004 blocks a door beyond any hinge SKU, advises a hinge
  count shortfall). Overrides can only **soften**, never escalate.
- **Unvalidated numbers never hard-block** (policy point 5): a `threshold: null`
  / `requires_validation` limit produces an advisory (≤ sev 3), not a review
  gate. `REQUIRES_VALIDATION_BLOCKED` is now reserved for engine-integrity
  failures only (missing evaluator, evaluator exception).
- **Tall units are anchored, not blocked**: `STAB-ANCHOR-002` auto-adds the
  wall-anchor kit to the BOM and asks for an acknowledgement.

## Live configurator integration

```
adapter.ts            cm Design (lib/model) → engine DesignModel (roles from
                      axis+position, shelf spans from supporting verticals,
                      standard joinery, 18/36 mm material, part ids preserved)
myble-profile.ts      Myble's partner/carrier profile (unconfirmed caps = null
                      ⇒ advise, never block)
configurator.ts       validateConfiguratorDesign() facade → UiReport (localized
                      messages, acknowledgements, patches, `orderable`) +
                      revalidateForOrder() for server-side replay
worker/validation.worker.ts   runs the engine off the main thread
useRulesValidation.ts  React hook: Web Worker + debounce + main-thread fallback
```

UI: `components/RulesFindings.tsx` (status chip + grouped recommendations,
hover-to-highlight parts) on `/design`; `/order` collects the severity-3
"Order anyway" acknowledgements; `app/api/order/route.ts` re-validates
server-side (stage `design` — order-pipeline invariants run post-order), blocks
only genuine impossibilities, and stores the full report + catalogue version +
acknowledgements in `orders.rules_*` (migration `0004_order_rules_validation`).

The existing hardcoded configurator limits (20–120 cm, etc.) stay as-is; engine
findings inside that envelope are advisory. Pricing is untouched.

## Non-negotiable principles

1. **Determinism** — same design + same catalogue version + same partner
   profile ⇒ byte-identical `ValidationReport`. No randomness, no clocks, no
   LLM calls (`UX-AI-003` is recorded in every audit trail).
2. **No invented thresholds** — `threshold: null` values from the catalogue are
   never filled in code. Named provisional constants live ONLY in
   [constants.ts](constants.ts) and are documented as such.
3. **Fail closed** — unknown category/material, missing input, unknown partner
   capability or an evaluator exception all produce `VIOLATED` or
   `REQUIRES_VALIDATION_BLOCKED`, never a silent pass.
4. **Auditability** — every finding carries `inputs_hash` (SHA-256 of the exact
   values read); `toAuditRecords(report)` yields the §6.3 records to persist.
5. **AI is presentation-layer only** — nothing in this package calls or is
   callable by an LLM to change a verdict.

## Layout

```
catalogue/            versioned catalogue JSONs (N and N−1 bundled)
types.ts              catalogue types (schema §2–§4)
design.ts             DesignModel (§5) + hostile-input sanitisation (§11)
report.ts             findings, reports, health statuses (§3, §8)
loader.ts             catalogue validation + unvalidated-safety-rule surface
engine.ts             orchestration: validate / validateIncremental / memo
context.ts            evaluator contract (pure fns, ctx with prior findings)
evaluators/<RULE>.ts  one file per rule, 1:1 with the catalogue (CI-enforced)
calc/                 deflection, mass, tipping, packaging (unit-tested)
health.ts             §8 aggregation with exact precedence
messages.ts           {placeholder} templates, cs→en fallback with warning
acknowledgements.ts   severity-3 ack store contract, hash-based invalidation
fixes.ts              propose(design, report) → DesignPatch[] (auto_correct)
constraints.ts        getValidRange() slider clamps / 32 mm snapping
incremental.ts        static input→rules index for validateIncremental
profiles.ts           partner & carrier profiles (null = unknown = fail closed)
scripts/              RULES.md generator + catalogue changelog CI gate
```

## Usage

```ts
import rawCatalogue from "@/lib/rules-engine/catalogue/catalogue.v1.0.0.json";
import { createEngine } from "@/lib/rules-engine";

const engine = createEngine(rawCatalogue, { partner: myPartnerProfile });

// Checkout (authoritative — server side, never trust the client report):
const report = engine.validate(design, { stage: "order", order: orderCtx });
if (report.health === "UNSAFE" || report.health === "CANNOT_MANUFACTURE") block();
if (report.health === "REQUIRES_REVIEW") routeToReviewQueue();
if (report.unacknowledged.length > 0) demandAcknowledgements();

// Configurator (Web Worker, per committed edit):
const next = engine.validateIncremental(design, ["shelves"], previousReport);

// Input-layer prevention (sliders/snapping — better than post-hoc errors):
engine.getValidRange({ kind: "shelf_span" });        // { min: 160, max: 900 }
engine.getValidRange({ kind: "shelf_position", unit_height_mm: h }); // snap 32

// Auto-corrections (apply through the normal edit pipeline + notify):
const patches = engine.proposeFixes(design, report);
```

Design-stage runs are memoised by `(design_hash, rule_id)`; a full run over 55
rules on a fixture design takes ~1 ms in vitest — far inside the 30 ms p95
incremental / 200 ms full budgets.

## Judgment calls & §7 policy (read before extending)

- **Stage order** follows schema §6.2 (`connection`/`frameless_system` before
  `structural`), not the catalogue's file order.
- **Null thresholds on severity ≥ 4 rules** (§7): the affected check returns
  `REQUIRES_VALIDATION_BLOCKED`, which health-maps to `REQUIRES_REVIEW` — or to
  `REQUIRES_WALL_ANCHOR` when the finding is anchor-flavoured and the kit is
  present (`STAB-CALC-003` loaded margin). Consequences today:
  - every freestanding unit ≥ 600 mm ⇒ anchor-required or review until
    `margin_min_loaded` is validated;
  - open-back shelving ⇒ review until the rail-width minimum is validated;
  - designs with an HDF back ⇒ review (HDF has **no density data**, so shipping
    mass fails closed). This is intentional: the catalogue is DRAFT and says so.
- **`CONN-SYS-001`** has `threshold: null` but its spec is enumerated in the
  rule text; connector counts are encoded as provisional constants and checked
  normally rather than blocking every design.
- **Health mapping** for severity-4 violations: `structural|stability` ⇒
  `UNSAFE`; every other category ⇒ `CANNOT_MANUFACTURE` (§8 names only
  manufacturing/shipping, but a scope/material/assembly severity-4 violation is
  by definition not manufacturable).
- **Order-pipeline rules** (`MFG-LABEL-006`, `ASM-INSTR-006`, `SHIP-PROT-003`,
  `UX-CONF-002`) are not expressible on a `DesignModel`; they report
  `NOT_APPLICABLE` at design stage and enforce against `OrderContext` at
  `stage: "order"`.
- **Tipping monotonicity**: the static screening model has no EN top-edge test
  force, so taller units are not automatically worse — see the note in
  [property.test.ts](property.test.ts).
- **Geometry/assembly checks** (`STRUCT-GEOM-009`, `ASM-SEQ-001`, `ASM-TOOL-002`)
  are declarative screenings on the model graph, not solid-body simulation; the
  configurator's 3D layer remains responsible for exact collision geometry.

## Known limitations / next steps

- The webapp's cm-based `lib/model.ts` design needs an adapter to `DesignModel`
  (not built yet — the current configurator predates this engine).
- Web Worker + checkout API wiring (tasks 9/10) is documented above but not yet
  wired into `app/`; do it behind a flag so prod behaviour is unchanged.
- `SHIP-ECON-004`'s price-ratio notice needs quote data (`lib/quote.ts`) and
  lives in the configurator layer.
- Czech `user_message` translations: mechanism ready (`locales/cs.ts`), strings
  pending a native speaker.
- Reviewer queue/waiver storage (task 8) is a backend feature; the engine
  provides finding hashes (`inputs_hash`) for waivers to reference.

## Testing

`npm test` runs everything (112 engine tests):
conformance (registry 1:1, every severity-4/5 rule has a VIOLATED case),
calc fixtures (hand-computed 800×300×18 shelf ⇒ δ = 4.37 mm), engine behaviour
(determinism, fail-closed, ack invalidation, incremental-vs-full agreement),
property tests (300 seeded random designs never throw), and a frozen golden
corpus (`UPDATE_GOLDEN=1` to regenerate intentionally).

CI extras: `node lib/rules-engine/scripts/generate-rules-reference.mjs` (diff
RULES.md) and `node lib/rules-engine/scripts/check-catalogue-changelog.mjs`
(blocks severity-4/5 threshold changes without `validated_by:` sign-off).
