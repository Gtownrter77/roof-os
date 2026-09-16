-- Reconcile the legacy (workspace_id, event_key) uniqueness with the
-- worker runtime's idempotency key: (workspace_id, agent_key, event_key).
-- This migration is safe after either the original 004 schema or the richer
-- 009 schema because both converge on the same table.

do $$
declare
  legacy_constraint text;
begin
  select conname
    into legacy_constraint
  from pg_constraint
  where conrelid = 'public.agent_runs'::regclass
    and contype = 'u'
    and conkey = array[
      (select attnum from pg_attribute where attrelid = 'public.agent_runs'::regclass and attname = 'workspace_id'),
      (select attnum from pg_attribute where attrelid = 'public.agent_runs'::regclass and attname = 'event_key')
    ]::smallint[];

  if legacy_constraint is not null then
    execute format('alter table public.agent_runs drop constraint %I', legacy_constraint);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agent_runs'::regclass
      and conname = 'agent_runs_workspace_agent_event_key'
  ) then
    alter table public.agent_runs
      add constraint agent_runs_workspace_agent_event_key
      unique (workspace_id, agent_key, event_key);
  end if;
end $$;

create index if not exists agent_runs_workspace_event_idx
  on public.agent_runs (workspace_id, event_key);
