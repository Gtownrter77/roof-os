-- Editable soffit measurement inputs for technician review.
alter table public.photo_estimate_workflows
  add column if not exists soffit_width_ft numeric(8,3),
  add column if not exists soffit_lf numeric(12,2),
  add column if not exists fascia_width_ft numeric(8,3),
  add column if not exists fascia_lf numeric(12,2);
