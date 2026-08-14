-- ─────────────────────────────────────────────────────────────────────────────
-- Orders + consent persistence for the Myble checkout.
--
-- Backs the B4 (consent record) and B5 (durable-medium confirmation) obligations
-- previously stubbed in app/api/order/route.ts. One row per placed order holds:
--   • the customer contact + CZ delivery address,
--   • a snapshot of the ordered product spec and prices,
--   • the B4 consent proof — which document VERSIONS were accepted and when,
--     plus the §1837 custom-withdrawal acknowledgement,
--   • a light audit trail (IP / user-agent).
--
-- RLS is enabled with NO policies, so the public anon/publishable key can neither
-- read nor write. Only the service-role key (used server-side in /api/order)
-- reaches this table — the service role bypasses RLS by design.
--
-- Apply via the Supabase SQL Editor (Dashboard → SQL Editor → New query) or the
-- Supabase CLI (`supabase db push`).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id                                       uuid primary key default gen_random_uuid(),
  order_no                                 text not null unique,
  created_at                               timestamptz not null default now(),
  locale                                   text not null,
  status                                   text not null default 'received',

  -- Customer contact
  first_name                               text,
  last_name                                text,
  email                                    text,
  phone                                    text,

  -- Delivery address (CZ-only at MVP, see order form B7)
  street                                   text,
  city                                     text,
  zip                                      text,
  country                                  text not null default 'CZ',
  delivery_method                          text,

  -- Ordered product snapshot
  design_spec                              jsonb not null default '{}'::jsonb,
  kit_price_czk                            integer,
  total_price_czk                          integer,

  -- B4 consent proof
  accepted_at                              timestamptz not null,
  accepted_doc_versions                    jsonb not null,
  acknowledged_custom_withdrawal_exclusion boolean not null default false,
  custom_specification                     jsonb,

  -- Audit
  ip                                       text,
  user_agent                               text
);

create index if not exists orders_order_no_idx   on public.orders (order_no);
create index if not exists orders_created_at_idx  on public.orders (created_at desc);

-- Deny-all for anon/authenticated; service_role bypasses RLS.
alter table public.orders enable row level security;
