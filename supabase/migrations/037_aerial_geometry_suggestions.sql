-- Phase D: AI roof geometry suggestions. Additive and review-gated.
-- The Phase A geometry tables referenced by the brief are absent from this baseline;
-- these are the single geometry tables introduced for that missing foundation.
create table if not exists public.aerial_measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inspection_id uuid not null references public.inspection_sessions(id) on delete cascade,
  source_photo_id uuid not null references public.inspection_photos(id) on delete restrict,
  image_width integer not null check (image_width > 0 and image_width <= 100000),
  image_height integer not null check (image_height > 0 and image_height <= 100000),
  status text not null default 'draft' check (status in ('draft','confirmed')),
  calibration_status text not null default 'uncalibrated' check (calibration_status in ('uncalibrated','calibrated','confirmed')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.roof_planes (
  id uuid primary key default gen_random_uuid(),
  aerial_measurement_id uuid not null references public.aerial_measurements(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  vertices jsonb not null,
  suggested_pitch text,
  confidence text not null check (confidence in ('low','medium','high')),
  source_image_reference text not null,
  is_suggested boolean not null default true,
  review_status text not null default 'pending' check (review_status in ('pending','accepted','rejected','edited')),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.roof_edges (
  id uuid primary key default gen_random_uuid(),
  aerial_measurement_id uuid not null references public.aerial_measurements(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  start_point jsonb not null,
  end_point jsonb not null,
  classification text not null check (classification in ('eave','rake','ridge','hip','valley','transition','step_flashing','other')),
  confidence text not null check (confidence in ('low','medium','high')),
  source_image_reference text not null,
  is_suggested boolean not null default true,
  review_status text not null default 'pending' check (review_status in ('pending','accepted','rejected','edited')),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.roof_objects (
  id uuid primary key default gen_random_uuid(),
  aerial_measurement_id uuid not null references public.aerial_measurements(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  object_type text not null check (object_type in ('skylight','chimney','hvac','pipe_boot','attic_vent','other')),
  position jsonb not null,
  confidence text not null check (confidence in ('low','medium','high')),
  source_image_reference text not null,
  is_suggested boolean not null default true,
  review_status text not null default 'pending' check (review_status in ('pending','accepted','rejected','edited')),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists aerial_measurements_workspace_created_idx on public.aerial_measurements(workspace_id, created_at desc);
create index if not exists roof_planes_aerial_idx on public.roof_planes(aerial_measurement_id);
create index if not exists roof_edges_aerial_idx on public.roof_edges(aerial_measurement_id);
create index if not exists roof_objects_aerial_idx on public.roof_objects(aerial_measurement_id);

alter table public.aerial_measurements enable row level security;
alter table public.roof_planes enable row level security;
alter table public.roof_edges enable row level security;
alter table public.roof_objects enable row level security;
create policy aerial_measurements_select on public.aerial_measurements for select using (public.is_workspace_member(workspace_id));
create policy aerial_measurements_write on public.aerial_measurements for all using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy roof_planes_select on public.roof_planes for select using (public.is_workspace_member(workspace_id));
create policy roof_planes_write on public.roof_planes for all using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy roof_edges_select on public.roof_edges for select using (public.is_workspace_member(workspace_id));
create policy roof_edges_write on public.roof_edges for all using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy roof_objects_select on public.roof_objects for select using (public.is_workspace_member(workspace_id));
create policy roof_objects_write on public.roof_objects for all using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
