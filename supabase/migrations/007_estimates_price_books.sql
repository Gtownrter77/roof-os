-- ROOF/OS estimate and pricing foundation
-- This migration creates versioned, auditable records. It does not create supplier feeds.

create table if not exists public.estimate_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimate_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.estimate_templates(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  formula_version text not null default 'v1',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table if not exists public.estimate_template_items (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.estimate_template_versions(id) on delete cascade,
  item_code text not null,
  description text not null,
  category text not null check (category in ('material','labor','allowance','fee','tax')),
  unit text not null,
  default_quantity numeric(12,3) not null default 1 check (default_quantity >= 0),
  waste_factor numeric(8,5) not null default 0 check (waste_factor >= 0),
  sort_order integer not null default 0,
  unique (template_version_id, item_code)
);

create table if not exists public.price_books (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  market text not null,
  source text not null,
  effective_at timestamptz not null,
  expires_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > effective_at)
);

create table if not exists public.price_book_items (
  id uuid primary key default gen_random_uuid(),
  price_book_id uuid not null references public.price_books(id) on delete cascade,
  sku text not null,
  description text not null,
  unit text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  source_url text,
  captured_at timestamptz not null default now(),
  unique (price_book_id, sku)
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  template_version_id uuid references public.estimate_template_versions(id) on delete restrict,
  price_book_id uuid references public.price_books(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','rejected','superseded')),
  formula_version text not null default 'v1',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'approved') = (approved_by is not null and approved_at is not null))
);

create table if not exists public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  item_code text not null,
  description text not null,
  category text not null check (category in ('material','labor','allowance','fee','tax')),
  unit text not null,
  quantity numeric(12,3) not null check (quantity >= 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  source_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists estimate_templates_workspace_idx on public.estimate_templates (workspace_id);
create index if not exists price_books_workspace_effective_idx on public.price_books (workspace_id, effective_at desc);
create index if not exists estimates_workspace_created_idx on public.estimates (workspace_id, created_at desc);

alter table public.estimate_templates enable row level security;
alter table public.estimate_template_versions enable row level security;
alter table public.estimate_template_items enable row level security;
alter table public.price_books enable row level security;
alter table public.price_book_items enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_line_items enable row level security;

create policy estimate_templates_select on public.estimate_templates for select using (public.is_workspace_member(workspace_id));
create policy estimate_templates_write on public.estimate_templates for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id) and auth.uid() = created_by);

create policy estimate_template_versions_select on public.estimate_template_versions for select using (exists (select 1 from public.estimate_templates t where t.id = template_id and public.is_workspace_member(t.workspace_id)));
create policy estimate_template_versions_write on public.estimate_template_versions for all using (exists (select 1 from public.estimate_templates t where t.id = template_id and public.is_workspace_admin(t.workspace_id))) with check (exists (select 1 from public.estimate_templates t where t.id = template_id and public.is_workspace_admin(t.workspace_id)) and auth.uid() = created_by);

create policy estimate_template_items_select on public.estimate_template_items for select using (exists (select 1 from public.estimate_template_versions v join public.estimate_templates t on t.id = v.template_id where v.id = template_version_id and public.is_workspace_member(t.workspace_id)));
create policy estimate_template_items_write on public.estimate_template_items for all using (exists (select 1 from public.estimate_template_versions v join public.estimate_templates t on t.id = v.template_id where v.id = template_version_id and public.is_workspace_admin(t.workspace_id))) with check (exists (select 1 from public.estimate_template_versions v join public.estimate_templates t on t.id = v.template_id where v.id = template_version_id and public.is_workspace_admin(t.workspace_id)));

create policy price_books_select on public.price_books for select using (public.is_workspace_member(workspace_id));
create policy price_books_write on public.price_books for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id) and auth.uid() = created_by);
create policy price_book_items_select on public.price_book_items for select using (exists (select 1 from public.price_books p where p.id = price_book_id and public.is_workspace_member(p.workspace_id)));
create policy price_book_items_write on public.price_book_items for all using (exists (select 1 from public.price_books p where p.id = price_book_id and public.is_workspace_admin(p.workspace_id))) with check (exists (select 1 from public.price_books p where p.id = price_book_id and public.is_workspace_admin(p.workspace_id)));

create policy estimates_select on public.estimates for select using (public.is_workspace_member(workspace_id));
create policy estimates_insert on public.estimates for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy estimates_update on public.estimates for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy estimate_line_items_select on public.estimate_line_items for select using (exists (select 1 from public.estimates e where e.id = estimate_id and public.is_workspace_member(e.workspace_id)));
create policy estimate_line_items_insert on public.estimate_line_items for insert with check (exists (select 1 from public.estimates e where e.id = estimate_id and public.is_workspace_member(e.workspace_id)));
