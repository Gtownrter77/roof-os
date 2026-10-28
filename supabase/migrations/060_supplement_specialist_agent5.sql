-- Agent 5 — Supplement Specialist review drafts (additive, review-only)
-- Human review is required. No automatic insurer submission, payment or export.
-- Workspace isolation is enforced by RLS; revision history is append-only.

create table if not exists public.supplement_review_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id text not null check (char_length(document_id) between 1 and 64),
  revision integer not null default 1 check (revision > 0),
  status text not null default 'ready_for_review'
    check (status in ('ready_for_review','approved','rejected','superseded')),
  packet jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, document_id, revision),
  check ((status = 'approved') = (approved_by is not null and approved_at is not null))
);

create index if not exists supplement_review_drafts_workspace_idx
  on public.supplement_review_drafts (workspace_id, created_at desc);

alter table public.supplement_review_drafts enable row level security;

drop policy if exists supplement_review_drafts_select on public.supplement_review_drafts;
create policy supplement_review_drafts_select on public.supplement_review_drafts
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists supplement_review_drafts_insert on public.supplement_review_drafts;
create policy supplement_review_drafts_insert on public.supplement_review_drafts
  for insert with check (
    public.is_workspace_member(workspace_id)
    and auth.uid() = created_by
    and status = 'ready_for_review'
    and approved_by is null
    and approved_at is null
  );

-- Drafts can be updated by their author or an admin. Approval requires admin.
drop policy if exists supplement_review_drafts_update on public.supplement_review_drafts;
create policy supplement_review_drafts_update on public.supplement_review_drafts
  for update using (
    public.is_workspace_member(workspace_id)
    and (created_by = auth.uid() or public.is_workspace_admin(workspace_id))
  ) with check (
    public.is_workspace_member(workspace_id)
    and (created_by = auth.uid() or public.is_workspace_admin(workspace_id))
    and (status = 'ready_for_review' or public.is_workspace_admin(workspace_id))
  );

-- Append-only history: no delete policy is created.

-- Revisions are assigned server-side per (workspace, document).
create or replace function public.assign_supplement_review_revision()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text || ':' || NEW.document_id, 0));
  select coalesce(max(revision), 0) + 1 into NEW.revision
  from public.supplement_review_drafts
  where workspace_id = NEW.workspace_id and document_id = NEW.document_id;
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists assign_supplement_review_revision on public.supplement_review_drafts;
create trigger assign_supplement_review_revision
  before insert on public.supplement_review_drafts
  for each row execute function public.assign_supplement_review_revision();

-- Approval metadata is admin-only and approved drafts are immutable.
create or replace function public.enforce_supplement_review_approval()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if NEW.approved_by is not null or NEW.approved_at is not null then
      if not public.is_workspace_admin(NEW.workspace_id) then
        raise exception 'Workspace administrator authority is required to approve a supplement review';
      end if;
    end if;
    return NEW;
  end if;

  if OLD.status = 'approved' then
    if NEW.status not in ('approved','superseded')
       or NEW.packet is distinct from OLD.packet
       or NEW.approved_by is distinct from OLD.approved_by
       or NEW.approved_at is distinct from OLD.approved_at then
      raise exception 'An approved supplement review is immutable';
    end if;
  end if;

  if NEW.approved_by is distinct from OLD.approved_by
     or NEW.approved_at is distinct from OLD.approved_at then
    if not public.is_workspace_admin(OLD.workspace_id) then
      raise exception 'Workspace administrator authority is required to change supplement approval metadata';
    end if;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists enforce_supplement_review_approval on public.supplement_review_drafts;
create trigger enforce_supplement_review_approval
  before insert or update on public.supplement_review_drafts
  for each row execute function public.enforce_supplement_review_approval();

revoke all on function public.assign_supplement_review_revision() from public, anon;
revoke all on function public.enforce_supplement_review_approval() from public, anon;
grant execute on function public.assign_supplement_review_revision() to authenticated;
grant execute on function public.enforce_supplement_review_approval() to authenticated;
