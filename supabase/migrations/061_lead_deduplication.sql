-- Prospect -> lead deduplication (new migration; does not edit 001/002)
--
-- One phone number identifies one lead inside a workspace. The guard runs in
-- the database so two devices cannot create the same prospect at once.
-- Intentional duplicates can be forced by a caller that sets
--   select set_config('roofos.allow_duplicate_lead', 'on', true);
-- before the insert (for example an office decision after a review).

create or replace function public.lead_phone_digits(value text)
  returns text language sql immutable set search_path = public as $$
    select nullif(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '')
  $$;

comment on function public.lead_phone_digits(text) is
  'Digits-only phone normalisation used for lead deduplication.';

-- Fast lookup for the duplicate check; non-unique so historic data cannot block the migration.
create index if not exists leads_workspace_phone_digits_idx
  on public.leads (workspace_id, public.lead_phone_digits(phone))
  where phone is not null;

create or replace function public.prevent_duplicate_lead()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_existing uuid;
begin
  if new.workspace_id is null then
    return new;
  end if;

  -- Explicit office override; scoped to the transaction.
  if coalesce(current_setting('roofos.allow_duplicate_lead', true), 'off') = 'on' then
    return new;
  end if;

  v_phone := public.lead_phone_digits(new.phone);
  if v_phone is null or length(v_phone) < 10 then
    return new;
  end if;

  -- Serialise inserts per workspace so two devices cannot both pass the check.
  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 0));

  select id into v_existing
  from public.leads
  where workspace_id = new.workspace_id
    and public.lead_phone_digits(phone) = v_phone
    and (tg_op = 'INSERT' or id <> new.id)
  limit 1;

  if v_existing is not null then
    raise exception 'A lead with this phone number already exists in this workspace.'
      using errcode = '23505', detail = v_existing::text;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_lead on public.leads;
create trigger prevent_duplicate_lead
  before insert or update of phone, workspace_id on public.leads
  for each row execute function public.prevent_duplicate_lead();

revoke all on function public.prevent_duplicate_lead() from public, anon;
revoke all on function public.lead_phone_digits(text) from public, anon;
grant execute on function public.prevent_duplicate_lead() to authenticated;
grant execute on function public.lead_phone_digits(text) to authenticated;
