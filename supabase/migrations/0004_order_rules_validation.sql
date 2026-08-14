-- ─────────────────────────────────────────────────────────────────────────────
-- Rules-engine validation record on orders (sales-first policy, 2026-07-20).
--
-- The checkout API re-runs the deterministic rules engine server-side (never
-- trusts the client report) and stores the authoritative result here so every
-- order carries: which catalogue/engine version validated it, the resulting
-- health status, the full ValidationReport (findings + computed values), and
-- the customer's severity-3 "Order anyway" acknowledgements.
--
-- All columns are nullable/defaulted so existing rows and any order placed
-- before this layer are unaffected. RLS is inherited from public.orders
-- (deny-all; the service role writes via the order route).
-- ─────────────────────────────────────────────────────────────────────────────

-- Catalogue + engine versions the order was validated under (pin for replay).
alter table public.orders add column if not exists rules_catalogue_version text;
alter table public.orders add column if not exists rules_engine_version    text;

-- Aggregated health status at order time (VALID … REQUIRES_WALL_ANCHOR …).
alter table public.orders add column if not exists rules_health text;

-- SHA-256 of the canonical design the report was computed from (audit link).
alter table public.orders add column if not exists rules_design_hash text;

-- The full server-side ValidationReport (findings, verdicts, computed values).
alter table public.orders add column if not exists rules_report jsonb;

-- The customer's severity-3 acknowledgements: [{rule_id, message,
-- catalogue_version, inputs_hash, design_hash, acknowledged_at}, …].
alter table public.orders add column if not exists rules_acknowledgements jsonb
  not null default '[]'::jsonb;

-- Set when the server re-validation disagrees with the client (health or new
-- findings) so ops can spot client/rules drift.
alter table public.orders add column if not exists rules_server_revalidated boolean
  not null default false;

comment on column public.orders.rules_report is
  'Authoritative server-side ValidationReport from lib/rules-engine at order creation.';
comment on column public.orders.rules_acknowledgements is
  'Customer severity-3 "Order anyway" acknowledgements recorded with the order.';
