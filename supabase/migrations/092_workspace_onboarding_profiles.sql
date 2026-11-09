-- Workspace-scoped, resumable onboarding profile.
-- This stores reviewed business preferences only; it is not an operational policy engine.
begin;

create table if not exists public.workspace_onboarding_profiles (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'completed')),
  schema_version integer not null default 1 check (schema_version = 1),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'completed' and completed_at is not null) or (status = 'draft' and completed_at is null)),
  -- Enforce the API's top-level allowlist at the database boundary as well.
  check (profile - ARRAY[
    'companyType', 'serviceZipCodes', 'roofingSystems', 'relatedServices',
    'crewCountBand', 'leadSources', 'inspectionStyle', 'estimateWorkflow',
    'productionWorkflow', 'customerContactPreferences', 'primaryGoal'
  ]::text[] = '{}'::jsonb),
  check (not (profile ? 'companyType') or coalesce(profile->>'companyType' in ('residential','commercial','both','unsure'), false)),
  check (not (profile ? 'crewCountBand') or coalesce(profile->>'crewCountBand' in ('solo','2-5','6-10','11-25','26+','unsure'), false)),
  check (not (profile ? 'inspectionStyle') or coalesce(profile->>'inspectionStyle' in ('manual','photo_first','drone_assisted','mixed','unsure'), false)),
  check (not (profile ? 'estimateWorkflow') or coalesce(profile->>'estimateWorkflow' in ('owner_priced','estimator_priced','external','unsure'), false)),
  check (not (profile ? 'productionWorkflow') or coalesce(profile->>'productionWorkflow' in ('in_house','subcontracted','mixed','unsure'), false))
);

alter table public.workspace_onboarding_profiles enable row level security;

-- Make Data API exposure explicit; RLS controls rows, GRANT controls table access.
revoke all on table public.workspace_onboarding_profiles from public, anon, authenticated;
grant select, insert, update on table public.workspace_onboarding_profiles to authenticated;

drop policy if exists workspace_onboarding_profiles_select on public.workspace_onboarding_profiles;
drop policy if exists workspace_onboarding_profiles_insert on public.workspace_onboarding_profiles;
drop policy if exists workspace_onboarding_profiles_update on public.workspace_onboarding_profiles;

create policy workspace_onboarding_profiles_select
  on public.workspace_onboarding_profiles for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy workspace_onboarding_profiles_insert
  on public.workspace_onboarding_profiles for insert
  to authenticated
  with check (
    public.is_workspace_admin(workspace_id)
    and auth.uid() = updated_by
  );

create policy workspace_onboarding_profiles_update
  on public.workspace_onboarding_profiles for update
  to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (
    public.is_workspace_admin(workspace_id)
    and auth.uid() = updated_by
  );

comment on table public.workspace_onboarding_profiles is
  'Workspace-owned, reviewed onboarding answers. Contains no customer records, secrets, employee personal data, or operational authorization.';
comment on column public.workspace_onboarding_profiles.profile is
  'Versioned allowlisted business preferences validated by the onboarding API; model output is never written directly.';
comment on column public.workspace_onboarding_profiles.status is
  'draft can be resumed; completed means an authorized workspace admin reviewed and finished the setup profile.';

commit;
