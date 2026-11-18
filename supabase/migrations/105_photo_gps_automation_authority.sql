-- Photo provenance and workspace-owner automatic measurement authority.
-- Untagged photos remain valid manual evidence. Only server-verified, embedded
-- EXIF location may qualify for photo-driven automation; never trust client claims.
alter table public.inspection_photos
  add column if not exists gps_verified boolean not null default false,
  add column if not exists gps_latitude double precision,
  add column if not exists gps_longitude double precision,
  add column if not exists gps_address text,
  add column if not exists gps_verified_at timestamptz,
  add column if not exists gps_sha256 text;

alter table public.inspection_photos
  drop constraint if exists inspection_photos_verified_embedded_gps_check;
alter table public.inspection_photos
  add constraint inspection_photos_verified_embedded_gps_check check (
    (not gps_verified and gps_latitude is null and gps_longitude is null
      and gps_address is null and gps_verified_at is null and gps_sha256 is null)
    or (gps_verified and gps_latitude between -90 and 90 and gps_longitude between -180 and 180
      and gps_address is not null and length(trim(gps_address)) between 1 and 250
      and gps_verified_at is not null and gps_sha256 ~ '^[a-f0-9]{64}$')
  );

-- Only a verified service-role operation can certify GPS provenance. Existing
-- browser, mobile and database direct-write paths cannot forge a green flag.
create or replace function public.protect_inspection_photo_gps_verification()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' and (
      new.gps_verified or new.gps_latitude is not null or new.gps_longitude is not null
      or new.gps_address is not null or new.gps_verified_at is not null or new.gps_sha256 is not null
    ) then
      raise exception 'Embedded photo GPS certification requires server verification' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.gps_verified is distinct from old.gps_verified
      or new.gps_latitude is distinct from old.gps_latitude
      or new.gps_longitude is distinct from old.gps_longitude
      or new.gps_address is distinct from old.gps_address
      or new.gps_verified_at is distinct from old.gps_verified_at
      or new.gps_sha256 is distinct from old.gps_sha256
      or new.object_path is distinct from old.object_path
      or new.bucket_id is distinct from old.bucket_id
    ) then
      raise exception 'Photo provenance is immutable to client updates' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_inspection_photo_gps_verification() from PUBLIC, anon, authenticated;
drop trigger if exists inspection_photo_gps_verification_guard on public.inspection_photos;
create trigger inspection_photo_gps_verification_guard
before insert or update on public.inspection_photos
for each row execute function public.protect_inspection_photo_gps_verification();

alter table public.workspace_settings
  add column if not exists enable_auto_photo_measurements boolean not null default false;

comment on column public.workspace_settings.enable_auto_photo_measurements is
  'Off by default. Only workspace owner may enable photo-driven automatic measurements; server must also verify embedded GPS and property address before any automation.';

create or replace function public.protect_owner_photo_measurement_permission()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if (
    (tg_op = 'INSERT' and new.enable_auto_photo_measurements)
    or (tg_op = 'UPDATE' and new.enable_auto_photo_measurements is distinct from old.enable_auto_photo_measurements)
  ) and coalesce(auth.role(), '') <> 'service_role'
    and not exists (
      select 1 from public.workspace_members
      where workspace_id = new.workspace_id
        and user_id = auth.uid() and role = 'owner'
    ) then
    raise exception 'Only workspace owner may change automatic photo measurement permission' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_owner_photo_measurement_permission() from PUBLIC, anon, authenticated;
drop trigger if exists owner_photo_measurement_permission_guard on public.workspace_settings;
create trigger owner_photo_measurement_permission_guard
before insert or update on public.workspace_settings
for each row execute function public.protect_owner_photo_measurement_permission();

create index if not exists inspection_photos_automation_provenance_idx
  on public.inspection_photos (workspace_id, inspection_id) where gps_verified;
