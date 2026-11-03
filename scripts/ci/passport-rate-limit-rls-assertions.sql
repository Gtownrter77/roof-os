do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_access_rate_limits'
      and policyname = 'deny_client_roles'
      and cmd = 'ALL'
      and roles @> array['anon'::name, 'authenticated'::name]
      and trim(both '()' from coalesce(qual, '')) = 'false'
      and trim(both '()' from coalesce(with_check, '')) = 'false'
  ) then
    raise exception 'Explicit deny policy for anon/authenticated rate-limit access is missing';
  end if;
end
$$;

select 'rate-limit client roles are explicitly denied by RLS' as result;
