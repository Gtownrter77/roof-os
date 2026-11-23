-- Forward-only Hover capture metadata for uploaded inspection photos.
-- Adds three columns to the existing table from 003; creates NO new Hover
-- table (111 already owns the scan pipeline tables and their RLS policies).
-- gps_in_file is deliberately NOT added here: it is server-authoritative and
-- is derived from byte verification when an ingest scan_image is created.

alter table public.inspection_photos add column hover_slot text;

alter table public.inspection_photos add column blur_score double precision;

alter table public.inspection_photos add column light_score double precision;
