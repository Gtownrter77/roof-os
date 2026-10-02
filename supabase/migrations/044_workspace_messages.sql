create table if not exists public.workspace_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.workspace_messages enable row level security;
drop policy if exists workspace_messages_select on public.workspace_messages;
drop policy if exists workspace_messages_insert on public.workspace_messages;
create policy workspace_messages_select on public.workspace_messages
  for select using (public.is_workspace_member(workspace_id));
create policy workspace_messages_insert on public.workspace_messages
  for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = user_id);
