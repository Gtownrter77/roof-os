-- Mobile offline synchronization contract.
-- Client keys are generated once on-device and reused across retries.
alter table public.inspection_sessions add column if not exists client_id text;
alter table public.inspection_measurements add column if not exists client_id text;
alter table public.inspection_photos add column if not exists client_id text;

create unique index if not exists inspection_sessions_workspace_client_uidx
  on public.inspection_sessions (workspace_id, client_id)
  where client_id is not null;
create unique index if not exists inspection_measurements_workspace_client_uidx
  on public.inspection_measurements (workspace_id, client_id)
  where client_id is not null;
create unique index if not exists inspection_photos_workspace_client_uidx
  on public.inspection_photos (workspace_id, client_id)
  where client_id is not null;

create index if not exists inspection_measurements_inspection_created_idx
  on public.inspection_measurements (inspection_id, created_by, captured_at desc);

comment on column public.inspection_sessions.client_id is 'Stable device-generated idempotency key for offline mobile session retries.';
comment on column public.inspection_measurements.client_id is 'Stable device-generated idempotency key for offline mobile measurement retries.';
comment on column public.inspection_photos.client_id is 'Stable device-generated idempotency key for offline mobile photo retries.';
