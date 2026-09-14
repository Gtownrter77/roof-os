-- ROOF/OS appointments and follow-up scheduling
-- Depends on 002_workspaces_activity_storage.sql.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  title text not null,
  appointment_type text not null default 'follow_up' check (appointment_type in ('inspection','meeting','follow_up','review','delivery','other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  title text not null,
  due_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'open' check (status in ('open','completed','dismissed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_key text not null check (agent_key in ('intake_router','scheduler','inspection_quality','office_copilot')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, agent_key)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_key text not null check (agent_key in ('intake_router','scheduler','inspection_quality','office_copilot')),
  event_key text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','needs_review')),
  model_name text,
  input_ref jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, event_key)
);

create index if not exists appointments_workspace_starts_idx on public.appointments (workspace_id, starts_at);
create index if not exists appointments_lead_starts_idx on public.appointments (lead_id, starts_at);
create index if not exists tasks_workspace_due_idx on public.tasks (workspace_id, due_at);

alter table public.appointments enable row level security;
alter table public.tasks enable row level security;
alter table public.automation_rules enable row level security;
alter table public.agent_runs enable row level security;

drop policy if exists appointments_select on public.appointments;
drop policy if exists appointments_insert on public.appointments;
drop policy if exists appointments_update on public.appointments;
drop policy if exists appointments_delete on public.appointments;
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;
drop policy if exists automation_rules_select on public.automation_rules;
drop policy if exists automation_rules_write on public.automation_rules;
drop policy if exists agent_runs_select on public.agent_runs;
drop policy if exists agent_runs_insert on public.agent_runs;

create policy appointments_select on public.appointments for select using (public.is_workspace_member(workspace_id));
create policy appointments_insert on public.appointments for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy appointments_update on public.appointments for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy appointments_delete on public.appointments for delete using (public.is_workspace_member(workspace_id));
create policy tasks_select on public.tasks for select using (public.is_workspace_member(workspace_id));
create policy tasks_insert on public.tasks for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy tasks_update on public.tasks for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy tasks_delete on public.tasks for delete using (public.is_workspace_member(workspace_id));
create policy automation_rules_select on public.automation_rules for select using (public.is_workspace_member(workspace_id));
create policy automation_rules_write on public.automation_rules for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy agent_runs_select on public.agent_runs for select using (public.is_workspace_member(workspace_id));
create policy agent_runs_insert on public.agent_runs for insert with check (public.is_workspace_member(workspace_id));
