-- ─────────────────────────────────────────────────────────────────────────────
-- Newsletter system wave 2: Resend sync + unsubscribe hardening.
--
--  • resend_contact_id — the Resend contact created on signup, so unsubscribes
--    and future audience ops can address the contact directly.
--  • unique index on unsubscribe_token — the one-click unsubscribe link looks
--    rows up by token, so the lookup must be indexed (and tokens unique).
--
-- Applied 2026-07-12 via the Supabase MCP connector. Idempotent — safe to
-- re-run from the SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.newsletter_subscribers
  add column if not exists resend_contact_id text;

create unique index if not exists newsletter_subscribers_unsubscribe_token_idx
  on public.newsletter_subscribers (unsubscribe_token);
