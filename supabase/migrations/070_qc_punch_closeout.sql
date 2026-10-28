-- QC punch list and supervisor closeout gate (additive)
--
-- Punch items are the QC defects found on a production job. Any workspace
-- member may record one and resolve one. A resolved item is immutable: a
-- correction is a new item.
--
-- A supervisor closeout is one immutable record per job. It can only be
-- recorded while the job is in progress and only when no critical punch item
-- is open. Completion of the job is gated on that closeout and on a fresh
-- check of open critical items, so a defect added after closeout still blocks
-- completion.
--
-- Nothing here changes the handoff snapshot, the schedule, the deposit, the
-- change orders, or any customer record.

create table if not exists public.production_job_punch_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete cascade,
  severity text not null check (severity in ('critical','major','minor')),
  location text not null default '' check (char_length(location) <= 200),
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text not null default '' check (char_length(resolution_note) <= 1000),
  check (
    (status = 'open' and resolved_by is null and resolved_at is null and resolution_note = '')
    or (status = 'resolved' and resolved_by is not null and resolved_at is not null)
  )
);

create index if not exists production_job_punch_items_job_idx
  on public.production_job_punch_items (job_id, created_at);

alter table public.production_job_punch_items enable row level security;

drop policy if exists production_job_punch_items_select on public.production_job_punch_items;
create policy production_job_punch_items_select on public.production_job_punch_items
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_job_punch_items_insert on public.production_job_punch_items;
create policy production_job_punch_items_insert on public.production_job_punch_items
  for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists production_job_punch_items_update on public.production_job_punch_items;
create policy production_job_punch_items_update on public.production_job_punch_items
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- No delete policy. A wrong item is resolved with a note or superseded by a
-- new item; it is never erased.

create or replace function public.enforce_production_job_punch_item()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.production_jobs%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'A punch item cannot be deleted; resolve it or record a new item'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'open' then
      raise exception 'A resolved punch item is immutable'
        using errcode = '23514';
    end if;

    if new.status <> 'resolved' then
      raise exception 'A punch item update must resolve the item'
        using errcode = '23514';
    end if;

    if new.workspace_id is distinct from old.workspace_id
       or new.job_id is distinct from old.job_id
       or new.severity is distinct from old.severity
       or new.location is distinct from old.location
       or new.description is distinct from old.description
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'The punch item fields are immutable; only the resolution may change'
        using errcode = '23514';
    end if;

    select * into v_job from public.production_jobs where id = old.job_id;
    if v_job.status = 'completed' or v_job.status = 'cancelled' then
      raise exception 'A completed or cancelled job cannot resolve punch items'
        using errcode = '23514';
    end if;

    new.resolved_by := auth.uid();
    new.resolved_at := now();
    return new;
  end if;

  select * into v_job from public.production_jobs where id = new.job_id;
  if not found then
    raise exception 'A punch item must reference an existing production job'
      using errcode = '23503';
  end if;

  if v_job.workspace_id is distinct from new.workspace_id then
    raise exception 'The punch item must belong to the job workspace'
      using errcode = '23514';
  end if;

  if v_job.status = 'completed' or v_job.status = 'cancelled' then
    raise exception 'A completed or cancelled job cannot take new punch items'
      using errcode = '23514';
  end if;

  -- A new item always starts open. A client-supplied resolution is ignored.
  new.status := 'open';
  new.created_by := auth.uid();
  new.created_at := now();
  new.resolved_by := null;
  new.resolved_at := null;
  new.resolution_note := '';
  return new;
end;
$$;

drop trigger if exists enforce_production_job_punch_item on public.production_job_punch_items;
create trigger enforce_production_job_punch_item
  before insert or update or delete on public.production_job_punch_items
  for each row execute function public.enforce_production_job_punch_item();

revoke all on function public.enforce_production_job_punch_item() from public, anon;
grant execute on function public.enforce_production_job_punch_item() to authenticated;

create table if not exists public.production_job_closeouts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete cascade,
  closed_by uuid not null references auth.users(id) on delete restrict,
  closed_at timestamptz not null default now(),
  note text not null default '' check (char_length(note) <= 2000),
  open_critical_count integer not null check (open_critical_count >= 0),
  open_total_count integer not null check (open_total_count >= 0),
  created_at timestamptz not null default now(),
  constraint production_job_closeouts_one_per_job unique (job_id)
);

alter table public.production_job_closeouts enable row level security;

drop policy if exists production_job_closeouts_select on public.production_job_closeouts;
create policy production_job_closeouts_select on public.production_job_closeouts
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_job_closeouts_insert on public.production_job_closeouts;
create policy production_job_closeouts_insert on public.production_job_closeouts
  for insert with check (public.is_workspace_admin(workspace_id));

-- No update or delete policy. A closeout is recorded once and never edited.

create or replace function public.enforce_production_job_closeout()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.production_jobs%rowtype;
  v_critical integer;
  v_open integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'A supervisor closeout cannot be deleted'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'A supervisor closeout is immutable'
      using errcode = '23514';
  end if;

  select * into v_job from public.production_jobs where id = new.job_id;
  if not found then
    raise exception 'A supervisor closeout must reference an existing production job'
      using errcode = '23503';
  end if;

  if v_job.workspace_id is distinct from new.workspace_id then
    raise exception 'The supervisor closeout must belong to the job workspace'
      using errcode = '23514';
  end if;

  if not public.is_workspace_admin(new.workspace_id) then
    raise exception 'Workspace owner or administrator access is required to record a closeout'
      using errcode = '42501';
  end if;

  if v_job.status <> 'in_progress' then
    raise exception 'A supervisor closeout can only be recorded while the job is in progress'
      using errcode = '23514';
  end if;

  select
    count(*) filter (where status = 'open' and severity = 'critical'),
    count(*) filter (where status = 'open')
    into v_critical, v_open
  from public.production_job_punch_items
  where job_id = new.job_id;

  if v_critical > 0 then
    raise exception 'A supervisor closeout is blocked by % unresolved critical punch item(s)', v_critical
      using errcode = '23514';
  end if;

  -- Server-owned evidence.
  new.closed_by := auth.uid();
  new.closed_at := now();
  new.open_critical_count := v_critical;
  new.open_total_count := v_open;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_production_job_closeout on public.production_job_closeouts;
create trigger enforce_production_job_closeout
  before insert or update or delete on public.production_job_closeouts
  for each row execute function public.enforce_production_job_closeout();

revoke all on function public.enforce_production_job_closeout() from public, anon;
grant execute on function public.enforce_production_job_closeout() to authenticated;

-- Completion is gated twice: the closeout must exist, and no critical punch
-- item may be open at the moment of completion. The second check catches a
-- defect recorded after the closeout.
create or replace function public.enforce_production_job_completion_gate()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if not exists (
      select 1 from public.production_job_closeouts
      where job_id = new.id and workspace_id = new.workspace_id
    ) then
      raise exception 'A production job needs a supervisor closeout before completion'
        using errcode = '23514';
    end if;

    if exists (
      select 1 from public.production_job_punch_items
      where job_id = new.id and status = 'open' and severity = 'critical'
    ) then
      raise exception 'A production job cannot complete with unresolved critical punch items'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_production_job_completion_gate on public.production_jobs;
create trigger enforce_production_job_completion_gate
  before update on public.production_jobs
  for each row execute function public.enforce_production_job_completion_gate();

revoke all on function public.enforce_production_job_completion_gate() from public, anon;
grant execute on function public.enforce_production_job_completion_gate() to authenticated;

comment on table public.production_job_punch_items is
  'QC defects for one production job. Open critical items block the supervisor closeout.';
comment on table public.production_job_closeouts is
  'One immutable supervisor closeout per job. Required before the job can be completed.';
comment on column public.production_job_punch_items.resolved_by is
  'Server-stamped member who resolved the item. Never supplied by the browser.';
comment on column public.production_job_closeouts.closed_by is
  'Server-stamped owner or administrator. Never supplied by the browser.';
