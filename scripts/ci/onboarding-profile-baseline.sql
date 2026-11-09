-- Synthetic minimum Supabase-compatible schema for migration 092.
-- Executed only in the disposable GitHub Actions PostgreSQL database.
do $role$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $role$;
do $role$ begin
  create role anon nologin;
exception when duplicate_object then null;
end $role$;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;

create table public.workspaces (
  id uuid primary key,
  name text not null,
  created_by uuid not null references auth.users(id)
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','member')),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.workspace_members
  where workspace_id = target_workspace and user_id = auth.uid()
); $$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.workspace_members
  where workspace_id = target_workspace
    and user_id = auth.uid()
    and role in ('owner','admin')
); $$;

insert into auth.users(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd');

insert into public.workspaces(id,name,created_by) values
 ('11111111-1111-4111-8111-111111111111','Synthetic Workspace A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22222222-2222-4222-8222-222222222222','Synthetic Workspace B','cccccccc-cccc-4ccc-8ccc-cccccccccccc');

insert into public.workspace_members(workspace_id,user_id,role) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','member'),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner'),
 ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','admin');

grant usage on schema auth, public to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, update on public.workspaces to authenticated;
