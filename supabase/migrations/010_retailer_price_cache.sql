-- ROOF/OS retailer price cache with a hard monthly request budget.
-- Retailer prices are reference inputs, not automatically insurance-approved rates.

create table if not exists public.retailer_price_queries (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('home_depot')),
  query_month date not null,
  request_count integer not null default 0 check (request_count >= 0),
  monthly_limit integer not null default 100 check (monthly_limit > 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, provider, query_month)
);

create table if not exists public.retailer_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('home_depot')),
  query text not null,
  zipcode text,
  store_id text,
  source_url text not null,
  response jsonb not null,
  retrieved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict
);

create index if not exists retailer_price_snapshots_lookup_idx
  on public.retailer_price_snapshots (workspace_id, provider, query, retrieved_at desc);

alter table public.retailer_price_queries enable row level security;
alter table public.retailer_price_snapshots enable row level security;

create policy retailer_price_queries_select on public.retailer_price_queries for select using (public.is_workspace_admin(workspace_id));
create policy retailer_price_snapshots_select on public.retailer_price_snapshots for select using (public.is_workspace_member(workspace_id));
create policy retailer_price_snapshots_insert on public.retailer_price_snapshots for insert with check (public.is_workspace_admin(workspace_id) and auth.uid() = created_by);

create or replace function public.reserve_retailer_price_query(p_workspace_id uuid, p_provider text, p_query_month date, p_monthly_limit integer default 100)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare reserved boolean;
begin
  if not public.is_workspace_admin(p_workspace_id) then raise exception 'workspace admin required'; end if;
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

grant execute on function public.reserve_retailer_price_query(uuid, text, date, integer) to authenticated;
