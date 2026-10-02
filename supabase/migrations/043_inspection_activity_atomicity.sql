-- Keep inspection scheduling and inspection starts atomic with their lead activity trail.
-- Depends on the existing lead, activity, appointment, and inspection-session tables.

create or replace function public.record_inspection_appointment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.appointment_type = 'inspection' and new.lead_id is not null then
    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.created_by
    ) then
      raise exception 'Appointment creator is not a workspace member' using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.leads l
      where l.id = new.lead_id
        and l.workspace_id = new.workspace_id
    ) then
      raise exception 'Lead does not belong to the appointment workspace' using errcode = '23514';
    end if;

    update public.leads
    set status = 'inspection_scheduled',
        next_action = 'Complete inspection',
        next_action_due = new.starts_at,
        next_action_owner_id = coalesce(auth.uid(), new.created_by),
        updated_at = now()
    where id = new.lead_id
      and workspace_id = new.workspace_id;

    insert into public.lead_activity (
      lead_id, workspace_id, user_id, kind, body
    ) values (
      new.lead_id,
      new.workspace_id,
      coalesce(auth.uid(), new.created_by),
      'note',
      'appointment_scheduled: Inspection scheduled for ' || new.starts_at::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists appointment_inspection_activity on public.appointments;
create trigger appointment_inspection_activity
after insert on public.appointments
for each row execute function public.record_inspection_appointment_activity();

create or replace function public.record_inspection_start_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_id is not null then
    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.created_by
    ) then
      raise exception 'Inspection creator is not a workspace member' using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.leads l
      where l.id = new.lead_id
        and l.workspace_id = new.workspace_id
    ) then
      raise exception 'Lead does not belong to the inspection workspace' using errcode = '23514';
    end if;

    insert into public.lead_activity (
      lead_id, workspace_id, user_id, kind, body
    ) values (
      new.lead_id,
      new.workspace_id,
      coalesce(auth.uid(), new.created_by),
      'note',
      'inspection_started: Inspection started (' || new.id::text || ')'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists inspection_session_start_activity on public.inspection_sessions;
create trigger inspection_session_start_activity
after insert on public.inspection_sessions
for each row execute function public.record_inspection_start_activity();

revoke execute on function public.record_inspection_appointment_activity() from public, anon, authenticated;
revoke execute on function public.record_inspection_start_activity() from public, anon, authenticated;
