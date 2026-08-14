-- ─────────────────────────────────────────────────────────────────────────────
-- Cookie-consent audit log (B6 — server-side proof of consent).
--
-- Until now the ONLY record of a visitor's cookie choice lived in their own
-- `myble_consent` cookie, on their device. That is enough to DRIVE the trackers
-- but is not durable evidence: if a DPA (or the visitor) asks us to prove what
-- was consented to and when, a cookie we cannot see is worthless. This table is
-- the Cookiebot-equivalent consent log — one immutable row per decision.
--
-- One row is written by /api/consent every time the visitor accepts, rejects,
-- customises, or withdraws. Rows are never updated or deleted, so the full
-- history of a visitor's choices is preserved. `consent_id` is an anonymous,
-- client-generated UUID (stored beside the choice in the cookie) that groups a
-- single browser's successive decisions — it is NOT tied to any account and
-- carries no personal data by itself.
--
-- Access model (same as 0001/0002): RLS enabled with NO policies, so the public
-- anon/publishable key can neither read nor write. Only the service-role key,
-- used server-side in /api/consent, reaches this table.
--
-- Apply via the Supabase SQL Editor (Dashboard → SQL Editor → New query) or the
-- Supabase CLI (`supabase db push`). Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

create table if not exists public.cookie_consents (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- Anonymous per-browser id (client-generated). Groups this visitor's
  -- successive decisions; not linked to any account.
  consent_id      uuid not null,

  -- What was consented to. Essential is always-on and needs no consent, so it
  -- is not recorded here.
  analytics       boolean not null,
  marketing       boolean not null,

  -- Which action produced this record (accept_all / reject_all / save / withdraw).
  -- Informative only — the analytics/marketing booleans are authoritative.
  action          text not null,

  -- Versioning, so we can prove WHICH wording/banner the visitor saw:
  --  • consent_version — schema version of the stored choice (lib/consent.tsx)
  --  • policy_version   — Cookies Policy doc version at the time (lib/legal.ts)
  consent_version integer not null,
  policy_version  text not null,

  -- Which locale the banner was shown in.
  locale          text not null default 'cs',

  -- Light audit trail.
  ip              text,
  user_agent      text
);

create index if not exists cookie_consents_consent_id_idx
  on public.cookie_consents (consent_id);
create index if not exists cookie_consents_created_at_idx
  on public.cookie_consents (created_at desc);

alter table public.cookie_consents enable row level security;
