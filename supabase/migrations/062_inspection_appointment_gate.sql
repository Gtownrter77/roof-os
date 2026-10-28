-- Qualification -> inspection appointment handoff (new migration; does not edit 004).
--
-- An inspection appointment for a lead is only valid when the lead is qualified.
-- Creating one assigns the appointment, moves the lead to inspection_scheduled and
-- sets the single next action, so two devices cannot drift apart.

create or replace function public.enforce_inspection_appointment()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lead public.leads%rowtype;
begin
  if new.appointment_type <> 'inspection' or new.lead_id is null then
    return new;
  end if;

  select * into v_lead from public.leads where id = new.lead_id;
  if not found then
    raise exception 'An inspection appointment must reference an existing lead.'
      using errcode = '23503';
  end if;

  if v_lead.workspace_id is distinct from new.workspace_id then
    raise exception 'An inspection appointment must belong to the lead workspace.'
      using errcode = '23514';
  end if;

  -- Every inspection has an owner: the explicit assignee or the creator.
  if new.assigned_to is null then
    new.assigned_to := new.created_by;
  end if;

  if not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = new.workspace_id and m.user_id = new.assigned_to
  ) then
    raise exception 'An inspection must be assigned to a workspace member.'
      using errcode = '23514';
  end if;

  if new.status = 'cancelled' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_lead.status not in ('qualified', 'inspection_scheduled') then
      raise exception 'The lead must be qualified before an inspection can be scheduled (current status: %).', v_lead.status
        using errcode = '23514';
    end if;

    if exists (
      select 1 from public.appointments a
      where a.lead_id = new.lead_id
        and a.appointment_type = 'inspection'
        and a.status = 'scheduled'
    ) then
      raise exception 'This lead already has a scheduled inspection.'
        using errcode = '23505';
    end if;
  end if;

  -- One writer for the handoff: the appointment, not the browser.
  update public.leads
     set status = 'inspection_scheduled',
         next_action = 'Complete inspection',
         next_action_due = new.starts_at,
         next_action_owner_id = new.assigned_to,
         updated_at = now()
   where id = new.lead_id;

  return new;
end;
$$;

comment on function public.enforce_inspection_appointment() is
  'Inspection appointment gate: qualified lead, workspace member assignee, one scheduled inspection, lead next action.';

drop trigger if exists enforce_inspection_appointment on public.appointments;
create trigger enforce_inspection_appointment
  before insert or update of lead_id, appointment_type, starts_at, assigned_to, status
  on public.appointments
  for each row execute function public.enforce_inspection_appointment();

revoke all on function public.enforce_inspection_appointment() from public, anon;
grant execute on function public.enforce_inspection_appointment() to authenticated;
