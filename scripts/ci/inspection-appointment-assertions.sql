-- Run only after migration 062 is applied to a disposable PostgreSQL database.
\set ON_ERROR_STOP on
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
insert into public.workspaces(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.workspace_members(workspace_id,user_id,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','member'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','owner');

insert into public.leads(id,workspace_id,owner_id,name,address,status) values
 ('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Qualified Lead','1 Synthetic Way','qualified'),
 ('10000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','New Lead','2 Synthetic Way','new'),
 ('10000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','Other Workspace Lead','3 Synthetic Way','qualified'),
 ('10000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Second Qualified Lead','4 Synthetic Way','qualified'),
 ('10000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Third Qualified Lead','5 Synthetic Way','qualified');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

-- 1. Scheduling an inspection on a qualified lead assigns it and writes the next action.
insert into public.appointments (workspace_id,lead_id,title,appointment_type,starts_at,ends_at,location,created_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000001',
        'Inspection: Qualified Lead','inspection','2026-11-03 15:00:00+00','2026-11-03 16:00:00+00',
        '1 Synthetic Way','11111111-1111-4111-8111-111111111111');

do $$
declare v_lead public.leads%rowtype; v_appt public.appointments%rowtype;
begin
  select * into v_lead from public.leads where id='10000000-0000-4000-8000-000000000001';
  if v_lead.status <> 'inspection_scheduled' then
    raise exception 'FAILURE: lead status is %, expected inspection_scheduled', v_lead.status;
  end if;
  if v_lead.next_action <> 'Complete inspection' then
    raise exception 'FAILURE: next action is %, expected Complete inspection', v_lead.next_action;
  end if;
  if v_lead.next_action_due <> '2026-11-03 15:00:00+00'::timestamptz then
    raise exception 'FAILURE: next action due is not the appointment start';
  end if;
  if v_lead.next_action_owner_id <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'FAILURE: next action has no assigned owner';
  end if;
  select * into v_appt from public.appointments where lead_id='10000000-0000-4000-8000-000000000001';
  if v_appt.assigned_to <> '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'FAILURE: appointment was not auto-assigned to the creator';
  end if;
end $$;

-- 2. A second scheduled inspection for the same lead is refused.
do $$
begin
  begin
    insert into public.appointments (workspace_id,lead_id,title,appointment_type,starts_at,ends_at,created_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000001',
            'Inspection duplicate','inspection','2026-11-04 15:00:00+00','2026-11-04 16:00:00+00',
            '11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: second inspection appointment was accepted';
  exception when unique_violation then
    raise notice 'Expected duplicate inspection rejection: %',SQLERRM;
  end;
end $$;

-- 3. An unqualified lead cannot be scheduled.
do $$
begin
  begin
    insert into public.appointments (workspace_id,lead_id,title,appointment_type,starts_at,ends_at,created_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000002',
            'Inspection: New Lead','inspection','2026-11-05 15:00:00+00','2026-11-05 16:00:00+00',
            '11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: inspection scheduled for an unqualified lead';
  exception when check_violation then
    raise notice 'Expected qualification gate rejection: %',SQLERRM;
  end;
  if (select status from public.leads where id='10000000-0000-4000-8000-000000000002') <> 'new' then
    raise exception 'SECURITY FAILURE: rejected insert still moved the lead';
  end if;
end $$;

-- 4. The lead and the appointment must share a workspace.
do $$
begin
  begin
    insert into public.appointments (workspace_id,lead_id,title,appointment_type,starts_at,ends_at,created_by)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000003',
            'Inspection: Other Workspace','inspection','2026-11-06 15:00:00+00','2026-11-06 16:00:00+00',
            '11111111-1111-4111-8111-111111111111');
    raise exception 'SECURITY FAILURE: cross-workspace inspection was accepted';
  exception when check_violation then
    raise notice 'Expected cross-workspace rejection: %',SQLERRM;
  end;
end $$;

-- 5. The assignee must be a workspace member.
do $$
begin
  begin
    insert into public.appointments (workspace_id,lead_id,title,appointment_type,starts_at,ends_at,created_by,assigned_to)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000004',
            'Inspection: outsider assignee','inspection','2026-11-07 15:00:00+00','2026-11-07 16:00:00+00',
            '11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333');
    raise exception 'SECURITY FAILURE: non-member was assigned an inspection';
  exception when check_violation then
    raise notice 'Expected assignee membership rejection: %',SQLERRM;
  end;
end $$;

-- 6. A non-lead inspection (calendar entry) is not blocked.
insert into public.appointments (workspace_id,title,appointment_type,starts_at,ends_at,created_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Generic inspection visit','inspection',
        '2026-11-08 15:00:00+00','2026-11-08 16:00:00+00','11111111-1111-4111-8111-111111111111');

-- 7. A member can schedule and is the default assignee.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
insert into public.appointments (workspace_id,lead_id,title,appointment_type,starts_at,ends_at,created_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000005',
        'Inspection: member scheduled','inspection','2026-11-09 15:00:00+00','2026-11-09 16:00:00+00',
        '22222222-2222-4222-8222-222222222222');

do $$
declare v_lead public.leads%rowtype; v_appt public.appointments%rowtype;
begin
  select * into v_lead from public.leads where id='10000000-0000-4000-8000-000000000005';
  if v_lead.next_action_owner_id <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'FAILURE: next action owner is not the scheduling member';
  end if;
  select * into v_appt from public.appointments where lead_id='10000000-0000-4000-8000-000000000005';
  if v_appt.assigned_to <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'FAILURE: appointment assignee is not the scheduling member';
  end if;
end $$;
reset role;

select 'PASS: qualification gate, one scheduled inspection, auto-assignment, lead next action, cross-workspace and non-member rejection, non-lead inspection allowed' as result;
