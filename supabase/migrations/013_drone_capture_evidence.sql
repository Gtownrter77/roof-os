-- Drone and aerial capture provenance. This stores evidence metadata; it does not certify measurements.

create table if not exists public.drone_captures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inspection_id uuid,
  source_type text not null check (source_type in ('drone_photo','drone_video','orthomosaic','oam_imagery','arcgis_imagery')),
  asset_url text not null,
  thumbnail_url text,
  captured_at timestamptz,
  latitude numeric(10,7),
  longitude numeric(10,7),
  altitude_m numeric(10,2),
  heading_deg numeric(7,2),
  camera_make text,
  camera_model text,
  license text,
  provider text,
  confidence text not null default 'unverified' check (confidence in ('unverified','low','medium','high','certified')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.drone_captures enable row level security;
create policy drone_captures_select on public.drone_captures for select using (public.is_workspace_member(workspace_id));
create policy drone_captures_write on public.drone_captures for all using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
