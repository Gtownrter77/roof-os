-- Restore the unique conflict target used by the default lead follow-up trigger.
-- This is intentionally idempotent so it repairs environments where migration 005
-- created the trigger but its partial unique index was not applied.
alter table public.tasks add column if not exists automation_key text;
create unique index if not exists tasks_automation_key_unique_idx
  on public.tasks (workspace_id, automation_key)
  where automation_key is not null;
