-- Receptionist workspace integrity hardening.
-- Keeps the existing worker-only booking boundary while preventing
-- cross-workspace lead lookup/creation and invalid privileged booking inputs.

begin;

alter table public.leads
  alter column workspace_id set not null;

create or replace function public.book_receptionist_appointment(
  p_workspace_id uuid,
  p_lead_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_location text,
  p_created_by uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_appointment public.appointments;
begin
  if p_workspace_id is null or p_lead_id is null or p_created_by is null or p_starts_at is null or nullif(pg_catalog.btrim(p_idempotency_key), '') is null then
    raise exception 'Missing required booking fields' using errcode = '22023';
  end if;
  if not exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = p_created_by and role in ('owner', 'admin', 'member')) then
    raise exception 'Booking creator is not a member of the target workspace' using errcode = '42501';
  end if;
  if not exists (select 1 from public.leads l where l.id = p_lead_id and l.workspace_id = p_workspace_id) then
    raise exception 'Lead does not belong to the target workspace' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text, 0));
  select payload into v_existing from public.receptionist_events where workspace_id = p_workspace_id and event_key = p_idempotency_key limit 1;
  if v_existing is not null and v_existing ? 'appointmentId' then
    select to_jsonb(a) into v_existing from public.appointments a where a.id = (v_existing->>'appointmentId')::uuid and a.workspace_id = p_workspace_id;
    if v_existing is not null then return v_existing; end if;
  end if;
  if exists (select 1 from public.appointments a where a.workspace_id = p_workspace_id and a.status <> 'cancelled' and a.starts_at < p_starts_at + interval '30 minutes' and a.ends_at > p_starts_at) then
    raise exception 'That appointment window is no longer available' using errcode = '23P01';
  end if;
  insert into public.appointments (workspace_id, lead_id, title, appointment_type, starts_at, ends_at, location, notes, created_by, status)
  values (p_workspace_id, p_lead_id, p_title, 'inspection', p_starts_at, p_starts_at + interval '30 minutes', p_location, 'Booked by ROOF/OS AI receptionist.', p_created_by, 'scheduled') returning * into v_appointment;
  insert into public.receptionist_events (workspace_id, event_key, event_type, provider, payload)
  values (p_workspace_id, p_idempotency_key, 'appointment.booked', 'receptionist', jsonb_build_object('appointmentId', v_appointment.id, 'leadId', p_lead_id));
  return to_jsonb(v_appointment);
end;
$$;

revoke all on function public.book_receptionist_appointment(uuid, uuid, text, timestamptz, text, uuid, text) from public, anon, authenticated;
grant execute on function public.book_receptionist_appointment(uuid, uuid, text, timestamptz, text, uuid, text) to service_role;

commit;
