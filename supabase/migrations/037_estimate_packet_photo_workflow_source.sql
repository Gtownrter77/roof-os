-- Tie strict estimate drafts to the technician-approved photo workflow that supplied their quantities.
alter table public.estimate_review_packets
  add column if not exists photo_estimate_workflow_id uuid
  references public.photo_estimate_workflows(id) on delete restrict;

create index if not exists estimate_review_packets_photo_workflow_idx
  on public.estimate_review_packets (photo_estimate_workflow_id)
  where photo_estimate_workflow_id is not null;

-- Keep direct authenticated inserts from bypassing the API's source and quantity checks.
create or replace function public.is_valid_approved_photo_estimate_packet(
  p_workspace_id uuid,
  p_inspection_id uuid,
  p_measurement_id uuid,
  p_workflow_id uuid,
  p_status text,
  p_price_source text,
  p_formula_version text,
  p_snapshot jsonb
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  source public.photo_estimate_workflows%rowtype;
  roof_quantity numeric;
  gutter_quantity numeric;
  reported_roof_quantity numeric;
  reported_gutter_quantity numeric;
  expected_roof_quantity numeric;
  eave_lf numeric;
  rafter_lf numeric;
  pitch numeric;
  waste_factor numeric;
  verified_at timestamptz;
  line_item jsonb;
  item_quantity numeric;
  roof_count integer := 0;
  gutter_count integer := 0;
  expected_gutter_count integer;
begin
  if p_workspace_id is null or p_inspection_id is null or p_workflow_id is null
     or p_measurement_id is not null or p_status is distinct from 'needs_price_review'
     or p_price_source is distinct from 'unpriced-draft'
     or p_formula_version is distinct from 'approved-photo-workflow-v1'
     or p_snapshot is null or p_snapshot->>'priceStatus' is distinct from 'unpriced'
     or jsonb_typeof(p_snapshot->'lineItems') is distinct from 'array'
     or jsonb_typeof(p_snapshot->'verifiedQuantities') is distinct from 'object' then
    return false;
  end if;

  select w.* into source
  from public.photo_estimate_workflows as w
  where w.id = p_workflow_id
    and w.workspace_id = p_workspace_id
    and w.inspection_id = p_inspection_id;
  if not found or source.status is distinct from 'approved' or source.approved_by is null or source.approved_at is null then
    return false;
  end if;
  if source.report #>> '{status}' is distinct from 'approved_for_customer_packet'
     or source.report #>> '{technicianVerification,decision}' is distinct from 'verified_by_technician'
     or source.report #>> '{technicianVerification,verifiedBy}' is distinct from source.approved_by::text then
    return false;
  end if;

  begin
    eave_lf := (source.report #>> '{technicianVerification,eaveLf}')::numeric;
    rafter_lf := (source.report #>> '{technicianVerification,rafterLf}')::numeric;
    pitch := (source.report #>> '{technicianVerification,pitch}')::numeric;
    waste_factor := (source.report #>> '{technicianVerification,wasteFactor}')::numeric;
    reported_roof_quantity := (source.report #>> '{technicianVerification,fieldSquares}')::numeric;
    reported_gutter_quantity := (source.report #>> '{technicianVerification,gutterLf}')::numeric;
    verified_at := (source.report #>> '{technicianVerification,verifiedAt}')::timestamptz;
    roof_quantity := (p_snapshot #>> '{verifiedQuantities,roofSquares}')::numeric;
    gutter_quantity := (p_snapshot #>> '{verifiedQuantities,gutterLf}')::numeric;
  exception when others then
    return false;
  end;

  if eave_lf is null or rafter_lf is null or pitch is null or waste_factor is null
     or reported_roof_quantity is null or reported_gutter_quantity is null or verified_at is null
     or roof_quantity is null or gutter_quantity is null then
    return false;
  end if;
  if eave_lf <= 0 or eave_lf > 10000 or rafter_lf <= 0 or rafter_lf > 10000
     or pitch < 0 or pitch > 24 or waste_factor < 0 or waste_factor > 1
     or source.roof_squares is null or source.roof_squares <= 0 or source.roof_squares > 100000
     or source.gutter_lf is null or source.gutter_lf < 0 or source.gutter_lf > 10000 then
    return false;
  end if;

  expected_roof_quantity := round((eave_lf * rafter_lf * sqrt(1 + power(pitch / 12, 2)) * (1 + waste_factor) / 100)::numeric, 2);
  if abs(source.roof_squares - expected_roof_quantity) > 0.01
     or abs(reported_roof_quantity - source.roof_squares) > 0.01
     or abs(reported_gutter_quantity - source.gutter_lf) > 0.01
     or abs(roof_quantity - source.roof_squares) > 0.01
     or abs(gutter_quantity - source.gutter_lf) > 0.01
     or verified_at is distinct from source.approved_at
     or p_snapshot #>> '{measurementSource,kind}' is distinct from 'technician-approved-photo-workflow'
     or p_snapshot #>> '{measurementSource,workflowId}' is distinct from source.id::text
     or p_snapshot #>> '{measurementSource,inspectionId}' is distinct from source.inspection_id::text
     or p_snapshot #>> '{measurementSource,verifiedBy}' is distinct from source.approved_by::text
     or (p_snapshot #>> '{measurementSource,verifiedAt}')::timestamptz is distinct from source.approved_at
     or not coalesce(p_snapshot->'requiredNextSteps' @> '["Human approval before external use"]'::jsonb, false) then
    return false;
  end if;

  for line_item in select value from jsonb_array_elements(p_snapshot->'lineItems') as items(value) loop
    if line_item->'price' is distinct from 'null'::jsonb then
      return false;
    end if;
    begin
      item_quantity := (line_item->>'quantity')::numeric;
    exception when others then
      return false;
    end;
    if item_quantity is null or item_quantity < 0 or item_quantity > 100000 then
      return false;
    end if;
    if line_item->>'internalCode' = 'ROOF-REPLACE' then
      roof_count := roof_count + 1;
      if line_item->>'unit' is distinct from 'SQ' or abs(item_quantity - source.roof_squares) > 0.01 then
        return false;
      end if;
    elsif line_item->>'internalCode' = 'GUTTER-REPLACE' then
      gutter_count := gutter_count + 1;
      if line_item->>'unit' is distinct from 'LF' or abs(item_quantity - source.gutter_lf) > 0.01 then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;

  expected_gutter_count := case when source.gutter_lf > 0 then 1 else 0 end;
  if roof_count <> 1 or gutter_count <> expected_gutter_count
     or jsonb_array_length(p_snapshot->'lineItems') <> 1 + expected_gutter_count then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.is_valid_approved_photo_estimate_packet(uuid, uuid, uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.is_valid_approved_photo_estimate_packet(uuid, uuid, uuid, uuid, text, text, text, jsonb) to authenticated;

drop policy if exists estimate_review_packets_write on public.estimate_review_packets;
drop policy if exists estimate_review_packets_insert_approved_workflow on public.estimate_review_packets;
create policy estimate_review_packets_insert_approved_workflow on public.estimate_review_packets
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and auth.uid() = created_by
    and public.is_valid_approved_photo_estimate_packet(
      workspace_id,
      inspection_id,
      measurement_id,
      photo_estimate_workflow_id,
      status,
      price_source,
      formula_version,
      estimate_snapshot
    )
  );

-- Preserve the prior creator-scoped update and delete behavior for existing packets.
drop policy if exists estimate_review_packets_update on public.estimate_review_packets;
create policy estimate_review_packets_update on public.estimate_review_packets
  for update
  using (public.is_workspace_member(workspace_id) and auth.uid() = created_by)
  with check (public.is_workspace_member(workspace_id) and auth.uid() = created_by);

drop policy if exists estimate_review_packets_delete on public.estimate_review_packets;
create policy estimate_review_packets_delete on public.estimate_review_packets
  for delete
  using (public.is_workspace_member(workspace_id) and auth.uid() = created_by);
