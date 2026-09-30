-- Enable Lowe's as a live retailer reference provider.
-- Lowe's values remain reference pricing and require owner review before estimates.

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
  add constraint retailer_price_queries_provider_check check (provider in ('home_depot', 'lowes'));
alter table public.retailer_price_snapshots
  add constraint retailer_price_snapshots_provider_check check (provider in ('home_depot', 'lowes'));
alter table public.retailer_price_watchlist
  add constraint retailer_price_watchlist_provider_check check (provider in ('home_depot', 'lowes'));

comment on table public.retailer_price_snapshots is 'Retailer reference pricing only; not licensed claims pricing or an approved estimate rate.';
comment on column public.retailer_price_snapshots.provider is 'Supported providers: home_depot and lowes.';

-- Reassert the worker function contract after provider expansion.
revoke execute on function public.reserve_retailer_price_query_worker(uuid, text, date, integer) from public, anon, authenticated;
grant execute on function public.reserve_retailer_price_query_worker(uuid, text, date, integer) to service_role;
