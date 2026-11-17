-- ContractorOS Release 1: governed control plane
-- Extends the existing ROOF/OS action ledger; does not create a parallel action gateway.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.contractor_authority_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role_key text not null,
  authority_level text not null default 'read'
    check (authority_level in ('read','prepare','approve','execute','coordinate','sustain','release')),
  capabilities jsonb not null default '[]'::jsonb,
  action_limits jsonb not null default '{}'::jsonb,
  prohibitions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, role_key)
);

create table if not exists public.contractor_mandates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mandate_key text not null,
  purpose text not null,
  scope jsonb not null default '{}'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  action_limits jsonb not null default '{}'::jsonb,
  prohibitions jsonb not null default '[]'::jsonb,
  resources jsonb not null default '{}'::jsonb,
  success_criteria jsonb not null default '{}'::jsonb,
  escalation_policy jsonb not null default '{}'::jsonb,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','active','paused','expired','cancelled','completed','revoked')),
  starts_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, mandate_key)
);

create table if not exists public.contractor_record_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  revision_status text not null default 'draft'
    check (revision_status in ('draft','review_required','reviewed','released','superseded','corrected','blocked')),
  snapshot jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  correction_of uuid references public.contractor_record_revisions(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  released_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  released_at timestamptz,
  unique (workspace_id, record_type, record_id, revision_number)
);

create table if not exists public.contractor_evidence_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  evidence_type text not null,
  original_ref text not null,
  derived_data jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed','review_required','accepted','rejected','superseded')),
  captured_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  captured_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.contractor_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  source text not null,
  record_type text,
  record_id uuid,
  source_revision integer,
  occurred_at timestamptz,
  recorded_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  correlation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','ignored','failed','outcome_unknown')),
  reconciliation_state text not null default 'not_required'
    check (reconciliation_state in ('not_required','pending','reconciled','blocked')),
  processed_at timestamptz,
  unique (workspace_id, event_key)
);

create table if not exists public.contractor_work_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mandate_id uuid references public.contractor_mandates(id) on delete set null,
  execution_key text not null,
  objective text not null,
  plan_version integer not null default 1 check (plan_version > 0),
  status text not null default 'planned'
    check (status in ('planned','running','waiting','paused','completed','failed','outcome_unknown','cancelled','reconciled')),
  state jsonb not null default '{}'::jsonb,
  assignments jsonb not null default '[]'::jsonb,
  completed_effects jsonb not null default '[]'::jsonb,
  pending_actions jsonb not null default '[]'::jsonb,
  waits jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  authority_snapshot jsonb not null default '{}'::jsonb,
  resource_consumption jsonb not null default '{}'::jsonb,
  verification jsonb not null default '{}'::jsonb,
  recovery jsonb not null default '{}'::jsonb,
  stop_conditions jsonb not null default '[]'::jsonb,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, execution_key)
);

alter table public.agent_action_batches
  add column if not exists mandate_id uuid references public.contractor_mandates(id) on delete set null,
  add column if not exists target_scope jsonb not null default '{}'::jsonb,
  add column if not exists expected_revisions jsonb not null default '{}'::jsonb,
  add column if not exists verification_state text not null default 'not_started'
    check (verification_state in ('not_started','pending','verified','failed','unknown','reconciled')),
  add column if not exists recovery_options jsonb not null default '[]'::jsonb,
  add column if not exists external_reference text;

alter table public.agent_actions
  add column if not exists mandate_id uuid references public.contractor_mandates(id) on delete set null,
  add column if not exists target_scope jsonb not null default '{}'::jsonb,
  add column if not exists expected_revision text,
  add column if not exists approval_reference text,
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists verification_state text not null default 'not_started'
    check (verification_state in ('not_started','pending','verified','failed','unknown','reconciled')),
  add column if not exists recovery_options jsonb not null default '[]'::jsonb,
  add column if not exists external_reference text;

create index if not exists contractor_authority_profiles_workspace_active_idx
  on public.contractor_authority_profiles (workspace_id, active, role_key);
create index if not exists contractor_mandates_workspace_status_idx
  on public.contractor_mandates (workspace_id, status, expires_at);
create index if not exists contractor_record_revisions_record_idx
  on public.contractor_record_revisions (workspace_id, record_type, record_id, revision_number desc);
create index if not exists contractor_evidence_record_idx
  on public.contractor_evidence_items (workspace_id, record_type, record_id, captured_at desc);
create index if not exists contractor_events_processing_idx
  on public.contractor_events (workspace_id, processing_status, recorded_at);
create index if not exists contractor_work_executions_status_idx
  on public.contractor_work_executions (workspace_id, status, updated_at desc);
create index if not exists agent_action_batches_mandate_idx
  on public.agent_action_batches (workspace_id, mandate_id, created_at desc);
create index if not exists agent_actions_mandate_idx
  on public.agent_actions (workspace_id, mandate_id, created_at desc);

create or replace function public.contractor_can_manage_control_plane(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_system_owner() or public.is_workspace_admin(target_workspace);
$$;

revoke all on function public.contractor_can_manage_control_plane(uuid) from public, anon;
grant execute on function public.contractor_can_manage_control_plane(uuid) to authenticated;

alter table public.contractor_authority_profiles enable row level security;
alter table public.contractor_mandates enable row level security;
alter table public.contractor_record_revisions enable row level security;
alter table public.contractor_evidence_items enable row level security;
alter table public.contractor_events enable row level security;
alter table public.contractor_work_executions enable row level security;

drop policy if exists contractor_authority_profiles_select on public.contractor_authority_profiles;
create policy contractor_authority_profiles_select on public.contractor_authority_profiles
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists contractor_authority_profiles_manage on public.contractor_authority_profiles;
create policy contractor_authority_profiles_manage on public.contractor_authority_profiles
  for all using (public.contractor_can_manage_control_plane(workspace_id))
  with check (public.contractor_can_manage_control_plane(workspace_id));

drop policy if exists contractor_mandates_select on public.contractor_mandates;
create policy contractor_mandates_select on public.contractor_mandates
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists contractor_mandates_manage on public.contractor_mandates;
create policy contractor_mandates_manage on public.contractor_mandates
  for all using (public.contractor_can_manage_control_plane(workspace_id))
  with check (public.contractor_can_manage_control_plane(workspace_id));

drop policy if exists contractor_record_revisions_select on public.contractor_record_revisions;
create policy contractor_record_revisions_select on public.contractor_record_revisions
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists contractor_evidence_items_select on public.contractor_evidence_items;
create policy contractor_evidence_items_select on public.contractor_evidence_items
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists contractor_events_select on public.contractor_events;
create policy contractor_events_select on public.contractor_events
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists contractor_work_executions_select on public.contractor_work_executions;
create policy contractor_work_executions_select on public.contractor_work_executions
  for select using (public.is_workspace_member(workspace_id));

comment on table public.contractor_authority_profiles is 'Owner-configurable role authority and capability limits for ContractorOS actions.';
comment on table public.contractor_mandates is 'Bounded owner-directed objectives with scope, limits, expiry, escalation, and cancellation.';
comment on table public.contractor_record_revisions is 'Generic revision and source lineage ledger for consequential ContractorOS records.';
comment on table public.contractor_evidence_items is 'Original evidence and derived candidates; review status prevents unreviewed conclusions becoming final.';
comment on table public.contractor_events is 'Deduplicated event intake with delayed/out-of-order and reconciliation states.';
comment on table public.contractor_work_executions is 'Persistent AI/workflow execution state for waits, recovery, verification, and manual takeover.';
