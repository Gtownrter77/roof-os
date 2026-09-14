-- Owner-managed local tax configuration for auditable price books.
-- The rate is a percentage (for example, 7.5000 represents 7.5%).
-- A source/jurisdiction is retained so the owner can document the combined rate.

alter table public.price_books
  add column if not exists local_tax_rate numeric(7,4) not null default 0
    check (local_tax_rate >= 0 and local_tax_rate <= 100);

alter table public.price_books
  add column if not exists tax_source text;
