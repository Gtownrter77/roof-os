-- Complete the mobile field measurement contract without changing authority boundaries.
alter table public.inspection_measurements
  add column if not exists rafter_lf numeric(12,2),
  add column if not exists soffit_lf numeric(12,2),
  add column if not exists fascia_lf numeric(12,2),
  add column if not exists roof_type text;

comment on column public.inspection_measurements.rafter_lf is 'Manual field rafter/slope length input; remains unverified until review.';
comment on column public.inspection_measurements.soffit_lf is 'Manual field soffit linear-foot input; remains unverified until review.';
comment on column public.inspection_measurements.fascia_lf is 'Manual field fascia linear-foot input; remains unverified until review.';
comment on column public.inspection_measurements.roof_type is 'Manual field roof-type observation; not an approval or certification.';
