-- Warranty and Roof Passport (Day 26)
-- Adds warranty tracking and Roof Passport documentation for completed jobs.
-- Warranty and passport are separate source features; this migration adds
-- the schema only. Full source integration is tracked separately.

-- Create warranties table
create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year'),
  status text not null default 'active'
    check (status in ('active','expired','revoked')),
  terms text check (char_length(terms) <= 5000),
  issued_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warranties_one_per_job unique (job_id)
);

alter table public.warranties enable row level security;

drop policy if exists warranties_select on public.warranties;
create policy warranties_select on public.warranties
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists warranties_insert on public.warranties;
create policy warranties_insert on public.warranties
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists warranties_update on public.warranties;
create policy warranties_update on public.warranties
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- Create roof_passports table (separate from warranty, audit documentation)
create table if not exists public.roof_passports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete restrict,
  generated_at timestamptz not null default now(),
  version text not null default '1.0'
    check (char_length(version) between 1 and 20),
  data jsonb not null default '[]'::jsonb
    check (jsonb_typeof(data) = 'array'),
  status text not null default 'pending'
    check (status in ('pending','generated','issued','revoked')),
  revocation_reason text check (char_length(revocation_reason) <= 1000),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roof_passports enable row level security;

drop policy if exists roof_passports_select on public.roof_passports;
create policy roof_passports_select on public.roof_passports
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists roof_passports_insert on public.roof_passports;
create policy roof_passports_insert on public.roof_passports
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists roof_passports_update on public.roof_passports;
create policy roof_passports_update on public.roof_passports
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

comment on table public.warranties is
  'One-year limited warranty per production job. Status: active/expired/revoked. '
  'Issued at job completion, expires 365 days later.';

comment on table public.roof_passports is
  'Roof Passport documentation for completed jobs. Separate from warranty '
  'and insurer submission. Generated on demand, status tracked. '
  'Data is a jsonb payload of job evidence. '
  'This is NOT an ESX document, not an insurer submission, '
  'and not proof of warranty.';

