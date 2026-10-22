-- Review-safe on-device AI observation contract.
-- Suggestions remain non-authoritative until an authenticated reviewer accepts or corrects them.
create table if not exists public.inspection_ai_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inspection_id uuid not null references public.inspection_sessions(id) on delete cascade,
  source_photo_id uuid references public.inspection_photos(id) on delete set null,
  client_id text not null check (length(trim(client_id)) between 8 and 200),
  model_id text not null check (length(trim(model_id)) between 1 and 200),
  model_version text not null check (length(trim(model_version)) between 1 and 200),
  observation_type text not null check (observation_type in ('photo_quality','component_detection','component_segmentation','roof_type','measurement_suggestion','missing_view')),
  component text,
  suggested_value jsonb not null default '{}'::jsonb,
  unit text,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_geometry jsonb not null default '{}'::jsonb,
  review_status text not null default 'suggested' check (review_status in ('suggested','accepted','corrected','rejected','superseded')),
  reviewer_value jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(trim(rejection_reason)) between 1 and 1000),
  captured_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, client_id),
  check (
    (review_status = 'suggested' and reviewer_value is null and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (review_status = 'accepted' and reviewer_value is null and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (review_status = 'corrected' and reviewer_value is not null and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (review_status = 'rejected' and reviewer_value is null and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null)
    or (review_status = 'superseded' and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists inspection_ai_observations_inspection_idx
  on public.inspection_ai_observations (inspection_id, created_at desc);
create index if not exists inspection_ai_observations_photo_idx
  on public.inspection_ai_observations (source_photo_id, created_at desc);
create index if not exists inspection_ai_observations_review_idx
  on public.inspection_ai_observations (workspace_id, review_status, created_at desc);

create or replace function public.validate_inspection_ai_observation_workspace()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  inspection_workspace uuid;
  photo_workspace uuid;
begin
  select workspace_id into inspection_workspace
    from public.inspection_sessions where id = new.inspection_id;
  if inspection_workspace is null or inspection_workspace is distinct from new.workspace_id then
    raise exception 'AI observation and inspection must belong to the same workspace' using errcode = '42501';
  end if;

  if new.source_photo_id is not null then
    select workspace_id into photo_workspace
      from public.inspection_photos where id = new.source_photo_id;
    if photo_workspace is null or photo_workspace is distinct from new.workspace_id then
      raise exception 'AI observation and source photo must belong to the same workspace' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists inspection_ai_observation_workspace_trigger on public.inspection_ai_observations;
create trigger inspection_ai_observation_workspace_trigger
before insert or update on public.inspection_ai_observations
for each row execute function public.validate_inspection_ai_observation_workspace();

create or replace function public.protect_inspection_ai_observation_provenance()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.inspection_id is distinct from old.inspection_id
     or new.source_photo_id is distinct from old.source_photo_id
     or new.client_id is distinct from old.client_id
     or new.model_id is distinct from old.model_id
     or new.model_version is distinct from old.model_version
     or new.observation_type is distinct from old.observation_type
     or new.component is distinct from old.component
     or new.suggested_value is distinct from old.suggested_value
     or new.unit is distinct from old.unit
     or new.confidence is distinct from old.confidence
     or new.source_geometry is distinct from old.source_geometry
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'AI observation provenance is immutable after insertion' using errcode = '42501';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inspection_ai_observation_provenance_trigger on public.inspection_ai_observations;
create trigger inspection_ai_observation_provenance_trigger
before update on public.inspection_ai_observations
for each row execute function public.protect_inspection_ai_observation_provenance();

alter table public.inspection_ai_observations enable row level security;

drop policy if exists inspection_ai_observations_select on public.inspection_ai_observations;
drop policy if exists inspection_ai_observations_insert on public.inspection_ai_observations;
drop policy if exists inspection_ai_observations_update on public.inspection_ai_observations;

create policy inspection_ai_observations_select on public.inspection_ai_observations
for select using (public.is_workspace_member(workspace_id));
create policy inspection_ai_observations_insert on public.inspection_ai_observations
for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy inspection_ai_observations_update on public.inspection_ai_observations
for update
using (public.is_workspace_member(workspace_id) and (auth.uid() = created_by or public.is_workspace_admin(workspace_id)))
with check (
  public.is_workspace_member(workspace_id)
  and (auth.uid() = created_by or public.is_workspace_admin(workspace_id))
  and (
    (review_status = 'suggested' and reviewed_by is null)
    or (review_status <> 'suggested' and reviewed_by = auth.uid())
  )
);

comment on table public.inspection_ai_observations is 'On-device AI suggestions; never authoritative without technician review and separate manager approval.';
comment on column public.inspection_ai_observations.client_id is 'Stable device-generated idempotency key for offline AI observation retries.';
comment on column public.inspection_ai_observations.suggested_value is 'Model suggestion only; do not treat as a verified field measurement.';
comment on column public.inspection_ai_observations.review_status is 'Authenticated technician or workspace-admin review state; acceptance does not replace manager approval.';
