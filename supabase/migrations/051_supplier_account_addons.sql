-- Optional account price add-ons. Home Depot and Lowe's stay valid.
-- Runs after 050 so it is the last provider check.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'retailer_price_queries_provider_check' and conrelid = 'public.retailer_price_queries'::regclass) then
    alter table public.retailer_price_queries drop constraint retailer_price_queries_provider_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'retailer_price_snapshots_provider_check' and conrelid = 'public.retailer_price_snapshots'::regclass) then
    alter table public.retailer_price_snapshots drop constraint retailer_price_snapshots_provider_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'retailer_price_watchlist_provider_check' and conrelid = 'public.retailer_price_watchlist'::regclass) then
    alter table public.retailer_price_watchlist drop constraint retailer_price_watchlist_provider_check;
  end if;
end $$;

alter table public.retailer_price_queries
  add constraint retailer_price_queries_provider_check check (provider in ('home_depot', 'lowes', 'abc', 'srs', 'beacon'));
alter table public.retailer_price_snapshots
  add constraint retailer_price_snapshots_provider_check check (provider in ('home_depot', 'lowes', 'abc', 'srs', 'beacon'));
alter table public.retailer_price_watchlist
  add constraint retailer_price_watchlist_provider_check check (provider in ('home_depot', 'lowes', 'abc', 'srs', 'beacon'));

comment on column public.retailer_price_snapshots.provider is 'Supported providers: home_depot, lowes, and optional abc, srs, and beacon account add-ons.';

-- Keep the server-side quota reservation allowlist aligned with the table constraints.
-- The API routes for ABC, SRS, and Beacon all use this function before calling providers.
create or replace function public.reserve_retailer_price_query(
  p_workspace_id uuid,
  p_provider text,
  p_query_month date,
  p_monthly_limit integer default 100
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
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
  if p_provider is null or p_provider not in ('home_depot', 'lowes', 'abc', 'srs', 'beacon') then
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
