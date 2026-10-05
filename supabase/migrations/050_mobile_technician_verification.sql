-- Persist field technician verification separately from manager approval/signature.
create table if not exists public.inspection_verifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inspection_id uuid not null references public.inspection_sessions(id) on delete cascade,
  technician_name text not null,
  technician_license text,
  verified_at timestamptz not null,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, inspection_id),
  check (length(trim(technician_name)) between 2 and 200),
  check (technician_license is null or length(trim(technician_license)) <= 100),
  check (notes is null or length(notes) <= 4000)
);
alter table public.inspection_verifications enable row level security;
drop policy if exists inspection_verifications_select on public.inspection_verifications;
drop policy if exists inspection_verifications_insert on public.inspection_verifications;
drop policy if exists inspection_verifications_update on public.inspection_verifications;
create policy inspection_verifications_select on public.inspection_verifications for select using (public.is_workspace_member(workspace_id));
create policy inspection_verifications_insert on public.inspection_verifications for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy inspection_verifications_update on public.inspection_verifications for update using (public.is_workspace_member(workspace_id) and auth.uid() = created_by) with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create index if not exists inspection_verifications_workspace_idx on public.inspection_verifications (workspace_id, verified_at desc);
comment on table public.inspection_verifications is 'Field technician verification record. It does not grant manager approval or replace a captured signature.';
