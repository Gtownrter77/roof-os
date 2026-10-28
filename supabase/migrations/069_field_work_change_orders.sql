-- Field work evidence and change-order review (additive)
--
-- Daily updates are append-only field evidence. A change order is a request
-- that a workspace owner or administrator approves or declines. Neither one
-- changes the immutable handoff snapshot from migration 064: the approved
-- change-order total is a separate record for later invoicing, never a silent
-- rewrite of the customer, accepted amount, or approved scope.

create table if not exists public.production_job_updates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete cascade,
  work_date date not null,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  percent_complete integer check (percent_complete is null or percent_complete between 0 and 100),
  blockers text not null default '' check (char_length(blockers) <= 1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists production_job_updates_job_idx
  on public.production_job_updates (job_id, work_date desc, created_at desc);

alter table public.production_job_updates enable row level security;

drop policy if exists production_job_updates_select on public.production_job_updates;
create policy production_job_updates_select on public.production_job_updates
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_job_updates_insert on public.production_job_updates;
create policy production_job_updates_insert on public.production_job_updates
  for insert with check (public.is_workspace_member(workspace_id));

-- No update or delete policy. Field evidence is append-only.

create or replace function public.enforce_production_job_update()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.production_jobs%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'A field update cannot be deleted; add a correcting update instead'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'A field update is append-only; add a correcting update instead'
      using errcode = '23514';
  end if;

  select * into v_job from public.production_jobs where id = new.job_id;
  if not found then
    raise exception 'A field update must reference an existing production job'
      using errcode = '23503';
  end if;

  if v_job.workspace_id is distinct from new.workspace_id then
    raise exception 'The field update must belong to the job workspace'
      using errcode = '23514';
  end if;

  if v_job.status = 'completed' or v_job.status = 'cancelled' then
    raise exception 'A completed or cancelled job cannot take new field updates'
      using errcode = '23514';
  end if;

  if new.work_date > current_date then
    raise exception 'A field update cannot be dated in the future'
      using errcode = '23514';
  end if;

  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_production_job_update on public.production_job_updates;
create trigger enforce_production_job_update
  before insert or update or delete on public.production_job_updates
  for each row execute function public.enforce_production_job_update();

revoke all on function public.enforce_production_job_update() from public, anon;
grant execute on function public.enforce_production_job_update() to authenticated;

create table if not exists public.production_job_change_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  reason text not null default '' check (char_length(reason) <= 1000),
  amount_delta numeric(12,2) not null check (amount_delta <> 0),
  status text not null default 'requested'
    check (status in ('requested','approved','declined')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '' check (char_length(decision_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'requested' and decided_by is null and decided_at is null)
    or (status in ('approved','declined') and decided_by is not null and decided_at is not null)
  )
);

create index if not exists production_job_change_orders_job_idx
  on public.production_job_change_orders (job_id, created_at desc);

alter table public.production_job_change_orders enable row level security;

drop policy if exists production_job_change_orders_select on public.production_job_change_orders;
create policy production_job_change_orders_select on public.production_job_change_orders
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_job_change_orders_insert on public.production_job_change_orders;
create policy production_job_change_orders_insert on public.production_job_change_orders
  for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists production_job_change_orders_update on public.production_job_change_orders;
create policy production_job_change_orders_update on public.production_job_change_orders
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- No delete policy. A change order is declined, never removed.

create or replace function public.enforce_production_job_change_order()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.production_jobs%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'A change order cannot be deleted; decline it instead'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'requested' then
      raise exception 'A decided change order is immutable'
        using errcode = '23514';
    end if;

    if new.status = old.status then
      raise exception 'A change order decision must approve or decline the request'
        using errcode = '23514';
    end if;

    if new.status not in ('approved','declined') then
      raise exception 'Invalid change order decision'
        using errcode = '23514';
    end if;

    if new.workspace_id is distinct from old.workspace_id
       or new.job_id is distinct from old.job_id
       or new.requested_by is distinct from old.requested_by
       or new.description is distinct from old.description
       or new.reason is distinct from old.reason
       or new.amount_delta is distinct from old.amount_delta
       or new.created_at is distinct from old.created_at then
      raise exception 'The change order request fields are immutable; only the decision may change'
        using errcode = '23514';
    end if;

    new.decided_by := auth.uid();
    new.decided_at := now();
    new.updated_at := now();
    return new;
  end if;

  select * into v_job from public.production_jobs where id = new.job_id;
  if not found then
    raise exception 'A change order must reference an existing production job'
      using errcode = '23503';
  end if;

  if v_job.workspace_id is distinct from new.workspace_id then
    raise exception 'The change order must belong to the job workspace'
      using errcode = '23514';
  end if;

  if v_job.status = 'completed' or v_job.status = 'cancelled' then
    raise exception 'A completed or cancelled job cannot take a new change order'
      using errcode = '23514';
  end if;

  new.requested_by := auth.uid();
  new.status := 'requested';
  new.decided_by := null;
  new.decided_at := null;
  new.decision_note := '';
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_production_job_change_order on public.production_job_change_orders;
create trigger enforce_production_job_change_order
  before insert or update or delete on public.production_job_change_orders
  for each row execute function public.enforce_production_job_change_order();

revoke all on function public.enforce_production_job_change_order() from public, anon;
grant execute on function public.enforce_production_job_change_order() to authenticated;

comment on table public.production_job_updates is
  'Append-only daily field evidence for one production job. Never changes the handoff snapshot.';
comment on table public.production_job_change_orders is
  'Owner-reviewed scope change requests. An approved amount is a separate invoice input and never rewrites the handoff approved_scope.';
comment on column public.production_job_change_orders.decided_by is
  'Server-stamped owner or administrator who approved or declined. Never supplied by the browser.';
