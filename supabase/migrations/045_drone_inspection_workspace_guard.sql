-- Prevent an aerial evidence row from linking an inspection belonging to another workspace.
create or replace function public.drone_capture_inspection_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inspection_workspace uuid;
begin
  if new.inspection_id is null then
    return new;
  end if;

  select workspace_id into inspection_workspace
  from public.inspection_sessions
  where id = new.inspection_id;

  if inspection_workspace is null or inspection_workspace <> new.workspace_id then
    raise exception 'Drone capture inspection must belong to the same workspace';
  end if;

  return new;
end;
$$;

drop trigger if exists drone_capture_inspection_workspace_guard on public.drone_captures;
create trigger drone_capture_inspection_workspace_guard
before insert or update of inspection_id, workspace_id on public.drone_captures
for each row execute function public.drone_capture_inspection_workspace();

create index if not exists drone_captures_workspace_inspection_idx
  on public.drone_captures(workspace_id, inspection_id, created_at desc);
