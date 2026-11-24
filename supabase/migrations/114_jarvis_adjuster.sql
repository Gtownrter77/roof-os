-- Forward-only: fold the in-house autonomous adjuster into the existing JARVIS
-- control plane. One queue, one worker, fifteen logical agents. The worker is
-- the only writer of claim state; every message is consent-gated and recorded
-- in adjuster_messages. No hosted migration is applied by source checks.

-- ---------------------------------------------------------------------------
-- Durable queue. payload_hash and idempotency_key are NOT NULL by design:
-- an enqueue without both is a bug, never an acceptable default.
-- ---------------------------------------------------------------------------
create table if not exists public.jarvis_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null check (type in (
    'run_claim_plan', 'update_claim_status', 'send_message',
    'generate_document', 'extract_estimate', 'sandbox_action'
  )),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  idempotency_key text not null,
  attempts integer not null default 0,
  claim_id uuid,
  lead_id uuid,
  run_after timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text,
  unique (workspace_id, idempotency_key)
);

create index if not exists jarvis_jobs_ready_idx
  on public.jarvis_jobs (status, run_after) where status = 'queued';
create index if not exists jarvis_jobs_claim_idx on public.jarvis_jobs (claim_id);

-- ---------------------------------------------------------------------------
-- Claim enrollment. Every claim auto-enrolls unless explicitly disabled.
-- ---------------------------------------------------------------------------
create table if not exists public.adjuster_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'new' check (status in ('new','planned','contacted','estimating','quoted','won','lost','cancelled')),
  disabled boolean not null default false,
  identity_id text not null default '',
  time_zone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, lead_id)
);

-- ---------------------------------------------------------------------------
-- Thread of record. identity_id and lead_id may be '' only when genuinely
-- absent; they are never filled with 'unknown' or with the claim id.
-- ---------------------------------------------------------------------------
create table if not exists public.adjuster_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  claim_id uuid not null references public.adjuster_claims(id) on delete cascade,
  identity_id text not null default '',
  lead_id text not null default '',
  channel text not null check (channel in ('sms','email','voice','internal')),
  direction text not null check (direction in ('inbound','outbound','internal')),
  body text not null,
  consent_snapshot jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists adjuster_messages_claim_idx
  on public.adjuster_messages (claim_id, created_at);

-- ---------------------------------------------------------------------------
-- Workspace kill switch and plan-only default. PLAN ONLY unless an owner
-- explicitly authorizes execution.
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_adjuster_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  adjuster_enabled boolean not null default true,
  plan_only boolean not null default true,
  identity_id text not null default '',
  inbound_channels text[] not null default array['sms','email']::text[],
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: workspace members read; writes go through the service-role worker or
-- the explicit toggle functions below. No cross-workspace write is possible.
-- ---------------------------------------------------------------------------
alter table public.jarvis_jobs enable row level security;
alter table public.adjuster_claims enable row level security;
alter table public.adjuster_messages enable row level security;
alter table public.workspace_adjuster_settings enable row level security;

create policy jarvis_jobs_member_read on public.jarvis_jobs
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy adjuster_claims_member_read on public.adjuster_claims
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy adjuster_messages_member_read on public.adjuster_messages
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy workspace_adjuster_settings_member_read on public.workspace_adjuster_settings
  for select to authenticated using (public.is_workspace_member(workspace_id));

grant select on public.jarvis_jobs, public.adjuster_claims,
  public.adjuster_messages, public.workspace_adjuster_settings to authenticated;

-- Enqueue with mandatory hash and key. Called by the server with the signed-in
-- user's client; RLS restricts the workspace to one the caller belongs to.
create or replace function public.jarvis_enqueue_job(
  p_workspace_id uuid,
  p_type text,
  p_payload jsonb,
  p_payload_hash text,
  p_idempotency_key text,
  p_claim_id uuid default null,
  p_lead_id uuid default null,
  p_run_after timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  job_id uuid;
begin
  if p_payload_hash is null or p_payload_hash = '' then
    raise exception 'payload_hash is required';
  end if;
  if p_idempotency_key is null or p_idempotency_key = '' then
    raise exception 'idempotency_key is required';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace membership required';
  end if;
  insert into public.jarvis_jobs (
    workspace_id, type, payload, payload_hash, idempotency_key,
    claim_id, lead_id, run_after
  ) values (
    p_workspace_id, p_type, coalesce(p_payload, '{}'::jsonb), p_payload_hash,
    p_idempotency_key, p_claim_id, p_lead_id, p_run_after
  )
  on conflict (workspace_id, idempotency_key) do nothing
  returning id into job_id;
  return job_id;
end;
$$;

-- Stop control. Cancels queued work for the claim in the same transaction.
create or replace function public.adjuster_set_claim_disabled(
  p_claim_id uuid,
  p_disabled boolean
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
begin
  select workspace_id into target_workspace
    from public.adjuster_claims where id = p_claim_id;
  if target_workspace is null or not public.is_workspace_member(target_workspace) then
    raise exception 'claim not found in caller workspace';
  end if;
  update public.adjuster_claims
    set disabled = p_disabled, updated_at = now()
    where id = p_claim_id;
  if p_disabled then
    update public.jarvis_jobs
      set status = 'cancelled', updated_at = now()
      where claim_id = p_claim_id and status = 'queued';
  end if;
  return true;
end;
$$;

create or replace function public.adjuster_set_workspace_enabled(
  p_workspace_id uuid,
  p_enabled boolean
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_admin(p_workspace_id) then
    raise exception 'workspace admin required';
  end if;
  insert into public.workspace_adjuster_settings (workspace_id, adjuster_enabled, updated_at)
    values (p_workspace_id, p_enabled, now())
  on conflict (workspace_id) do update
    set adjuster_enabled = excluded.adjuster_enabled, updated_at = now();
  if not p_enabled then
    update public.jarvis_jobs
      set status = 'cancelled', updated_at = now()
      where workspace_id = p_workspace_id and status = 'queued';
  end if;
  return true;
end;
$$;

revoke all on function public.jarvis_enqueue_job(uuid, text, jsonb, text, text, uuid, uuid, timestamptz) from public;
revoke all on function public.adjuster_set_claim_disabled(uuid, boolean) from public;
revoke all on function public.adjuster_set_workspace_enabled(uuid, boolean) from public;
grant execute on function public.jarvis_enqueue_job(uuid, text, jsonb, text, text, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.adjuster_set_claim_disabled(uuid, boolean) to authenticated;
grant execute on function public.adjuster_set_workspace_enabled(uuid, boolean) to authenticated;

comment on table public.jarvis_jobs is 'Single existing JARVIS queue; adjuster jobs are ordinary jobs, not a second queue.';
comment on table public.adjuster_messages is 'Thread of record for autonomous adjuster outbound and inbound messages.';
comment on column public.workspace_adjuster_settings.plan_only is 'Plan-only default: execution requires explicit owner authorization.';
