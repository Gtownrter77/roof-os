-- Enforce that a lead's next-action owner belongs to the same workspace.
alter table public.leads
  drop constraint if exists leads_next_action_owner_workspace_fkey;

create or replace function public.ensure_lead_next_action_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is not null and new.next_action_owner_id is not null then
    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.next_action_owner_id
    ) then
      raise exception 'Next action owner must be a member of the lead workspace' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_next_action_owner_workspace_guard on public.leads;
create trigger leads_next_action_owner_workspace_guard
before insert or update of workspace_id, next_action_owner_id on public.leads
for each row execute function public.ensure_lead_next_action_owner();

revoke execute on function public.ensure_lead_next_action_owner() from public, anon, authenticated;

-- Existing rows must already satisfy the invariant before the migration can be considered valid.
do $$
begin
  if exists (
    select 1
    from public.leads l
    where l.workspace_id is not null
      and l.next_action_owner_id is not null
      and not exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = l.workspace_id
          and wm.user_id = l.next_action_owner_id
      )
  ) then
    raise exception 'Existing leads contain next-action owners outside their workspace';
  end if;
end $$;