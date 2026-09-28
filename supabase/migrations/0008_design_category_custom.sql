-- "Other" furniture type on community submissions.
--
-- The share dialog's category list ends in "Other"; picking it reveals an
-- optional free-text field where the designer names the type themselves
-- ("wine rack", "plant stand"). The row still files under category = 'other'
-- so the library pills stay a fixed, translatable set; the free text is kept
-- beside it for backstage, as a hint of which categories are missing.
alter table public.designs add column if not exists category_custom text;
