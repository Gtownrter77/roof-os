-- Solidify live Home Depot reference pricing without changing product wording.
-- Cache identity includes both ZIP and store so locations cannot cross-pollinate.
alter table public.retailer_price_snapshots
  add column if not exists location_key text generated always as (coalesce(zipcode, '') || ':' || coalesce(store_id, '')) stored;

with ranked as (
  select id, row_number() over (
    partition by workspace_id, provider, query, coalesce(zipcode, ''), coalesce(store_id, '')
    order by retrieved_at desc, id desc
  ) as row_number
  from public.retailer_price_snapshots
)
delete from public.retailer_price_snapshots snapshot using ranked
where snapshot.id = ranked.id and ranked.row_number > 1;

create unique index if not exists retailer_price_snapshots_location_uidx
  on public.retailer_price_snapshots (workspace_id, provider, query, location_key);

create or replace function public.reserve_retailer_price_query(
  p_workspace_id uuid,
  p_provider text,
  p_query_month date default null,
  p_monthly_limit integer default 100
)
returns boolean language plpgsql security definer set search_path = public
as $$
declare reserved boolean;
  current_month date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if not public.is_workspace_admin(p_workspace_id) then raise exception 'workspace admin required'; end if;
  if p_provider <> 'home_depot' then raise exception 'unsupported retailer provider'; end if;
  insert into public.retailer_price_queries (workspace_id, provider, query_month, request_count, monthly_limit)
  values (p_workspace_id, p_provider, current_month, 1, 100)
  on conflict (workspace_id, provider, query_month) do update
    set request_count = retailer_price_queries.request_count + 1, monthly_limit = 100, updated_at = now()
    where retailer_price_queries.request_count < 100
    returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

grant execute on function public.reserve_retailer_price_query(uuid, text, date, integer) to authenticated;

create or replace function public.reserve_retailer_price_query_worker(
  p_workspace_id uuid,
  p_provider text,
  p_query_month date default null,
  p_monthly_limit integer default 100
)
returns boolean language plpgsql security definer set search_path = public
as $$
declare reserved boolean;
  current_month date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if p_provider <> 'home_depot' then raise exception 'unsupported retailer provider'; end if;
  insert into public.retailer_price_queries (workspace_id, provider, query_month, request_count, monthly_limit)
  values (p_workspace_id, p_provider, current_month, 1, 100)
  on conflict (workspace_id, provider, query_month) do update
    set request_count = retailer_price_queries.request_count + 1, monthly_limit = 100, updated_at = now()
    where retailer_price_queries.request_count < 100
    returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

revoke execute on function public.reserve_retailer_price_query_worker(uuid, text, date, integer) from public, anon, authenticated;
grant execute on function public.reserve_retailer_price_query_worker(uuid, text, date, integer) to service_role;
