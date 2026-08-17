-- ─────────────────────────────────────────────────────────────────────────────
-- Comgate payments, audit log and settlement reconciliation.
--
-- Design notes:
--   • ONE order can have MANY payments. A customer who abandons a bank redirect
--     and retries produces two rows; only one ever reaches 'paid'. Modelling
--     this as a child table (rather than columns on `orders`) also leaves room
--     for a deposit + balance split later without a migration.
--   • Amounts are stored in MINOR UNITS (haléře) as integers, exactly as Comgate
--     sends them. No floats anywhere in the money path.
--   • payment_events is an append-only audit log. Every webhook, every status
--     poll, every refund attempt lands here. This is what you show an acquirer
--     during a dispute, and what you read when a payment "went weird".
--   • RLS: deny-all, same as public.orders. Only the service-role key reaches
--     these tables, from server routes behind requireBackstage() or the webhook.
--
-- Apply via Supabase SQL Editor or `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── payments ────────────────────────────────────────────────────────────────

create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Link to the order. order_no is duplicated because it is what we send to
  -- Comgate as refId, and what comes back on every notification.
  order_id            uuid not null references public.orders(id) on delete restrict,
  order_no            text not null,

  -- Comgate's transaction id. Unique, but nullable for the brief window between
  -- inserting our row and receiving Comgate's response.
  trans_id            text unique,

  -- Our own lifecycle. Deliberately NOT identical to Comgate's four statuses:
  --   created    row exists, Comgate not yet called
  --   pending    payment created, waiting for the payer
  --   authorized funds held (pre-auth mode only), not yet captured
  --   paid       money captured
  --   cancelled  payer abandoned, or we cancelled/expired it
  --   refunded   fully refunded
  --   failed     Comgate rejected creation, or the payment errored
  status              text not null default 'created',

  -- Comgate's own status, stored verbatim for debugging drift.
  comgate_status      text,

  -- Money, in MINOR UNITS.
  amount_minor        integer not null,
  currency            text not null default 'CZK',
  refunded_minor      integer not null default 0,

  -- What the payer actually used, e.g. CARD_CZ_CSOB_2 / BANK_CZ_KB_PSD2 / APPLEPAY.
  -- This column is the whole point of the analysis that chose Comgate: it is how
  -- you find out your real method mix instead of assuming it.
  method              text,
  -- Comgate's fee on the transaction where the tariff exposes it.
  fee_minor           integer,

  is_preauth          boolean not null default false,
  is_test             boolean not null default false,

  -- Payer data returned by Comgate. cardNumber is already masked by them; never
  -- store anything more than the masked value.
  payer_name          text,
  payer_account       text,
  card_number_masked  text,
  variable_symbol     text,

  -- Why a card was declined. Ops-facing only — never render verbatim to a payer.
  error_reason        text,

  -- Timestamps for the funnel: created → redirected → paid.
  redirect_url        text,
  paid_at             timestamptz,
  cancelled_at        timestamptz,
  refunded_at         timestamptz,

  -- Settlement link, filled by the reconciliation job.
  settled_transfer_id text,
  settled_at          timestamptz,

  -- Last full status payload from Comgate.
  last_status_payload jsonb,

  constraint payments_status_check check (
    status in ('created','pending','authorized','paid','cancelled','refunded','failed')
  ),
  constraint payments_amount_positive check (amount_minor > 0),
  constraint payments_refund_within_amount check (refunded_minor between 0 and amount_minor)
);

create index if not exists payments_order_id_idx   on public.payments (order_id);
create index if not exists payments_order_no_idx   on public.payments (order_no);
create index if not exists payments_status_idx     on public.payments (status);
create index if not exists payments_created_at_idx on public.payments (created_at desc);
create index if not exists payments_method_idx     on public.payments (method);

-- At most ONE successful payment per order. This is the database-level guard
-- against double-charging when a webhook and a return-URL sync race each other.
create unique index if not exists payments_one_paid_per_order
  on public.payments (order_id)
  where status in ('paid','authorized');

alter table public.payments enable row level security;

-- ── payment_events (append-only audit log) ──────────────────────────────────

create table if not exists public.payment_events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  payment_id   uuid references public.payments(id) on delete cascade,
  order_no     text,
  trans_id     text,
  -- create | push | status_sync | refund | capture | cancel | error | reconcile
  kind         text not null,
  status_from  text,
  status_to    text,
  -- Raw request/response or webhook body. Never redact — this is the evidence.
  payload      jsonb,
  message      text,
  source_ip    text
);

create index if not exists payment_events_payment_id_idx on public.payment_events (payment_id);
create index if not exists payment_events_trans_id_idx   on public.payment_events (trans_id);
create index if not exists payment_events_created_at_idx on public.payment_events (created_at desc);

alter table public.payment_events enable row level security;

-- ── settlements (Comgate payouts to the bank account) ───────────────────────

create table if not exists public.payment_settlements (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  transfer_id    text not null unique,
  transfer_date  date,
  account        text,
  variable_symbol text,
  -- Full singleTransfer payload — field names vary by tariff.
  detail         jsonb,
  -- Sum of the payments we matched to this transfer, MINOR UNITS.
  matched_minor  integer not null default 0,
  matched_count  integer not null default 0
);

create index if not exists payment_settlements_date_idx on public.payment_settlements (transfer_date desc);

alter table public.payment_settlements enable row level security;

-- ── orders: payment + review columns ────────────────────────────────────────

-- Denormalised payment state so the existing orders list can show it without a
-- join. Kept in sync by lib/payments.ts whenever a payment transitions.
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists paid_at        timestamptz;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists updated_at     timestamptz not null default now();

-- Design review gate. The rules engine already flags designs via
-- validateConfiguratorDesign().needsReview; this is where the human decision
-- lands. An order is only released to meble.pl once review_state = 'approved'.
alter table public.orders add column if not exists review_state text not null default 'pending';
alter table public.orders add column if not exists reviewed_at  timestamptz;
alter table public.orders add column if not exists review_note  text;

do $$ begin
  alter table public.orders add constraint orders_payment_status_check
    check (payment_status in ('unpaid','pending','authorized','paid','refunded','failed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders add constraint orders_review_state_check
    check (review_state in ('pending','approved','rejected'));
exception when duplicate_object then null; end $$;

create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_review_state_idx   on public.orders (review_state);

-- Keep updated_at honest. lib/backstageData.ts already reads it.
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists payments_touch_updated_at on public.payments;
create trigger payments_touch_updated_at before update on public.payments
  for each row execute function public.touch_updated_at();

comment on table  public.payments is 'Comgate payment attempts. One order may have several; at most one paid.';
comment on table  public.payment_events is 'Append-only audit log of every payment interaction — dispute evidence.';
comment on column public.payments.method is 'Comgate method id actually used — the source of truth for real CZ method mix.';
comment on column public.orders.review_state is 'Human design review gate. Production is only released when approved.';
