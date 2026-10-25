-- Public, read-only homeowner share links for Roof Passports.
-- A passport is only reachable by an unguessable token and only after the
-- workspace explicitly publishes it (public_shared = true). No anonymous RLS
-- policy is added: the public route reads with the server-only service role and
-- returns a bounded, read-only projection.

alter table public.roof_passports
  add column if not exists public_token uuid not null default gen_random_uuid(),
  add column if not exists public_shared boolean not null default false,
  add column if not exists public_shared_at timestamptz;

create unique index if not exists roof_passports_public_token_idx
  on public.roof_passports (public_token);

create index if not exists roof_passports_public_shared_idx
  on public.roof_passports (public_shared)
  where public_shared;
