-- Synthetic, disposable PostgreSQL-only baseline for production handoff tests.
-- Not Supabase Auth, Storage, API or production.
create schema if not exists auth;
create table auth.users(id uuid primary key);
-- Roles are cluster-wide: another suite may have created them already.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

create table public.workspaces(id uuid primary key);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','member')),
  primary key(workspace_id,user_id)
);
create function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members
  where workspace_id=target_workspace and user_id=auth.uid()) $$;

create function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members
  where workspace_id=target_workspace and user_id=auth.uid()
    and role in ('owner','admin')) $$;

-- Only the columns migration 063/064 read or reference.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  status text not null default 'new',
  next_action text,
  next_action_due timestamptz,
  next_action_owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','pending_approval','approved','rejected','superseded')),
  formula_version text not null default 'v1',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.estimate_line_items (
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

grant usage on schema auth, public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
