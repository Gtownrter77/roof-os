-- ROOF/OS status history and inspection photo metadata
-- Depends on 002_workspaces_activity_storage.sql.

update public.leads l
set workspace_id = members.workspace_id
from (
  select distinct on (user_id) user_id, workspace_id
  from public.workspace_members
  order by user_id, created_at
) as members
where l.workspace_id is null and l.owner_id = members.user_id;

create table if not exists public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.record_lead_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.workspace_id is not null and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    insert into public.lead_status_history (lead_id, workspace_id, from_status, to_status, changed_by)
    values (new.id, new.workspace_id, case when tg_op = 'INSERT' then null else old.status end, new.status, coalesce(auth.uid(), new.owner_id));
  end if;
  return new;
end;
$$;

drop trigger if exists lead_status_history_trigger on public.leads;
create trigger lead_status_history_trigger
after insert or update of status on public.leads
for each row execute function public.record_lead_status_change();

create table if not exists public.inspection_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','in_progress','completed','cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  client_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspection_sessions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  bucket_id text not null default 'inspection-photos',
  object_path text not null,
  album text not null default 'general',
  caption text,
  annotation_json jsonb not null default '{}'::jsonb,
  mime_type text not null,
  file_size_bytes bigint,
  width integer,
  height integer,
  captured_at timestamptz,
  upload_status text not null default 'uploaded' check (upload_status in ('queued','uploading','uploaded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create index if not exists lead_status_history_lead_created_idx on public.lead_status_history (lead_id, created_at desc);
create index if not exists inspection_sessions_workspace_created_idx on public.inspection_sessions (workspace_id, created_at desc);
create index if not exists inspection_photos_inspection_created_idx on public.inspection_photos (inspection_id, created_at desc);
create index if not exists inspection_photos_workspace_album_idx on public.inspection_photos (workspace_id, album, created_at desc);

alter table public.lead_status_history enable row level security;
alter table public.inspection_sessions enable row level security;
alter table public.inspection_photos enable row level security;

drop policy if exists lead_status_history_select on public.lead_status_history;
drop policy if exists lead_status_history_insert on public.lead_status_history;
drop policy if exists inspection_sessions_select on public.inspection_sessions;
drop policy if exists inspection_sessions_insert on public.inspection_sessions;
drop policy if exists inspection_sessions_update on public.inspection_sessions;
drop policy if exists inspection_photos_select on public.inspection_photos;
drop policy if exists inspection_photos_insert on public.inspection_photos;
drop policy if exists inspection_photos_update on public.inspection_photos;
drop policy if exists inspection_photos_delete on public.inspection_photos;

create policy lead_status_history_select on public.lead_status_history
for select using (public.is_workspace_member(workspace_id));
create policy lead_status_history_insert on public.lead_status_history
for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = changed_by);

create policy inspection_sessions_select on public.inspection_sessions
for select using (public.is_workspace_member(workspace_id));
create policy inspection_sessions_insert on public.inspection_sessions
for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
create policy inspection_sessions_update on public.inspection_sessions
for update using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy inspection_photos_select on public.inspection_photos
for select using (public.is_workspace_member(workspace_id));
create policy inspection_photos_insert on public.inspection_photos
for insert with check (public.is_workspace_member(workspace_id) and auth.uid() = uploaded_by);
create policy inspection_photos_update on public.inspection_photos
for update using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy inspection_photos_delete on public.inspection_photos
for delete using (public.is_workspace_member(workspace_id));
