-- Independent, non-operational preference store for the 15-agent onboarding screen.
-- Never read this table as authorization to run agents, spend money or call customers.
begin;

create or replace function public.bailey_agent_setup_is_valid(p_setup jsonb)
returns boolean
language sql immutable parallel safe
set search_path = ''
as $fn$
  select coalesce(
    jsonb_typeof(p_setup) = 'object'
    and (select count(*) = 15 from jsonb_each(p_setup))
    and not exists (
      select 1 from jsonb_each(p_setup) as entry(agent_key, preference)
      where agent_key <> all (array[
        'orchestrator','chief_of_staff','personal_calling','business_receptionist',
        'outbound_sales','scheduling','customer_care','roofing_estimator',
        'production_foreman','purchasing','finance','research','documents',
        'development','quality_security'
      ]::text[])
      or jsonb_typeof(preference) <> 'string'
      or preference #>> '{}' not in ('off','review_only','approval_required')
    ),
    false
  );
$fn$;

create table if not exists public.workspace_bailey_agent_setup (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  setup jsonb not null check (public.bailey_agent_setup_is_valid(setup)),
  status text not null default 'draft' check (status in ('draft','reviewed')),
  schema_version integer not null default 1 check (schema_version = 1),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check ((status = 'reviewed' and reviewed_at is not null)
      or (status = 'draft' and reviewed_at is null))
);

alter table public.workspace_bailey_agent_setup enable row level security;
revoke all on public.workspace_bailey_agent_setup from public, anon, authenticated;
grant select, insert, update on public.workspace_bailey_agent_setup to authenticated;

create policy bailey_agent_setup_select on public.workspace_bailey_agent_setup
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy bailey_agent_setup_insert on public.workspace_bailey_agent_setup
  for insert to authenticated
  with check (public.is_workspace_admin(workspace_id) and auth.uid() = updated_by);
create policy bailey_agent_setup_update on public.workspace_bailey_agent_setup
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id) and auth.uid() = updated_by);

comment on table public.workspace_bailey_agent_setup is
  'Owner-reviewed non-operational 15-agent onboarding preferences. NOT agent activation, permission grants, or evidence of worker readiness.';
commit;
