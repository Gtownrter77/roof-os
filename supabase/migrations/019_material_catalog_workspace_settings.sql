-- ROOF/OS expanded material catalog, workspace settings, and jurisdiction-level tax rates.
-- Catalog rows are product metadata only; prices must come from an approved source.
create table if not exists public.material_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  subcategory text,
  brand text,
  product_line text,
  product_name text not null,
  variant text,
  unit text not null,
  coverage_per_unit numeric(12,3),
  color_options jsonb not null default '[]'::jsonb,
  search_terms text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category, brand, product_line, product_name, variant, unit)
);
create index if not exists material_catalog_search_idx on public.material_catalog using gin (to_tsvector('simple', coalesce(category,'') || ' ' || coalesce(subcategory,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(product_line,'') || ' ' || product_name || ' ' || coalesce(variant,'')));
alter table public.material_catalog enable row level security;
create policy material_catalog_select on public.material_catalog for select to authenticated using (active = true);

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  price_refresh_frequency text not null default 'weekly' check (price_refresh_frequency in ('weekly','manual','disabled')),
  default_language text not null default 'en-US',
  default_zipcode text check (default_zipcode is null or default_zipcode ~ '^[0-9]{5}$'),
  preferred_brands jsonb not null default '{}'::jsonb,
  material_search_mode text not null default 'catalog_and_retailer' check (material_search_mode in ('catalog_only','catalog_and_retailer')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.workspace_settings enable row level security;
create policy workspace_settings_select on public.workspace_settings for select using (public.is_workspace_member(workspace_id));
create policy workspace_settings_write on public.workspace_settings for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id) and auth.uid() = updated_by);

alter table public.price_books add column if not exists state_tax_rate numeric(7,4) not null default 0 check (state_tax_rate >= 0 and state_tax_rate <= 100);
alter table public.price_books add column if not exists county_tax_rate numeric(7,4) not null default 0 check (county_tax_rate >= 0 and county_tax_rate <= 100);
alter table public.price_books add column if not exists city_tax_rate numeric(7,4) not null default 0 check (city_tax_rate >= 0 and city_tax_rate <= 100);
alter table public.price_books add column if not exists special_district_tax_rate numeric(7,4) not null default 0 check (special_district_tax_rate >= 0 and special_district_tax_rate <= 100);

create or replace function public.save_owner_price_book_with_tax(
  p_workspace_id uuid, p_name text, p_market text, p_effective_at timestamptz,
  p_state_tax_rate numeric, p_county_tax_rate numeric, p_city_tax_rate numeric,
  p_special_district_tax_rate numeric, p_tax_source text, p_created_by uuid, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare new_price_book_id uuid; combined_rate numeric;
begin
  if p_created_by is distinct from auth.uid() or not public.is_system_owner() then raise exception 'system owner required'; end if;
  if not public.is_workspace_member(p_workspace_id) then raise exception 'workspace membership required'; end if;
  if p_state_tax_rate < 0 or p_county_tax_rate < 0 or p_city_tax_rate < 0 or p_special_district_tax_rate < 0 then raise exception 'tax rates must be non-negative'; end if;
  combined_rate := p_state_tax_rate + p_county_tax_rate + p_city_tax_rate + p_special_district_tax_rate;
  if combined_rate > 100 then raise exception 'combined tax rate must be 100 or less'; end if;
  insert into public.price_books (workspace_id, name, market, source, effective_at, local_tax_rate, state_tax_rate, county_tax_rate, city_tax_rate, special_district_tax_rate, tax_source, status, created_by)
  values (p_workspace_id, p_name, p_market, 'owner-managed', p_effective_at, combined_rate, p_state_tax_rate, p_county_tax_rate, p_city_tax_rate, p_special_district_tax_rate, nullif(p_tax_source, ''), 'draft', p_created_by)
  returning id into new_price_book_id;
  insert into public.price_book_items (price_book_id, sku, description, unit, unit_price, source_url, captured_at)
  select new_price_book_id, item.sku, item.description, item.unit, item.unit_price, 'owner-managed', now()
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(sku text, description text, unit text, unit_price numeric);
  return new_price_book_id;
end; $$;
grant execute on function public.save_owner_price_book_with_tax(uuid,text,text,timestamptz,numeric,numeric,numeric,numeric,text,uuid,jsonb) to authenticated;

insert into public.material_catalog (category, subcategory, brand, product_line, product_name, variant, unit, coverage_per_unit, color_options, search_terms)
values
('shingles','architectural','GAF','Timberline HDZ','Timberline HDZ',null,'bundle',33,'["Charcoal","Weathered Wood","Hickory","Shakewood","Fox Hollow Gray","Barkwood","Hunter Green","Mission Brown","Pewter Gray","Slate","Hearthstone"]','{"GAF HDZ","architectural shingle"}'),
('shingles','three_tab','GAF','Royal Sovereign','Royal Sovereign',null,'bundle',33,'["Charcoal","Weathered Wood","Pewter Gray","Hunter Green"]','{"GAF Royal Sovereign","three tab"}'),
('shingles','starter','GAF','Pro-Start','Starter Strip Shingles',null,'bundle',100,'[]','{"starter shingle","starter strip"}'),
('shingles','ridge_cap','GAF','TimberTex','Ridge Cap Shingles',null,'bundle',25,'["Charcoal","Weathered Wood","Hickory","Pewter Gray","Slate"]','{"GAF ridge cap","hip ridge"}'),
('shingles','designer','GAF','Grand Sequoia','Grand Sequoia',null,'bundle',20,'["Auburn","Cedar","Charcoal","Hickory"]','{"designer shingle","luxury shingle"}'),
('underlayment','synthetic','GAF','Deck-Armor','Synthetic Felt',null,'roll',10,'[]','{"GAF synthetic felt","synthetic underlayment"}'),
('underlayment','synthetic','Generic',null,'Synthetic Felt',null,'roll',10,'[]','{"generic synthetic felt","synthetic underlayment"}'),
('underlayment','ice_water','GAF','WeatherWatch','Ice and Water Shield',null,'roll',2,'[]','{"GAF ice and water","ice shield"}'),
('underlayment','ice_water','Generic',null,'Ice and Water Shield',null,'roll',2,'[]','{"generic ice and water","ice shield"}'),
('ventilation','ridge','GAF','Cobra','Cobra 3 Ridge Vent',null,'linear_ft',20,'[]','{"Cobra3","ridge vent"}'),
('ventilation','ridge','Generic',null,'Ridge Vent',null,'linear_ft',20,'[]','{"generic ridge vent"}'),
('ventilation','box',null,null,'Box Vent',null,'each',null,'[]','{"box vent","static vent"}'),
('ventilation','bathroom',null,null,'Bathroom Exhaust Roof Vent',null,'each',null,'[]','{"bathroom exhaust vent","roof jack"}'),
('flashing','edge',null,null,'Drip Edge',null,'piece',10,'[]','{"drip edge","eave metal"}'),
('flashing','edge',null,null,'Gutter Apron',null,'piece',10,'[]','{"gutter apron"}'),
('flashing','step',null,null,'Step Flashing','Metal','piece',1,'[]','{"step flashing","metal step flashing"}'),
('flashing','step',null,null,'Step Flashing','Black','piece',1,'[]','{"black step flashing"}'),
('flashing','valley',null,null,'W-Valley Metal',null,'piece',10,'[]','{"valley metal"}'),
('penetration','pipe_boot',null,null,'Pipe Boot','1.5 inch','each',null,'[]','{"pipe boot 1.5","plumbing boot"}'),
('penetration','pipe_boot',null,null,'Pipe Boot','2 inch','each',null,'[]','{"pipe boot 2"}'),
('penetration','pipe_boot',null,null,'Pipe Boot','3 inch','each',null,'[]','{"pipe boot 3"}'),
('penetration','pipe_boot',null,null,'Pipe Boot','4 inch','each',null,'[]','{"pipe boot 4"}'),
('fasteners','nails',null,null,'Coil Roofing Nails',null,'box',null,'[]','{"coil nails","roofing nails"}'),
('fasteners','staples',null,null,'Roofing Staples',null,'box',null,'[]','{"staples"}'),
('fasteners','caps',null,null,'Button Caps',null,'box',null,'[]','{"button caps","cap nails"}'),
('sealant','roofing',null,null,'NP1 Sealant',null,'tube',null,'[]','{"NP1","polyurethane sealant"}'),
('decking','osb',null,null,'OSB Roof Sheathing','7/16 inch','sheet',32,'[]','{"7/16 OSB","roof decking"}'),
('decking','osb',null,null,'OSB Roof Sheathing','15/32 inch','sheet',32,'[]','{"15/32 OSB"}'),
('skylight','self_flashing','VELUX',null,'Self-Flashing Skylight','fixed','each',null,'[]','{"VELUX skylight","self flashing skylight"}'),
('skylight','self_flashing','VELUX',null,'Self-Flashing Skylight','deck mount','each',null,'[]','{"VELUX deck mount"}'),
('gutters','gutter',null,null,'Aluminum K-Style Gutter','5 inch','linear_ft',10,'[]','{"5 inch gutter"}'),
('gutters','gutter',null,null,'Aluminum K-Style Gutter','6 inch','linear_ft',10,'[]','{"6 inch gutter"}'),
('gutters','downspout',null,null,'Aluminum Downspout','2x3 inch','linear_ft',10,'[]','{"downspout"}'),
('disposal','dumpster',null,null,'Dumpster Rental','20 yard','each',null,'[]','{"dumpster rental","debris disposal"}'),
('disposal','dumpster',null,null,'Dumpster Rental','30 yard','each',null,'[]','{"dumpster rental"}'),
('logistics','delivery',null,null,'Material Delivery Fee',null,'each',null,'[]','{"delivery fee","material delivery"}')
on conflict (category, brand, product_line, product_name, variant, unit) do nothing;
