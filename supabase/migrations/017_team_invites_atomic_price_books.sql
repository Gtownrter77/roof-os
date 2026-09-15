-- Harden owner-managed pricing writes and add auditable team invitations.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email, status)
);

create index if not exists workspace_invitations_lookup_idx
  on public.workspace_invitations (workspace_id, email, status, created_at desc);

alter table public.workspace_invitations enable row level security;
create policy workspace_invitations_select on public.workspace_invitations
  for select using (public.is_workspace_admin(workspace_id));
create policy workspace_invitations_insert on public.workspace_invitations
  for insert with check (public.is_workspace_admin(workspace_id) and auth.uid() = invited_by);
create policy workspace_invitations_update on public.workspace_invitations
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create or replace function public.save_owner_price_book(
  p_workspace_id uuid,
  p_name text,
  p_market text,
  p_effective_at timestamptz,
  p_local_tax_rate numeric,
  p_tax_source text,
  p_created_by uuid,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_price_book_id uuid;
begin
  if p_created_by is distinct from auth.uid() or not public.is_system_owner() then
    raise exception 'system owner required';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace membership required';
  end if;
  if p_local_tax_rate < 0 or p_local_tax_rate > 100 then
    raise exception 'local tax rate must be between 0 and 100';
  end if;

  insert into public.price_books (
    workspace_id, name, market, source, effective_at, local_tax_rate,
    tax_source, status, created_by
  ) values (
    p_workspace_id, p_name, p_market, 'owner-managed', p_effective_at,
    p_local_tax_rate, nullif(p_tax_source, ''), 'draft', p_created_by
  ) returning id into new_price_book_id;

  insert into public.price_book_items (
    price_book_id, sku, description, unit, unit_price, source_url, captured_at
  )
  select new_price_book_id, item.sku, item.description, item.unit,
         item.unit_price, 'owner-managed', now()
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    sku text, description text, unit text, unit_price numeric
  );

  return new_price_book_id;
end;
$$;

grant execute on function public.save_owner_price_book(uuid, text, text, timestamptz, numeric, text, uuid, jsonb) to authenticated;
