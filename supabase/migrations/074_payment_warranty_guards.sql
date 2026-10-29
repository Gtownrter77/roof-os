-- Payment, warranty and passport lifecycle guards (Day 25/26 hardening)
--
-- Migration 072 records payment attempts but does not constrain which invoice
-- they may reference. A payment must not be attached to a draft or void
-- invoice, and a payment outcome must follow a known transition.
-- Migration 073 records warranties and Roof Passports but does not constrain
-- their status moves. A revocation is terminal and the issuer/expiry evidence
-- is server-owned.
--
-- These are additive triggers. No existing table, column, or policy changes.

-- 1. Payment attempts are audit records for an issued invoice only.
create or replace function public.enforce_production_invoice_payment()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_invoice public.production_invoices%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'A payment attempt cannot be deleted; record a reversal instead'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
       or new.invoice_id is distinct from old.invoice_id
       or new.amount_cents is distinct from old.amount_cents
       or new.currency is distinct from old.currency
       or new.payment_method is distinct from old.payment_method
       or new.receipt_reference is distinct from old.receipt_reference
       or new.created_by is distinct from old.created_by
       or new.attempted_at is distinct from old.attempted_at then
      raise exception 'Payment amount, invoice and evidence are immutable; only the outcome may change'
        using errcode = '23514';
    end if;

    if new.status = old.status then
      raise exception 'Only a payment outcome move is allowed'
        using errcode = '23514';
    end if;

    if not (
      (old.status = 'pending' and new.status in ('succeeded','failed'))
      or (old.status = 'succeeded' and new.status = 'reversed')
    ) then
      raise exception 'Invalid payment outcome transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;

    if new.status = 'succeeded' then
      if new.payment_method is null then
        raise exception 'A succeeded payment needs a payment method'
          using errcode = '23514';
      end if;
      new.failure_reason := null;
      new.completed_at := now();
    elsif new.status = 'failed' then
      if new.failure_reason is null or char_length(btrim(new.failure_reason)) = 0 then
        raise exception 'A failed payment needs a failure reason'
          using errcode = '23514';
      end if;
      new.completed_at := now();
    elsif new.status = 'reversed' then
      new.completed_at := coalesce(old.completed_at, now());
    end if;

    new.updated_at := now();
    return new;
  end if;

  select * into v_invoice from public.production_invoices where id = new.invoice_id;
  if not found then
    raise exception 'A payment attempt must reference an existing invoice'
      using errcode = '23503';
  end if;

  if v_invoice.workspace_id is distinct from new.workspace_id then
    raise exception 'The payment attempt must belong to the invoice workspace'
      using errcode = '23514';
  end if;

  if v_invoice.status <> 'issued' then
    raise exception 'A payment attempt requires an issued invoice (current status: %)', v_invoice.status
      using errcode = '23514';
  end if;

  if new.status <> 'pending' then
    raise exception 'A new payment attempt must start pending'
      using errcode = '23514';
  end if;

  new.created_by := auth.uid();
  new.attempted_at := now();
  new.completed_at := null;
  new.failure_reason := null;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_production_invoice_payment on public.production_invoice_payments;
create trigger enforce_production_invoice_payment
  before insert or update or delete on public.production_invoice_payments
  for each row execute function public.enforce_production_invoice_payment();

revoke all on function public.enforce_production_invoice_payment() from public, anon;
grant execute on function public.enforce_production_invoice_payment() to authenticated;

-- 2. An invoice with a successful payment cannot be voided until the payment
--    is reversed. A void invoice carries no live money.
create or replace function public.enforce_production_invoice_void_guard()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'void' and old.status is distinct from 'void' then
    if exists (
      select 1 from public.production_invoice_payments
      where invoice_id = new.id and status = 'succeeded'
    ) then
      raise exception 'An invoice with a successful payment cannot be voided; reverse the payment first'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_production_invoice_void_guard on public.production_invoices;
create trigger enforce_production_invoice_void_guard
  before update on public.production_invoices
  for each row execute function public.enforce_production_invoice_void_guard();

revoke all on function public.enforce_production_invoice_void_guard() from public, anon;
grant execute on function public.enforce_production_invoice_void_guard() to authenticated;

-- 3. Warranty issuer, expiry and revocation are server-owned.
create or replace function public.enforce_warranty_lifecycle()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job public.production_jobs%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'A warranty cannot be deleted; revoke it instead'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'revoked' then
      raise exception 'A revoked warranty is immutable'
        using errcode = '23514';
    end if;

    if new.workspace_id is distinct from old.workspace_id
       or new.job_id is distinct from old.job_id
       or new.issued_at is distinct from old.issued_at
       or new.expires_at is distinct from old.expires_at
       or new.issued_by is distinct from old.issued_by
       or new.terms is distinct from old.terms
       or new.created_at is distinct from old.created_at then
      raise exception 'Warranty identity and term are immutable; only the status may change'
        using errcode = '23514';
    end if;

    if not (
      (old.status = 'active' and new.status in ('expired','revoked'))
      or (old.status = 'expired' and new.status = 'revoked')
    ) then
      raise exception 'Invalid warranty status transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;

    new.updated_at := now();
    return new;
  end if;

  select * into v_job from public.production_jobs where id = new.job_id;
  if not found then
    raise exception 'A warranty must reference an existing production job'
      using errcode = '23503';
  end if;

  if v_job.workspace_id is distinct from new.workspace_id then
    raise exception 'The warranty must belong to the job workspace'
      using errcode = '23514';
  end if;

  if v_job.status <> 'completed' then
    raise exception 'A warranty requires a completed production job (current status: %)', v_job.status
      using errcode = '23514';
  end if;

  new.status := 'active';
  new.issued_at := now();
  new.expires_at := now() + interval '1 year';
  new.issued_by := auth.uid();
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_warranty_lifecycle on public.warranties;
create trigger enforce_warranty_lifecycle
  before insert or update or delete on public.warranties
  for each row execute function public.enforce_warranty_lifecycle();

revoke all on function public.enforce_warranty_lifecycle() from public, anon;
grant execute on function public.enforce_warranty_lifecycle() to authenticated;

-- 4. Roof Passport lifecycle and revocation evidence are server-owned.
create or replace function public.enforce_roof_passport_lifecycle()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A Roof Passport cannot be deleted; revoke it instead'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'revoked' then
      raise exception 'A revoked Roof Passport is immutable'
        using errcode = '23514';
    end if;

    if new.workspace_id is distinct from old.workspace_id
       or new.job_id is distinct from old.job_id
       or new.version is distinct from old.version
       or new.data is distinct from old.data
       or new.created_at is distinct from old.created_at then
      raise exception 'Roof Passport identity and content are immutable; only the status may change'
        using errcode = '23514';
    end if;

    if not (
      (old.status = 'pending' and new.status in ('generated','revoked'))
      or (old.status = 'generated' and new.status in ('issued','revoked'))
      or (old.status = 'issued' and new.status = 'revoked')
    ) then
      raise exception 'Invalid Roof Passport status transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;

    if new.status = 'revoked' then
      if new.revocation_reason is null or char_length(btrim(new.revocation_reason)) = 0 then
        raise exception 'A Roof Passport revocation needs a reason'
          using errcode = '23514';
      end if;
      new.revoked_by := auth.uid();
      new.revoked_at := now();
    else
      new.revocation_reason := null;
      new.revoked_by := null;
      new.revoked_at := null;
    end if;

    new.updated_at := now();
    return new;
  end if;

  if not exists (select 1 from public.production_jobs where id = new.job_id) then
    raise exception 'A Roof Passport must reference an existing production job'
      using errcode = '23503';
  end if;

  if not exists (
    select 1 from public.production_jobs
    where id = new.job_id and workspace_id = new.workspace_id
  ) then
    raise exception 'The Roof Passport must belong to the job workspace'
      using errcode = '23514';
  end if;

  new.status := 'pending';
  new.generated_at := now();
  new.revocation_reason := null;
  new.revoked_by := null;
  new.revoked_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_roof_passport_lifecycle on public.roof_passports;
create trigger enforce_roof_passport_lifecycle
  before insert or update or delete on public.roof_passports
  for each row execute function public.enforce_roof_passport_lifecycle();

revoke all on function public.enforce_roof_passport_lifecycle() from public, anon;
grant execute on function public.enforce_roof_passport_lifecycle() to authenticated;

comment on function public.enforce_production_invoice_payment() is
  'Payment attempts require an issued invoice and follow pending -> succeeded/failed -> reversed.';
comment on function public.enforce_warranty_lifecycle() is
  'Warranty issuer, one-year term and terminal revocation are server-owned.';
comment on function public.enforce_roof_passport_lifecycle() is
  'Roof Passport status moves are ordered and revocation evidence is server-owned.';
