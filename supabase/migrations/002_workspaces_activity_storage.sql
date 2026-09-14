create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.handle_new_user_workspace()
returns trigger language plpgsql security definer set search_path = public
as $$
declare workspace_id uuid;
begin
  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), 'My Roofing Company'), new.id)
  returning id into workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (workspace_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_workspace on auth.users;
create trigger on_auth_user_created_workspace after insert on auth.users
for each row execute function public.handle_new_user_workspace();

do $$
declare u record; workspace_id uuid;
begin
  for u in select id, raw_user_meta_data from auth.users loop
    if not exists (select 1 from public.workspace_members where user_id = u.id) then
      insert into public.workspaces (name, created_by)
      values (coalesce(nullif(u.raw_user_meta_data->>'company_name', ''), 'My Roofing Company'), u.id)
      returning id into workspace_id;
      insert into public.workspace_members (workspace_id, user_id, role) values (workspace_id, u.id, 'owner');
    end if;
  end loop;
end $$;

alter table public.leads add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create table if not exists public.lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','status_change','created')),
  body text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid()); $$;

create or replace function public.current_workspace_id()
returns uuid language sql stable security definer set search_path = public
as $$ select workspace_id from public.workspace_members where user_id = auth.uid() order by created_at limit 1; $$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activity enable row level security;

drop policy if exists workspace_select on public.workspaces;
drop policy if exists member_select on public.workspace_members;
drop policy if exists lead_select on public.leads;
drop policy if exists lead_insert on public.leads;
drop policy if exists lead_update on public.leads;
drop policy if exists lead_delete on public.leads;
drop policy if exists activity_select on public.lead_activity;
drop policy if exists activity_insert on public.lead_activity;
create policy workspace_select on public.workspaces for select using (public.is_workspace_member(id));
create policy member_select on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy lead_select on public.leads for select using (public.is_workspace_member(workspace_id));
create policy lead_insert on public.leads for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = owner_id);
create policy lead_update on public.leads for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy lead_delete on public.leads for delete using (public.is_workspace_member(workspace_id));
create policy activity_select on public.lead_activity for select using (public.is_workspace_member(workspace_id));
create policy activity_insert on public.lead_activity for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do nothing;

drop policy if exists inspection_photos_select on storage.objects;
drop policy if exists inspection_photos_insert on storage.objects;
drop policy if exists inspection_photos_delete on storage.objects;
create policy inspection_photos_select on storage.objects for select using (bucket_id = 'inspection-photos' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy inspection_photos_insert on storage.objects for insert with check (bucket_id = 'inspection-photos' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy inspection_photos_delete on storage.objects for delete using (bucket_id = 'inspection-photos' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
