do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype = 'trigger'::regtype
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or not (coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[])
      )
  ) then
    raise exception 'SECURITY DEFINER trigger privilege/search_path hardening failed';
  end if;

  if to_regprocedure('public.is_estimate_admin(uuid)') is not null then
    if has_function_privilege('anon', 'public.is_estimate_admin(uuid)'::regprocedure, 'EXECUTE') then
      raise exception 'is_estimate_admin must not be executable by anon';
    end if;

    if not has_function_privilege('authenticated', 'public.is_estimate_admin(uuid)'::regprocedure, 'EXECUTE') then
      raise exception 'authenticated RLS policies must retain is_estimate_admin access';
    end if;
  end if;
end
$$;

select 'SECURITY DEFINER trigger privileges and search_path verified' as result;
