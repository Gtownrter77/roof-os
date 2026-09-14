-- Weekly retailer refresh configuration.

create table if not exists public.retailer_price_watchlist (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'home_depot' check (provider = 'home_depot'),
  query text not null,
  zipcode text,
  store_id text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, query, zipcode, store_id)
);

alter table public.retailer_price_snapshots alter column created_by drop not null;

alter table public.retailer_price_watchlist enable row level security;
create policy retailer_price_watchlist_select on public.retailer_price_watchlist for select using (public.is_workspace_member(workspace_id));
create policy retailer_price_watchlist_write on public.retailer_price_watchlist for all using (public.is_workspace_admin(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_admin(workspace_id) and auth.uid() = created_by);

create or replace function public.reserve_retailer_price_query_worker(p_workspace_id uuid, p_provider text, p_query_month date, p_monthly_limit integer default 100)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare reserved boolean;
begin
  insert into public.retailer_price_queries (workspace_id, provider, query_month, request_count, monthly_limit)
  values (p_workspace_id, p_provider, p_query_month, 1, p_monthly_limit)
  on conflict (workspace_id, provider, query_month) do update
    set request_count = retailer_price_queries.request_count + 1,
        updated_at = now()
    where retailer_price_queries.request_count < retailer_price_queries.monthly_limit
    returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

revoke execute on function public.reserve_retailer_price_query_worker(uuid, text, date, integer) from public, anon, authenticated;
grant execute on function public.reserve_retailer_price_query_worker(uuid, text, date, integer) to service_role;
