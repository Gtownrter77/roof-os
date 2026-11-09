-- Add an optional, database-enforced expiry to a workspace trial.
-- NULL means the workspace is not time-limited; existing customers are unchanged.
alter table public.workspaces
  add column if not exists trial_expires_at timestamptz,
  add column if not exists trial_status text not null default 'active' check (trial_status in ('pending', 'active'));

comment on column public.workspaces.trial_status is
  'Pending workspaces are inaccessible until a new account owner activates its evaluation.';

comment on column public.workspaces.trial_expires_at is
  'Optional server-enforced access cutoff for temporary demo workspaces. NULL means no trial expiry.';

-- All workspace-scoped RLS policies call this helper. Enforce expiry here so
-- changing a browser clock or keeping an old client session cannot extend access.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.workspace_members member
    join public.workspaces workspace
      on workspace.id = member.workspace_id
    where member.workspace_id = target_workspace
      and member.user_id = auth.uid()
      and workspace.trial_status <> 'pending'
      and (
        workspace.trial_expires_at is null
        or workspace.trial_expires_at > statement_timestamp()
      )
  );
$function$;

-- Admin checks must also honor expiry; otherwise privileged workspace policies
-- could remain usable after the demo window closes.
create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.workspace_members member
    join public.workspaces workspace
      on workspace.id = member.workspace_id
    where member.workspace_id = target_workspace
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin')
      and workspace.trial_status <> 'pending'
      and (
        workspace.trial_expires_at is null
        or workspace.trial_expires_at > statement_timestamp()
      )
  );
$function$;

-- Do not keep returning an expired workspace as the user's active workspace.
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (
      select active.workspace_id
      from public.user_active_workspaces active
      where active.user_id = auth.uid()
        and public.is_workspace_member(active.workspace_id)
    ),
    (
      select member.workspace_id
      from public.workspace_members member
      where member.user_id = auth.uid()
        and public.is_workspace_member(member.workspace_id)
      order by member.created_at, member.workspace_id
      limit 1
    )
  );
$function$;
