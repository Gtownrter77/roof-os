-- Enforce that a workspace-scoped lead owner is a member of that workspace.
-- This mirrors the existing RLS owner contract for trusted service-role writes.

create or replace function public.enforce_lead_owner_workspace_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is not null and new.owner_id is not null then
    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.owner_id
    ) then
      raise exception 'Lead owner must be a member of the lead workspace' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.leads l
    where l.workspace_id is not null
      and not exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = l.workspace_id
          and wm.user_id = l.owner_id
      )
  ) then
    raise exception 'Existing leads contain owners outside their workspace';
  end if;
end $$;

drop trigger if exists leads_owner_workspace_guard on public.leads;
create trigger leads_owner_workspace_guard
before insert or update of workspace_id, owner_id
on public.leads
for each row execute function public.enforce_lead_owner_workspace_consistency();

revoke all on function public.enforce_lead_owner_workspace_consistency() from public, anon, authenticated;