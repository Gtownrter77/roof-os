-- Run only after REAL migration 059 is applied to disposable Postgres.
\set ON_ERROR_STOP on
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
insert into public.workspaces(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.workspace_members(workspace_id,user_id,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','member'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','owner');
insert into public.estimates(id,workspace_id,status,created_by) values
 ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','draft','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbb-bbbbbbbbbbbb','draft','33333333-3333-4333-8333-333333333333');
grant select,insert,update,delete on all tables in schema public to authenticated;

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

do $$
begin
  begin
    update public.estimates set status='approved',
      approved_by='22222222-2222-4222-8222-222222222222',approved_at=now()
    where id='aaaaaaaa-1111-4111-8111-111111111111';
  exception when others then
    raise notice 'Expected member direct approval rejection: %',SQLERRM;
  end;
  if (select status from public.estimates
    where id='aaaaaaaa-1111-4111-8111-111111111111') <> 'draft' then
    raise exception 'SECURITY FAILURE: member forged approval directly';
  end if;

  begin
    perform public.replace_estimate_line_items(
      'aaaaaaaa-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '[]'::jsonb,'approved','v1');
  exception when others then
    raise notice 'Expected member RPC approval rejection: %',SQLERRM;
  end;
  if (select status from public.estimates
    where id='aaaaaaaa-1111-4111-8111-111111111111') <> 'draft' then
    raise exception 'SECURITY FAILURE: member forged approval via RPC';
  end if;

  begin
    perform public.replace_estimate_line_items(
      'bbbbbbbb-2222-4222-8222-222222222222',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbb-bbbbbbbbbbbb',
      '[]'::jsonb,'approved','v1');
  exception when others then
    raise notice 'Expected cross-workspace RPC rejection: %',SQLERRM;
  end;
end $$;
reset role;

do $$
begin
  if (select status from public.estimates
    where id='bbbbbbbb-2222-4222-8222-222222222222') <> 'draft' then
    raise exception 'SECURITY FAILURE: cross-workspace approval was allowed';
  end if;
end $$;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

-- Positive test: owner must be allowed to approve through intended database RPC.
select public.replace_estimate_line_items(
 'aaaaaaaa-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '[{"category":"material","description":"Synthetic underlayment","unit":"SQ","quantity":2,"unit_cost":35}]'::jsonb,
 'approved','v1');

do $$
begin
  if not exists(select 1 from public.estimates where
      id='aaaaaaaa-1111-4111-8111-111111111111'
      and status='approved'
      and approved_by='11111111-1111-4111-8111-111111111111'
      and approved_at is not null and total=70) then
    raise exception 'OWNER APPROVAL FAILED: wrong total or approval metadata';
  end if;
  begin
    update public.estimates set total=1,
      approved_by='22222222-2222-4222-8222-222222222222'
      where id='aaaaaaaa-1111-4111-8111-111111111111';
  exception when others then
    raise notice 'Expected approved estimate mutation rejection: %',SQLERRM;
  end;
  if not exists(select 1 from public.estimates where
    id='aaaaaaaa-1111-4111-8111-111111111111'
    and total=70
    and approved_by='11111111-1111-4111-8111-111111111111') then
    raise exception 'SECURITY FAILURE: approved record can be tampered with';
  end if;
end $$;
select 'PASS: tested member denial, cross-workspace denial, owner approval, immutable approved totals' as result;
