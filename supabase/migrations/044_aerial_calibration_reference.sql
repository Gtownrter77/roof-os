-- Store the human calibration reference used to convert image pixels into real-world feet.
-- Calibration remains review metadata; it does not authorize AI-derived quantities by itself.
alter table public.aerial_measurements
  add column if not exists scale_reference_pixels numeric(14,4),
  add column if not exists scale_reference_feet numeric(14,4),
  add column if not exists pixels_per_foot numeric(14,6),
  add column if not exists calibrated_by uuid references auth.users(id) on delete set null,
  add column if not exists calibrated_at timestamptz;

alter table public.aerial_measurements
  drop constraint if exists aerial_measurements_calibration_reference_check;

alter table public.aerial_measurements
  add constraint aerial_measurements_calibration_reference_check
  check (
    (scale_reference_pixels is null and scale_reference_feet is null and pixels_per_foot is null)
    or (
      scale_reference_pixels > 0
      and scale_reference_feet > 0
      and pixels_per_foot > 0
      and pixels_per_foot = round(scale_reference_pixels / scale_reference_feet, 6)
    )
  );

create index if not exists aerial_measurements_calibrated_idx
  on public.aerial_measurements(workspace_id, calibrated_at desc)
  where calibration_status = 'calibrated';
