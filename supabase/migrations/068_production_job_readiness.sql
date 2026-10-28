-- Prebuild readiness decisions for a production job (additive)
--
-- The schedule (migration 067) proves who is assigned and what material is
-- planned. This table records the two facts that cannot be derived from other
-- rows: the permit decision and the weather decision. Deposit, crew and
-- material readiness stay derived from their own ledgers.
--
-- The database stamps who checked and when. A client cannot backdate a permit
-- or a weather check. No review flag is stored: readiness is computed on read.

create table if not exists public.production_job_readiness (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null unique references public.production_jobs(id) on delete cascade,
  permit_status text not null default 'unknown'
    check (permit_status in ('unknown','not_required','needed','applied','issued')),
  permit_reference text not null default '' check (char_length(permit_reference) <= 120),
  permit_checked_at timestamptz,
  permit_checked_by uuid references auth.users(id) on delete set null,
  weather_decision text not null default 'unknown'
    check (weather_decision in ('unknown','clear','hold')),
  weather_source text not null default '' check (char_length(weather_source) <= 200),
  weather_checked_at timestamptz,
  weather_checked_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (permit_status = 'unknown' or (permit_checked_at is not null and permit_checked_by is not null)),
  check (weather_decision = 'unknown' or (weather_checked_at is not null and weather_checked_by is not null))
);

create index if not exists production_job_readiness_workspace_idx
  on public.production_job_readiness (workspace_id, updated_at desc);

alter table public.production_job_readiness enable row level security;

drop policy if exists production_job_readiness_select on public.production_job_readiness;
create policy production_job_readiness_select on public.production_job_readiness
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_job_readiness_insert on public.production_job_readiness;
create policy production_job_readiness_insert on public.production_job_readiness
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists production_job_readiness_update on public.production_job_readiness;
create policy production_job_readiness_update on public.production_job_readiness
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- No delete policy. A readiness record is cancelled by changing a decision to
-- unknown or hold, never by removing the row.

create or replace function public.enforce_production_job_readiness()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.production_jobs%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'A prebuild readiness record cannot be deleted; record a new decision instead'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
       or new.job_id is distinct from old.job_id
       or new.created_at is distinct from old.created_at then
      raise exception 'The readiness job and workspace are immutable'
        using errcode = '23514';
    end if;

    -- The check time and checker are server owned. Restamp only when the
    -- decision itself changes, so editing a reference does not fake freshness.
    if new.permit_status is distinct from old.permit_status then
      if new.permit_status = 'unknown' then
        new.permit_checked_at := null;
        new.permit_checked_by := null;
      else
        new.permit_checked_at := now();
        new.permit_checked_by := auth.uid();
      end if;
    else
      new.permit_checked_at := old.permit_checked_at;
      new.permit_checked_by := old.permit_checked_by;
    end if;

    if new.weather_decision is distinct from old.weather_decision then
      if new.weather_decision = 'unknown' then
        new.weather_checked_at := null;
        new.weather_checked_by := null;
      else
        new.weather_checked_at := now();
        new.weather_checked_by := auth.uid();
      end if;
    else
      new.weather_checked_at := old.weather_checked_at;
      new.weather_checked_by := old.weather_checked_by;
    end if;

    new.updated_by := auth.uid();
    new.updated_at := now();
    return new;
  end if;

  select * into v_job from public.production_jobs where id = new.job_id;
  if not found then
    raise exception 'A readiness record must reference an existing production job'
      using errcode = '23503';
  end if;

  if v_job.workspace_id is distinct from new.workspace_id then
    raise exception 'The readiness record must belong to the job workspace'
      using errcode = '23514';
  end if;

  new.permit_checked_at := case when new.permit_status = 'unknown' then null else now() end;
  new.permit_checked_by := case when new.permit_status = 'unknown' then null else auth.uid() end;
  new.weather_checked_at := case when new.weather_decision = 'unknown' then null else now() end;
  new.weather_checked_by := case when new.weather_decision = 'unknown' then null else auth.uid() end;
  new.updated_by := auth.uid();
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_production_job_readiness on public.production_job_readiness;
create trigger enforce_production_job_readiness
  before insert or update or delete on public.production_job_readiness
  for each row execute function public.enforce_production_job_readiness();

revoke all on function public.enforce_production_job_readiness() from public, anon;
grant execute on function public.enforce_production_job_readiness() to authenticated;

comment on table public.production_job_readiness is
  'Owner-recorded permit and weather decisions for one production job. Deposit, crew and material readiness are derived from their own ledgers.';
comment on column public.production_job_readiness.permit_checked_at is
  'Server-stamped time of the current permit decision. Never supplied by the browser.';
comment on column public.production_job_readiness.weather_checked_at is
  'Server-stamped time of the current weather decision. Readiness treats it as stale after 24 hours.';
