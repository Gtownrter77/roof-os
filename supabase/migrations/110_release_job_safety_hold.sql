-- Forward-only fix for the CRITICAL deadlock in 109_foreman_sos.sql.
-- 109 opens a hold and blocks in_progress/completed while it is open, but no
-- caller can set released_at/released_by. This migration adds an authorized
-- release path without editing or replaying an applied migration.

create or replace function public.release_job_safety_hold(incident uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.job_safety_holds;
  j public.production_jobs;
begin
  select * into h from public.job_safety_holds where id = incident for update;
  if h.id is null then
    raise exception 'Safety hold not found' using errcode = 'P0002';
  end if;
  if h.released_at is not null then
    return;
  end if;

  select * into j from public.production_jobs where id = h.job_id for update;
  if j.id is null then
    raise exception 'Safety hold job not found' using errcode = 'P0002';
  end if;
  if not public.is_workspace_admin(j.workspace_id) then
    raise exception 'Workspace administrator access is required to release a safety hold' using errcode = '42501';
  end if;

  update public.job_safety_holds
     set released_at = now(), released_by = auth.uid()
   where id = incident and released_at is null;
end $$;

revoke all on function public.release_job_safety_hold(uuid) from public, anon;
grant execute on function public.release_job_safety_hold(uuid) to authenticated;

-- 109 created this trigger function without the least-privilege REVOKE applied
-- by hardening migration 075. Re-assert the invariant here; triggers do not
-- require caller EXECUTE grants.
revoke all on function public.enforce_job_safety_hold() from public, anon, authenticated;
