-- Owner YOLO MODE.
-- Off is the default: the AI agent must wait for a human approval before it applies a step.
-- On lets the agent run the process start to finish for this workspace.

alter table public.workspace_settings
  add column if not exists yolo_mode boolean not null default false;

comment on column public.workspace_settings.yolo_mode is
  'Owner switch. False requires human approval before the AI agent applies a step. True lets the agent run the process start to finish.';
