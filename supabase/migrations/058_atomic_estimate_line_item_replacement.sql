-- The original estimates schema has no estimate_snapshot column or DELETE policies.
alter table public.estimates add column if not exists estimate_snapshot jsonb not null default '{}'::jsonb;
create policy estimate_line_items_delete on public.estimate_line_items for delete
  using (exists (select 1 from public.estimates e where e.id=estimate_id
    and public.is_workspace_member(e.workspace_id) and e.status not in ('approved','superseded')));
create policy estimates_delete on public.estimates for delete
  using (public.is_workspace_member(workspace_id) and status not in ('approved','superseded')
    and (created_by=auth.uid() or public.is_workspace_admin(workspace_id)));

-- Atomic replacement: all changes commit together or none do.
create or replace function public.replace_estimate_line_items(
  p_estimate_id uuid, p_workspace_id uuid, p_items jsonb,
  p_status text, p_formula_version text
) returns void language plpgsql security invoker set search_path = 'public' as $$
declare
  v_estimate public.estimates%rowtype;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_amount numeric;
  v_quantity numeric;
  v_unit_cost numeric;
  v_category text;
  v_index integer := 0;
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'Workspace membership required';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'Invalid estimate line items';
  end if;
  select * into v_estimate from public.estimates
    where id = p_estimate_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'Estimate not found'; end if;
  if v_estimate.status in ('approved','rejected','superseded') then
    raise exception 'Estimate cannot be modified in this status';
  end if;
  if p_status not in ('draft','pending_approval','approved','rejected','superseded') then
    raise exception 'Invalid estimate status';
  end if;
  delete from public.estimate_line_items where estimate_id = p_estimate_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_index := v_index + 1;
    v_category := v_item->>'category';
    if v_category not in ('material','labor','allowance','fee','tax')
       or nullif(btrim(v_item->>'description'),'') is null
       or nullif(btrim(v_item->>'unit'),'') is null then
      raise exception 'Invalid line item';
    end if;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    if v_quantity < 0 or v_unit_cost < 0 then raise exception 'Negative line item amount'; end if;
    v_amount := v_quantity * v_unit_cost;
    if v_category = 'tax' then v_tax := v_tax + v_amount;
    else v_subtotal := v_subtotal + v_amount; end if;
    insert into public.estimate_line_items
      (estimate_id,item_code,description,category,unit,quantity,unit_cost,line_total,source_snapshot)
    values (p_estimate_id, coalesce(nullif(btrim(v_item->>'item_code'),''),'ITEM-'||v_index),
      btrim(v_item->>'description'),v_category,btrim(v_item->>'unit'),
      v_quantity,v_unit_cost,v_amount,
      jsonb_build_object('waste_factor',coalesce((v_item->>'waste_factor')::numeric,0),
                         'sort_order',coalesce((v_item->>'sort_order')::integer,v_index-1)));
  end loop;
  update public.estimates set subtotal=v_subtotal,tax=v_tax,total=v_subtotal+v_tax,
    status=p_status,formula_version=coalesce(p_formula_version,v_estimate.formula_version),
    approved_by=case when p_status='approved' then auth.uid() else null end,
    approved_at=case when p_status='approved' then now() else null end,
    updated_at=now()
  where id=p_estimate_id and workspace_id=p_workspace_id;
end;
$$;
revoke all on function public.replace_estimate_line_items(uuid,uuid,jsonb,text,text) from public, anon;
grant execute on function public.replace_estimate_line_items(uuid,uuid,jsonb,text,text) to authenticated;
