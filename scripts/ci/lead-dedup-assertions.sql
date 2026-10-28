-- Run only after migration 061 is applied to a disposable PostgreSQL database.
\set ON_ERROR_STOP on
insert into auth.users(id) values
 ('77777777-7777-4777-8777-777777777777'),
 ('88888888-8888-4888-8888-888888888888'),
 ('99999999-9999-4999-8999-999999999999');
insert into public.workspaces(id) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff');
insert into public.workspace_members(workspace_id,user_id,role) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','77777777-7777-4777-8777-777777777777','owner'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','88888888-8888-4888-8888-888888888888','member'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','99999999-9999-4999-8999-999999999999','owner');

set role authenticated;
set request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';

-- First lead is accepted.
insert into public.leads (workspace_id,owner_id,name,address,phone,email)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '77777777-7777-4777-8777-777777777777',
        'Synthetic Prospect One','1 Synthetic Way','(555) 010-2000','one@example.invalid');

do $$
begin
  -- Same digits in a different format is the same prospect.
  begin
    insert into public.leads (workspace_id,owner_id,name,address,phone)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            '77777777-7777-4777-8777-777777777777',
            'Synthetic Prospect Duplicate','2 Synthetic Way','555.010.2000');
  exception when unique_violation then
    raise notice 'Expected duplicate phone rejection: %',SQLERRM;
  end;
  if (select count(*) from public.leads
      where workspace_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') <> 1 then
    raise exception 'SECURITY FAILURE: duplicate lead was created';
  end if;

  -- A different number is a different prospect.
  insert into public.leads (workspace_id,owner_id,name,address,phone)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          '77777777-7777-4777-8777-777777777777',
          'Synthetic Prospect Two','3 Synthetic Way','(555) 010-2001');

  -- No phone: not deduplicated by this guard.
  insert into public.leads (workspace_id,owner_id,name,address)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          '77777777-7777-4777-8777-777777777777',
          'Synthetic Prospect No Phone','4 Synthetic Way');
end $$;

-- Same phone in another workspace is allowed.
set request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';
insert into public.leads (workspace_id,owner_id,name,address,phone)
values ('ffffffff-ffff-4fff-8fff-ffffffffffff',
        '99999999-9999-4999-8999-999999999999',
        'Synthetic Other Workspace','5 Other Way','(555) 010-2000');

-- A member cannot bypass the guard by editing an existing lead's phone.
set request.jwt.claim.sub = '88888888-8888-4888-8888-888888888888';
do $$
begin
  begin
    update public.leads set phone='(555) 010-2001'
    where workspace_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
      and name='Synthetic Prospect No Phone';
  exception when unique_violation then
    raise notice 'Expected duplicate phone update rejection: %',SQLERRM;
  end;
  if exists (select 1 from public.leads
      where workspace_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
        and name='Synthetic Prospect No Phone'
        and phone is not null) then
    raise exception 'SECURITY FAILURE: duplicate phone written by update';
  end if;
end $$;

-- Explicit office override is honoured and is transaction-scoped.
do $$
begin
  perform set_config('roofos.allow_duplicate_lead', 'on', true);
  insert into public.leads (workspace_id,owner_id,name,address,phone)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          '88888888-8888-4888-8888-888888888888',
          'Synthetic Intentional Duplicate','6 Synthetic Way','(555) 010-2000');
end $$;

-- The override is gone after that transaction: a further duplicate still fails.
do $$
begin
  begin
    insert into public.leads (workspace_id,owner_id,name,address,phone)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            '88888888-8888-4888-8888-888888888888',
            'Synthetic Duplicate After Override','7 Synthetic Way','(555) 010-2000');
  exception when unique_violation then
    raise notice 'Expected duplicate rejection after the override transaction ended: %',SQLERRM;
  end;
  if exists (select 1 from public.leads
      where workspace_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
        and name='Synthetic Duplicate After Override') then
    raise exception 'SECURITY FAILURE: override leaked past its transaction';
  end if;
end $$;
reset role;

select 'PASS: duplicate phone rejected across formats, other workspace allowed, update blocked, explicit override honoured' as result;
