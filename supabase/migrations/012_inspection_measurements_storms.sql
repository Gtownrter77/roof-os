-- Inspection evidence and reviewable measurements.

create table if not exists public.inspection_measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inspection_id uuid,
  source_type text not null check (source_type in ('manual','device_gps','aerial_provider','photo_inference')),
  confidence text not null check (confidence in ('unverified','low','medium','high','certified')) default 'unverified',
  roof_area_sqft numeric(12,2),
  roof_squares numeric(12,2),
  gutter_lf numeric(12,2),
  ridge_lf numeric(12,2),
  eave_lf numeric(12,2),
  rake_lf numeric(12,2),
  valley_lf numeric(12,2),
  pitch text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  source_reference text,
  notes text,
  captured_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create table if not exists public.storm_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inspection_id uuid,
  provider text not null check (provider in ('nws','ncei','manual')),
  event_type text,
  event_date date,
  distance_miles numeric(10,2),
  severity text,
  confidence text not null check (confidence in ('candidate','corroborated','verified')) default 'candidate',
  source_url text not null,
  source_payload jsonb not null default '{}'::jsonb,
  reviewed boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  retrieved_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create table if not exists public.estimate_review_packets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inspection_id uuid,
  measurement_id uuid references public.inspection_measurements(id) on delete restrict,
  storm_evidence_id uuid references public.storm_evidence(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','needs_measurement_review','needs_storm_review','needs_price_review','approved','rejected')),
  price_source text,
  formula_version text not null default 'claims-draft-v1',
  estimate_snapshot jsonb not null default '{}'::jsonb,
  approval_note text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.inspection_measurements enable row level security;
alter table public.storm_evidence enable row level security;
alter table public.estimate_review_packets enable row level security;

create policy inspection_measurements_select on public.inspection_measurements for select using (public.is_workspace_member(workspace_id));
create policy inspection_measurements_write on public.inspection_measurements for all using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy storm_evidence_select on public.storm_evidence for select using (public.is_workspace_member(workspace_id));
create policy storm_evidence_write on public.storm_evidence for all using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy estimate_review_packets_select on public.estimate_review_packets for select using (public.is_workspace_member(workspace_id));
create policy estimate_review_packets_write on public.estimate_review_packets for all using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
