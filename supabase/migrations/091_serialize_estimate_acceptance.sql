-- Serialize acceptance recording with estimate status and pricing changes.
-- Locking the estimate row makes the approved-status check and copied price snapshot
-- atomic with respect to concurrent UPDATEs (including superseding the estimate).

create or replace function public.enforce_estimate_acceptance()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estimate public.estimates%rowtype;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'A recorded estimate acceptance is immutable'
      using errcode = '23514';
  end if;

  select * into v_estimate from public.estimates where id = NEW.estimate_id for update;
  if not found then
    raise exception 'An acceptance must reference an existing estimate'
      using errcode = '23503';
  end if;

  if v_estimate.workspace_id is distinct from NEW.workspace_id then
    raise exception 'An acceptance must belong to the estimate workspace'
      using errcode = '23514';
  end if;

  if v_estimate.status <> 'approved' then
    raise exception 'The estimate must be approved before acceptance can be recorded (current status: %)', v_estimate.status
      using errcode = '23514';
  end if;

  if not public.is_workspace_member(NEW.workspace_id) then
    raise exception 'Workspace membership is required to record an acceptance'
      using errcode = '23514';
  end if;

  -- The browser cannot choose the accepted amount, formula or time.
  NEW.accepted_subtotal := v_estimate.subtotal;
  NEW.accepted_tax := v_estimate.tax;
  NEW.accepted_total := v_estimate.total;
  NEW.estimate_formula_version := v_estimate.formula_version;
  NEW.accepted_at := now();
  NEW.created_at := now();
  return NEW;
end;
$$;


comment on function public.enforce_estimate_acceptance() is
  'Records acceptance only while the estimate is approved; locks the estimate row so status and price snapshots cannot race.';
