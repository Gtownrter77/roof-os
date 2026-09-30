-- Technician-controlled photo refresh decision for photo-to-estimate review.
-- Measurements are preserved; the server records the decision but does not
-- judge whether a technician's values are plausible.

alter table public.photo_estimate_workflows
  add column if not exists refresh_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists refresh_requested_at timestamptz,
  add column if not exists refresh_reason text;

alter table public.photo_estimate_workflows
  drop constraint if exists photo_estimate_workflows_status_check;

alter table public.photo_estimate_workflows
  add constraint photo_estimate_workflows_status_check
  check (status in ('uploaded','address_pending','property_review','measurement_review','estimate_review','report_review','photo_refresh_requested','approved','sent'));
