-- ROOF/OS runtime contracts for idempotent agents and authorized claims imports

create table if not exists public.claims_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('capout','licensed_provider','supplier_feed','owner_import')),
  external_document_id text,
  source_uri text,
  source_sha256 text,
  status text not null default 'received' check (status in ('received','processing','ready_for_review','approved','rejected','failed')),
  market text,
  effective_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, external_document_id)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_key text not null check (agent_key in ('intake_router','scheduler','inspection_quality','office_copilot')),
  event_key text not null,
  trigger text not null,
  status text not null check (status in ('queued','running','succeeded','failed','needs_review','skipped')),
  input_reference jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  model_name text,
  prompt_version text,
  approval_state text not null default 'not_required' check (approval_state in ('not_required','pending','approved','rejected')),
  attempt integer not null default 1 check (attempt > 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, agent_key, event_key)
);

create index if not exists claims_imports_workspace_status_idx on public.claims_imports (workspace_id, status, created_at desc);
create index if not exists agent_runs_workspace_agent_idx on public.agent_runs (workspace_id, agent_key, created_at desc);

alter table public.claims_imports enable row level security;
alter table public.agent_runs enable row level security;

create policy claims_imports_select on public.claims_imports for select using (public.is_workspace_member(workspace_id));
create policy claims_imports_write on public.claims_imports for all using (public.is_workspace_admin(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_admin(workspace_id) and auth.uid() = created_by);
create policy agent_runs_select on public.agent_runs for select using (public.is_workspace_member(workspace_id));

-- Workers use a narrowly scoped server-side credential after validating workspace ownership.
-- There is intentionally no client insert/update policy for agent_runs.

create or replace function public.claims_import_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists claims_imports_touch_updated_at on public.claims_imports;
create trigger claims_imports_touch_updated_at before update on public.claims_imports for each row execute function public.claims_import_touch_updated_at();
