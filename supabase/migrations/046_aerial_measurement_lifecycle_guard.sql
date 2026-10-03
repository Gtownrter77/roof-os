-- Enforce the aerial measurement review lifecycle at the database boundary.
-- API routes remain the user-facing workflow; these constraints prevent direct
-- clients from marking uncalibrated AI geometry as confirmed.

alter table public.aerial_measurements
  drop constraint if exists aerial_measurements_confirmation_state_check;

alter table public.aerial_measurements
  add constraint aerial_measurements_confirmation_state_check
  check (
    (calibration_status = 'uncalibrated'
      and status = 'draft')
    or
    (calibration_status = 'calibrated'
      and status = 'draft'
      and scale_reference_pixels is not null
      and scale_reference_feet is not null
      and pixels_per_foot is not null
      and calibrated_by is not null
      and calibrated_at is not null)
    or
    (calibration_status = 'confirmed'
      and status = 'confirmed'
      and scale_reference_pixels is not null
      and scale_reference_feet is not null
      and pixels_per_foot is not null
      and calibrated_by is not null
      and calibrated_at is not null
      and confirmed_by is not null
      and confirmed_at is not null)
  );

create or replace function public.enforce_aerial_measurement_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.calibrated_by is distinct from old.calibrated_by
     and new.calibrated_by is not null
     and new.calibrated_by <> auth.uid() then
    raise exception 'Calibration actor must be the authenticated user';
  end if;

  if new.confirmed_by is distinct from old.confirmed_by
     and new.confirmed_by is not null
     and new.confirmed_by <> auth.uid() then
    raise exception 'Confirmation actor must be the authenticated user';
  end if;

  return new;
end;
$$;

drop trigger if exists aerial_measurement_actor_guard on public.aerial_measurements;
create trigger aerial_measurement_actor_guard
before update on public.aerial_measurements
for each row execute function public.enforce_aerial_measurement_actor();
