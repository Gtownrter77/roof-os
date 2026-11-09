-- Start a single two-hour evaluation only after a user verifies a company email.
-- The company email domain is the enforceable company key; consumer email domains
-- are rejected. This is an abuse barrier, not proof of legal company identity.

begin;

alter table public.workspaces
  add column if not exists trial_started_at timestamptz;

create table if not exists public.workspace_trial_claims (
  company_domain text primary key,
  workspace_id uuid unique references public.workspaces(id) on delete set null,
  user_id uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz not null default statement_timestamp()
);

alter table public.workspace_trial_claims enable row level security;
revoke all on table public.workspace_trial_claims from public, anon, authenticated;

-- New accounts start with a locked workspace. Only the explicit activation RPC
-- can unlock it, so password login or a skipped callback cannot bypass the trial.
create or replace function public.handle_new_user_workspace()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_workspace_id uuid;
begin
  insert into public.workspaces (name, created_by, trial_status)
  values (
    coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), 'My Roofing Company'),
    new.id,
    'pending'
  )
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner');

  return new;
end;
$function$;

create or replace function public.activate_two_hour_workspace_trial(p_company_domain text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_email_domain text;
  v_email_confirmed_at timestamptz;
  v_domain text := lower(trim(coalesce(p_company_domain, '')));
  v_workspace_id uuid;
  v_trial_status text;
  v_started_at timestamptz;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if v_domain = '' or length(v_domain) > 253
     or v_domain !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$'
     or v_domain like '%..%' then
    raise exception using errcode = '22023', message = 'Enter a valid company email domain.';
  end if;

  select lower(email), email_confirmed_at
    into v_email, v_email_confirmed_at
    from auth.users where id = v_user_id;
  if v_email_confirmed_at is null then
    raise exception using errcode = '28000', message = 'Verify your work email before activating a trial.';
  end if;
  v_email_domain := split_part(coalesce(v_email, ''), '@', 2);
  if v_email_domain = '' or v_email_domain <> v_domain then
    raise exception using errcode = '22023', message = 'Use a verified work email matching your company domain.';
  end if;

  if v_domain = any(array[
    'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','outlook.com','hotmail.com',
    'live.com','icloud.com','me.com','aol.com','proton.me','protonmail.com',
    'mail.com','gmx.com','msn.com'
  ]) then
    raise exception using errcode = '22023', message = 'A company-domain email is required for a free trial.';
  end if;

  select wm.workspace_id
    into v_workspace_id
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
   where wm.user_id = v_user_id
     and wm.role = 'owner'
     and w.created_by = v_user_id
   order by wm.created_at, wm.workspace_id
   limit 1
   for update of w;

  if v_workspace_id is null then
    raise exception using errcode = '42501', message = 'An owner workspace is required to activate a trial.';
  end if;

  select trial_started_at, trial_expires_at, trial_status
    into v_started_at, v_expires_at, v_trial_status
    from public.workspaces
   where id = v_workspace_id;

  if v_started_at is not null then
    return jsonb_build_object(
      'workspace_id', v_workspace_id,
      'started_at', v_started_at,
      'expires_at', v_expires_at,
      'already_active', true
    );
  end if;

  if v_trial_status <> 'pending' then
    raise exception using errcode = '42501', message = 'This workspace is not eligible for a new free trial.';
  end if;

  insert into public.workspace_trial_claims(company_domain, workspace_id, user_id)
  values (v_domain, v_workspace_id, v_user_id);

  v_started_at := statement_timestamp();
  v_expires_at := v_started_at + interval '2 hours';

  update public.workspaces
     set trial_started_at = v_started_at,
         trial_expires_at = v_expires_at,
         trial_status = 'active'
   where id = v_workspace_id;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'started_at', v_started_at,
    'expires_at', v_expires_at,
    'already_active', false
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'This company or account has already used its free trial.';
end;
$function$;

revoke all on function public.activate_two_hour_workspace_trial(text) from public, anon;
grant execute on function public.activate_two_hour_workspace_trial(text) to authenticated;

commit;
