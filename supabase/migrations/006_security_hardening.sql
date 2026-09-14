-- ROOF/OS security hardening
-- Applies least-privilege controls to automation configuration, audit records, and photo paths.

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Only workspace owners/admins may change automation behavior.
drop policy if exists automation_rules_write on public.automation_rules;
create policy automation_rules_write
  on public.automation_rules
  for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- Agent audit rows are written by the trusted worker, not arbitrary clients.
drop policy if exists agent_runs_insert on public.agent_runs;

-- Require private inspection objects to be stored under <workspace>/<uploader>/... .
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

-- Re-apply the follow-up trigger with enabled-agent checks and explicit workspace ownership.
create or replace function public.create_default_lead_followup()
returns trigger language plpgsql security definer set search_path = public
as $$
declare followup_key text;
declare followup_title text;
declare followup_hours integer;
begin
  if new.workspace_id is null or new.owner_id is null then return new; end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.automation_rules
      where workspace_id = new.workspace_id and agent_key = 'intake_router' and enabled
    ) then return new; end if;
    followup_key := 'intake:' || new.id::text;
    followup_title := 'First response: ' || new.name;
    followup_hours := 24;
  elsif new.status is distinct from old.status
    and new.status in ('qualified','inspected','report_approved') then
    if not exists (
      select 1 from public.automation_rules
      where workspace_id = new.workspace_id and agent_key = 'scheduler' and enabled
    ) then return new; end if;
    followup_key := 'status:' || new.id::text || ':' || new.status;
    followup_title := 'Follow up: ' || new.name || ' (' || replace(new.status, '_', ' ') || ')';
    followup_hours := case when new.status = 'inspected' then 48 else 168 end;
  else
    return new;
  end if;

  insert into public.tasks
    (workspace_id, lead_id, title, due_at, assigned_to, created_by, status, notes, automation_key)
  values
    (new.workspace_id, new.id, followup_title,
     now() + make_interval(hours => followup_hours), new.owner_id, new.owner_id,
     'open', 'Created by ROOF/OS scheduler agent default rule.', followup_key)
  on conflict (workspace_id, automation_key) do nothing;
  return new;
end;
$$;
