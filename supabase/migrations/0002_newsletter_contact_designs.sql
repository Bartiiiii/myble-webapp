-- ─────────────────────────────────────────────────────────────────────────────
-- Wave 2 of the datastore: newsletter, contact messages, shareable designs,
-- and orders hardening.
--
-- Access model (same as 0001): NextAuth handles login, so auth.uid() is never
-- available — ALL tables are RLS deny-all and only the server-side service-role
-- key (Next.js API routes) reads/writes. The public publishable key can reach
-- nothing.
--
--  • newsletter_subscribers — footer e-mail capture. E-mail is normalized to
--    lowercase in the API route, so a plain unique constraint suffices. Keeps
--    the GDPR essentials: when/where consent was given, locale, and an
--    unsubscribe token for the (future) one-click unsubscribe link.
--  • contact_messages — messages from the /contact form (replaces mailto-only).
--  • designs — full Design JSON snapshots behind a short share slug, so a
--    customer can send their configuration to a partner or reopen it on
--    another device ("/design?d=<slug>").
--  • orders — add `design` (the FULL parts list; production/cut-list source of
--    truth, previously only in the customer's localStorage), a status-lifecycle
--    CHECK, and an auto-maintained updated_at.
--
-- Apply via the Supabase SQL Editor. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── Newsletter ───────────────────────────────────────────────────────────────
create table if not exists public.newsletter_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  locale            text not null default 'cs',
  source            text not null default 'footer',
  consented_at      timestamptz not null default now(),
  unsubscribed_at   timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid(),
  ip                text,
  user_agent        text,
  created_at        timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- ── Contact messages ─────────────────────────────────────────────────────────
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  message    text not null,
  locale     text not null default 'cs',
  ip         text,
  user_agent text,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

-- ── Shareable designs ────────────────────────────────────────────────────────
create table if not exists public.designs (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  design     jsonb not null,
  locale     text not null default 'cs',
  source     text not null default 'share',
  created_at timestamptz not null default now()
);

alter table public.designs enable row level security;

-- ── Orders hardening ─────────────────────────────────────────────────────────
-- Full Design JSON (parts list) — the production source of truth for the cut
-- list. design_spec keeps the human-readable summary; this keeps the geometry.
alter table public.orders add column if not exists design jsonb;

alter table public.orders add column if not exists updated_at timestamptz not null default now();

-- Status lifecycle guard (dashboard edits included).
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('received', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'));

-- Keep updated_at fresh on every UPDATE (e.g. status changes in the dashboard).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();
