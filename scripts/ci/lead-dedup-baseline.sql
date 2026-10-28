-- Synthetic, disposable PostgreSQL-only baseline for lead deduplication tests.
-- Not Supabase Auth, Storage, API or production.
create schema if not exists auth;
create table auth.users(id uuid primary key);
-- Roles are cluster-wide: another suite may have created them already.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.workspaces(id uuid primary key);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','member')),
  primary key(workspace_id,user_id)
);
create function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members
  where workspace_id=target_workspace and user_id=auth.uid()) $$;
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  phone text,
  email text,
  status text not null default 'new',
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy lead_select on public.leads for select using (public.is_workspace_member(workspace_id));
create policy lead_insert on public.leads for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = owner_id);
create policy lead_update on public.leads for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
grant usage on schema auth,public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
