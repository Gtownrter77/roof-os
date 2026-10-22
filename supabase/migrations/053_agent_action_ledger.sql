-- ROOF/OS Agent Action Ledger
-- Agents may propose work; only approved, exact action payloads may execute.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.agent_action_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  batch_key text not null,
  status text not null default 'proposed' check (status in ('proposed','awaiting_approval','approved','partially_approved','executing','executed','rejected','expired','failed')),
  risk_level text not null default 'internal' check (risk_level in ('none','internal','customer_communication','operational','financial','legal')),
  summary text not null,
  expires_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  approval_token_hash text,
  created_at timestamptz not null default now(),
  execution_started_at timestamptz,
  execution_finished_at timestamptz,
  unique (workspace_id, batch_key)
);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  batch_id uuid not null references public.agent_action_batches(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  kind text not null,
  subject_type text not null,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  reason text not null,
  source_evidence jsonb not null default '[]'::jsonb,
  risk_level text not null check (risk_level in ('none','internal','customer_communication','operational','financial','legal')),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','executing','executed','skipped','failed')),
  idempotency_key text not null,
  requires_approval boolean not null default true,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  executed_at timestamptz,
  result jsonb,
  error_message text,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  unique (batch_id, sequence)
);

create table if not exists public.agent_approval_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  batch_id uuid not null references public.agent_action_batches(id) on delete cascade,
  action_ids uuid[] not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approval_method text not null default 'one_touch' check (approval_method in ('one_touch','explicit_detail','system_policy')),
  approval_summary_hash text not null,
  approved_payload_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_action_batches_workspace_status_idx
  on public.agent_action_batches (workspace_id, status, created_at desc);
create index if not exists agent_actions_batch_status_idx
  on public.agent_actions (batch_id, status, sequence);
create index if not exists agent_actions_workspace_created_idx
  on public.agent_actions (workspace_id, created_at desc);
create index if not exists agent_approval_events_batch_idx
  on public.agent_approval_events (batch_id, created_at desc);

alter table public.agent_action_batches enable row level security;
alter table public.agent_actions enable row level security;
alter table public.agent_approval_events enable row level security;

drop policy if exists agent_action_batches_select on public.agent_action_batches;
create policy agent_action_batches_select on public.agent_action_batches
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists agent_actions_select on public.agent_actions;
create policy agent_actions_select on public.agent_actions
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists agent_approval_events_select on public.agent_approval_events;
create policy agent_approval_events_select on public.agent_approval_events
  for select using (public.is_workspace_member(workspace_id));

-- Proposed actions and execution results are written by the server-side worker.
-- Human approval is exposed through a narrowly scoped application RPC in a later batch;
-- do not add broad client update policies here.
comment on table public.agent_action_batches is 'Server-created proposed action bundles requiring policy checks and, when applicable, one-touch human approval.';
comment on table public.agent_actions is 'Immutable proposed side effects with exact payload hashes and idempotency keys.';
comment on table public.agent_approval_events is 'Append-only record binding a human approval to exact action IDs and payload hashes.';

create or replace function public.approve_agent_action_batch(
  p_batch_id uuid,
  p_action_ids uuid[],
  p_approval_summary_hash text,
  p_approved_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_workspace uuid;
  selected_count integer;
  distinct_count integer;
  action_count integer;
  expected_summary_hash text;
  expected_payload_hash text;
  updated_count integer;
  current_user_id uuid := auth.uid();
  now_at timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_batch_id is null or coalesce(array_length(p_action_ids, 1), 0) = 0 then
    raise exception 'batch and action IDs are required';
  end if;
  if coalesce(trim(p_approval_summary_hash), '') = '' or coalesce(trim(p_approved_payload_hash), '') = '' then
    raise exception 'approval hashes are required';
  end if;

  select b.workspace_id, count(a.id)::integer
    into batch_workspace, action_count
    from public.agent_action_batches b
    left join public.agent_actions a on a.batch_id = b.id
   where b.id = p_batch_id
   group by b.workspace_id;

  if batch_workspace is null then raise exception 'action batch not found'; end if;
  if not public.is_workspace_admin(batch_workspace) then raise exception 'workspace administrator access is required'; end if;

  select count(*)::integer, count(distinct a.id)::integer
    into selected_count, distinct_count
    from public.agent_actions a
   where a.batch_id = p_batch_id and a.id = any(p_action_ids);
  if selected_count <> action_count or distinct_count <> action_count or array_length(p_action_ids, 1) <> action_count then
    raise exception 'approval must include every action exactly once';
  end if;

  select
    encode(extensions.digest(
      p_batch_id::text || E'\n' || b.summary || E'\n' ||
      coalesce(string_agg(a.id::text, E'\n' order by a.sequence), ''),
      'sha256'
    ), 'hex'),
    encode(extensions.digest(
      coalesce(string_agg(a.id::text || ':' || a.payload_hash, E'\n' order by a.sequence), ''),
      'sha256'
    ), 'hex')
    into expected_summary_hash, expected_payload_hash
    from public.agent_action_batches b
    left join public.agent_actions a on a.batch_id = b.id
   where b.id = p_batch_id
   group by b.summary;

  if lower(trim(p_approval_summary_hash)) <> expected_summary_hash
     or lower(trim(p_approved_payload_hash)) <> expected_payload_hash then
    raise exception 'approval hashes do not match the current action batch';
  end if;

  if exists (
    select 1 from public.agent_action_batches b
     where b.id = p_batch_id
       and (b.status not in ('proposed','awaiting_approval') or (b.expires_at is not null and b.expires_at <= now_at))
  ) then
    raise exception 'action batch is no longer approvable';
  end if;

  update public.agent_action_batches
     set status = 'approved', approved_at = now_at, approved_by = current_user_id,
         approval_token_hash = expected_payload_hash
   where id = p_batch_id
     and status in ('proposed', 'awaiting_approval')
     and (expires_at is null or expires_at > now_at);
  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'action batch is no longer approvable';
  end if;

  update public.agent_actions
     set status = 'approved', approved_at = now_at, approved_by = current_user_id
   where batch_id = p_batch_id and id = any(p_action_ids);

  insert into public.agent_approval_events (
    workspace_id, batch_id, action_ids, approved_by, approval_method,
    approval_summary_hash, approved_payload_hash
  ) values (
    batch_workspace, p_batch_id, p_action_ids, current_user_id, 'one_touch',
    p_approval_summary_hash, p_approved_payload_hash
  );

  return jsonb_build_object('batch_id', p_batch_id, 'status', 'approved', 'action_count', action_count, 'approved_by', current_user_id, 'approved_at', now_at);
end;
$$;

revoke all on function public.approve_agent_action_batch(uuid, uuid[], text, text) from public, anon;
grant execute on function public.approve_agent_action_batch(uuid, uuid[], text, text) to authenticated;
