-- Enforce workspace consistency across Phase D aerial geometry relationships.
create or replace function public.enforce_aerial_workspace_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare parent_workspace uuid;
begin
  if tg_table_name = 'aerial_measurements' then
    select workspace_id into parent_workspace from public.inspection_sessions where id = new.inspection_id;
    if parent_workspace is null or parent_workspace <> new.workspace_id then
      raise exception 'inspection and aerial measurement must belong to the same workspace';
    end if;
    select workspace_id into parent_workspace from public.inspection_photos where id = new.source_photo_id;
    if parent_workspace is null or parent_workspace <> new.workspace_id then
      raise exception 'source photo and aerial measurement must belong to the same workspace';
    end if;
  else
    select workspace_id into parent_workspace from public.aerial_measurements where id = new.aerial_measurement_id;
    if parent_workspace is null or parent_workspace <> new.workspace_id then
      raise exception 'aerial measurement and geometry row must belong to the same workspace';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists aerial_measurements_workspace_consistency on public.aerial_measurements;
create trigger aerial_measurements_workspace_consistency
before insert or update of workspace_id, inspection_id, source_photo_id
on public.aerial_measurements
for each row execute function public.enforce_aerial_workspace_consistency();

drop trigger if exists roof_planes_workspace_consistency on public.roof_planes;
create trigger roof_planes_workspace_consistency
before insert or update of workspace_id, aerial_measurement_id
on public.roof_planes
for each row execute function public.enforce_aerial_workspace_consistency();

drop trigger if exists roof_edges_workspace_consistency on public.roof_edges;
create trigger roof_edges_workspace_consistency
before insert or update of workspace_id, aerial_measurement_id
on public.roof_edges
for each row execute function public.enforce_aerial_workspace_consistency();

drop trigger if exists roof_objects_workspace_consistency on public.roof_objects;
create trigger roof_objects_workspace_consistency
before insert or update of workspace_id, aerial_measurement_id
on public.roof_objects
for each row execute function public.enforce_aerial_workspace_consistency();

revoke all on function public.enforce_aerial_workspace_consistency() from public, anon, authenticated;
