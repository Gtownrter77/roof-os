do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not (coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[])
  ) then
    raise exception 'A public SECURITY DEFINER function still has a mutable/non-empty search_path';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'An anonymous role can execute a public SECURITY DEFINER function';
  end if;
end
$$;

select count(*) as hardened_public_security_definer_functions
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[];
