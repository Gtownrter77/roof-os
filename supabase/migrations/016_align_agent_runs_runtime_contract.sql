-- Align the agent runtime table created by migration 004 with the richer
-- runtime contract introduced by migration 009 and workers/agent-runtime.ts.

alter table public.agent_runs add column if not exists trigger text;
alter table public.agent_runs add column if not exists input_reference jsonb;
alter table public.agent_runs add column if not exists error_message text;
alter table public.agent_runs add column if not exists prompt_version text;
alter table public.agent_runs add column if not exists approval_state text;
alter table public.agent_runs add column if not exists attempt integer;
alter table public.agent_runs add column if not exists started_at timestamptz;
alter table public.agent_runs add column if not exists finished_at timestamptz;

update public.agent_runs
set trigger = coalesce(trigger, 'legacy'),
    input_reference = coalesce(input_reference, coalesce(input_ref, '{}'::jsonb)),
    output = coalesce(output, '{}'::jsonb),
    attempt = coalesce(attempt, 1),
    approval_state = coalesce(approval_state, 'not_required');

alter table public.agent_runs alter column trigger set default 'unknown';
alter table public.agent_runs alter column trigger set not null;
alter table public.agent_runs alter column input_reference set default '{}'::jsonb;
alter table public.agent_runs alter column input_reference set not null;
alter table public.agent_runs alter column output set default '{}'::jsonb;
alter table public.agent_runs alter column output set not null;
alter table public.agent_runs alter column attempt set default 1;
alter table public.agent_runs alter column attempt set not null;
alter table public.agent_runs alter column approval_state set default 'not_required';
alter table public.agent_runs alter column approval_state set not null;

alter table public.agent_runs drop constraint if exists agent_runs_status_check;
alter table public.agent_runs add constraint agent_runs_status_check
  check (status in ('queued','running','succeeded','failed','needs_review','skipped'));
