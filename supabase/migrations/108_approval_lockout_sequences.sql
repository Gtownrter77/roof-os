-- Owner-set lockout / tagout sequence.
-- The owner decides the business model. The sequence is not fixed.
-- Send stays locked until every step the owner required is tagged.

alter table public.workspace_members
  add column if not exists approval_sequence jsonb not null default '["self"]'::jsonb;

alter table public.workspace_members
  drop constraint if exists workspace_members_approval_sequence_check;

alter table public.workspace_members
  add constraint workspace_members_approval_sequence_check
  check (
    jsonb_typeof(approval_sequence) = 'array'
    and jsonb_array_length(approval_sequence) between 1 and 4
  );

comment on column public.workspace_members.approval_sequence is
  'Owner-set lockout order. Values are self, inspector, closer, operations, owner. Send is locked until each step is tagged.';

alter table public.estimates
  add column if not exists approval_tags jsonb not null default '[]'::jsonb;

comment on column public.estimates.approval_tags is
  'Tagged locks in order. Each tag records step, layer, user, and time. Send is locked until the owner sequence is complete.';
