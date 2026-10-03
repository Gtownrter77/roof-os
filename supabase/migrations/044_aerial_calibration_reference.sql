-- Store the human calibration reference used to convert image pixels into real-world feet.
-- Calibration remains review metadata; it does not authorize AI-derived quantities by itself.
alter table public.aerial_measurements
  add column if not exists scale_reference_pixels numeric(14,4),
  add column if not exists scale_reference_feet numeric(14,4),
  add column if not exists pixels_per_foot numeric(14,6),
  add column if not exists calibrated_by uuid references auth.users(id) on delete set null,
  add column if not exists calibrated_at timestamptz;

alter table public.aerial_measurements
  drop constraint if exists aerial_measurements_calibration_reference_check;

alter table public.aerial_measurements
  add constraint aerial_measurements_calibration_reference_check
  check (
    (scale_reference_pixels is null and scale_reference_feet is null and pixels_per_foot is null)
    or (
      scale_reference_pixels > 0
      and scale_reference_feet > 0
      and pixels_per_foot > 0
      and pixels_per_foot = round(scale_reference_pixels / scale_reference_feet, 6)
    )
  );

create index if not exists aerial_measurements_calibrated_idx
  on public.aerial_measurements(workspace_id, calibrated_at desc)
  where calibration_status = 'calibrated';


-- Reviewers need to be able to accept/edit/reject suggestions created by another
-- workspace member. Keep ownership/workspace linkage immutable while allowing
-- workspace members to perform review updates.
create or replace function public.prevent_aerial_geometry_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Aerial geometry ownership and workspace linkage are immutable';
  end if;

  if tg_table_name <> 'aerial_measurements'
     and (to_jsonb(new)->>'aerial_measurement_id') is distinct from (to_jsonb(old)->>'aerial_measurement_id') then
    raise exception 'Aerial geometry ownership and workspace linkage are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists aerial_measurements_immutable_linkage on public.aerial_measurements;
create trigger aerial_measurements_immutable_linkage
before update on public.aerial_measurements
for each row execute function public.prevent_aerial_geometry_owner_change();

drop trigger if exists roof_planes_immutable_linkage on public.roof_planes;
create trigger roof_planes_immutable_linkage
before update on public.roof_planes
for each row execute function public.prevent_aerial_geometry_owner_change();

drop trigger if exists roof_edges_immutable_linkage on public.roof_edges;
create trigger roof_edges_immutable_linkage
before update on public.roof_edges
for each row execute function public.prevent_aerial_geometry_owner_change();

drop trigger if exists roof_objects_immutable_linkage on public.roof_objects;
create trigger roof_objects_immutable_linkage
before update on public.roof_objects
for each row execute function public.prevent_aerial_geometry_owner_change();

drop policy if exists aerial_measurements_write on public.aerial_measurements;
drop policy if exists roof_planes_write on public.roof_planes;
drop policy if exists roof_edges_write on public.roof_edges;
drop policy if exists roof_objects_write on public.roof_objects;

create policy aerial_measurements_insert on public.aerial_measurements
for insert
with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);

create policy aerial_measurements_update on public.aerial_measurements
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy roof_planes_insert on public.roof_planes
for insert
with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);

create policy roof_planes_update on public.roof_planes
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy roof_edges_insert on public.roof_edges
for insert
with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);

create policy roof_edges_update on public.roof_edges
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy roof_objects_insert on public.roof_objects
for insert
with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);

create policy roof_objects_update on public.roof_objects
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
