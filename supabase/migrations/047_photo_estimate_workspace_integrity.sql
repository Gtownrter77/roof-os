-- Enforce workspace consistency for photo-estimate workflow parents.
create or replace function public.enforce_photo_estimate_workspace_consistency()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and not exists (select 1 from public.leads l where l.id = new.lead_id and l.workspace_id = new.workspace_id) then raise exception 'Lead and photo-estimate workflow must belong to the same workspace' using errcode = '23514'; end if;
  if new.inspection_id is not null and not exists (select 1 from public.inspection_sessions i where i.id = new.inspection_id and i.workspace_id = new.workspace_id) then raise exception 'Inspection and photo-estimate workflow must belong to the same workspace' using errcode = '23514'; end if;
  return new;
end;
$$;
do $$ begin
  if exists (select 1 from public.photo_estimate_workflows w where w.lead_id is not null and not exists (select 1 from public.leads l where l.id = w.lead_id and l.workspace_id = w.workspace_id)) then raise exception 'Existing photo_estimate_workflows contain lead/workspace mismatches'; end if;
  if exists (select 1 from public.photo_estimate_workflows w where w.inspection_id is not null and not exists (select 1 from public.inspection_sessions i where i.id = w.inspection_id and i.workspace_id = w.workspace_id)) then raise exception 'Existing photo_estimate_workflows contain inspection/workspace mismatches'; end if;
end $$;
drop trigger if exists photo_estimate_workspace_consistency on public.photo_estimate_workflows;
create trigger photo_estimate_workspace_consistency before insert or update of workspace_id, lead_id, inspection_id on public.photo_estimate_workflows for each row execute function public.enforce_photo_estimate_workspace_consistency();
revoke all on function public.enforce_photo_estimate_workspace_consistency() from public, anon, authenticated;
