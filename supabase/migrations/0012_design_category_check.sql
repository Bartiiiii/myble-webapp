-- Library categories: the check that keeps designs.category to the list the
-- library knows (lib/library.ts → CATEGORIES, minus the "all" pseudo-category).
--
-- The rebuilt library adds two categories (nightstands, hallway) and keeps the
-- ids of the first list where the meaning carried over (tables is now coffee &
-- side tables, media TV & music, office desks & office, storage modular &
-- storage, pets pets & plants), so no published row has to move. Until now the
-- column had no check at all; /api/community/submit filters to the list and
-- falls back to 'shelves'. This makes the database agree with it.
--
-- A value outside the list (from before the API filtered) is re-filed under
-- 'other', and the old value is kept in category_custom (0008) for backstage,
-- unless the designer had already named a type there.
--
-- Not applied by the library rebuild: run it in the Supabase SQL Editor when
-- the code that ships the new list is live. Idempotent, safe to re-run.

update public.designs
   set category_custom = coalesce(category_custom, category),
       category = 'other'
 where category is not null
   and category not in ('shelves', 'tables', 'nightstands', 'media', 'office', 'hallway', 'storage', 'pets', 'other');

alter table public.designs drop constraint if exists designs_category_check;
alter table public.designs add constraint designs_category_check
  check (category is null
         or category in ('shelves', 'tables', 'nightstands', 'media', 'office', 'hallway', 'storage', 'pets', 'other'));
