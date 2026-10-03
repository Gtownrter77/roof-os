alter table public.siding_measurements
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz,
  add column if not exists verification jsonb;

create index if not exists idx_siding_measurements_verified
  on public.siding_measurements (workspace_id, status, verified_at);
