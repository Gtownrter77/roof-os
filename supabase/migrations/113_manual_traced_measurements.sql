-- Forward-only: allow reviewed, hand-traced roof geometry as a measurement source.
-- Widens the existing source_type check from 101 by exactly one value; no new
-- columns or tables, and the server remains authoritative for area recomputation.
alter table public.inspection_measurements
  drop constraint if exists inspection_measurements_source_type_check;
alter table public.inspection_measurements
  add constraint inspection_measurements_source_type_check
  check (source_type in ('manual','device_gps','aerial_provider','photo_inference','ai_formulated','manual_traced'));

comment on column public.inspection_measurements.source_type is 'Measurement provenance; manual_traced is reviewed hand-traced geometry with area recomputed on the server.';
