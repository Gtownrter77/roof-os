-- Retailer pricing quota hardening.
-- Browser callers may request a reservation, but they cannot choose a different
-- billing month or raise the workspace/provider monthly quota.
begin;

create or replace function public.reserve_retailer_price_query(
  p_workspace_id uuid,
  p_provider text,
  p_query_month date,
  p_monthly_limit integer default 100
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  reserved boolean;
  effective_month date := date_trunc('month', now() at time zone 'UTC')::date;
  effective_limit integer := 100;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.is_workspace_admin(p_workspace_id) then
    raise exception 'workspace admin required';
  end if;
  if p_provider not in ('home_depot', 'lowes') then
    raise exception 'unsupported retailer provider';
  end if;
  if p_query_month is distinct from effective_month then
    raise exception 'query month must be the current UTC month';
  end if;
  if p_monthly_limit is distinct from effective_limit then
    raise exception 'monthly limit is fixed at 100';
  end if;

  insert into public.retailer_price_queries
    (workspace_id, provider, query_month, request_count, monthly_limit)
  values
    (p_workspace_id, p_provider, effective_month, 1, effective_limit)
  on conflict (workspace_id, provider, query_month)
  do update
    set request_count = retailer_price_queries.request_count + 1,
        monthly_limit = effective_limit,
        updated_at = now()
  where retailer_price_queries.request_count < effective_limit
  returning true into reserved;

  return coalesce(reserved, false);
end;
$function$;

create or replace function public.reserve_retailer_price_query_worker(
  p_workspace_id uuid,
  p_provider text,
  p_query_month date,
  p_monthly_limit integer default 100
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  reserved boolean;
  effective_month date := date_trunc('month', now() at time zone 'UTC')::date;
  effective_limit integer := 100;
begin
  if p_provider not in ('home_depot', 'lowes') then
    raise exception 'unsupported retailer provider';
  end if;
  if p_query_month is distinct from effective_month then
    raise exception 'query month must be the current UTC month';
  end if;
  if p_monthly_limit is distinct from effective_limit then
    raise exception 'monthly limit is fixed at 100';
  end if;

  insert into public.retailer_price_queries
    (workspace_id, provider, query_month, request_count, monthly_limit)
  values
    (p_workspace_id, p_provider, effective_month, 1, effective_limit)
  on conflict (workspace_id, provider, query_month)
  do update
    set request_count = retailer_price_queries.request_count + 1,
        monthly_limit = effective_limit,
        updated_at = now()
  where retailer_price_queries.request_count < effective_limit
  returning true into reserved;

  return coalesce(reserved, false);
end;
$function$;

revoke all on function public.reserve_retailer_price_query(uuid, text, date, integer) from public, anon;
grant execute on function public.reserve_retailer_price_query(uuid, text, date, integer) to authenticated;

revoke all on function public.reserve_retailer_price_query_worker(uuid, text, date, integer) from public, anon, authenticated;
grant execute on function public.reserve_retailer_price_query_worker(uuid, text, date, integer) to service_role;

commit;
