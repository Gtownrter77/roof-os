-- Photo-to-estimate workflow records. Every automated result remains review-gated.
create table if not exists public.photo_estimate_workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  inspection_id uuid references public.inspection_sessions(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'uploaded' check (status in ('uploaded','address_pending','property_review','measurement_review','estimate_review','report_review','approved','sent')),
  address text,
  address_confidence numeric(5,2),
  latitude numeric(10,7),
  longitude numeric(10,7),
  footprint_sqft numeric(12,2),
  roof_squares numeric(12,2),
  gutter_lf numeric(12,2),
  storm_candidates jsonb not null default '[]'::jsonb,
  estimate jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  source_photo_ids text[] not null default '{}',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photo_estimate_workflows_workspace_idx on public.photo_estimate_workflows (workspace_id, created_at desc);
create index if not exists photo_estimate_workflows_lead_idx on public.photo_estimate_workflows (lead_id, created_at desc);
alter table public.photo_estimate_workflows enable row level security;
drop policy if exists photo_estimate_workflows_select on public.photo_estimate_workflows;
drop policy if exists photo_estimate_workflows_insert on public.photo_estimate_workflows;
drop policy if exists photo_estimate_workflows_update on public.photo_estimate_workflows;
create policy photo_estimate_workflows_select on public.photo_estimate_workflows for select using (public.is_workspace_member(workspace_id));
create policy photo_estimate_workflows_insert on public.photo_estimate_workflows for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy photo_estimate_workflows_update on public.photo_estimate_workflows for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
