-- AI-first measurement formulation. Technical validation and provenance remain required;
-- human calibration and review are no longer prerequisites for storing a formulation.
alter table public.aerial_measurements
  add column if not exists ai_formulation jsonb,
  add column if not exists ai_model_version text,
  add column if not exists ai_formulated_at timestamptz,
  add column if not exists measurement_source text not null default 'geometry';

alter table public.inspection_measurements
  drop constraint if exists inspection_measurements_source_type_check;
alter table public.inspection_measurements
  add constraint inspection_measurements_source_type_check
  check (source_type in ('manual','device_gps','aerial_provider','photo_inference','ai_formulated'));

comment on column public.aerial_measurements.ai_formulation is 'AI-formulated geometry, scale, pitch, quantities, assumptions, and confidence packet.';
comment on column public.aerial_measurements.measurement_source is 'Provenance category for the formulation; authorization is handled separately.';
