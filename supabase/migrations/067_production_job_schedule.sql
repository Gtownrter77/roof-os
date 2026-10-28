-- Production job schedule: crew assignments and material lines (additive)
--
-- Both tables hang off one immutable production handoff (migration 064).
-- Schedule records never change the handoff's customer, amount or scope.
-- Members read the schedule; workspace owners/admins write it.
-- Records are cancelled, not deleted.

create table if not exists public.production_job_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete restrict,
  role text not null default 'crew'
    check (role in ('crew_lead','crew','material_runner')),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','confirmed','cancelled')),
  notes text not null default '' check (char_length(notes) <= 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end > scheduled_start)
);

create index if not exists production_job_assignments_job_idx
  on public.production_job_assignments (job_id, scheduled_start);
create index if not exists production_job_assignments_workspace_idx
  on public.production_job_assignments (workspace_id, created_at desc);

create table if not exists public.production_job_materials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete cascade,
  line_item_id uuid references public.estimate_line_items(id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 1 and 300),
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null check (char_length(btrim(unit)) between 1 and 16),
  status text not null default 'needed'
    check (status in ('needed','ordered','delivered','cancelled')),
  needed_by date,
  vendor text not null default '' check (char_length(vendor) <= 120),
  notes text not null default '' check (char_length(notes) <= 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_job_materials_job_idx
  on public.production_job_materials (job_id, created_at);
create index if not exists production_job_materials_workspace_idx
  on public.production_job_materials (workspace_id, created_at desc);

alter table public.production_job_assignments enable row level security;
alter table public.production_job_materials enable row level security;

drop policy if exists production_job_assignments_select on public.production_job_assignments;
create policy production_job_assignments_select on public.production_job_assignments
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_job_assignments_insert on public.production_job_assignments;
create policy production_job_assignments_insert on public.production_job_assignments
  for insert with check (
    public.is_workspace_admin(workspace_id)
    and auth.uid() = created_by
  );

drop policy if exists production_job_assignments_update on public.production_job_assignments;
create policy production_job_assignments_update on public.production_job_assignments
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists production_job_materials_select on public.production_job_materials;
create policy production_job_materials_select on public.production_job_materials
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_job_materials_insert on public.production_job_materials;
create policy production_job_materials_insert on public.production_job_materials
  for insert with check (
    public.is_workspace_admin(workspace_id)
    and auth.uid() = created_by
  );

drop policy if exists production_job_materials_update on public.production_job_materials;
create policy production_job_materials_update on public.production_job_materials
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- No delete policies on either table: cancel the record instead.

create or replace function public.enforce_production_job_assignment()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.production_jobs%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'A production assignment cannot be deleted; cancel it instead'
      using errcode = '23514';
  end if;

  select * into v_job from public.production_jobs where id = coalesce(new.job_id, old.job_id);
  if not found then
    raise exception 'A production assignment must reference an existing job'
      using errcode = '23503';
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
       or new.job_id is distinct from old.job_id
       or new.member_user_id is distinct from old.member_user_id
       or new.role is distinct from old.role
       or new.scheduled_start is distinct from old.scheduled_start
       or new.scheduled_end is distinct from old.scheduled_end
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'The assignment source fields are immutable; change status or notes'
        using errcode = '23514';
    end if;

    if new.status is distinct from old.status then
      if not (
        (old.status = 'scheduled' and new.status in ('confirmed','cancelled'))
        or (old.status = 'confirmed' and new.status = 'cancelled')
      ) then
        raise exception 'Invalid assignment status transition from % to %', old.status, new.status
          using errcode = '23514';
      end if;
    end if;

    new.updated_at := now();
    return new;
  end if;

  if v_job.workspace_id is distinct from new.workspace_id then
    raise exception 'The assignment must belong to the job workspace'
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = new.workspace_id and user_id = new.member_user_id
  ) then
    raise exception 'The assigned person must belong to this workspace'
      using errcode = '23514';
  end if;

  if new.scheduled_end <= new.scheduled_start then
    raise exception 'A production assignment must end after it starts'
      using errcode = '23514';
  end if;

  new.status := 'scheduled';
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_production_job_assignment on public.production_job_assignments;
create trigger enforce_production_job_assignment
  before insert or update or delete on public.production_job_assignments
  for each row execute function public.enforce_production_job_assignment();

create or replace function public.enforce_production_job_material()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.production_jobs%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'A material line cannot be deleted; cancel it instead'
      using errcode = '23514';
  end if;

  select * into v_job from public.production_jobs where id = coalesce(new.job_id, old.job_id);
  if not found then
    raise exception 'A material line must reference an existing job'
      using errcode = '23503';
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
       or new.job_id is distinct from old.job_id
       or new.line_item_id is distinct from old.line_item_id
       or new.description is distinct from old.description
       or new.quantity is distinct from old.quantity
       or new.unit is distinct from old.unit
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'The material source fields are immutable; change status, vendor, date or notes'
        using errcode = '23514';
    end if;

    if new.status is distinct from old.status then
      if not (
        (old.status = 'needed' and new.status in ('ordered','cancelled'))
        or (old.status = 'ordered' and new.status in ('delivered','cancelled'))
      ) then
        raise exception 'Invalid material status transition from % to %', old.status, new.status
          using errcode = '23514';
      end if;
    end if;

    new.updated_at := now();
    return new;
  end if;

  if v_job.workspace_id is distinct from new.workspace_id then
    raise exception 'The material line must belong to the job workspace'
      using errcode = '23514';
  end if;

  if new.line_item_id is not null and not exists (
    select 1 from public.estimate_line_items li
    where li.id = new.line_item_id and li.estimate_id = v_job.estimate_id
  ) then
    raise exception 'A material line may only reference its own approved estimate scope'
      using errcode = '23514';
  end if;

  new.status := 'needed';
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_production_job_material on public.production_job_materials;
create trigger enforce_production_job_material
  before insert or update or delete on public.production_job_materials
  for each row execute function public.enforce_production_job_material();

revoke all on function public.enforce_production_job_assignment() from public, anon;
revoke all on function public.enforce_production_job_material() from public, anon;
grant execute on function public.enforce_production_job_assignment() to authenticated;
grant execute on function public.enforce_production_job_material() to authenticated;

comment on table public.production_job_assignments is
  'Crew assignment for one immutable production handoff. Workspace members read; owners/admins write.';
comment on table public.production_job_materials is
  'Material line for one production job, optionally linked to its approved estimate scope line.';
