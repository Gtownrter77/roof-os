-- Recorded customer acceptance + deposit state (new migration; does not edit 007/059).
--
-- This is NOT an e-signature. It records that office staff spoke with or heard from
-- the customer and that the customer accepted the approved estimate. The customer
-- name, method and acceptance time are immutable evidence. Amounts are copied from
-- the approved estimate by the database, never supplied by the browser.
--
-- Deposits are an append-only event ledger: requested -> received -> refunded, or a
-- single waived event. Each event is immutable. The current state is derived from
-- the events; no balance column can silently drift.

create table if not exists public.estimate_acceptances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  accepted_by_name text not null check (char_length(btrim(accepted_by_name)) between 1 and 120),
  acceptance_method text not null
    check (acceptance_method in ('in_person','phone','email','text','portal')),
  note text,
  -- Server-owned snapshot of the approved estimate at acceptance time.
  accepted_subtotal numeric(12,2) not null default 0 check (accepted_subtotal >= 0),
  accepted_tax numeric(12,2) not null default 0 check (accepted_tax >= 0),
  accepted_total numeric(12,2) not null default 0 check (accepted_total >= 0),
  estimate_formula_version text not null default '',
  accepted_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint estimate_acceptances_one_per_estimate unique (estimate_id)
);

create index if not exists estimate_acceptances_workspace_idx
  on public.estimate_acceptances (workspace_id, accepted_at desc);

create table if not exists public.estimate_deposit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  acceptance_id uuid not null references public.estimate_acceptances(id) on delete restrict,
  event_type text not null check (event_type in ('requested','received','waived','refunded')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  method text check (method in ('cash','check','card','ach','other')),
  reference text,
  note text,
  occurred_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists estimate_deposit_events_acceptance_idx
  on public.estimate_deposit_events (acceptance_id, created_at, id);
create index if not exists estimate_deposit_events_workspace_idx
  on public.estimate_deposit_events (workspace_id, occurred_at desc);

alter table public.estimate_acceptances enable row level security;
alter table public.estimate_deposit_events enable row level security;

drop policy if exists estimate_acceptances_select on public.estimate_acceptances;
create policy estimate_acceptances_select on public.estimate_acceptances
  for select using (public.is_workspace_member(workspace_id));

-- Any workspace member may record what the customer said. The recorder is the caller.
drop policy if exists estimate_acceptances_insert on public.estimate_acceptances;
create policy estimate_acceptances_insert on public.estimate_acceptances
  for insert with check (
    public.is_workspace_member(workspace_id)
    and auth.uid() = recorded_by
  );

-- No update or delete policy: acceptance is immutable.

drop policy if exists estimate_deposit_events_select on public.estimate_deposit_events;
create policy estimate_deposit_events_select on public.estimate_deposit_events
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists estimate_deposit_events_insert on public.estimate_deposit_events;
create policy estimate_deposit_events_insert on public.estimate_deposit_events
  for insert with check (
    public.is_workspace_member(workspace_id)
    and auth.uid() = recorded_by
  );

-- No update or delete policy: the deposit ledger is append-only.

-- Acceptance: approved estimate only, matching workspace, one per estimate,
-- server-owned amounts and timestamp, immutable after insert.
create or replace function public.enforce_estimate_acceptance()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estimate public.estimates%rowtype;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'A recorded estimate acceptance is immutable'
      using errcode = '23514';
  end if;

  select * into v_estimate from public.estimates where id = NEW.estimate_id;
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

drop trigger if exists enforce_estimate_acceptance on public.estimate_acceptances;
create trigger enforce_estimate_acceptance
  before insert or update or delete on public.estimate_acceptances
  for each row execute function public.enforce_estimate_acceptance();

-- Deposit ledger state machine and immutable events.
create or replace function public.enforce_estimate_deposit_event()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_acceptance public.estimate_acceptances%rowtype;
  v_event_count integer := 0;
  v_requested numeric := 0;
  v_received numeric := 0;
  v_refunded numeric := 0;
  v_last_type text;
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
         coalesce(sum(amount) filter (where event_type = 'requested'), 0),
         coalesce(sum(amount) filter (where event_type = 'received'), 0),
         coalesce(sum(amount) filter (where event_type = 'refunded'), 0)
    into v_event_count, v_requested, v_received, v_refunded
  from public.estimate_deposit_events
  where acceptance_id = NEW.acceptance_id;

  select event_type into v_last_type
  from public.estimate_deposit_events
  where acceptance_id = NEW.acceptance_id
  order by created_at desc, id desc
  limit 1;

  if v_last_type = 'refunded' then
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
      if v_last_type is distinct from 'requested' then
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
      if v_last_type is distinct from 'received' then
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

drop trigger if exists enforce_estimate_deposit_event on public.estimate_deposit_events;
create trigger enforce_estimate_deposit_event
  before insert or update or delete on public.estimate_deposit_events
  for each row execute function public.enforce_estimate_deposit_event();

revoke all on function public.enforce_estimate_acceptance() from public, anon;
revoke all on function public.enforce_estimate_deposit_event() from public, anon;
grant execute on function public.enforce_estimate_acceptance() to authenticated;
grant execute on function public.enforce_estimate_deposit_event() to authenticated;

comment on table public.estimate_acceptances is
  'Recorded customer acceptance of an approved estimate. Not an electronic signature.';
comment on table public.estimate_deposit_events is
  'Append-only deposit ledger. Current deposit state is derived from the events.';
