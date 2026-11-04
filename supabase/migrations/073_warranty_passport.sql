-- Warranty and Roof Passport lifecycle additions.
--
-- The original 020 schema is already used by the live app:
--   warranties.registration_status / passport_id / lead_id
--   roof_passports.status / lead_id / public_token / public_shared
-- Keep that contract. The production-job lifecycle uses separate nullable
-- linkage and lifecycle fields until a real completed job exists.
--
-- This migration is intentionally additive and safe against the legacy schema.

create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid references public.production_jobs(id) on delete restrict,
  passport_id uuid references public.roof_passports(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  manufacturer text,
  product_line text,
  registration_status text not null default 'not_started'
    check (registration_status in ('not_started','packet_ready','submitted','registered','expired','claim_open')),
  registered_at date,
  expires_at date,
  transfer_allowed boolean not null default true,
  missing_items text,
  notes text,
  issued_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active','expired','revoked')),
  terms text check (char_length(terms) <= 5000),
  issued_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend already-deployed 020 tables without dropping or renaming legacy fields.
alter table public.warranties
  add column if not exists job_id uuid references public.production_jobs(id) on delete restrict,
  add column if not exists issued_at timestamptz not null default now(),
  add column if not exists status text not null default 'active',
  add column if not exists terms text,
  add column if not exists issued_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.warranties'::regclass
      and conname = 'warranties_status_check'
  ) then
    alter table public.warranties
      add constraint warranties_status_check
      check (status in ('active','expired','revoked'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.warranties'::regclass
      and conname = 'warranties_terms_length_check'
  ) then
    alter table public.warranties
      add constraint warranties_terms_length_check
      check (terms is null or char_length(terms) <= 5000);
  end if;
end
$$;

-- Keep the property-centered passport fields and public-share token used by
-- existing pages/routes. lifecycle_status is deliberately separate from the
-- legacy status CHECK ('draft','active','transferred','archived').
create table if not exists public.roof_passports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid references public.production_jobs(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  property_address text not null,
  homeowner_name text,
  material_system text,
  manufacturer text,
  color text,
  install_date date,
  squares numeric(12,2),
  ventilation_notes text,
  status text not null default 'draft'
    check (status in ('draft','active','transferred','archived')),
  public_token uuid not null default gen_random_uuid(),
  public_shared boolean not null default false,
  public_shared_at timestamptz,
  generated_at timestamptz not null default now(),
  version text not null default '1.0'
    check (char_length(version) between 1 and 20),
  data jsonb not null default '[]'::jsonb
    check (jsonb_typeof(data) = 'array'),
  lifecycle_status text not null default 'pending'
    check (lifecycle_status in ('pending','generated','issued','revoked')),
  revocation_reason text check (char_length(revocation_reason) <= 1000),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roof_passports
  add column if not exists job_id uuid references public.production_jobs(id) on delete restrict,
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists version text not null default '1.0',
  add column if not exists data jsonb not null default '[]'::jsonb,
  add column if not exists lifecycle_status text not null default 'pending',
  add column if not exists revocation_reason text,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists public_token uuid not null default gen_random_uuid(),
  add column if not exists public_shared boolean not null default false,
  add column if not exists public_shared_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.roof_passports'::regclass
      and conname = 'roof_passports_version_length_check'
  ) then
    alter table public.roof_passports
      add constraint roof_passports_version_length_check
      check (char_length(version) between 1 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.roof_passports'::regclass
      and conname = 'roof_passports_data_array_check'
  ) then
    alter table public.roof_passports
      add constraint roof_passports_data_array_check
      check (jsonb_typeof(data) = 'array');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.roof_passports'::regclass
      and conname = 'roof_passports_lifecycle_status_check'
  ) then
    alter table public.roof_passports
      add constraint roof_passports_lifecycle_status_check
      check (lifecycle_status in ('pending','generated','issued','revoked'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.roof_passports'::regclass
      and conname = 'roof_passports_revocation_reason_length_check'
  ) then
    alter table public.roof_passports
      add constraint roof_passports_revocation_reason_length_check
      check (revocation_reason is null or char_length(revocation_reason) <= 1000);
  end if;
end
$$;

create unique index if not exists warranties_one_per_job
  on public.warranties (job_id)
  where job_id is not null;
create unique index if not exists roof_passports_public_token_idx
  on public.roof_passports (public_token);
create index if not exists roof_passports_public_shared_idx
  on public.roof_passports (public_shared)
  where public_shared;

alter table public.warranties enable row level security;
alter table public.roof_passports enable row level security;

-- Remove the original permissive FOR ALL policies. They allowed members to
-- change the public-share flag directly, bypassing the admin-only share API.
drop policy if exists warranties_select on public.warranties;
drop policy if exists warranties_write on public.warranties;
drop policy if exists warranties_insert on public.warranties;
drop policy if exists warranties_update on public.warranties;
drop policy if exists warranties_select_member on public.warranties;
drop policy if exists warranties_insert_legacy_member on public.warranties;
drop policy if exists warranties_insert_job_admin on public.warranties;
drop policy if exists warranties_update_admin on public.warranties;

create policy warranties_select_member on public.warranties
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Existing lead-linked warranty records remain a supported member workflow.
create policy warranties_insert_legacy_member on public.warranties
  for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and auth.uid() = created_by
    and job_id is null
  );

create policy warranties_insert_job_admin on public.warranties
  for insert to authenticated
  with check (
    public.is_workspace_admin(workspace_id)
    and auth.uid() = created_by
    and job_id is not null
  );

create policy warranties_update_admin on public.warranties
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists roof_passports_select on public.roof_passports;
drop policy if exists roof_passports_write on public.roof_passports;
drop policy if exists roof_passports_insert on public.roof_passports;
drop policy if exists roof_passports_update on public.roof_passports;
drop policy if exists roof_passports_select_member on public.roof_passports;
drop policy if exists roof_passports_insert_legacy_member on public.roof_passports;
drop policy if exists roof_passports_insert_job_admin on public.roof_passports;
drop policy if exists roof_passports_update_admin on public.roof_passports;

create policy roof_passports_select_member on public.roof_passports
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy roof_passports_insert_legacy_member on public.roof_passports
  for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and auth.uid() = created_by
    and job_id is null
    and public_shared = false
  );

create policy roof_passports_insert_job_admin on public.roof_passports
  for insert to authenticated
  with check (
    public.is_workspace_admin(workspace_id)
    and auth.uid() = created_by
    and job_id is not null
  );

-- Only admins may change public-sharing state or job-linked lifecycle evidence.
create policy roof_passports_update_admin on public.roof_passports
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

comment on table public.warranties is
  'Legacy lead-linked registration records remain compatible. Job-linked records use the separate active/expired/revoked lifecycle and one-per-job guard. A record is not manufacturer registration proof.';
comment on table public.roof_passports is
  'Property-centered Roof Passport. Legacy status and homeowner-share contract are preserved; job-linked lifecycle uses lifecycle_status. Not an ESX document, insurer submission, or proof of warranty.';
