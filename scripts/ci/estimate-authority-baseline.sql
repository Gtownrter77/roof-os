-- Synthetic, disposable PostgreSQL-only Supabase baseline.
-- Not a substitute for real Supabase Auth, Storage, API or production data.
create schema if not exists auth;
create table auth.users(id uuid primary key);
create role authenticated nologin;
create role anon nologin;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.workspaces(id uuid primary key);
create table public.leads(id uuid primary key);
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
create function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members
  where workspace_id=target_workspace and user_id=auth.uid()
    and role in ('owner','admin')) $$;
grant usage on schema auth,public to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
