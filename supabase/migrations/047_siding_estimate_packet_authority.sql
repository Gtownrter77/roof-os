alter table public.estimate_review_packets
  add column if not exists siding_measurement_id uuid references public.siding_measurements(id) on delete restrict;

create index if not exists estimate_review_packets_siding_measurement_idx
  on public.estimate_review_packets (siding_measurement_id)
  where siding_measurement_id is not null;

create or replace function public.is_valid_approved_siding_estimate_packet(
  p_workspace_id uuid,
  p_inspection_id uuid,
  p_siding_measurement_id uuid,
  p_status text,
  p_price_source text,
  p_formula_version text,
  p_snapshot jsonb
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  source public.siding_measurements%rowtype;
  reported_quantity numeric;
  item jsonb;
  item_quantity numeric;
  item_count integer := 0;
begin
  if p_workspace_id is null or p_inspection_id is null or p_siding_measurement_id is null
     or p_status is distinct from 'needs_price_review'
     or p_price_source is distinct from 'unpriced-draft'
     or p_formula_version is distinct from 'approved-siding-measurement-v1'
     or p_snapshot is null
     or p_snapshot->>'priceStatus' is distinct from 'unpriced'
     or jsonb_typeof(p_snapshot->'lineItems') is distinct from 'array'
     or jsonb_typeof(p_snapshot->'verifiedQuantities') is distinct from 'object' then
    return false;
  end if;

  select s.* into source
  from public.siding_measurements as s
  where s.id = p_siding_measurement_id
    and s.workspace_id = p_workspace_id
    and s.inspection_id = p_inspection_id;
  if not found or source.status is distinct from 'verified' or source.verified_by is null or source.verified_at is null then
    return false;
  end if;

  begin
    reported_quantity := (p_snapshot #>> '{verifiedQuantities,sidingSqFt}')::numeric;
  exception when others then
    return false;
  end;

  if reported_quantity is null or source.order_area_sq_ft is null
     or source.order_area_sq_ft <= 0 or source.order_area_sq_ft > 100000
     or abs(reported_quantity - source.order_area_sq_ft) > 0.01
     or p_snapshot #>> '{measurementSource,kind}' is distinct from 'technician-verified-siding-measurement'
     or p_snapshot #>> '{measurementSource,measurementId}' is distinct from source.id::text
     or p_snapshot #>> '{measurementSource,inspectionId}' is distinct from source.inspection_id::text
     or p_snapshot #>> '{measurementSource,sourcePhotoId}' is distinct from source.source_photo_id::text
     or p_snapshot #>> '{measurementSource,verifiedBy}' is distinct from source.verified_by::text
     or (p_snapshot #>> '{measurementSource,verifiedAt}')::timestamptz is distinct from source.verified_at
     or not coalesce(p_snapshot->'requiredNextSteps' @> '["Human approval before external use"]'::jsonb, false) then
    return false;
  end if;

  for item in select value from jsonb_array_elements(p_snapshot->'lineItems') as items(value) loop
    if item->'price' is distinct from 'null'::jsonb then return false; end if;
    begin
      item_quantity := (item->>'quantity')::numeric;
    exception when others then
      return false;
    end;
    if item_quantity is null or item_quantity < 0 or item_quantity > 100000 then return false; end if;
    if item->>'internalCode' = 'SIDING-REPLACE' then
      item_count := item_count + 1;
      if item->>'unit' is distinct from 'SQ' or abs(item_quantity - source.order_area_sq_ft) > 0.01 then return false; end if;
    else
      return false;
    end if;
  end loop;

  return item_count = 1 and jsonb_array_length(p_snapshot->'lineItems') = 1;
end;
$$;

revoke all on function public.is_valid_approved_siding_estimate_packet(uuid, uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.is_valid_approved_siding_estimate_packet(uuid, uuid, uuid, text, text, text, jsonb) to authenticated;

drop policy if exists estimate_review_packets_insert_approved_workflow on public.estimate_review_packets;
create policy estimate_review_packets_insert_approved_workflow on public.estimate_review_packets
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and auth.uid() = created_by
    and (
      (siding_measurement_id is null and public.is_valid_approved_photo_estimate_packet(
        workspace_id,
        inspection_id,
        measurement_id,
        photo_estimate_workflow_id,
        status,
        price_source,
        formula_version,
        estimate_snapshot
      ))
      or (photo_estimate_workflow_id is null and public.is_valid_approved_siding_estimate_packet(
        workspace_id,
        inspection_id,
        siding_measurement_id,
        status,
        price_source,
        formula_version,
        estimate_snapshot
      ))
    )
  );
