-- All SECURITY DEFINER functions in public use a closed search path.
-- Keep their existing EXECUTE grants unchanged: workspace/RLS helpers and
-- authenticated approval RPCs are intentionally callable by authenticated users.
begin;

do $$
declare
  fn record;
  signature text;
begin
  for fn in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not (coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[])
  loop
    signature := format('%I.%I(%s)', fn.nspname, fn.proname, fn.identity_args);
    execute format('ALTER FUNCTION %s SET search_path = %L', signature, '');
  end loop;
end;
$$;

commit;
