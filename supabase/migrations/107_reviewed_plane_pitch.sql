-- R2: preserve human-reviewed numeric pitch independently of model notes.
-- Follows migration 106_photo_to_report_atomic_packet.sql. Numeric technician review remains separate from AI suggestion; migrate before deploying new routes.
-- Additive migration only. Apply in a controlled, verified database change ahead of server routes.
alter table public.roof_planes
  add column if not exists reviewed_pitch_rise_per_12 numeric
  check (reviewed_pitch_rise_per_12 >= 0 and reviewed_pitch_rise_per_12 <= 36);

alter table public.aerial_measurements
  add column if not exists orthographic_top_down_confirmed boolean not null default false,
  add column if not exists uniform_pitch_confirmed boolean not null default false,
  add column if not exists confirmed_uniform_pitch_rise_per_12 numeric
    check (confirmed_uniform_pitch_rise_per_12 >= 0 and confirmed_uniform_pitch_rise_per_12 <= 36);

comment on column public.roof_planes.reviewed_pitch_rise_per_12
  is 'Human-reviewed roof plane rise per 12 inches of run; separate from untrusted AI suggested_pitch text.';
comment on column public.aerial_measurements.orthographic_top_down_confirmed
  is 'Explicit human confirmation at geometry finalization; never inferred from AI or cached status.';
comment on column public.aerial_measurements.uniform_pitch_confirmed
  is 'Human explicitly attests all accepted planes share one roof pitch.';
comment on column public.aerial_measurements.confirmed_uniform_pitch_rise_per_12
  is 'Human-verified uniform roof rise per twelve, if uniform_pitch_confirmed is true.';
