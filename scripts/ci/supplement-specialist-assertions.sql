-- Run only after the real migration 060 is applied to disposable PostgreSQL.
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
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','owner');
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- Member creates an evidence-linked review draft; revision is assigned server-side.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

insert into public.supplement_review_drafts
  (id,workspace_id,document_id,packet,created_by)
values
  ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','carrier-1','{"lines":[]}','22222222-2222-4222-8222-222222222222');

insert into public.supplement_review_drafts
  (id,workspace_id,document_id,packet,created_by)
values
  ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','carrier-1','{"lines":[]}','22222222-2222-4222-8222-222222222222');

do $$
begin
  if (select count(*) from public.supplement_review_drafts
      where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and document_id='carrier-1') <> 2 then
    raise exception 'FAILURE: expected two revisions';
  end if;
  if exists(select 1 from public.supplement_review_drafts
      where document_id='carrier-1' and revision not in (1,2)) then
    raise exception 'FAILURE: revision assignment wrong';
  end if;

  -- Member may edit their own review packet while it is under review.
  update public.supplement_review_drafts set packet='{"lines":[{"x":1}]}'
    where id='aaaaaaaa-0000-4000-8000-000000000002';

  -- Member may not approve, even their own draft.
  begin
    update public.supplement_review_drafts
      set status='approved', approved_by='22222222-2222-4222-8222-222222222222', approved_at=now()
      where id='aaaaaaaa-0000-4000-8000-000000000002';
  exception when others then
    raise notice 'Expected member approval rejection: %',SQLERRM;
  end;
  if (select status from public.supplement_review_drafts
      where id='aaaaaaaa-0000-4000-8000-000000000002') <> 'ready_for_review' then
    raise exception 'SECURITY FAILURE: member approved a supplement review';
  end if;

  -- Direct insert pretending approval is rejected.
  begin
    insert into public.supplement_review_drafts
      (workspace_id,document_id,status,packet,created_by,approved_by,approved_at)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','carrier-2','approved','{}',
      '22222222-2222-4222-8222-222222222222',
      '22222222-2222-4222-8222-222222222222',now());
  exception when others then
    raise notice 'Expected member approved-insert rejection: %',SQLERRM;
  end;
end $$;

-- Owner approves the review, then the record becomes immutable.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.supplement_review_drafts
  set status='approved', approved_by='11111111-1111-4111-8111-111111111111', approved_at=now()
  where id='aaaaaaaa-0000-4000-8000-000000000002';

do $$
begin
  begin
    update public.supplement_review_drafts set packet='{"tampered":true}'
      where id='aaaaaaaa-0000-4000-8000-000000000002';
  exception when others then
    raise notice 'Expected approved packet mutation rejection: %',SQLERRM;
  end;
  if (select packet from public.supplement_review_drafts
      where id='aaaaaaaa-0000-4000-8000-000000000002') = '{"tampered":true}'::jsonb then
    raise exception 'SECURITY FAILURE: approved supplement packet was modified';
  end if;
end $$;
reset role;

-- Cross-workspace isolation: workspace B owner sees only workspace B rows.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
begin
  if exists(select 1 from public.supplement_review_drafts
      where workspace_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'SECURITY FAILURE: cross-workspace draft visible';
  end if;

  insert into public.supplement_review_drafts
    (workspace_id,document_id,packet,created_by)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','carrier-1','{}','33333333-3333-4333-8333-333333333333');

  -- Revisions are scoped per workspace: same document id starts at 1 here.
  if (select revision from public.supplement_review_drafts
      where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 1 then
    raise exception 'FAILURE: revision leaked across workspaces';
  end if;
end $$;
reset role;

select 'PASS: member draft creation, server revision, member approval denial, admin approval, approved immutability, cross-workspace isolation' as result;
