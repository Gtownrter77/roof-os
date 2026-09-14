-- ROOF/OS system-owner lock.
-- This is intentionally fail-closed: until the singleton row is set to Ryan's
-- authenticated Supabase user UUID, system configuration writes are denied.

create table if not exists public.system_owner (
  singleton boolean primary key default true check (singleton),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  owner_display_name text not null default 'Ryan Michael Long',
  updated_at timestamptz not null default now()
);

create or replace function public.is_system_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.system_owner
    where singleton = true and owner_user_id = auth.uid()
  );
$$;

alter table public.system_owner enable row level security;
create policy system_owner_select on public.system_owner for select using (public.is_system_owner());

-- Configuration surfaces are now owner-only. Existing member/admin policies are
-- replaced rather than layered so no broader policy can grant write access.
drop policy if exists automation_rules_write on public.automation_rules;
create policy automation_rules_write on public.automation_rules for all using (public.is_system_owner()) with check (public.is_system_owner());

drop policy if exists price_books_write on public.price_books;
create policy price_books_write on public.price_books for all using (public.is_system_owner()) with check (public.is_system_owner());

drop policy if exists price_book_items_write on public.price_book_items;
create policy price_book_items_write on public.price_book_items for all using (public.is_system_owner()) with check (public.is_system_owner());

drop policy if exists retailer_price_watchlist_write on public.retailer_price_watchlist;
create policy retailer_price_watchlist_write on public.retailer_price_watchlist for all using (public.is_system_owner()) with check (public.is_system_owner());

-- One-time activation, to be run by Ryan in the Supabase SQL editor after
-- signing in. Replace the placeholder with auth.users.id for Ryan's account.
-- insert into public.system_owner (owner_user_id, owner_display_name)
-- values ('RYAN_SUPABASE_USER_UUID', 'Ryan Michael Long')
-- on conflict (singleton) do update set owner_user_id = excluded.owner_user_id,
-- owner_display_name = excluded.owner_display_name, updated_at = now();
