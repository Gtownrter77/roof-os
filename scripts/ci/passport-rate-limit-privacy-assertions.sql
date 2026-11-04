do $$
declare
  v_function regprocedure := 'public.consume_public_rate_limit(text,integer,integer)'::regprocedure;
begin
  if has_function_privilege('anon', v_function, 'EXECUTE')
     or has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'Public passport rate-limit RPC must not be directly executable by client roles';
  end if;
  if not has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception 'service_role must retain public passport rate-limit RPC execution';
  end if;

  if has_table_privilege('anon', 'public.public_access_rate_limits', 'select')
     or has_table_privilege('anon', 'public.public_access_rate_limits', 'insert')
     or has_table_privilege('authenticated', 'public.public_access_rate_limits', 'select')
     or has_table_privilege('authenticated', 'public.public_access_rate_limits', 'insert') then
    raise exception 'Public passport rate-limit table must not be directly accessible to client roles';
  end if;
  if not has_table_privilege('service_role', 'public.public_access_rate_limits', 'select')
     or not has_table_privilege('service_role', 'public.public_access_rate_limits', 'insert')
     or not has_table_privilege('service_role', 'public.public_access_rate_limits', 'update') then
    raise exception 'service_role must retain rate-limit table access';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid = v_function
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[]
  ) then
    raise exception 'Rate-limit SECURITY DEFINER function must use an empty search_path';
  end if;
end
$$;

begin;
set local role service_role;
select public.consume_public_rate_limit('ci-rollback-bucket', 1, 60);
rollback;

select 'public passport rate-limit storage is service-role-only and RPC remains functional' as result;
