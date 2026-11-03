-- Keep the public passport rate-limit ledger private to server-side code.
-- The public endpoint calls the RPC with the service-role client; clients do
-- not need direct table or function privileges.
begin;

alter function public.consume_public_rate_limit(text, integer, integer)
  set search_path = '';

revoke all on function public.consume_public_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_rate_limit(text, integer, integer)
  to service_role;

revoke all on table public.public_access_rate_limits
  from public, anon, authenticated;
grant all on table public.public_access_rate_limits
  to service_role;

commit;
