-- Durable client references make mobile retries idempotent.
-- The same local job/photo/measurement can be safely replayed after a timeout.
alter table public.inspection_sessions
  add column if not exists client_ref text;

alter table public.inspection_photos
  add column if not exists client_ref text;

alter table public.inspection_measurements
  add column if not exists client_ref text;

create unique index if not exists inspection_sessions_workspace_client_ref_uidx
  on public.inspection_sessions (workspace_id, client_ref)
  where client_ref is not null;

create unique index if not exists inspection_photos_workspace_client_ref_uidx
  on public.inspection_photos (workspace_id, client_ref)
  where client_ref is not null;

create unique index if not exists inspection_measurements_workspace_client_ref_uidx
  on public.inspection_measurements (workspace_id, client_ref)
  where client_ref is not null;
