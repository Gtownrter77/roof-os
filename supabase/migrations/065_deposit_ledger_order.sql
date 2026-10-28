-- Deposit ledger state fix (new migration; does not edit 063).
--
-- 063 decided the "last" deposit event from a timestamp plus the random UUID.
-- Events written in one transaction share created_at, so the refund terminal
-- state could be missed. This rewrite derives the state from event presence and
-- counts, which is deterministic.

create or replace function public.enforce_estimate_deposit_event()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_acceptance public.estimate_acceptances%rowtype;
  v_event_count integer := 0;
  v_requested_count integer := 0;
  v_received_count integer := 0;
  v_refunded_count integer := 0;
  v_requested numeric := 0;
  v_received numeric := 0;
  v_refunded numeric := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'A deposit event is immutable'
      using errcode = '23514';
  end if;

  select * into v_acceptance from public.estimate_acceptances where id = NEW.acceptance_id;
  if not found then
    raise exception 'A deposit event must reference a recorded acceptance'
      using errcode = '23503';
  end if;

  if v_acceptance.workspace_id is distinct from NEW.workspace_id
     or v_acceptance.estimate_id is distinct from NEW.estimate_id then
    raise exception 'A deposit event must match the acceptance workspace and estimate'
      using errcode = '23514';
  end if;

  if not public.is_workspace_member(NEW.workspace_id) then
    raise exception 'Workspace membership is required to record a deposit event'
      using errcode = '23514';
  end if;

  select count(*),
         count(*) filter (where event_type = 'requested'),
         count(*) filter (where event_type = 'received'),
         count(*) filter (where event_type = 'refunded'),
         coalesce(sum(amount) filter (where event_type = 'requested'), 0),
         coalesce(sum(amount) filter (where event_type = 'received'), 0),
         coalesce(sum(amount) filter (where event_type = 'refunded'), 0)
    into v_event_count, v_requested_count, v_received_count, v_refunded_count,
         v_requested, v_received, v_refunded
  from public.estimate_deposit_events
  where acceptance_id = NEW.acceptance_id;

  if v_refunded_count > 0 then
    raise exception 'A refunded deposit cannot receive new events'
      using errcode = '23514';
  end if;

  case NEW.event_type
    when 'requested' then
      if v_event_count > 0 then
        raise exception 'A deposit request can only be recorded once'
          using errcode = '23514';
      end if;
      if NEW.amount <= 0 then
        raise exception 'A requested deposit needs a positive amount'
          using errcode = '23514';
      end if;
      if NEW.amount > v_acceptance.accepted_total then
        raise exception 'A requested deposit cannot exceed the accepted total'
          using errcode = '23514';
      end if;
    when 'waived' then
      if v_event_count > 0 then
        raise exception 'A deposit waiver must be the only deposit event'
          using errcode = '23514';
      end if;
      if NEW.amount <> 0 then
        raise exception 'A waived deposit has no amount'
          using errcode = '23514';
      end if;
    when 'received' then
      if v_requested_count <> 1 or v_received_count <> 0 then
        raise exception 'A deposit can only be received after it is requested'
          using errcode = '23514';
      end if;
      if NEW.amount <= 0 then
        raise exception 'A received deposit needs a positive amount'
          using errcode = '23514';
      end if;
      if NEW.amount > v_requested then
        raise exception 'A received deposit cannot exceed the requested amount'
          using errcode = '23514';
      end if;
      if v_received + NEW.amount > v_acceptance.accepted_total then
        raise exception 'Received deposits cannot exceed the accepted total'
          using errcode = '23514';
      end if;
      if NEW.method is null then
        raise exception 'A received deposit needs a payment method'
          using errcode = '23514';
      end if;
    when 'refunded' then
      if v_received_count <> 1 then
        raise exception 'Only a received deposit can be refunded'
          using errcode = '23514';
      end if;
      if NEW.amount <= 0 then
        raise exception 'A refund needs a positive amount'
          using errcode = '23514';
      end if;
      if NEW.amount > v_received - v_refunded then
        raise exception 'A refund cannot exceed the received deposit'
          using errcode = '23514';
      end if;
      if NEW.method is null then
        raise exception 'A refund needs a payment method'
          using errcode = '23514';
      end if;
  end case;

  NEW.occurred_at := now();
  NEW.created_at := now();
  return NEW;
end;
$$;

revoke all on function public.enforce_estimate_deposit_event() from public, anon;
grant execute on function public.enforce_estimate_deposit_event() to authenticated;

comment on function public.enforce_estimate_deposit_event() is
  'Append-only deposit ledger. State is derived from event presence and counts, never from UUID ordering.';
