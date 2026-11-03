-- Make the rate-limit table's client-deny posture explicit. service_role
-- bypasses RLS and retains its explicit table grants from migration 076.
begin;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_access_rate_limits'
      and policyname = 'deny_client_roles'
  ) then
    execute 'create policy deny_client_roles on public.public_access_rate_limits for all to anon, authenticated using (false) with check (false)';
  end if;
end;
$$;

comment on policy deny_client_roles on public.public_access_rate_limits
  is 'Explicit deny for client API roles; rate-limit access is server/service-role only.';

commit;
