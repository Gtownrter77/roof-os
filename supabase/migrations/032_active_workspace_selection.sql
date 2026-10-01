-- Make workspace selection explicit for users with memberships in more than one workspace.
-- The fallback preserves the original first-created membership only until the user
-- explicitly selects a workspace through the application UI.

begin;

create table if not exists public.user_active_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.user_active_workspaces enable row level security;

drop policy if exists user_active_workspaces_select on public.user_active_workspaces;
drop policy if exists user_active_workspaces_insert on public.user_active_workspaces;
drop policy if exists user_active_workspaces_update on public.user_active_workspaces;
drop policy if exists user_active_workspaces_delete on public.user_active_workspaces;

create policy user_active_workspaces_select
  on public.user_active_workspaces for select
  using (auth.uid() = user_id);

create policy user_active_workspaces_insert
  on public.user_active_workspaces for insert
  with check (
    auth.uid() = user_id
    and public.is_workspace_member(workspace_id)
  );

create policy user_active_workspaces_update
  on public.user_active_workspaces for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.is_workspace_member(workspace_id)
  );

create policy user_active_workspaces_delete
  on public.user_active_workspaces for delete
  using (auth.uid() = user_id);

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select active.workspace_id
      from public.user_active_workspaces active
      where active.user_id = auth.uid()
        and exists (
          select 1
          from public.workspace_members member
          where member.workspace_id = active.workspace_id
            and member.user_id = auth.uid()
        )
    ),
    (
      select member.workspace_id
      from public.workspace_members member
      where member.user_id = auth.uid()
      order by member.created_at, member.workspace_id
      limit 1
    )
  );
$$;

revoke all on function public.current_workspace_id() from public, anon;
grant execute on function public.current_workspace_id() to authenticated;

commit;
