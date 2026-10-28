-- Sales -> production job handoff (new migration; does not edit 004, 007 or 063).
--
-- A production job is created from one accepted estimate. The job keeps an
-- immutable snapshot of the customer, the accepted amount and the approved
-- scope, so later estimate edits or a superseded estimate cannot silently
-- change what production was told to build.
--
-- The database owns the handoff. The browser cannot choose the job number,
-- the lead, the accepted total or the scope.

create table if not exists public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_number text not null check (char_length(job_number) between 1 and 40),
  lead_id uuid not null references public.leads(id) on delete restrict,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  acceptance_id uuid not null references public.estimate_acceptances(id) on delete restrict,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 200),
  property_address text not null check (char_length(btrim(property_address)) between 1 and 500),
  status text not null default 'ready'
    check (status in ('ready','scheduled','in_progress','completed','cancelled')),
  accepted_total numeric(12,2) not null check (accepted_total > 0),
  accepted_at timestamptz not null,
  estimate_formula_version text not null default '',
  approved_scope jsonb not null default '[]'::jsonb
    check (jsonb_typeof(approved_scope) = 'array'),
  scope_item_count integer not null default 0 check (scope_item_count > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One production handoff per estimate. Creating a second job is a conflict,
  -- not a new version.
  constraint production_jobs_one_per_estimate unique (estimate_id),
  constraint production_jobs_job_number_workspace unique (workspace_id, job_number)
);

create index if not exists production_jobs_workspace_created_idx
  on public.production_jobs (workspace_id, created_at desc);
create index if not exists production_jobs_lead_idx
  on public.production_jobs (lead_id, created_at desc);

alter table public.production_jobs enable row level security;

drop policy if exists production_jobs_select on public.production_jobs;
create policy production_jobs_select on public.production_jobs
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists production_jobs_insert on public.production_jobs;
create policy production_jobs_insert on public.production_jobs
  for insert with check (
    public.is_workspace_member(workspace_id)
    and auth.uid() = created_by
  );

-- Status moves are allowed; source evidence is not. The trigger enforces both.
drop policy if exists production_jobs_update on public.production_jobs;
create policy production_jobs_update on public.production_jobs
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- No delete policy: a handoff is cancelled, not erased.

create or replace function public.enforce_production_job_handoff()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estimate public.estimates%rowtype;
  v_acceptance public.estimate_acceptances%rowtype;
  v_lead public.leads%rowtype;
  v_scope jsonb := '[]'::jsonb;
  v_scope_count integer := 0;
begin
  if tg_op = 'DELETE' then
    raise exception 'A production job handoff cannot be deleted; cancel it instead'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
       or new.job_number is distinct from old.job_number
       or new.lead_id is distinct from old.lead_id
       or new.estimate_id is distinct from old.estimate_id
       or new.acceptance_id is distinct from old.acceptance_id
       or new.customer_name is distinct from old.customer_name
       or new.property_address is distinct from old.property_address
       or new.accepted_total is distinct from old.accepted_total
       or new.accepted_at is distinct from old.accepted_at
       or new.estimate_formula_version is distinct from old.estimate_formula_version
       or new.approved_scope is distinct from old.approved_scope
       or new.scope_item_count is distinct from old.scope_item_count
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'The production handoff source evidence is immutable'
        using errcode = '23514';
    end if;

    if new.status is distinct from old.status then
      if not (
        (old.status = 'ready' and new.status in ('scheduled','in_progress','cancelled'))
        or (old.status = 'scheduled' and new.status in ('in_progress','cancelled'))
        or (old.status = 'in_progress' and new.status in ('completed','cancelled'))
      ) then
        raise exception 'Invalid production job status transition from % to %', old.status, new.status
          using errcode = '23514';
      end if;
    end if;

    new.updated_at := now();
    return new;
  end if;

  -- INSERT: every source field is read from the database, not the request.
  select * into v_estimate from public.estimates where id = new.estimate_id;
  if not found then
    raise exception 'A production job must reference an existing estimate'
      using errcode = '23503';
  end if;

  if v_estimate.workspace_id is distinct from new.workspace_id then
    raise exception 'A production job must belong to the estimate workspace'
      using errcode = '23514';
  end if;

  if v_estimate.status <> 'approved' then
    raise exception 'The estimate must be approved before production handoff (current status: %)', v_estimate.status
      using errcode = '23514';
  end if;

  if v_estimate.lead_id is null then
    raise exception 'A production job needs the estimate customer before handoff'
      using errcode = '23514';
  end if;

  select * into v_acceptance from public.estimate_acceptances
   where id = new.acceptance_id;
  if not found then
    raise exception 'A production job must reference a recorded acceptance'
      using errcode = '23503';
  end if;

  if v_acceptance.estimate_id is distinct from v_estimate.id
     or v_acceptance.workspace_id is distinct from v_estimate.workspace_id then
    raise exception 'The acceptance must belong to the estimate being handed off'
      using errcode = '23514';
  end if;

  if v_acceptance.accepted_total <= 0 then
    raise exception 'A production job needs a real priced estimate'
      using errcode = '23514';
  end if;

  select * into v_lead from public.leads where id = v_estimate.lead_id;
  if not found then
    raise exception 'A production job must reference the estimate customer'
      using errcode = '23503';
  end if;

  if v_lead.workspace_id is distinct from v_estimate.workspace_id then
    raise exception 'The customer must belong to the estimate workspace'
      using errcode = '23514';
  end if;

  if v_lead.status = 'lost' then
    raise exception 'A lost lead cannot be handed off to production'
      using errcode = '23514';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'line_item_id', li.id,
             'item_code', li.item_code,
             'description', li.description,
             'category', li.category,
             'unit', li.unit,
             'quantity', li.quantity,
             'unit_cost', li.unit_cost,
             'line_total', li.line_total,
             'source_snapshot', li.source_snapshot
           ) order by li.id
         ), '[]'::jsonb),
         count(*)
    into v_scope, v_scope_count
  from public.estimate_line_items li
  where li.estimate_id = v_estimate.id;

  if v_scope_count = 0 then
    raise exception 'A production job needs at least one approved scope line item'
      using errcode = '23514';
  end if;

  if not public.is_workspace_member(new.workspace_id) then
    raise exception 'Workspace membership is required to create a production job'
      using errcode = '23514';
  end if;

  -- Server-owned identity and evidence.
  new.job_number := 'JOB-' || upper(substr(replace(new.id::text, '-', ''), 1, 12));
  new.lead_id := v_estimate.lead_id;
  new.customer_name := v_lead.name;
  new.property_address := v_lead.address;
  new.status := 'ready';
  new.accepted_total := v_acceptance.accepted_total;
  new.accepted_at := v_acceptance.accepted_at;
  new.estimate_formula_version := v_acceptance.estimate_formula_version;
  new.approved_scope := v_scope;
  new.scope_item_count := v_scope_count;
  new.created_at := now();
  new.updated_at := now();

  -- One writer for the customer handoff: the job, not the browser.
  update public.leads
     set status = 'won',
         next_action = 'Prepare production job',
         next_action_due = null,
         next_action_owner_id = new.created_by,
         updated_at = now()
   where id = v_estimate.lead_id;

  return new;
end;
$$;

comment on function public.enforce_production_job_handoff() is
  'Sales to production gate: approved estimate, recorded acceptance, real priced scope, immutable source evidence, one job per estimate.';

drop trigger if exists enforce_production_job_handoff on public.production_jobs;
create trigger enforce_production_job_handoff
  before insert or update or delete on public.production_jobs
  for each row execute function public.enforce_production_job_handoff();

revoke all on function public.enforce_production_job_handoff() from public, anon;
grant execute on function public.enforce_production_job_handoff() to authenticated;

comment on table public.production_jobs is
  'Immutable sales-to-production handoff from one accepted estimate. Status changes are allowed; source evidence is not.';
