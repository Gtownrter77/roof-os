create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  phone text,
  email text,
  status text not null default 'new',
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads enable row level security;

drop policy if exists "lead_select" on public.leads;
drop policy if exists "lead_insert" on public.leads;
drop policy if exists "lead_update" on public.leads;
drop policy if exists "lead_delete" on public.leads;

create policy "lead_select" on public.leads for select
  using (auth.uid() = owner_id);
create policy "lead_insert" on public.leads for insert
  with check (auth.uid() = owner_id);
create policy "lead_update" on public.leads for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create policy "lead_delete" on public.leads for delete
  using (auth.uid() = owner_id);
