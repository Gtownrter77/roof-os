create table if not exists public.siding_measurements (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 inspection_id uuid references public.inspection_sessions(id) on delete set null,
 source_photo_id uuid references public.inspection_photos(id) on delete set null,
 elevation text not null,
 course_count numeric not null default 0 check(course_count>=0),
 exposure_inches numeric not null default 0 check(exposure_inches>=0 and exposure_inches<=24),
 width_ft numeric not null default 0 check(width_ft>=0),
 openings jsonb not null default '[]'::jsonb,
 waste_percent numeric not null default 0 check(waste_percent>=0 and waste_percent<=100),
 calculated_height_ft numeric not null default 0,
 gross_area_sq_ft numeric not null default 0,
 opening_deduction_sq_ft numeric not null default 0,
 net_area_sq_ft numeric not null default 0,
 waste_sq_ft numeric not null default 0,
 order_area_sq_ft numeric not null default 0,
 status text not null default 'unverified' check(status in ('unverified','verified','rejected')),
 created_by uuid not null references auth.users(id),
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.siding_measurements enable row level security;
drop policy if exists siding_measurements_select on public.siding_measurements;
create policy siding_measurements_select on public.siding_measurements for select using(public.is_workspace_member(workspace_id));
drop policy if exists siding_measurements_insert on public.siding_measurements;
create policy siding_measurements_insert on public.siding_measurements for insert with check(public.is_workspace_member(workspace_id) and created_by=auth.uid());
drop policy if exists siding_measurements_update_admin on public.siding_measurements;
create policy siding_measurements_update_admin on public.siding_measurements for update using(public.is_workspace_admin(workspace_id)) with check(public.is_workspace_admin(workspace_id));
