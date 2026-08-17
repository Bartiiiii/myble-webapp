-- ─────────────────────────────────────────────────────────────────────────────
-- Account-owned designs (My Account → My Designs).
--
-- `designs` already stores the right shape for a saved design (slug, full
-- Design JSON, locale) — it just has no owner today, since it was built only
-- for anonymous share links. This adds ownership without a new table: a
-- design saved to an account is the SAME row as a shared design when the two
-- coincide (saving a design opened from a share link claims that row rather
-- than duplicating it).
--
-- user_email is always lowercased/trimmed before write and query, matching
-- the ADMIN_EMAIL / newsletter_subscribers convention elsewhere in this repo.
-- null user_email = still an anonymous share, unaffected by this migration.
--
-- No RLS policy changes: the table is already deny-all + service-role-only
-- (see 0002_newsletter_contact_designs.sql), and every /api/account/* route
-- reads the owner from the NextAuth session server-side, never from the
-- client, so there is no auth.uid() dependency to add.
--
-- Apply via the Supabase SQL Editor or MCP connector. Idempotent — safe to
-- re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.designs add column if not exists user_email text;
alter table public.designs add column if not exists name text;

create index if not exists designs_user_email_idx on public.designs (user_email);
