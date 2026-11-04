-- Log a canvass result as one authenticated transaction. If either the lead
-- mutation or its activity insert fails, PostgreSQL rolls both back.
-- Prefix 079 follows the production 075-078 security reconciliation.
create or replace function public.log_canvass_knock(
  p_address text,
  p_name text,
  p_phone text,
  p_notes text,
  p_outcome text
)
returns table (lead_id uuid, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_address text := btrim(coalesce(p_address, ''));
  v_normalized_address text;
  v_name text;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_status text;
  v_next_action text;
  v_lost_reason text;
  v_lost_reason_detail text;
  v_lost_at timestamptz;
  v_enabled boolean;
  v_lead_id uuid;
  v_existing_status text;
  v_existing_lost_reason_detail text;
  v_update_pipeline boolean := false;
  v_created boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if v_address = '' then
    raise exception 'Property address is required.' using errcode = '22023';
  end if;
  if p_outcome is null or p_outcome not in ('INTERESTED', 'NOT_HOME', 'INSPECTED', 'DO_NOT_KNOCK') then
    raise exception 'Unsupported canvass outcome.' using errcode = '22023';
  end if;

  v_workspace_id := public.current_workspace_id();
  if v_workspace_id is null or not public.is_workspace_member(v_workspace_id) then
    raise exception 'Active workspace is required.' using errcode = '42501';
  end if;

  select enable_canvassing_lead_auto_convert into v_enabled
  from public.workspace_settings
  where workspace_id = v_workspace_id;

  if v_enabled is distinct from true then
    raise exception 'Canvass lead conversion is disabled or not configured for this workspace.' using errcode = '42501';
  end if;

  v_normalized_address := lower(regexp_replace(v_address, '[[:space:]]+', ' ', 'g'));
  v_name := coalesce(nullif(btrim(coalesce(p_name, '')), ''), 'Canvass: ' || v_address);

  if p_outcome = 'INTERESTED' then
    v_status := 'new';
    v_next_action := 'Schedule field inspection';
  elsif p_outcome = 'NOT_HOME' then
    v_status := 'new';
    v_next_action := 'Return visit / follow up door hanger';
  elsif p_outcome = 'INSPECTED' then
    v_status := 'inspected';
    v_next_action := 'Upload photos and draft report';
  else
    v_status := 'lost';
    v_lost_reason := 'other';
    v_lost_reason_detail := 'Do not knock / no soliciting';
    v_lost_at := now();
  end if;

  -- Serialize address matching and insertion across concurrent devices in a workspace.
  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text, 0));

  select l.id, l.status, l.lost_reason_detail
    into v_lead_id, v_existing_status, v_existing_lost_reason_detail
  from public.leads l
  where l.workspace_id = v_workspace_id
    and l.source = 'canvasser_door_knocking'
    and lower(regexp_replace(btrim(l.address), '[[:space:]]+', ' ', 'g')) = v_normalized_address
  order by l.created_at desc
  limit 1
  for update;

  if v_lead_id is null then
    insert into public.leads (
      owner_id, name, address, phone, source, notes, workspace_id, status,
      next_action, next_action_owner_id, lost_reason, lost_reason_detail, lost_at
    ) values (
      v_user_id, v_name, v_address, v_phone, 'canvasser_door_knocking',
      coalesce(v_notes, 'Logged from field canvass.'), v_workspace_id, v_status,
      v_next_action, case when v_next_action is not null then v_user_id else null end,
      v_lost_reason, v_lost_reason_detail, v_lost_at
    ) returning id into v_lead_id;
    v_created := true;
  else
    if coalesce(v_existing_lost_reason_detail, '') ilike '%do not knock%'
       and p_outcome <> 'DO_NOT_KNOCK' then
      raise exception 'This property is marked do not knock. A new canvass result cannot override that restriction.'
        using errcode = '42501';
    end if;

    -- Only early-stage leads may be changed by a canvass note. INSPECTED may
    -- advance qualified/assigned leads, but later pipeline states never move backwards.
    v_update_pipeline :=
      v_existing_status = 'new'
      or (v_existing_status in ('qualified', 'assigned') and p_outcome = 'INSPECTED');

    update public.leads l set
      name = case when nullif(btrim(coalesce(p_name, '')), '') is not null then v_name else l.name end,
      phone = coalesce(v_phone, l.phone),
      status = case when v_update_pipeline then v_status else l.status end,
      next_action = case when v_update_pipeline then v_next_action else l.next_action end,
      next_action_owner_id = case
        when v_update_pipeline and v_next_action is not null then v_user_id
        when v_update_pipeline then null
        else l.next_action_owner_id
      end,
      lost_reason = case when v_update_pipeline then v_lost_reason else l.lost_reason end,
      lost_reason_detail = case
        when p_outcome = 'DO_NOT_KNOCK' then v_lost_reason_detail
        when v_update_pipeline then null
        else l.lost_reason_detail
      end,
      lost_at = case when v_update_pipeline then v_lost_at else l.lost_at end,
      updated_at = now()
    where l.id = v_lead_id;
  end if;

  insert into public.lead_activity (lead_id, workspace_id, user_id, kind, body)
  values (
    v_lead_id,
    v_workspace_id,
    v_user_id,
    'note',
    'Door knock: ' || replace(p_outcome, '_', ' ')
      || case when v_notes is null then '' else ' — ' || v_notes end
  );

  return query select v_lead_id, v_created;
end;
$$;

revoke all on function public.log_canvass_knock(text, text, text, text, text) from public, anon;
grant execute on function public.log_canvass_knock(text, text, text, text, text) to authenticated;
