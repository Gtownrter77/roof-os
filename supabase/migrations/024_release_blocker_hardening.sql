-- Release blocker hardening: reconcile legacy agent_runs and gate supplement approvals.

-- Migration 004 used (workspace_id,event_key), while the runtime contract uses
-- (workspace_id,agent_key,event_key). Remove only the legacy two-column unique.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'agent_runs'
      and c.contype = 'u'
      and (select array_agg(a.attname order by a.attname)
           from pg_attribute a
           where a.attrelid = t.oid and a.attnum = any(c.conkey)) = array['event_key','workspace_id']::text[]
  loop
    execute format('alter table public.agent_runs drop constraint if exists %I', constraint_name);
  end loop;
end $$;

-- Keep one deterministic record if a pre-hardening database already contains duplicates.
with ranked as (
  select id, row_number() over (partition by workspace_id, agent_key, event_key order by created_at desc, id desc) as row_number
  from public.agent_runs
)
delete from public.agent_runs a using ranked r
where a.id = r.id and r.row_number > 1;

create unique index if not exists agent_runs_workspace_agent_event_uidx
  on public.agent_runs (workspace_id, agent_key, event_key);

alter table public.agent_runs add column if not exists lease_owner text;
alter table public.agent_runs add column if not exists lease_expires_at timestamptz;
alter table public.agent_runs add column if not exists claimed_at timestamptz;

-- Workers claim an event atomically; a second worker cannot run a live lease.
create or replace function public.claim_agent_run(
  p_workspace_id uuid,
  p_agent_key text,
  p_event_key text,
  p_trigger text,
  p_input_reference jsonb,
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns public.agent_runs
language plpgsql
security definer
set search_path = public
as $$
declare result public.agent_runs;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'lease duration must be between 30 and 3600 seconds';
  end if;
  insert into public.agent_runs (workspace_id, agent_key, event_key, trigger, status, input_reference, attempt, lease_owner, lease_expires_at, claimed_at)
  values (p_workspace_id, p_agent_key, p_event_key, p_trigger, 'running', coalesce(p_input_reference, '{}'::jsonb), 1, p_worker_id, now() + make_interval(secs => p_lease_seconds), now())
  on conflict (workspace_id, agent_key, event_key) do update
    set status = 'running', trigger = excluded.trigger, input_reference = excluded.input_reference,
        attempt = public.agent_runs.attempt + 1, lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at, claimed_at = excluded.claimed_at,
        started_at = now(), finished_at = null, error_message = null
    where public.agent_runs.status not in ('succeeded','needs_review')
      and (public.agent_runs.lease_expires_at is null or public.agent_runs.lease_expires_at < now())
  returning * into result;
  return result;
end;
$$;

revoke all on function public.claim_agent_run(uuid, text, text, text, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.claim_agent_run(uuid, text, text, text, jsonb, text, integer) to service_role;

drop policy if exists agent_runs_insert on public.agent_runs;
drop policy if exists agent_runs_select on public.agent_runs;
create policy agent_runs_select on public.agent_runs
  for select using (public.is_workspace_member(workspace_id));

-- Only owners/admins may approve or reject supplements. Members may still read.
drop policy if exists supplements_update on public.supplements;
create policy supplements_update on public.supplements
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

update public.supplements set reviewed_at = coalesce(reviewed_at, updated_at, created_at), reviewed_by = coalesce(reviewed_by, created_by) where status in ('approved','rejected') and (reviewed_by is null or reviewed_at is null);
alter table public.supplements add constraint supplements_review_fields_check
  check ((status = 'needs_review' and reviewed_by is null and reviewed_at is null)
      or (status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null));
