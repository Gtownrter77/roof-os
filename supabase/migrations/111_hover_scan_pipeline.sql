-- Hover parity scan pipeline: immutable capture, metric scale, versioned
-- measurements, evidence, human lock trail and export artifacts.
-- New migration only. Applied migrations are never edited or renumbered.
-- Measurements are data, not pixels: the 3D model is a view over these records.

create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  property_id uuid,
  status text not null default 'capturing'
    check (status in ('capturing','ingested','reconstructing','measuring','review','locked','exported','failed')),
  capture_mode text not null check (capture_mode in ('exterior','interior')),
  deliverable text not null check (deliverable in ('roof_only','full_exterior','photos_only')),
  provider_path text not null default 'oss' check (provider_path in ('oss','commercial')),
  sla_tier text not null default 'visual-twin'
    check (sla_tier in ('visual-twin','estimated','verified','certified')),
  owner_lock_sequence jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.scan_images (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  job_id uuid not null references public.scan_jobs(id) on delete restrict,
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  slot text,
  role text not null check (role in ('model','evidence','damage','reference')),
  gps_in_file boolean not null default false,
  exif_json jsonb not null default '{}'::jsonb,
  blur_score numeric,
  light_score numeric,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.scale_anchors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  job_id uuid not null references public.scan_jobs(id) on delete restrict,
  kind text not null check (kind in ('door','garage','wall','bar','gps','footprint')),
  observed_value double precision not null check (observed_value > 0),
  unit text not null check (unit in ('ft','m')),
  source_image_id uuid references public.scan_images(id) on delete set null,
  confidence double precision not null default 0.5 check (confidence between 0 and 1),
  residual_in double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.reconstructions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  job_id uuid not null references public.scan_jobs(id) on delete restrict,
  manifest_hash text not null check (manifest_hash ~ '^[a-f0-9]{64}$'),
  engine_versions jsonb not null default '{}'::jsonb,
  mesh_url text,
  splat_url text,
  metric_status text not null default 'relative-only'
    check (metric_status in ('metric','relative-only','failed')),
  reprojection_error_px double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.measurement_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  job_id uuid not null references public.scan_jobs(id) on delete restrict,
  reconstruction_id uuid references public.reconstructions(id) on delete set null,
  ruleset_version text not null,
  status text not null default 'draft'
    check (status in ('draft','reviewed','relative-only','locked','rejected')),
  confidence_summary jsonb not null default '{}'::jsonb,
  locked_by uuid,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  set_id uuid not null references public.measurement_sets(id) on delete restrict,
  type text not null,
  value double precision,
  unit text not null,
  confidence double precision not null default 0 check (confidence between 0 and 1),
  source_refs jsonb not null default '[]'::jsonb,
  correction_of uuid references public.measurements(id) on delete set null,
  status text not null default 'proposed'
    check (status in ('proposed','accepted','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  measurement_id uuid not null references public.measurements(id) on delete restrict,
  image_id uuid references public.scan_images(id) on delete set null,
  region jsonb,
  plane_id text,
  model_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.qa_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  set_id uuid not null references public.measurement_sets(id) on delete restrict,
  actor_id uuid not null,
  actor_role text not null,
  action text not null check (action in ('accept','correct','reject','lock','unlock')),
  before_json jsonb,
  after_json jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.export_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  set_id uuid not null references public.measurement_sets(id) on delete restrict,
  format text not null check (format in ('PDF','XLS','XML','JSON','ESX','SKP','DWG','DXF')),
  path text not null,
  ruleset_version text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  gated boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.scan_jobs enable row level security;
alter table public.scan_images enable row level security;
alter table public.scale_anchors enable row level security;
alter table public.reconstructions enable row level security;
alter table public.measurement_sets enable row level security;
alter table public.measurements enable row level security;
alter table public.evidence_links enable row level security;
alter table public.qa_events enable row level security;
alter table public.export_artifacts enable row level security;

create policy scan_jobs_workspace_select on public.scan_jobs
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy scan_jobs_workspace_write on public.scan_jobs
  for all to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy scan_images_workspace_select on public.scan_images
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy scan_images_workspace_write on public.scan_images
  for all to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy scale_anchors_workspace_select on public.scale_anchors
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy scale_anchors_workspace_write on public.scale_anchors
  for all to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy reconstructions_workspace_select on public.reconstructions
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy reconstructions_workspace_write on public.reconstructions
  for all to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy measurement_sets_workspace_select on public.measurement_sets
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy measurement_sets_workspace_write on public.measurement_sets
  for all to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy measurements_workspace_select on public.measurements
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy measurements_workspace_write on public.measurements
  for all to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy evidence_links_workspace_select on public.evidence_links
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy evidence_links_workspace_write on public.evidence_links
  for all to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy qa_events_workspace_select on public.qa_events
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy qa_events_workspace_write on public.qa_events
  for all to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy export_artifacts_workspace_select on public.export_artifacts
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy export_artifacts_workspace_write on public.export_artifacts
  for all to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
