-- Agent 5 — request idempotency for supplement review drafts (additive)
-- A caller-supplied key is scoped to one workspace. Replaying the same key
-- returns the stored draft; reusing it with a changed payload is a conflict.
-- Review-only: this migration adds no send, export, or approval path.

alter table public.supplement_review_drafts
  add column if not exists idempotency_key text,
  add column if not exists request_fingerprint text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'supplement_review_idempotency_key_length'
  ) then
    alter table public.supplement_review_drafts
      add constraint supplement_review_idempotency_key_length
      check (
        idempotency_key is null
        or char_length(idempotency_key) between 16 and 128
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'supplement_review_request_fingerprint_length'
  ) then
    alter table public.supplement_review_drafts
      add constraint supplement_review_request_fingerprint_length
      check (
        request_fingerprint is null
        or char_length(request_fingerprint) between 32 and 128
      );
  end if;
end $$;

-- One key per workspace. The document id is deliberately not part of the
-- unique key: reusing a key with a different document is a conflict.
create unique index if not exists supplement_review_drafts_idempotency_idx
  on public.supplement_review_drafts (workspace_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.supplement_review_drafts.idempotency_key is
  'Caller-supplied retry key, scoped to one workspace. Null when the caller did not send one.';
comment on column public.supplement_review_drafts.request_fingerprint is
  'SHA-256 of the canonical request payload. Replay with the same key must match.';
