-- ─────────────────────────────────────────────────────────────────────────────
-- Wave 3: the community layer behind the Design Library.
--
--   • profiles       — one row per person who has ever signed in, plus the
--                      seeded "house" designers the curated library is
--                      credited to. Drives /u/<handle>, the backstage Users
--                      section, and the author chip on every card.
--   • follows        — follower graph (follower → following), one row per pair.
--   • design_fires   — 🔥 LEDGER, one row per (design, reactor). This replaces
--                      the free-running counter in 0005: the count is now
--                      derived from rows, and the primary key makes a second
--                      🔥 from the same person a no-op instead of a +1. That
--                      is the actual fix for "spamming makes it go up forever"
--                      — the old counter trusted the client's ±1, this one
--                      cannot be inflated no matter what the client sends.
--   • designs (+)    — sharing to the library: share_status lifecycle
--                      (private → pending → published / rejected), title,
--                      category and review metadata, so nothing reaches the
--                      public library before it is approved in backstage.
--
-- Access model is unchanged: RLS enabled with NO policies (deny-all for anon
-- and authenticated), every read/write goes through a server route using the
-- service-role key. NextAuth owns identity, so auth.uid() is never available;
-- profiles are keyed by the same normalized (lowercased/trimmed) e-mail used
-- by orders / newsletter_subscribers / designs.user_email.
--
-- Apply via the Supabase SQL Editor. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── Profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  -- null only for seeded designers that were never real sign-ins.
  email         text unique,
  -- URL identity: /u/<handle>. Lowercase, [a-z0-9_-], 2–24 chars.
  handle        text not null unique,
  display_name  text not null,
  -- Google profile photo (or any https URL). Null → the initials avatar,
  -- coloured by avatar_color, which needs no external request to render.
  avatar_url    text,
  avatar_color  smallint not null default 0 check (avatar_color between 0 and 7),
  bio           text,
  -- Seeded house designers: shown in the library and in backstage, but they
  -- never sign in. Kept distinguishable so real user counts stay honest.
  is_seed       boolean not null default false,
  -- Null until the person has confirmed their name + avatar on first sign-in.
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

alter table public.profiles enable row level security;

-- ── Follows ──────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  -- Nobody follows themselves; the follow button hides for your own profile,
  -- and this makes that true even if the API is called directly.
  constraint follows_not_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

-- ── 🔥 ledger ────────────────────────────────────────────────────────────────
-- reactor_key is 'u:<email>' for a signed-in person, 'a:<uuid>' for an
-- anonymous visitor (a server-set httpOnly cookie — the browser cannot forge
-- or clear it from JS the way it could the old localStorage marker).
create table if not exists public.design_fires (
  design_id   text not null,
  reactor_key text not null,
  created_at  timestamptz not null default now(),
  primary key (design_id, reactor_key)
);

create index if not exists design_fires_design_idx on public.design_fires (design_id);

alter table public.design_fires enable row level security;

-- Set (or clear) one person's 🔥 on one design and return the authoritative
-- count. Idempotent in both directions: firing twice inserts once, un-firing
-- something you never fired deletes nothing. The client can hammer this and
-- the number will not move past 1 per reactor.
create or replace function public.set_design_fire(
  p_design_id text,
  p_reactor_key text,
  p_on boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_on then
    insert into public.design_fires (design_id, reactor_key)
    values (p_design_id, p_reactor_key)
    on conflict (design_id, reactor_key) do nothing;
  else
    delete from public.design_fires
    where design_id = p_design_id and reactor_key = p_reactor_key;
  end if;

  select count(*)::integer into v_count
  from public.design_fires
  where design_id = p_design_id;

  return v_count;
end;
$$;

revoke all on function public.set_design_fire(text, text, boolean) from public, anon, authenticated;

-- Every design's 🔥 count in one round trip (the library grid needs them all).
create or replace function public.design_fire_counts()
returns table (design_id text, fire_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select design_id, count(*)::integer as fire_count
  from public.design_fires
  group by design_id;
$$;

revoke all on function public.design_fire_counts() from public, anon, authenticated;

-- Carry the old counters over so nothing visibly resets on deploy. Each
-- historical count becomes that many synthetic ledger rows ('legacy:<n>'),
-- which keeps the number while giving every future tap a real identity.
insert into public.design_fires (design_id, reactor_key)
select dr.design_id, 'legacy:' || g.i
from public.design_reactions dr
cross join lateral generate_series(1, dr.fire_count) as g(i)
where dr.fire_count > 0
on conflict do nothing;

-- ── Designs: sharing to the library ──────────────────────────────────────────
alter table public.designs add column if not exists share_status text not null default 'private';
alter table public.designs add column if not exists title text;
alter table public.designs add column if not exists category text;
alter table public.designs add column if not exists note text;
alter table public.designs add column if not exists submitted_at timestamptz;
alter table public.designs add column if not exists reviewed_at timestamptz;
alter table public.designs add column if not exists review_note text;

alter table public.designs drop constraint if exists designs_share_status_check;
alter table public.designs add constraint designs_share_status_check
  check (share_status in ('private', 'pending', 'published', 'rejected'));

create index if not exists designs_share_status_idx on public.designs (share_status, submitted_at desc);

-- ── Seeded house designers ───────────────────────────────────────────────────
-- Fixed UUIDs so follows and backstage rows survive a re-run, and so
-- lib/designers.ts (the code-side source for names/avatars/credits) and this
-- table can never disagree about who is who.
insert into public.profiles (id, email, handle, display_name, avatar_color, bio, is_seed, onboarded_at)
values
  ('11111111-1111-4111-8111-000000000001', null, 'myble',   'Myble Studio',    0, 'The house designs. Everything we build to show what the configurator can do.', true, now()),
  ('11111111-1111-4111-8111-000000000002', null, 'tereza',  'Tereza Malá',     1, 'Prague flat, too many books, one very specific alcove.', true, now()),
  ('11111111-1111-4111-8111-000000000003', null, 'kuba',    'Jakub Novák',     2, 'Records, a turntable, and furniture measured around both.', true, now()),
  ('11111111-1111-4111-8111-000000000004', null, 'anna',    'Anna Dvořáková',  3, 'Small rooms, low pieces, nothing that blocks a window.', true, now()),
  ('11111111-1111-4111-8111-000000000005', null, 'martin',  'Martin Kovář',    4, 'Working from a corner of the living room since 2020.', true, now()),
  ('11111111-1111-4111-8111-000000000006', null, 'lucie',   'Lucie Horáková',  5, 'Two cats. Their furniture comes first, apparently.', true, now()),
  ('11111111-1111-4111-8111-000000000007', null, 'petr',    'Petr Beneš',      6, 'Hallways, entryways, and the eternal shoe problem.', true, now())
on conflict (id) do update
  set handle       = excluded.handle,
      display_name = excluded.display_name,
      avatar_color = excluded.avatar_color,
      bio          = excluded.bio,
      is_seed      = excluded.is_seed;
