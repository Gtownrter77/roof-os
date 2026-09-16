-- Review actions are restricted to workspace owners and administrators.
create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.workspace_members
  where workspace_id = target_workspace
    and user_id = auth.uid()
    and role in ('owner', 'admin')
); $$;

drop policy if exists supplements_update on public.supplements;
create policy supplements_update on public.supplements
  for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
