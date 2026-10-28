-- Promotions: refer-a-friend codes, vouchers and the myble+ points ledger.
--
-- Everything is keyed on the normalised (lowercased, trimmed) e-mail, the same
-- convention orders, newsletter_subscribers and account pages already use:
-- orders are guest checkouts, so an e-mail is the only identity every order has.
--
-- Same access model as the other tables: RLS on, no policies, so only the
-- service role (API routes, lib/rewards.ts) can read or write.

-- One shareable code per customer. Created lazily the first time someone opens
-- their referral panel.
create table if not exists public.referral_codes (
  code        text primary key,
  owner_email text not null unique,
  created_at  timestamptz not null default now()
);

-- Single-use money-off codes owned by one e-mail. Issued as a referral reward
-- (when a referred friend's order is confirmed) or bought with myble+ points.
-- `redeemed_order_no` is set atomically when an order uses it, so a voucher can
-- never be spent twice.
create table if not exists public.vouchers (
  code              text primary key,
  email             text not null,
  amount_czk        integer not null check (amount_czk > 0),
  min_kit_czk       integer not null default 0,
  source            text not null check (source in ('referral_reward', 'loyalty')),
  source_ref        text not null,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz,
  redeemed_order_no text,
  redeemed_at       timestamptz,
  unique (source, source_ref)
);
create index if not exists vouchers_email_idx on public.vouchers (email);

-- myble+ points as an append-only ledger: the balance is sum(points). The
-- (reason, ref) key makes every award idempotent: confirming the same order
-- twice, or approving the same design twice, cannot pay out twice.
create table if not exists public.loyalty_ledger (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  points     integer not null,
  reason     text not null check (reason in ('order', 'order_reversal', 'design_published', 'redeem')),
  ref        text not null,
  created_at timestamptz not null default now(),
  unique (reason, ref)
);
create index if not exists loyalty_ledger_email_idx on public.loyalty_ledger (email);

-- What an order was discounted by. `discount_czk` is server-validated before it
-- is written, so the payment step can trust it when it recomputes the price.
alter table public.orders
  add column if not exists discount_code  text,
  add column if not exists discount_kind  text check (discount_kind in ('referral', 'voucher')),
  add column if not exists discount_czk   integer not null default 0,
  add column if not exists referrer_email text;

-- Points → voucher, atomically. The advisory lock serialises redemptions per
-- e-mail, so a double click cannot spend the same balance twice.
create or replace function public.redeem_loyalty_points(
  p_email      text,
  p_points     integer,
  p_amount_czk integer,
  p_min_kit    integer,
  p_code       text,
  p_expires_at timestamptz
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  perform pg_advisory_xact_lock(hashtext('loyalty:' || p_email));
  select coalesce(sum(points), 0) into v_balance from loyalty_ledger where email = p_email;
  if v_balance < p_points then
    return null;
  end if;
  insert into vouchers (code, email, amount_czk, min_kit_czk, source, source_ref, expires_at)
    values (p_code, p_email, p_amount_czk, p_min_kit, 'loyalty', p_code, p_expires_at);
  insert into loyalty_ledger (email, points, reason, ref)
    values (p_email, -p_points, 'redeem', p_code);
  return p_code;
end;
$$;

revoke all on function public.redeem_loyalty_points(text, integer, integer, integer, text, timestamptz) from public, anon, authenticated;

alter table public.referral_codes enable row level security;
alter table public.vouchers enable row level security;
alter table public.loyalty_ledger enable row level security;
