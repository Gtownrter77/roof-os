-- Optional ABC Supply account price add-on.
-- Home Depot and Lowe's provider values stay valid.

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
  add constraint retailer_price_queries_provider_check check (provider in ('home_depot', 'lowes', 'abc'));
alter table public.retailer_price_snapshots
  add constraint retailer_price_snapshots_provider_check check (provider in ('home_depot', 'lowes', 'abc'));
alter table public.retailer_price_watchlist
  add constraint retailer_price_watchlist_provider_check check (provider in ('home_depot', 'lowes', 'abc'));

comment on column public.retailer_price_snapshots.provider is 'Supported providers: home_depot, lowes, and optional abc account add-on.';
