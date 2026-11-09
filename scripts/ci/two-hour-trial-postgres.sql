\set ON_ERROR_STOP on

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create table public.user_active_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  updated_at timestamptz not null default now()
);

\ir ../../supabase/migrations/085_workspace_trial_expiry.sql
\ir ../../supabase/migrations/086_two_hour_trial_activation.sql
\ir ../../supabase/migrations/087_fix_trial_company_domain_validation.sql
\ir ../../supabase/migrations/088_strict_trial_company_domain_labels.sql
\ir ../../supabase/migrations/089_correct_trial_domain_regex_escaping.sql

-- Exercise the final migration's exact domain-label validator, not only 086's
-- original implementation. Invalid labels must fail before account lookup.
do $
declare
  candidate text;
  invalid_domains text[] := array[
    'foo.-bar.com',
    'foo.bar-.com',
    'foo..bar.com',
    '-foo.com',
    'foo-.com',
    repeat('a', 64) || '.com',
    'foo.com-',
    'foo.c',
    'foo_' || '.com'
  ];
begin
  if not ('roofingco.com' ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\\.[a-z]{2,}
create trigger on_auth_user_created_workspace
after insert on auth.users
for each row execute function public.handle_new_user_workspace();

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','owner@acme.test',now(),'{"company_name":"Acme Roofing","request_two_hour_trial":true}'),
 ('10000000-0000-4000-8000-000000000002','other@acme.test',now(),'{"company_name":"Acme Duplicate","request_two_hour_trial":true}'),
 ('10000000-0000-4000-8000-000000000003','person@gmail.com',now(),'{"company_name":"Personal Email","request_two_hour_trial":true}'),
 ('10000000-0000-4000-8000-000000000004','pending@roofco.test',null,'{"company_name":"Unverified","request_two_hour_trial":true}'),
 ('10000000-0000-4000-8000-000000000005','legacy@rooflegacy.test',now(),'{}');

-- Existing customer workspaces default to active; new Auth users get pending workspaces.
insert into public.workspaces(id,name,created_by,trial_status)
values ('20000000-0000-4000-8000-000000000005','Legacy customer','10000000-0000-4000-8000-000000000005','active');
insert into public.workspace_members(workspace_id,user_id,role)
values ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','owner');

do $$
declare
  v_workspace_id uuid;
  result jsonb;
  started timestamptz;
  expires timestamptz;
begin
  select id into v_workspace_id from public.workspaces where created_by = '10000000-0000-4000-8000-000000000001';
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
  if public.is_workspace_member(v_workspace_id) then raise exception 'pending workspace was accessible before activation'; end if;
  if public.is_workspace_admin(v_workspace_id) then raise exception 'pending workspace admin access was allowed'; end if;
  if public.current_workspace_id() is not null then raise exception 'pending workspace was returned as active'; end if;

  result := public.activate_two_hour_workspace_trial('acme.test');
  if (result->>'already_active')::boolean then raise exception 'first activation was marked already active'; end if;
  started := (result->>'started_at')::timestamptz;
  expires := (result->>'expires_at')::timestamptz;
  if expires - started <> interval '2 hours' then raise exception 'trial is not exactly two hours'; end if;
  if not public.is_workspace_member(v_workspace_id) then raise exception 'active trial membership denied'; end if;
  result := public.activate_two_hour_workspace_trial('acme.test');
  if not (result->>'already_active')::boolean then raise exception 'repeat activation did not report existing trial'; end if;
  if (result->>'expires_at')::timestamptz <> expires then raise exception 'repeat activation reset the expiry'; end if;
end $$;

do $$
declare v_workspace_id uuid;
begin
  select id into v_workspace_id from public.workspaces where created_by = '10000000-0000-4000-8000-000000000002';
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  if public.is_workspace_member(v_workspace_id) then raise exception 'second pending workspace was accessible'; end if;
  begin
    perform public.activate_two_hour_workspace_trial('acme.test');
    raise exception 'duplicate company domain unexpectedly received a trial';
  exception when unique_violation then null;
  end;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$ begin
  perform public.activate_two_hour_workspace_trial('gmail.com');
  raise exception 'consumer email domain unexpectedly received a trial';
exception when invalid_parameter_value then null;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $$ begin
  perform public.activate_two_hour_workspace_trial('roofco.test');
  raise exception 'unverified email unexpectedly received a trial';
exception when sqlstate '28000' then null;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
update public.workspaces
   set trial_expires_at = statement_timestamp() - interval '1 second'
 where created_by = '10000000-0000-4000-8000-000000000001';
do $$
declare v_workspace_id uuid;
begin
  select id into v_workspace_id from public.workspaces where created_by = '10000000-0000-4000-8000-000000000001';
  if public.is_workspace_member(v_workspace_id) then raise exception 'expired trial still has workspace access'; end if;
  if public.is_workspace_admin(v_workspace_id) then raise exception 'expired trial still has admin access'; end if;
  if public.current_workspace_id() is not null then raise exception 'expired trial remains active workspace'; end if;
end $$;

do $$
begin
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
  if not public.is_workspace_member('20000000-0000-4000-8000-000000000005') then raise exception 'existing customer workspace was locked'; end if;
  if has_table_privilege('authenticated','public.workspace_trial_claims','select') then raise exception 'authenticated role can read private trial claims'; end if;
  if has_function_privilege('anon','public.activate_two_hour_workspace_trial(text)','execute') then raise exception 'anon can activate trials'; end if;
  if not has_function_privilege('authenticated','public.activate_two_hour_workspace_trial(text)','execute') then raise exception 'authenticated role cannot activate trials'; end if;
  if not exists (select 1 from public.workspace_trial_claims where company_domain = 'acme.test') then raise exception 'trial claim was not persisted'; end if;
end $$;

delete from public.workspaces where created_by = '10000000-0000-4000-8000-000000000001';
do $$ begin
  if not exists (select 1 from public.workspace_trial_claims where company_domain = 'acme.test' and workspace_id is null) then
    raise exception 'company trial claim did not survive workspace deletion';
  end if;
end $$;

\echo 'two-hour-trial-postgres: PASS'
) then
    raise exception 'valid company domain was rejected by the strict regex';
  end if;
  foreach candidate in array invalid_domains loop
    begin
      perform public.activate_two_hour_workspace_trial(candidate);
      raise exception 'malformed company domain unexpectedly accepted: %', candidate;
    exception when invalid_parameter_value then
      null;
    end;
  end loop;
end $;

create trigger on_auth_user_created_workspace
after insert on auth.users
for each row execute function public.handle_new_user_workspace();

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','owner@acme.test',now(),'{"company_name":"Acme Roofing","request_two_hour_trial":true}'),
 ('10000000-0000-4000-8000-000000000002','other@acme.test',now(),'{"company_name":"Acme Duplicate","request_two_hour_trial":true}'),
 ('10000000-0000-4000-8000-000000000003','person@gmail.com',now(),'{"company_name":"Personal Email","request_two_hour_trial":true}'),
 ('10000000-0000-4000-8000-000000000004','pending@roofco.test',null,'{"company_name":"Unverified","request_two_hour_trial":true}'),
 ('10000000-0000-4000-8000-000000000005','legacy@rooflegacy.test',now(),'{}');

-- Existing customer workspaces default to active; new Auth users get pending workspaces.
insert into public.workspaces(id,name,created_by,trial_status)
values ('20000000-0000-4000-8000-000000000005','Legacy customer','10000000-0000-4000-8000-000000000005','active');
insert into public.workspace_members(workspace_id,user_id,role)
values ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','owner');

do $$
declare
  v_workspace_id uuid;
  result jsonb;
  started timestamptz;
  expires timestamptz;
begin
  select id into v_workspace_id from public.workspaces where created_by = '10000000-0000-4000-8000-000000000001';
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
  if public.is_workspace_member(v_workspace_id) then raise exception 'pending workspace was accessible before activation'; end if;
  if public.is_workspace_admin(v_workspace_id) then raise exception 'pending workspace admin access was allowed'; end if;
  if public.current_workspace_id() is not null then raise exception 'pending workspace was returned as active'; end if;

  result := public.activate_two_hour_workspace_trial('acme.test');
  if (result->>'already_active')::boolean then raise exception 'first activation was marked already active'; end if;
  started := (result->>'started_at')::timestamptz;
  expires := (result->>'expires_at')::timestamptz;
  if expires - started <> interval '2 hours' then raise exception 'trial is not exactly two hours'; end if;
  if not public.is_workspace_member(v_workspace_id) then raise exception 'active trial membership denied'; end if;
  result := public.activate_two_hour_workspace_trial('acme.test');
  if not (result->>'already_active')::boolean then raise exception 'repeat activation did not report existing trial'; end if;
  if (result->>'expires_at')::timestamptz <> expires then raise exception 'repeat activation reset the expiry'; end if;
end $$;

do $$
declare v_workspace_id uuid;
begin
  select id into v_workspace_id from public.workspaces where created_by = '10000000-0000-4000-8000-000000000002';
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  if public.is_workspace_member(v_workspace_id) then raise exception 'second pending workspace was accessible'; end if;
  begin
    perform public.activate_two_hour_workspace_trial('acme.test');
    raise exception 'duplicate company domain unexpectedly received a trial';
  exception when unique_violation then null;
  end;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$ begin
  perform public.activate_two_hour_workspace_trial('gmail.com');
  raise exception 'consumer email domain unexpectedly received a trial';
exception when invalid_parameter_value then null;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $$ begin
  perform public.activate_two_hour_workspace_trial('roofco.test');
  raise exception 'unverified email unexpectedly received a trial';
exception when sqlstate '28000' then null;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
update public.workspaces
   set trial_expires_at = statement_timestamp() - interval '1 second'
 where created_by = '10000000-0000-4000-8000-000000000001';
do $$
declare v_workspace_id uuid;
begin
  select id into v_workspace_id from public.workspaces where created_by = '10000000-0000-4000-8000-000000000001';
  if public.is_workspace_member(v_workspace_id) then raise exception 'expired trial still has workspace access'; end if;
  if public.is_workspace_admin(v_workspace_id) then raise exception 'expired trial still has admin access'; end if;
  if public.current_workspace_id() is not null then raise exception 'expired trial remains active workspace'; end if;
end $$;

do $$
begin
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
  if not public.is_workspace_member('20000000-0000-4000-8000-000000000005') then raise exception 'existing customer workspace was locked'; end if;
  if has_table_privilege('authenticated','public.workspace_trial_claims','select') then raise exception 'authenticated role can read private trial claims'; end if;
  if has_function_privilege('anon','public.activate_two_hour_workspace_trial(text)','execute') then raise exception 'anon can activate trials'; end if;
  if not has_function_privilege('authenticated','public.activate_two_hour_workspace_trial(text)','execute') then raise exception 'authenticated role cannot activate trials'; end if;
  if not exists (select 1 from public.workspace_trial_claims where company_domain = 'acme.test') then raise exception 'trial claim was not persisted'; end if;
end $$;

delete from public.workspaces where created_by = '10000000-0000-4000-8000-000000000001';
do $$ begin
  if not exists (select 1 from public.workspace_trial_claims where company_domain = 'acme.test' and workspace_id is null) then
    raise exception 'company trial claim did not survive workspace deletion';
  end if;
end $$;

\echo 'two-hour-trial-postgres: PASS'
