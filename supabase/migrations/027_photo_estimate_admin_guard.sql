-- Approval and customer-packet state changes require workspace administration.
drop policy if exists photo_estimate_workflows_update on public.photo_estimate_workflows;
create policy photo_estimate_workflows_update on public.photo_estimate_workflows
  for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
