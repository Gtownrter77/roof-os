-- Reassert private inspection storage access with uploader ownership in the
-- object path. Workspace administrators may read/delete workspace objects;
-- members can create only under their own <workspace>/<user>/ prefix.

begin;

drop policy if exists inspection_photos_select on storage.objects;
drop policy if exists inspection_photos_insert on storage.objects;
drop policy if exists inspection_photos_delete on storage.objects;

create policy inspection_photos_select
  on storage.objects for select
  using (
    bucket_id = 'inspection-photos'
    and coalesce(array_length(storage.foldername(name), 1), 0) >= 2
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_workspace_admin((storage.foldername(name))[1]::uuid)
    )
  );

create policy inspection_photos_insert
  on storage.objects for insert
  with check (
    bucket_id = 'inspection-photos'
    and coalesce(array_length(storage.foldername(name), 1), 0) >= 2
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy inspection_photos_delete
  on storage.objects for delete
  using (
    bucket_id = 'inspection-photos'
    and coalesce(array_length(storage.foldername(name), 1), 0) >= 2
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_workspace_admin((storage.foldername(name))[1]::uuid)
    )
  );

commit;
