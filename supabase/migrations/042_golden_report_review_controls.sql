-- Golden Report review controls: technician identity/signature, per-photo review, and manager approval.
-- Additive migration; existing workspace-scoped RLS remains authoritative.
alter table public.photo_estimate_workflows
  add column if not exists technician_name text,
  add column if not exists technician_license text,
  add column if not exists technician_signature text,
  add column if not exists photo_reviews jsonb not null default '[]'::jsonb,
  add column if not exists manager_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists manager_approved_at timestamptz,
  add column if not exists manager_approval_name text,
  add column if not exists manager_approval_signature text;

alter table public.photo_estimate_workflows
  drop constraint if exists photo_estimate_workflows_review_controls_check;

alter table public.photo_estimate_workflows
  add constraint photo_estimate_workflows_review_controls_check check (
    (manager_approved_by is null and manager_approved_at is null)
    or (manager_approved_by is not null and manager_approved_at is not null
      and nullif(trim(manager_approval_name), '') is not null
      and nullif(trim(manager_approval_signature), '') is not null)
  );

comment on column public.photo_estimate_workflows.photo_reviews is
  'Audited per-source-photo usability and coverage decisions; never inferred from AI output.';
comment on column public.photo_estimate_workflows.technician_signature is
  'Technician signature capture artifact, stored only as a bounded PNG data URL.';
