create table if not exists public.siding_measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inspection_id uuid references public.inspection_sessions(id) on delete set null,
  source_photo_id uuid references public.inspection_photos(id) on delete set null,
  elevation text not null default 'unknown',
  course_count numeric(10,2) not null check (course_count > 0),
  exposure_inches numeric(8,3) not null check (exposure_inches > 0 and exposure_inches <= 24),
  width_ft numeric(10,3) not null check (width_ft > 0),
  openings jsonb not null default '[]'::jsonb,
  waste_percent numeric(6,2) not null default 10 check (waste_percent >= 0 and waste_percent <= 100),
  calculated_height_ft numeric(10,3) not null,
  gross_area_sqft numeric(12,2) not null,
  opening_deduction_sqft numeric(12,2) not null default 0,
  net_area_sqft numeric(12,2) not null,
  order_area_sqft numeric(12,2) not null,
  status text not null default 'unverified' check (status in ('unverified','verified','rejected')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.siding_measurements enable row level security;
create policy siding_measurements_select on public.siding_measurements for select using (public.is_workspace_member(workspace_id));
create policy siding_measurements_insert on public.siding_measurements for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy siding_measurements_update_admin on public.siding_measurements for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
