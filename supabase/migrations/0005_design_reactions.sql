-- 🔥 reactions on Design Library pieces.
--
-- One row per design, holding a running counter. Writes go exclusively through
-- /api/reactions (service role), which validates the design id against the
-- curated LIBRARY allowlist — so this table can never accumulate junk rows.
--
-- RLS is enabled with NO policies: deny-all for anon/authenticated, while the
-- service-role key bypasses RLS. Same posture as orders/designs/newsletter.

create table if not exists public.design_reactions (
  design_id  text primary key,
  fire_count integer not null default 0 check (fire_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.design_reactions enable row level security;

-- Atomic increment/decrement. Doing this in SQL (rather than read-modify-write
-- in the route) keeps concurrent taps from clobbering each other, and the
-- greatest(0, …) guard means an un-react can never drive a counter negative.
create or replace function public.bump_design_fire(p_design_id text, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.design_reactions as dr (design_id, fire_count, updated_at)
  values (p_design_id, greatest(0, p_delta), now())
  on conflict (design_id) do update
    set fire_count = greatest(0, dr.fire_count + p_delta),
        updated_at = now()
  returning dr.fire_count into v_count;

  return v_count;
end;
$$;

revoke all on function public.bump_design_fire(text, integer) from public, anon, authenticated;
