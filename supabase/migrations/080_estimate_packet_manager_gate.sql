-- Estimate review packets sourced from photo workflows require the same
-- manager approval that gates Golden Report generation. This closes the
-- direct-table-insert path around the API route.
create or replace function public.enforce_photo_estimate_packet_manager_gate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source public.photo_estimate_workflows%rowtype;
begin
  if new.photo_estimate_workflow_id is null then
    return new;
  end if;
  select * into source
  from public.photo_estimate_workflows
  where id = new.photo_estimate_workflow_id
    and workspace_id = new.workspace_id
    and inspection_id = new.inspection_id;
  if not found
     or source.manager_approved_by is null
     or source.manager_approved_at is null
     or nullif(trim(source.manager_approval_name), '') is null
     or nullif(trim(source.manager_approval_signature), '') is null then
    raise exception 'Manager approval is required before creating a photo estimate review packet';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_photo_estimate_packet_manager_gate on public.estimate_review_packets;
create trigger enforce_photo_estimate_packet_manager_gate
before insert on public.estimate_review_packets
for each row execute function public.enforce_photo_estimate_packet_manager_gate();

revoke all on function public.enforce_photo_estimate_packet_manager_gate() from public, anon;
grant execute on function public.enforce_photo_estimate_packet_manager_gate() to authenticated;
