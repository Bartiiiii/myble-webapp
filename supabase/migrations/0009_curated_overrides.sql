-- Edited versions of the curated (house) library designs.
--
-- The curated pieces are authored in code (lib/library.ts) so they render on
-- first paint without a database. Backstage can now edit one in the
-- configurator and publish an updated version without a deploy: the newest
-- version lives here, keyed by the curated id, and is laid over the code
-- version wherever the library is shown. Deleting a row reverts that piece to
-- the version in code.
--
-- Same access model as the other tables: RLS on, no policies, so only the
-- service role (API routes) can read or write.
create table if not exists public.curated_overrides (
  id          text primary key,
  design      jsonb not null,
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);

alter table public.curated_overrides enable row level security;
