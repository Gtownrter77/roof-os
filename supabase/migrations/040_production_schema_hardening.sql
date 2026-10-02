-- Production schema hardening for Phase D geometry and CRM ownership.
-- Removes redundant RLS policy overlap and adds covering indexes for new foreign keys.

create index if not exists aerial_measurements_inspection_idx
  on public.aerial_measurements(inspection_id);
create index if not exists aerial_measurements_source_photo_idx
  on public.aerial_measurements(source_photo_id);
create index if not exists aerial_measurements_created_by_idx
  on public.aerial_measurements(created_by);
create index if not exists aerial_measurements_confirmed_by_idx
  on public.aerial_measurements(confirmed_by);

create index if not exists roof_planes_workspace_idx
  on public.roof_planes(workspace_id);
create index if not exists roof_planes_created_by_idx
  on public.roof_planes(created_by);
create index if not exists roof_planes_reviewed_by_idx
  on public.roof_planes(reviewed_by);

create index if not exists roof_edges_workspace_idx
  on public.roof_edges(workspace_id);
create index if not exists roof_edges_created_by_idx
  on public.roof_edges(created_by);
create index if not exists roof_edges_reviewed_by_idx
  on public.roof_edges(reviewed_by);

create index if not exists roof_objects_workspace_idx
  on public.roof_objects(workspace_id);
create index if not exists roof_objects_created_by_idx
  on public.roof_objects(created_by);
create index if not exists roof_objects_reviewed_by_idx
  on public.roof_objects(reviewed_by);

create index if not exists leads_next_action_owner_idx
  on public.leads(next_action_owner_id)
  where next_action_owner_id is not null;

do $$
declare
  t text;
begin
  foreach t in array array['aerial_measurements','roof_planes','roof_edges','roof_objects'] loop
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by)',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by)',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete using (public.is_workspace_member(workspace_id) and auth.uid() = created_by)',
      t || '_delete', t
    );
  end loop;
end $$;
