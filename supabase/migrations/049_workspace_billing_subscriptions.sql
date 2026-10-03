create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan text not null check (plan in ('starter','pro','enterprise')),
  status text not null check (status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_subscriptions enable row level security;

drop policy if exists workspace_subscriptions_select on public.workspace_subscriptions;
create policy workspace_subscriptions_select
  on public.workspace_subscriptions
  for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_subscriptions_insert_admin on public.workspace_subscriptions;
create policy workspace_subscriptions_insert_admin
  on public.workspace_subscriptions
  for insert
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists workspace_subscriptions_update_admin on public.workspace_subscriptions;
create policy workspace_subscriptions_update_admin
  on public.workspace_subscriptions
  for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create index if not exists workspace_subscriptions_status_idx
  on public.workspace_subscriptions(workspace_id, status);