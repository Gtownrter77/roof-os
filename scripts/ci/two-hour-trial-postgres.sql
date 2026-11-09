\set ON_ERROR_STOP on

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz
);
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.workspaces (
  id uuid primary key,
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

insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','owner@acme.test',now()),
 ('10000000-0000-4000-8000-000000000002','other@acme.test',now()),
 ('10000000-0000-4000-8000-000000000003','person@gmail.com',now()),
 ('10000000-0000-4000-8000-000000000004','pending@roofco.test',null);

insert into public.workspaces(id,name,created_by) values
 ('20000000-0000-4000-8000-000000000001','Acme test','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','Acme duplicate','10000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000003','Personal email','10000000-0000-4000-8000-000000000003'),
 ('20000000-0000-4000-8000-000000000004','Unverified email','10000000-0000-4000-8000-000000000004');

insert into public.workspace_members(workspace_id,user_id,role) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','owner'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','owner'),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','owner');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare result jsonb; started timestamptz; expires timestamptz;
begin
  result := public.activate_two_hour_workspace_trial('acme.test');
  if (result->>'already_active')::boolean then raise exception 'first activation was marked already active'; end if;
  started := (result->>'started_at')::timestamptz;
  expires := (result->>'expires_at')::timestamptz;
  if expires - started <> interval '2 hours' then raise exception 'trial is not exactly two hours'; end if;
  if not public.is_workspace_member('20000000-0000-4000-8000-000000000001') then raise exception 'active trial membership denied'; end if;
  result := public.activate_two_hour_workspace_trial('acme.test');
  if not (result->>'already_active')::boolean then raise exception 'repeat activation did not report existing trial'; end if;
  if (result->>'expires_at')::timestamptz <> expires then raise exception 'repeat activation reset the expiry'; end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$ begin
  perform public.activate_two_hour_workspace_trial('acme.test');
  raise exception 'duplicate company domain unexpectedly received a trial';
exception when unique_violation then null;
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
 where id = '20000000-0000-4000-8000-000000000001';
do $$ begin
  if public.is_workspace_member('20000000-0000-4000-8000-000000000001') then raise exception 'expired trial still has workspace access'; end if;
  if public.current_workspace_id() is not null then raise exception 'expired trial remains active workspace'; end if;
end $$;

do $$
begin
  if has_table_privilege('authenticated','public.workspace_trial_claims','select') then raise exception 'authenticated role can read private trial claims'; end if;
  if has_function_privilege('anon','public.activate_two_hour_workspace_trial(text)','execute') then raise exception 'anon can activate trials'; end if;
  if not has_function_privilege('authenticated','public.activate_two_hour_workspace_trial(text)','execute') then raise exception 'authenticated role cannot activate trials'; end if;
  if not exists (select 1 from public.workspace_trial_claims where company_domain = 'acme.test') then raise exception 'trial claim was not persisted'; end if;
end $$;

\echo 'two-hour-trial-postgres: PASS'
