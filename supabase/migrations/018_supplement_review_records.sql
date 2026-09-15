-- Persist reviewable supplement findings instead of browser-only mock state.
create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  job_address text not null,
  title text not null,
  description text not null,
  additional_cost numeric(12,2) not null default 0 check (additional_cost >= 0),
  materials jsonb not null default '[]'::jsonb,
  labor_description text,
  urgency text not null default 'medium' check (urgency in ('low','medium','high','critical')),
  status text not null default 'needs_review' check (status in ('needs_review','approved','rejected')),
  source text not null default 'manual_review',
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplements_workspace_status_idx on public.supplements (workspace_id, status, created_at desc);
alter table public.supplements enable row level security;
create policy supplements_select on public.supplements for select using (public.is_workspace_member(workspace_id));
create policy supplements_insert on public.supplements for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy supplements_update on public.supplements for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
