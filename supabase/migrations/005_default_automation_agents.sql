-- ROOF/OS default automation-agent configuration
-- Depends on 002_workspaces_activity_storage.sql and 004_appointments_tasks.sql.

alter table public.tasks add column if not exists automation_key text;
create unique index if not exists tasks_automation_key_unique_idx
  on public.tasks (workspace_id, automation_key)
  where automation_key is not null;

create or replace function public.seed_default_automation_rules(target_workspace uuid, actor uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into public.automation_rules (workspace_id, agent_key, enabled, config, created_by)
  values
    (target_workspace, 'intake_router', true, '{"assignment":"owner_then_round_robin","first_response_hours":24,"duplicate_match":["email","phone","address"]}'::jsonb, actor),
    (target_workspace, 'scheduler', true, '{"follow_up_days":7,"reminder_hours":[24,2],"require_human_approval":true}'::jsonb, actor),
    (target_workspace, 'inspection_quality', true, '{"required_albums":["before","damage","measurements"],"require_caption":true}'::jsonb, actor),
    (target_workspace, 'office_copilot', false, '{"model":"ollama","require_human_approval":true}'::jsonb, actor)
  on conflict (workspace_id, agent_key) do update
    set config = excluded.config, updated_at = now();
end;
$$;

do $$
declare w record;
begin
  for w in
    select wm.workspace_id, wm.user_id
    from public.workspace_members wm
    where wm.role = 'owner'
  loop
    perform public.seed_default_automation_rules(w.workspace_id, w.user_id);
  end loop;
end $$;

create or replace function public.create_default_lead_followup()
returns trigger language plpgsql security definer set search_path = public
as $$
declare followup_key text;
declare followup_title text;
declare followup_hours integer;
begin
  if new.workspace_id is null then return new; end if;

  if tg_op = 'INSERT' then
    followup_key := 'intake:' || new.id::text;
    followup_title := 'First response: ' || new.name;
    followup_hours := 24;
  elsif new.status is distinct from old.status and new.status in ('qualified','inspected','report_approved') then
    followup_key := 'status:' || new.id::text || ':' || new.status;
    followup_title := 'Follow up: ' || new.name || ' (' || replace(new.status, '_', ' ') || ')';
    followup_hours := case when new.status = 'inspected' then 48 else 168 end;
  else
    return new;
  end if;

  insert into public.tasks (workspace_id, lead_id, title, due_at, assigned_to, created_by, status, notes, automation_key)
  values (new.workspace_id, new.id, followup_title, now() + make_interval(hours => followup_hours), new.owner_id, new.owner_id, 'open', 'Created by ROOF/OS scheduler agent default rule.', followup_key)
  on conflict (workspace_id, automation_key) do nothing;
  return new;
end;
$$;

drop trigger if exists default_lead_followup_trigger on public.leads;
create trigger default_lead_followup_trigger
after insert or update of status on public.leads
for each row execute function public.create_default_lead_followup();
