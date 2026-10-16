-- Consent-based, video-only canvass recordings linked to CRM leads.
-- Use the next available local migration prefix; do not apply to production without migration review.
create table if not exists public.canvass_recordings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recording_status text not null check (recording_status in ('uploaded','consent_not_obtained','consented_not_recorded','upload_failed')),
  consented_at timestamptz,
  object_path text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  created_at timestamptz not null default now(),
  check (
    (recording_status = 'uploaded' and consented_at is not null and object_path is not null and mime_type = 'video/webm' and file_size_bytes > 0)
    or
    (recording_status <> 'uploaded' and object_path is null)
  )
);

create index if not exists canvass_recordings_workspace_lead_created_idx
  on public.canvass_recordings (workspace_id, lead_id, created_at desc);

alter table public.canvass_recordings enable row level security;
drop policy if exists canvass_recordings_select on public.canvass_recordings;
drop policy if exists canvass_recordings_insert on public.canvass_recordings;
create policy canvass_recordings_select on public.canvass_recordings
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy canvass_recordings_insert on public.canvass_recordings
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('canvass-recordings', 'canvass-recordings', false, 104857600, array['video/webm'])
on conflict (id) do update set public = false, file_size_limit = 104857600, allowed_mime_types = array['video/webm'];

drop policy if exists canvass_recordings_storage_select on storage.objects;
drop policy if exists canvass_recordings_storage_insert on storage.objects;
create policy canvass_recordings_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'canvass-recordings'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
create policy canvass_recordings_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'canvass-recordings'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
