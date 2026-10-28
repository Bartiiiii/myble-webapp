-- Checkout legal copy evidence (2026-10-04).
--
-- The checkout no longer asks for consent ticks: the order button reads
-- "Objednat s povinností platby" (§1826a) and the made-to-measure notice plus the
-- "by placing the order you agree to…" line sit under it as passive text. With
-- no tick to store, the proof of what the customer agreed to is which version
-- of that copy, and of the T&C, was on screen when they ordered.
--
-- Additive and nullable: rows written before this keep their old consent
-- columns (acknowledged_custom_withdrawal_exclusion etc.), which are not dropped.

alter table public.orders
  add column if not exists submitted_at                timestamptz,
  add column if not exists checkout_legal_copy_version text,
  add column if not exists terms_version               text;
