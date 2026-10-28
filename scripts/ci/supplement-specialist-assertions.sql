-- Run only after the real migration 060 is applied to disposable PostgreSQL.
\set ON_ERROR_STOP on
insert into auth.users(id) values
 ('44444444-4444-4444-8444-444444444444'),
 ('55555555-5555-4555-8555-555555555555'),
 ('66666666-6666-4666-8666-666666666666');
insert into public.workspaces(id) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
insert into public.workspace_members(workspace_id,user_id,role) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','44444444-4444-4444-8444-444444444444','owner'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','55555555-5555-4555-8555-555555555555','member'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','66666666-6666-4666-8666-666666666666','owner');
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- Member creates an evidence-linked review draft; revision is assigned server-side.
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

insert into public.supplement_review_drafts
  (id,workspace_id,document_id,packet,created_by)
values
  ('cccccccc-0000-4000-8000-000000000001','cccccccc-cccc-4ccc-8ccc-cccccccccccc','carrier-1','{"lines":[]}','55555555-5555-4555-8555-555555555555');

insert into public.supplement_review_drafts
  (id,workspace_id,document_id,packet,created_by)
values
  ('cccccccc-0000-4000-8000-000000000002','cccccccc-cccc-4ccc-8ccc-cccccccccccc','carrier-1','{"lines":[]}','55555555-5555-4555-8555-555555555555');

do $$
begin
  if (select count(*) from public.supplement_review_drafts
      where workspace_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and document_id='carrier-1') <> 2 then
    raise exception 'FAILURE: expected two revisions';
  end if;
  if exists(select 1 from public.supplement_review_drafts
      where document_id='carrier-1' and revision not in (1,2)) then
    raise exception 'FAILURE: revision assignment wrong';
  end if;

  -- Member may edit their own review packet while it is under review.
  update public.supplement_review_drafts set packet='{"lines":[{"x":1}]}'
    where id='cccccccc-0000-4000-8000-000000000002';

  -- Member may not approve, even their own draft.
  begin
    update public.supplement_review_drafts
      set status='approved', approved_by='55555555-5555-4555-8555-555555555555', approved_at=now()
      where id='cccccccc-0000-4000-8000-000000000002';
  exception when others then
    raise notice 'Expected member approval rejection: %',SQLERRM;
  end;
  if (select status from public.supplement_review_drafts
      where id='cccccccc-0000-4000-8000-000000000002') <> 'ready_for_review' then
    raise exception 'SECURITY FAILURE: member approved a supplement review';
  end if;

  -- Direct insert pretending approval is rejected.
  begin
    insert into public.supplement_review_drafts
      (workspace_id,document_id,status,packet,created_by,approved_by,approved_at)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','carrier-2','approved','{}',
      '55555555-5555-4555-8555-555555555555',
      '55555555-5555-4555-8555-555555555555',now());
  exception when others then
    raise notice 'Expected member approved-insert rejection: %',SQLERRM;
  end;
end $$;

-- Owner approves the review, then the record becomes immutable.
set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
update public.supplement_review_drafts
  set status='approved', approved_by='44444444-4444-4444-8444-444444444444', approved_at=now()
  where id='cccccccc-0000-4000-8000-000000000002';

do $$
begin
  begin
    update public.supplement_review_drafts set packet='{"tampered":true}'
      where id='cccccccc-0000-4000-8000-000000000002';
  exception when others then
    raise notice 'Expected approved packet mutation rejection: %',SQLERRM;
  end;
  if (select packet from public.supplement_review_drafts
      where id='cccccccc-0000-4000-8000-000000000002') = '{"tampered":true}'::jsonb then
    raise exception 'SECURITY FAILURE: approved supplement packet was modified';
  end if;
end $$;
reset role;

-- Cross-workspace isolation: workspace B owner sees only workspace B rows.
set role authenticated;
set request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
do $$
begin
  if exists(select 1 from public.supplement_review_drafts
      where workspace_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') then
    raise exception 'SECURITY FAILURE: cross-workspace draft visible';
  end if;

  insert into public.supplement_review_drafts
    (workspace_id,document_id,packet,created_by)
  values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','carrier-1','{}','66666666-6666-4666-8666-666666666666');

  -- Revisions are scoped per workspace: same document id starts at 1 here.
  if (select revision from public.supplement_review_drafts
      where workspace_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 1 then
    raise exception 'FAILURE: revision leaked across workspaces';
  end if;
end $$;
reset role;

-- Idempotency: one key per workspace, bounded length, reusable in another workspace.
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
insert into public.supplement_review_drafts
  (workspace_id,document_id,packet,created_by,idempotency_key,request_fingerprint)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','carrier-3','{}',
   '55555555-5555-4555-8555-555555555555','idem-workspace-a-0001',repeat('a',64));

do $$
begin
  -- Reusing the key for another document in the same workspace is rejected.
  begin
    insert into public.supplement_review_drafts
      (workspace_id,document_id,packet,created_by,idempotency_key,request_fingerprint)
    values
      ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','carrier-4','{}',
       '55555555-5555-4555-8555-555555555555','idem-workspace-a-0001',repeat('b',64));
    raise exception 'FAILURE: duplicate idempotency key accepted in one workspace';
  exception when unique_violation then
    raise notice 'Expected duplicate idempotency key rejection';
  end;

  -- Short keys are rejected by the check constraint.
  begin
    insert into public.supplement_review_drafts
      (workspace_id,document_id,packet,created_by,idempotency_key,request_fingerprint)
    values
      ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','carrier-5','{}',
       '55555555-5555-4555-8555-555555555555','short',repeat('c',64));
    raise exception 'FAILURE: short idempotency key accepted';
  exception when check_violation then
    raise notice 'Expected short idempotency key rejection';
  end;
end $$;

-- The same key is a separate namespace in another workspace.
set request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
insert into public.supplement_review_drafts
  (workspace_id,document_id,packet,created_by,idempotency_key,request_fingerprint)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','carrier-9','{}',
   '66666666-6666-4666-8666-666666666666','idem-workspace-a-0001',repeat('d',64));
reset role;

do $$
begin
  if (select count(*) from public.supplement_review_drafts
      where idempotency_key='idem-workspace-a-0001') <> 2 then
    raise exception 'FAILURE: idempotency key did not stay scoped per workspace';
  end if;
end $$;

select 'PASS: member draft creation, server revision, member approval denial, admin approval, approved immutability, cross-workspace isolation, per-workspace idempotency key' as result;
