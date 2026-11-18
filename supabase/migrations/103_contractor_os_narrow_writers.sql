-- ContractorOS Stage 2: narrow, fail-closed writers.
-- These functions are the only client-facing write path for the generic control-plane records.

create or replace function public.contractor_create_mandate(
  p_mandate_key text,
  p_purpose text,
  p_scope jsonb default '{}'::jsonb,
  p_tools jsonb default '[]'::jsonb,
  p_action_limits jsonb default '{}'::jsonb,
  p_prohibitions jsonb default '[]'::jsonb,
  p_resources jsonb default '{}'::jsonb,
  p_success_criteria jsonb default '{}'::jsonb,
  p_escalation_policy jsonb default '{}'::jsonb,
  p_owner_user_id uuid default null,
  p_starts_at timestamptz default null,
  p_expires_at timestamptz default null
)
returns public.contractor_mandates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid := public.current_workspace_id();
  v_row public.contractor_mandates;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_workspace_id is null then raise exception 'active workspace is required'; end if;
  if not public.contractor_can_manage_control_plane(v_workspace_id) then
    raise exception 'workspace administrator access is required';
  end if;
  if coalesce(length(trim(p_mandate_key)), 0) < 3 or length(trim(p_mandate_key)) > 120 then
    raise exception 'mandate key must be 3 to 120 characters';
  end if;
  if coalesce(length(trim(p_purpose)), 0) < 1 or length(trim(p_purpose)) > 2000 then
    raise exception 'mandate purpose is required and must be at most 2000 characters';
  end if;
  if p_expires_at is not null and p_starts_at is not null and p_expires_at <= p_starts_at then
    raise exception 'mandate expiry must be after its start';
  end if;
  if p_owner_user_id is not null and not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = v_workspace_id and wm.user_id = p_owner_user_id
  ) then
    raise exception 'mandate owner must be a member of the active workspace';
  end if;

  insert into public.contractor_mandates (
    workspace_id, mandate_key, purpose, scope, tools, action_limits,
    prohibitions, resources, success_criteria, escalation_policy,
    owner_user_id, status, starts_at, expires_at, created_by, updated_by
  ) values (
    v_workspace_id, trim(p_mandate_key), trim(p_purpose), coalesce(p_scope, '{}'::jsonb),
    coalesce(p_tools, '[]'::jsonb), coalesce(p_action_limits, '{}'::jsonb),
    coalesce(p_prohibitions, '[]'::jsonb), coalesce(p_resources, '{}'::jsonb),
    coalesce(p_success_criteria, '{}'::jsonb), coalesce(p_escalation_policy, '{}'::jsonb),
    coalesce(p_owner_user_id, v_user_id), 'draft', p_starts_at, p_expires_at, v_user_id, v_user_id
  ) returning * into v_row;
  return v_row;
exception
  when unique_violation then raise exception 'mandate key already exists in this workspace';
end;
$$;

create or replace function public.contractor_transition_mandate(
  p_mandate_id uuid,
  p_status text,
  p_cancellation_reason text default null
)
returns public.contractor_mandates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_current_status text;
  v_user_id uuid := auth.uid();
  v_row public.contractor_mandates;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  select workspace_id, status into v_workspace_id, v_current_status
    from public.contractor_mandates where id = p_mandate_id;
  if v_workspace_id is null then raise exception 'mandate not found'; end if;
  if not public.contractor_can_manage_control_plane(v_workspace_id) then
    raise exception 'workspace administrator access is required';
  end if;
  if p_status not in ('active','paused','expired','cancelled','completed','revoked') then
    raise exception 'invalid mandate transition status';
  end if;
  if v_current_status in ('cancelled','revoked','completed','expired') then
    raise exception 'terminal mandate cannot be transitioned';
  end if;
  if p_status = 'cancelled' and coalesce(length(trim(p_cancellation_reason)), 0) < 3 then
    raise exception 'cancellation reason is required';
  end if;
  if p_status = 'active' and exists (
    select 1 from public.contractor_mandates m
    where m.id = p_mandate_id and m.expires_at is not null and m.expires_at <= now()
  ) then
    raise exception 'expired mandate cannot be activated';
  end if;

  update public.contractor_mandates
     set status = p_status,
         cancellation_reason = case when p_status = 'cancelled' then trim(p_cancellation_reason) else cancellation_reason end,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         updated_by = v_user_id,
         updated_at = now()
   where id = p_mandate_id
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.contractor_capture_evidence(
  p_record_type text,
  p_record_id uuid,
  p_evidence_type text,
  p_original_ref text,
  p_derived_data jsonb default '{}'::jsonb,
  p_provenance jsonb default '{}'::jsonb,
  p_confidence numeric default null
)
returns public.contractor_evidence_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid := public.current_workspace_id();
  v_row public.contractor_evidence_items;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_workspace_id is null or not public.is_workspace_member(v_workspace_id) then
    raise exception 'workspace membership is required';
  end if;
  if coalesce(length(trim(p_record_type)), 0) not between 2 and 80 then raise exception 'record type is invalid'; end if;
  if p_record_id is null then raise exception 'record id is required'; end if;
  if coalesce(length(trim(p_evidence_type)), 0) not between 2 and 80 then raise exception 'evidence type is invalid'; end if;
  if coalesce(length(trim(p_original_ref)), 0) < 1 or length(trim(p_original_ref)) > 2000 then raise exception 'original evidence reference is required'; end if;
  if p_confidence is not null and (p_confidence < 0 or p_confidence > 1) then raise exception 'confidence must be between 0 and 1'; end if;

  insert into public.contractor_evidence_items (
    workspace_id, record_type, record_id, evidence_type, original_ref,
    derived_data, provenance, confidence, review_status, captured_by
  ) values (
    v_workspace_id, trim(p_record_type), p_record_id, trim(p_evidence_type), trim(p_original_ref),
    coalesce(p_derived_data, '{}'::jsonb), coalesce(p_provenance, '{}'::jsonb), p_confidence,
    'unreviewed', v_user_id
  ) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.contractor_review_evidence(
  p_evidence_id uuid,
  p_review_status text
)
returns public.contractor_evidence_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_current_status text;
  v_user_id uuid := auth.uid();
  v_row public.contractor_evidence_items;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  select workspace_id, review_status into v_workspace_id, v_current_status
    from public.contractor_evidence_items where id = p_evidence_id;
  if v_workspace_id is null then raise exception 'evidence item not found'; end if;
  if not public.contractor_can_manage_control_plane(v_workspace_id) then
    raise exception 'workspace administrator access is required';
  end if;
  if p_review_status not in ('accepted','rejected','superseded') then raise exception 'invalid evidence review status'; end if;
  if v_current_status in ('accepted','rejected','superseded') then raise exception 'evidence review is immutable'; end if;

  update public.contractor_evidence_items
     set review_status = p_review_status, reviewed_by = v_user_id, reviewed_at = now()
   where id = p_evidence_id
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.contractor_create_record_revision(
  p_record_type text,
  p_record_id uuid,
  p_snapshot jsonb,
  p_source_refs jsonb default '[]'::jsonb,
  p_correction_of uuid default null
)
returns public.contractor_record_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid := public.current_workspace_id();
  v_next_revision integer;
  v_row public.contractor_record_revisions;
  v_parent_workspace uuid;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_workspace_id is null or not public.is_workspace_member(v_workspace_id) then raise exception 'workspace membership is required'; end if;
  if coalesce(length(trim(p_record_type)), 0) not between 2 and 80 then raise exception 'record type is invalid'; end if;
  if p_record_id is null then raise exception 'record id is required'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then raise exception 'snapshot must be a JSON object'; end if;
  if p_source_refs is null or jsonb_typeof(p_source_refs) <> 'array' then raise exception 'source references must be a JSON array'; end if;
  if p_correction_of is not null then
    select workspace_id into v_parent_workspace from public.contractor_record_revisions where id = p_correction_of;
    if v_parent_workspace is distinct from v_workspace_id then raise exception 'correction parent is outside the active workspace'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || trim(p_record_type) || ':' || p_record_id::text, 0));
  select coalesce(max(revision_number), 0) + 1 into v_next_revision
    from public.contractor_record_revisions
   where workspace_id = v_workspace_id and record_type = trim(p_record_type) and record_id = p_record_id;

  insert into public.contractor_record_revisions (
    workspace_id, record_type, record_id, revision_number, revision_status,
    snapshot, source_refs, correction_of, created_by
  ) values (
    v_workspace_id, trim(p_record_type), p_record_id, v_next_revision, 'draft',
    p_snapshot, p_source_refs, p_correction_of, v_user_id
  ) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.contractor_review_record_revision(
  p_revision_id uuid,
  p_revision_status text
)
returns public.contractor_record_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_current_status text;
  v_user_id uuid := auth.uid();
  v_row public.contractor_record_revisions;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  select workspace_id, revision_status into v_workspace_id, v_current_status
    from public.contractor_record_revisions where id = p_revision_id;
  if v_workspace_id is null then raise exception 'record revision not found'; end if;
  if not public.contractor_can_manage_control_plane(v_workspace_id) then raise exception 'workspace administrator access is required'; end if;
  if p_revision_status not in ('review_required','reviewed','released','blocked','corrected') then raise exception 'invalid revision status'; end if;
  if v_current_status in ('released','superseded') then raise exception 'released revision is immutable'; end if;
  if p_revision_status = 'released' and v_current_status not in ('reviewed','corrected') then
    raise exception 'revision must be reviewed before release';
  end if;

  update public.contractor_record_revisions
     set revision_status = p_revision_status,
         reviewed_by = case when p_revision_status in ('reviewed','released','blocked','corrected') then v_user_id else reviewed_by end,
         reviewed_at = case when p_revision_status in ('reviewed','released','blocked','corrected') then now() else reviewed_at end,
         released_by = case when p_revision_status = 'released' then v_user_id else released_by end,
         released_at = case when p_revision_status = 'released' then now() else released_at end
   where id = p_revision_id
   returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.contractor_create_mandate(text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.contractor_create_mandate(text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,timestamptz,timestamptz) to authenticated;
revoke all on function public.contractor_transition_mandate(uuid,text,text) from public, anon;
grant execute on function public.contractor_transition_mandate(uuid,text,text) to authenticated;
revoke all on function public.contractor_capture_evidence(text,uuid,text,text,jsonb,jsonb,numeric) from public, anon;
grant execute on function public.contractor_capture_evidence(text,uuid,text,text,jsonb,jsonb,numeric) to authenticated;
revoke all on function public.contractor_review_evidence(uuid,text) from public, anon;
grant execute on function public.contractor_review_evidence(uuid,text) to authenticated;
revoke all on function public.contractor_create_record_revision(text,uuid,jsonb,jsonb,uuid) from public, anon;
grant execute on function public.contractor_create_record_revision(text,uuid,jsonb,jsonb,uuid) to authenticated;
revoke all on function public.contractor_review_record_revision(uuid,text) from public, anon;
grant execute on function public.contractor_review_record_revision(uuid,text) to authenticated;

comment on function public.contractor_create_mandate(text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,timestamptz,timestamptz) is 'Narrow owner/admin writer for bounded ContractorOS mandates.';
comment on function public.contractor_transition_mandate(uuid,text,text) is 'Narrow owner/admin mandate transition writer with terminal-state protection.';
comment on function public.contractor_capture_evidence(text,uuid,text,text,jsonb,jsonb,numeric) is 'Member evidence capture writer; review remains a separate admin action.';
comment on function public.contractor_review_evidence(uuid,text) is 'Admin-only immutable evidence review writer.';
comment on function public.contractor_create_record_revision(text,uuid,jsonb,jsonb,uuid) is 'Member revision writer with server-assigned monotonic revision number.';
comment on function public.contractor_review_record_revision(uuid,text) is 'Admin-only revision review/release writer with release gating.';
