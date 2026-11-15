-- Defense in depth: fix search_path of the onboarding JSONB validator after migration 093.
-- This alters only function execution metadata; no customer or workspace rows change.
begin;
alter function public.onboarding_jsonb_string_array_is_valid(jsonb, integer, integer, text, text[])
  set search_path = '';
commit;
