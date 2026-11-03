-- Harden trigger-only SECURITY DEFINER functions against direct API invocation
-- and mutable search_path resolution. Trigger execution does not require callers
-- to have EXECUTE on the trigger function; PostgreSQL validates this at CREATE TRIGGER.
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
      and p.prorettype = 'trigger'::regtype
  loop
    signature := format('%I.%I(%s)', fn.nspname, fn.proname, fn.identity_args);
    execute format('ALTER FUNCTION %s SET search_path = %L', signature, '');
    execute format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', signature);
  end loop;
end;
$$;

-- This helper is intentionally used by authenticated RLS policies and by
-- server-side guards. It is not an anonymous endpoint. Some isolated migration
-- rehearsals do not install migration 059, so harden it only when it exists.
do $
begin
  if to_regprocedure('public.is_estimate_admin(uuid)') is not null then
    execute format(
      'ALTER FUNCTION %s SET search_path = %L',
      'public.is_estimate_admin(uuid)'::regprocedure,
      ''
    );
    execute format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      'public.is_estimate_admin(uuid)'::regprocedure
    );
    execute format(
      'GRANT EXECUTE ON FUNCTION %s TO authenticated',
      'public.is_estimate_admin(uuid)'::regprocedure
    );
  end if;
end;
$;

commit;
