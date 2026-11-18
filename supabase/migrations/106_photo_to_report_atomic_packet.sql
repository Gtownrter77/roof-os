-- Atomically create exactly one Photo-to-Report review packet per photo.
-- The existing two-step HTTP insert could leave orphaned workflow rows or
-- overwrite an already-created job during concurrent retries.
create or replace function public.start_photo_to_report_review_packet(
  p_workspace_id uuid,
  p_photo_id uuid,
  p_actor_id uuid,
  p_report jsonb,
  p_estimate jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_photo public.inspection_photos%rowtype;
  v_job_id uuid;
  v_workflow_id uuid;
  v_lead_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'Only trusted application service may start a Photo-to-Report packet' using errcode='42501';
  end if;
  select * into v_photo from public.inspection_photos
    where id=p_photo_id and workspace_id=p_workspace_id and uploaded_by=p_actor_id
      and gps_verified=true and gps_latitude between -90 and 90 and gps_longitude between -180 and 180
      and nullif(trim(gps_address),'') is not null and gps_sha256 is not null
      and upload_status='uploaded';
  if not found then
    raise exception 'Server-certified GPS photo is required' using errcode='42501';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id=p_workspace_id and user_id=p_actor_id
  ) then
    raise exception 'A current workspace member is required' using errcode='42501';
  end if;

  if not exists (
    select 1 from public.workspace_settings
    where workspace_id=p_workspace_id and enable_auto_photo_measurements is true
  ) then
    raise exception 'Workspace owner has not enabled automatic photo measurements' using errcode='42501';
  end if;

  select lead_id into v_lead_id from public.inspection_sessions
    where id=v_photo.inspection_id and workspace_id=p_workspace_id;
  if not found then
    raise exception 'Inspection and photo workspace differ' using errcode='42501';
  end if;

  insert into public.photo_to_report_jobs (
    workspace_id, inspection_id, photo_id, created_by, state, review_reason
  ) values (
    p_workspace_id, v_photo.inspection_id, v_photo.id, p_actor_id, 'property_review',
    'Source photo is GPS certified; property match and roof measurements require review.'
  )
  on conflict (workspace_id,photo_id) do nothing
  returning id into v_job_id;

  if v_job_id is null then
    select workflow_id into v_workflow_id from public.photo_to_report_jobs
      where workspace_id=p_workspace_id and photo_id=p_photo_id;
    if v_workflow_id is null then
      raise exception 'Photo review packet is not yet available; retry safely' using errcode='40001';
    end if;
    return v_workflow_id;
  end if;

  insert into public.photo_estimate_workflows (
    workspace_id, inspection_id, lead_id, created_by, status, address,
    latitude, longitude, source_photo_ids, report, estimate
  ) values (
    p_workspace_id, v_photo.inspection_id, v_lead_id, p_actor_id, 'property_review',
    v_photo.gps_address, v_photo.gps_latitude, v_photo.gps_longitude,
    array[v_photo.id], p_report, p_estimate
  ) returning id into v_workflow_id;

  update public.photo_to_report_jobs
    set workflow_id=v_workflow_id, updated_at=now()
    where id=v_job_id and workspace_id=p_workspace_id;

  return v_workflow_id;
end;
$$;

revoke all on function public.start_photo_to_report_review_packet(uuid,uuid,uuid,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.start_photo_to_report_review_packet(uuid,uuid,uuid,jsonb,jsonb)
  to service_role;
notify pgrst, 'reload schema';
