-- A foreman SOS survives assignment edits and schedule changes.
create table public.job_safety_holds (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.production_jobs(id),
  opened_by uuid not null references auth.users(id),
  opened_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users(id)
);
create unique index job_one_active_hold on public.job_safety_holds(job_id) where released_at is null;
alter table public.job_safety_holds enable row level security;
create policy read_job_safety_hold on public.job_safety_holds for select to authenticated using (
  exists (select 1 from public.production_jobs j where j.id = job_id and public.is_workspace_member(j.workspace_id))
);

create function public.foreman_sos(target_job uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare j public.production_jobs; incident uuid;
begin
  select * into j from public.production_jobs where id = target_job for update;
  if j.id is null or j.status not in ('scheduled','in_progress','ready') or
    not exists (select 1 from public.workspace_members m where m.workspace_id=j.workspace_id and m.user_id=auth.uid()) or
    not exists (select 1 from public.production_job_assignments a where a.job_id=j.id
      and a.workspace_id=j.workspace_id and a.member_user_id=auth.uid() and a.role='crew_lead'
      and a.status <> 'cancelled' and now() between a.scheduled_start and a.scheduled_end)
    then raise exception 'Active foreman assignment required' using errcode='42501'; end if;
  select id into incident from public.job_safety_holds where job_id=j.id and released_at is null;
  if incident is not null then return incident; end if;
  insert into public.job_safety_holds(job_id,opened_by) values(j.id,auth.uid()) returning id into incident;
  insert into public.tasks(workspace_id,lead_id,title,notes,assigned_to,created_by,due_at)
    select j.workspace_id,j.lead_id,'SOS — stop work at ' || j.property_address,
      'Foreman SOS for job ' || j.job_number || '. Incident ' || incident, recipient,auth.uid(),now()
    from (select user_id as recipient from public.workspace_members where workspace_id=j.workspace_id and role in ('owner','admin')
      union select member_user_id from public.production_job_assignments where job_id=j.id and status <> 'cancelled') recipients;
  return incident;
end $$;
revoke all on function public.foreman_sos(uuid) from public,anon;
grant execute on function public.foreman_sos(uuid) to authenticated;

create function public.enforce_job_safety_hold() returns trigger language plpgsql set search_path='' security definer as $$
begin
  if new.status is distinct from old.status and new.status in ('in_progress','completed') and
    exists(select 1 from public.job_safety_holds where job_id=new.id and released_at is null)
    then raise exception 'Foreman SOS hold requires a safety review'; end if;
  return new;
end $$;
create trigger enforce_job_safety_hold before update of status on public.production_jobs
for each row execute function public.enforce_job_safety_hold();
