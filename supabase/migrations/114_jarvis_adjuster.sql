-- Forward-only: fold the in-house autonomous adjuster into the existing JARVIS
-- control plane. This creates the single queue (jarvis_jobs) and the single
-- worker's job types; there is no second queue or second worker. The worker is
-- the only writer of claim state; every message is consent-gated and recorded
-- in adjuster_messages. No hosted migration is applied by source checks.

-- ---------------------------------------------------------------------------
-- Claim enrollment. Every lead/claim auto-enrolls unless explicitly disabled.
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
-- Durable queue. payload_hash and idempotency_key are NOT NULL by design:
-- an enqueue without both is a bug, never an acceptable default. Created after
-- adjuster_claims because jobs carry a real claim foreign key.
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
  claim_id uuid references public.adjuster_claims(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
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
-- the explicit toggle/enroll functions below. No cross-workspace write is
-- possible. Drop guards make a partially applied migration replayable.
-- ---------------------------------------------------------------------------
alter table public.jarvis_jobs enable row level security;
alter table public.adjuster_claims enable row level security;
alter table public.adjuster_messages enable row level security;
alter table public.workspace_adjuster_settings enable row level security;

drop policy if exists jarvis_jobs_member_read on public.jarvis_jobs;
drop policy if exists adjuster_claims_member_read on public.adjuster_claims;
drop policy if exists adjuster_messages_member_read on public.adjuster_messages;
drop policy if exists workspace_adjuster_settings_member_read on public.workspace_adjuster_settings;

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

-- Enqueue with mandatory hash and key. Authenticated callers must be workspace
-- members. The service-role path exists only for the trusted inbound worker;
-- both paths enforce the claim and workspace stop controls.
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
  claim_disabled boolean;
  workspace_enabled boolean;
begin
  if p_payload_hash is null or p_payload_hash = '' then
    raise exception 'payload_hash is required';
  end if;
  if p_idempotency_key is null or p_idempotency_key = '' then
    raise exception 'idempotency_key is required';
  end if;
  if auth.role() = 'service_role' then
    if not exists (select 1 from public.workspaces where id = p_workspace_id) then
      raise exception 'workspace not found';
    end if;
  elsif not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace membership required';
  end if;

  if p_claim_id is not null then
    select disabled into claim_disabled
      from public.adjuster_claims
      where id = p_claim_id and workspace_id = p_workspace_id;
    if not found then raise exception 'claim not found in workspace'; end if;
    if claim_disabled then raise exception 'claim is disabled'; end if;
  end if;

  select adjuster_enabled into workspace_enabled
    from public.workspace_adjuster_settings where workspace_id = p_workspace_id;
  if found and not workspace_enabled then raise exception 'adjuster disabled for workspace'; end if;

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

-- Enrollment RPC: the only supported claim write from an authenticated client.
-- The identity comes from deployment configuration passed by the server, never
-- from an arbitrary request body.
create or replace function public.adjuster_enroll_claim(
  p_workspace_id uuid,
  p_lead_id uuid,
  p_identity_id text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_id uuid;
  clean_identity text := '';
begin
  if auth.role() <> 'service_role' and not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace membership required';
  end if;
  if p_identity_id is not null and p_identity_id <> '' then
    if p_identity_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
      raise exception 'identity_id must be a UUID or empty';
    end if;
    clean_identity := p_identity_id;
  end if;
  if not exists (select 1 from public.leads where id = p_lead_id and workspace_id = p_workspace_id) then
    raise exception 'lead not found in workspace';
  end if;

  insert into public.workspace_adjuster_settings (workspace_id, identity_id)
    values (p_workspace_id, clean_identity)
  on conflict (workspace_id) do nothing;

  insert into public.adjuster_claims (workspace_id, lead_id, identity_id)
    values (p_workspace_id, p_lead_id, clean_identity)
  on conflict (workspace_id, lead_id) do update set updated_at = now()
  returning id into claim_id;
  return claim_id;
end;
$$;

-- Auto-enroll every new lead; backfill existing leads once. Both are idempotent.
create or replace function public.adjuster_auto_enroll_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_identity text := '';
begin
  select identity_id into configured_identity
    from public.workspace_adjuster_settings where workspace_id = new.workspace_id;
  insert into public.adjuster_claims (workspace_id, lead_id, identity_id)
    values (new.workspace_id, new.id, coalesce(configured_identity, ''))
  on conflict (workspace_id, lead_id) do nothing;
  return new;
end;
$$;

drop trigger if exists adjuster_leads_auto_enroll on public.leads;
create trigger adjuster_leads_auto_enroll
  after insert on public.leads
  for each row execute function public.adjuster_auto_enroll_lead();

insert into public.adjuster_claims (workspace_id, lead_id, identity_id)
  select l.workspace_id, l.id, coalesce(s.identity_id, '')
    from public.leads l
    left join public.workspace_adjuster_settings s on s.workspace_id = l.workspace_id
  on conflict (workspace_id, lead_id) do nothing;

-- Atomic inbound write: message and queue job in one service-role transaction,
-- after workspace binding, stop controls and claim-lead correlation all pass.
create or replace function public.adjuster_record_inbound(
  p_workspace_id uuid,
  p_claim_id uuid,
  p_identity_id text,
  p_channel text,
  p_contact text,
  p_body text,
  p_matched_lead_id uuid,
  p_payload_hash text,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_claim public.adjuster_claims%rowtype;
  workspace_enabled boolean;
  safe_lead text := '';
  safe_identity text := '';
  message_id uuid;
  job_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  select * into target_claim
    from public.adjuster_claims
    where id = p_claim_id and workspace_id = p_workspace_id
    for update;
  if not found then raise exception 'claim not found in configured workspace'; end if;
  if target_claim.disabled then raise exception 'claim is disabled'; end if;

  select adjuster_enabled into workspace_enabled
    from public.workspace_adjuster_settings where workspace_id = p_workspace_id;
  if found and not workspace_enabled then raise exception 'adjuster disabled for workspace'; end if;

  if target_claim.lead_id is distinct from p_matched_lead_id then
    raise exception 'sender does not match the claim lead';
  end if;

  if p_matched_lead_id is not null then safe_lead := p_matched_lead_id::text; end if;
  if p_identity_id is not null
     and p_identity_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
    safe_identity := p_identity_id;
  end if;

  insert into public.adjuster_messages (
    workspace_id, claim_id, identity_id, lead_id, channel, direction,
    body, consent_snapshot, idempotency_key
  ) values (
    p_workspace_id, p_claim_id, safe_identity, safe_lead, p_channel, 'inbound',
    p_body, jsonb_build_object('correlated', true, 'contact', p_contact), p_idempotency_key
  )
  on conflict (workspace_id, idempotency_key) do nothing
  returning id into message_id;

  insert into public.jarvis_jobs (
    workspace_id, type, payload, payload_hash, idempotency_key, claim_id, lead_id
  ) values (
    p_workspace_id, 'run_claim_plan',
    jsonb_build_object('claimId', p_claim_id, 'source', 'inbound'),
    p_payload_hash, p_idempotency_key, p_claim_id, p_matched_lead_id
  )
  on conflict (workspace_id, idempotency_key) do nothing
  returning id into job_id;

  return coalesce(job_id, message_id);
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
  if target_workspace is null then raise exception 'claim not found'; end if;
  if auth.role() <> 'service_role' and not public.is_workspace_member(target_workspace) then
    raise exception 'workspace membership required';
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
  if auth.role() <> 'service_role' and not public.is_workspace_admin(p_workspace_id) then
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
revoke all on function public.adjuster_enroll_claim(uuid, uuid, text) from public;
revoke all on function public.adjuster_set_claim_disabled(uuid, boolean) from public;
revoke all on function public.adjuster_set_workspace_enabled(uuid, boolean) from public;
revoke all on function public.adjuster_record_inbound(uuid, uuid, text, text, text, text, uuid, text, text) from public;
grant execute on function public.jarvis_enqueue_job(uuid, text, jsonb, text, text, uuid, uuid, timestamptz) to authenticated, service_role;
grant execute on function public.adjuster_enroll_claim(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.adjuster_set_claim_disabled(uuid, boolean) to authenticated, service_role;
grant execute on function public.adjuster_set_workspace_enabled(uuid, boolean) to authenticated, service_role;
grant execute on function public.adjuster_record_inbound(uuid, uuid, text, text, text, text, uuid, text, text) to service_role;

comment on table public.jarvis_jobs is 'The single JARVIS queue; adjuster jobs are ordinary jobs, not a second queue.';
comment on table public.adjuster_messages is 'Thread of record for autonomous adjuster outbound and inbound messages.';
comment on column public.workspace_adjuster_settings.plan_only is 'Plan-only default: execution requires explicit owner authorization.';
comment on function public.adjuster_record_inbound is 'Atomic service-role write after workspace binding, stop-control and claim-lead correlation checks.';
