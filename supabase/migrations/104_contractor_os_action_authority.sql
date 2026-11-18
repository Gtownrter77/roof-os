-- ContractorOS Stage 3: action-time authority evaluation.
-- The approval-event trigger is atomic with the existing approval RPC and fails closed.

alter table public.agent_action_batches
  add column if not exists authority_state text not null default 'not_evaluated'
    check (authority_state in ('not_evaluated','allowed','denied','stale')),
  add column if not exists authority_profile_role text,
  add column if not exists authority_evaluated_at timestamptz;

alter table public.agent_actions
  add column if not exists authority_state text not null default 'not_evaluated'
    check (authority_state in ('not_evaluated','allowed','denied','stale')),
  add column if not exists authority_profile_role text,
  add column if not exists authority_evaluated_at timestamptz;

create index if not exists agent_action_batches_authority_idx
  on public.agent_action_batches (workspace_id, authority_state, created_at desc);
create index if not exists agent_actions_authority_idx
  on public.agent_actions (workspace_id, authority_state, created_at desc);

create or replace function public.contractor_effective_authority(
  target_workspace uuid,
  target_user uuid
)
returns table (
  role_key text,
  authority_level text,
  capabilities jsonb,
  action_limits jsonb,
  prohibitions jsonb,
  profile_source text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role_key text;
begin
  if target_workspace is null or target_user is null then return; end if;
  select coalesce(nullif(wm.employee_layer, ''), wm.role)
    into v_role_key
    from public.workspace_members wm
   where wm.workspace_id = target_workspace and wm.user_id = target_user;
  if v_role_key is null then return; end if;

  if exists (
    select 1 from public.contractor_authority_profiles p
     where p.workspace_id = target_workspace and p.role_key = v_role_key and p.active = true
  ) then
    return query
    select p.role_key, p.authority_level, p.capabilities, p.action_limits, p.prohibitions, 'profile'::text
      from public.contractor_authority_profiles p
     where p.workspace_id = target_workspace and p.role_key = v_role_key and p.active = true;
  else
    return query
    select v_role_key,
           case when v_role_key = 'owner' then 'release' when v_role_key = 'admin' then 'approve' else 'read' end,
           case when v_role_key = 'owner' then '["prepare","approve","execute","coordinate","sustain","release"]'::jsonb
                when v_role_key = 'admin' then '["prepare","approve","coordinate"]'::jsonb
                else '["read","prepare"]'::jsonb end,
           '{}'::jsonb,
           '[]'::jsonb,
           'safe_default'::text;
  end if;
end;
$$;

create or replace function public.contractor_enforce_action_approval_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_risk_level text;
  v_role_key text;
  v_authority_level text;
  v_capabilities jsonb;
  v_required_capability text;
  v_authority_rank integer;
  v_required_rank integer;
  v_now timestamptz := now();
begin
  select b.workspace_id, b.risk_level
    into v_workspace_id, v_risk_level
    from public.agent_action_batches b
   where b.id = new.batch_id;
  if v_workspace_id is null then raise exception 'action batch not found'; end if;

  select e.role_key, e.authority_level, e.capabilities
    into v_role_key, v_authority_level, v_capabilities
    from public.contractor_effective_authority(v_workspace_id, new.approved_by) e;
  if v_role_key is null then raise exception 'approver has no workspace authority profile'; end if;

  v_required_capability := case
    when v_risk_level in ('financial','legal') then 'release'
    when v_risk_level in ('customer_communication','operational') then 'approve'
    else 'prepare'
  end;
  v_authority_rank := case v_authority_level
    when 'read' then 0 when 'prepare' then 1 when 'approve' then 2 when 'execute' then 3
    when 'coordinate' then 4 when 'sustain' then 5 when 'release' then 6 else -1 end;
  v_required_rank := case v_required_capability
    when 'prepare' then 1 when 'approve' then 2 when 'release' then 6 else 99 end;

  if not (coalesce(v_capabilities, '[]'::jsonb) ? v_required_capability) and v_authority_rank < v_required_rank then
    raise exception 'approver authority is insufficient for this action risk level';
  end if;

  update public.agent_action_batches
     set authority_state = 'allowed', authority_profile_role = v_role_key, authority_evaluated_at = v_now
   where id = new.batch_id;
  update public.agent_actions
     set authority_state = 'allowed', authority_profile_role = v_role_key, authority_evaluated_at = v_now
   where batch_id = new.batch_id;
  return new;
end;
$$;

drop trigger if exists contractor_action_approval_authority on public.agent_approval_events;
create trigger contractor_action_approval_authority
before insert on public.agent_approval_events
for each row execute function public.contractor_enforce_action_approval_authority();

revoke all on function public.contractor_effective_authority(uuid, uuid) from public, anon, authenticated;
revoke all on function public.contractor_enforce_action_approval_authority() from public, anon, authenticated;
grant execute on function public.contractor_effective_authority(uuid, uuid) to service_role;
grant execute on function public.contractor_enforce_action_approval_authority() to service_role;

comment on function public.contractor_effective_authority(uuid, uuid) is 'Resolves an active workspace role profile, with safe owner/admin/member defaults when no profile exists.';
comment on function public.contractor_enforce_action_approval_authority() is 'Atomic approval-event guard requiring role/profile capability for action risk.';
comment on trigger contractor_action_approval_authority on public.agent_approval_events is 'Prevents approvals that exceed the configured authority profile.';
