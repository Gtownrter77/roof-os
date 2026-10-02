-- ROOF/OS CRM missing spokes
-- Depends on the existing lead/workspace/activity/task model.
-- Adds first-class next actions, transparent lead scoring, stalled detection,
-- and structured lost reasons without introducing a second CRM or database.

alter table public.leads
  add column if not exists next_action text,
  add column if not exists next_action_due timestamptz,
  add column if not exists next_action_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists lead_score integer not null default 0,
  add column if not exists lead_score_reasons jsonb not null default '[]'::jsonb,
  add column if not exists lost_reason text,
  add column if not exists lost_reason_detail text,
  add column if not exists lost_at timestamptz,
  add column if not exists qualified_at timestamptz,
  add column if not exists last_activity_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_lost_reason_check') then
    alter table public.leads add constraint leads_lost_reason_check
      check (lost_reason is null or lost_reason in (
        'price','no_response','competitor','insurance_denied',
        'customer_canceled','outside_service_area','duplicate','bad_lead','other'
      ));
  end if;
end $$;

create index if not exists leads_workspace_next_action_idx
  on public.leads (workspace_id, next_action_due)
  where next_action is not null;

create index if not exists leads_workspace_score_idx
  on public.leads (workspace_id, lead_score desc);

create index if not exists leads_workspace_activity_idx
  on public.leads (workspace_id, last_activity_at desc);

create or replace function public.refresh_lead_score(target_lead_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  l public.leads%rowtype;
  score integer := 0;
  reasons jsonb := '[]'::jsonb;
begin
  select * into l from public.leads where id = target_lead_id;
  if not found then return; end if;

  if nullif(trim(l.phone), '') is not null then
    score := score + 15;
    reasons := reasons || jsonb_build_array('Phone present');
  end if;
  if nullif(trim(l.email), '') is not null then
    score := score + 15;
    reasons := reasons || jsonb_build_array('Email present');
  end if;
  if nullif(trim(l.address), '') is not null then
    score := score + 15;
    reasons := reasons || jsonb_build_array('Property address present');
  end if;
  if coalesce(l.source, 'manual') <> 'manual' then
    score := score + 10;
    reasons := reasons || jsonb_build_array('Known lead source');
  end if;

  case l.status
    when 'assigned' then
      score := score + 5;
      reasons := reasons || jsonb_build_array('Assigned');
    when 'qualified' then
      score := score + 20;
      reasons := reasons || jsonb_build_array('Qualified');
    when 'inspection_scheduled' then
      score := score + 25;
      reasons := reasons || jsonb_build_array('Inspection scheduled');
    when 'inspected' then
      score := score + 30;
      reasons := reasons || jsonb_build_array('Inspection completed');
    when 'report_pending' then
      score := score + 30;
      reasons := reasons || jsonb_build_array('Report pending');
    when 'report_approved' then
      score := score + 35;
      reasons := reasons || jsonb_build_array('Report approved');
    when 'won' then
      score := 100;
      reasons := reasons || jsonb_build_array('Won');
    when 'lost' then
      score := 0;
      reasons := reasons || jsonb_build_array('Lost');
    else
      null;
  end case;

  update public.leads
  set lead_score = least(score, 100),
      lead_score_reasons = reasons,
      updated_at = now()
  where id = target_lead_id;
end;
$$;

create or replace function public.refresh_lead_activity_timestamp()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.leads
  set last_activity_at = greatest(coalesce(last_activity_at, '-infinity'::timestamptz), new.created_at),
      updated_at = now()
  where id = new.lead_id;
  return new;
end;
$$;

drop trigger if exists lead_activity_updates_lead on public.lead_activity;
create trigger lead_activity_updates_lead
after insert on public.lead_activity
for each row execute function public.refresh_lead_activity_timestamp();

create or replace function public.refresh_lead_score_trigger()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.refresh_lead_score(new.id);
  return new;
end;
$$;

drop trigger if exists leads_refresh_score on public.leads;
create trigger leads_refresh_score
after insert or update of phone, email, address, source, status on public.leads
for each row execute function public.refresh_lead_score_trigger();

update public.leads l
set workspace_id = wm.workspace_id
from public.workspace_members wm
where l.workspace_id is null
  and wm.user_id = l.owner_id;

update public.leads l
set last_activity_at = a.latest_activity
from (
  select lead_id, max(created_at) as latest_activity
  from public.lead_activity
  group by lead_id
) a
where l.id = a.lead_id
  and (l.last_activity_at is null or a.latest_activity > l.last_activity_at);

do $$
declare r record;
begin
  for r in select id from public.leads loop
    perform public.refresh_lead_score(r.id);
  end loop;
end $$;

revoke execute on function public.refresh_lead_score(uuid) from public, anon, authenticated;
revoke execute on function public.refresh_lead_activity_timestamp() from public, anon, authenticated;
revoke execute on function public.refresh_lead_score_trigger() from public, anon, authenticated;

comment on column public.leads.next_action is 'The single next operational action required to move this lead forward.';
comment on column public.leads.next_action_due is 'Due time for the next operational action.';
comment on column public.leads.next_action_owner_id is 'Workspace member responsible for the next action.';
comment on column public.leads.lead_score is 'Transparent 0-100 operational priority score, not an AI judgment.';
comment on column public.leads.lead_score_reasons is 'Human-readable reasons contributing to lead_score.';
comment on column public.leads.lost_reason is 'Controlled reason a lead was lost.';
comment on column public.leads.lost_reason_detail is 'Optional free-text context for the lost reason.';
