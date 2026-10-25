-- Fixed-window rate limiting for the public, token-gated passport endpoint.
-- The table is service-role only: RLS is enabled with no policies, and the
-- SECURITY DEFINER function is executable only by service_role.

create table if not exists public.public_access_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.public_access_rate_limits enable row level security;

create index if not exists public_access_rate_limits_window_idx
  on public.public_access_rate_limits (window_start);

create or replace function public.consume_public_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_bucket is null or length(p_bucket) = 0 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.public_access_rate_limits (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
  do update set hits = public.public_access_rate_limits.hits + 1
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_public_rate_limit(text, integer, integer) from public;
revoke all on function public.consume_public_rate_limit(text, integer, integer) from anon, authenticated;
grant execute on function public.consume_public_rate_limit(text, integer, integer) to service_role;
