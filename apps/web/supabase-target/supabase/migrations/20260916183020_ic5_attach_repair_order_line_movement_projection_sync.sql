-- IC-5: attach_repair_order_line_movement is a real, standalone,
-- authenticated-callable writer of business attribution (Concept B) --
-- live-confirmed before this migration that calling it alone left the
-- projection (Concept C) untouched (0 known rows after a real attach
-- call), a second, independent source of the same "projection can drift
-- from attribution truth" architectural debt IC-5 exists to eliminate,
-- not merely the reversal case. Fixed by having it invoke the SAME
-- authoritative rebuild primitive for the exact bucket its own new link
-- affects, immediately after the link is inserted, in the same
-- transaction -- reusing the rebuild path rather than adding a third,
-- separately-written incremental-update implementation.
CREATE OR REPLACE FUNCTION public.attach_repair_order_line_movement(p_actor_user_id uuid, p_repair_order_line_id uuid, p_inventory_movement_line_id uuid, p_applied_quantity numeric, p_relation_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_ro record;
  v_ml record;
  v_existing_sum numeric;
  v_new_id uuid;
  v_bucket_location_id uuid;
begin
  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'p_actor_user_id must match the authenticated caller' using errcode = '28000';
  end if;

  if p_applied_quantity is null or p_applied_quantity <= 0 then
    raise exception 'applied_quantity must be greater than zero' using errcode = '22023';
  end if;

  if p_relation_type not in ('receipt', 'issue') then
    raise exception 'relation_type must be receipt or issue' using errcode = '22023';
  end if;

  select rol.id as line_id, ro.id as repair_order_id, ro.organization_id, ro.branch_id, rol.variant_id
    into v_ro
    from repair_order_lines rol
    join repair_orders ro on ro.id = rol.repair_order_id
   where rol.id = p_repair_order_line_id
     and rol.deleted_at is null
     and ro.deleted_at is null;

  if not found then
    raise exception 'RepairOrderLine not found: %', p_repair_order_line_id using errcode = 'P0002';
  end if;

  if not (
    has_branch_permission(v_ro.organization_id, v_ro.branch_id, 'warehouse.inventory.operate')
    or has_branch_permission(v_ro.organization_id, v_ro.branch_id, 'warehouse.inventory.adjust')
  ) then
    raise exception 'Not authorized to attribute inventory movements for this branch' using errcode = '42501';
  end if;

  select iml.id, iml.organization_id, iml.branch_id, iml.quantity, iml.variant_id,
         iml.source_location_id, iml.destination_location_id,
         imh.status, imh.reference_type, imh.reference_id, imt.category
    into v_ml
    from inventory_movement_lines iml
    join inventory_movement_headers imh on imh.id = iml.movement_id
    join inventory_movement_types imt on imt.id = imh.movement_type_id
   where iml.id = p_inventory_movement_line_id
     and iml.deleted_at is null
   for update of iml;

  if not found then
    raise exception 'Inventory movement line not found: %', p_inventory_movement_line_id using errcode = 'P0002';
  end if;

  if v_ml.organization_id <> v_ro.organization_id or v_ml.branch_id <> v_ro.branch_id then
    raise exception 'Movement line organization/branch does not match the RepairOrder' using errcode = '42501';
  end if;

  if v_ml.status <> 'posted' then
    raise exception 'Only posted movement lines can be attributed to a RepairOrderLine' using errcode = '55000';
  end if;

  if (p_relation_type = 'receipt' and v_ml.category <> 'receipt')
     or (p_relation_type = 'issue' and v_ml.category <> 'issue') then
    raise exception 'relation_type % does not match movement category %', p_relation_type, v_ml.category
      using errcode = '22023';
  end if;

  if v_ml.reference_type = 'repair_order' and v_ml.reference_id is not null
     and v_ml.reference_id <> v_ro.repair_order_id::text then
    raise exception 'Movement is referenced to a different RepairOrder' using errcode = '55000';
  end if;

  if v_ro.variant_id is not null and v_ro.variant_id <> v_ml.variant_id then
    raise exception 'Movement line product/variant does not match the RepairOrderLine''s own variant'
      using errcode = '55000';
  end if;

  select coalesce(sum(applied_quantity), 0) into v_existing_sum
    from repair_order_line_movement_links
   where inventory_movement_line_id = p_inventory_movement_line_id;

  if v_existing_sum + p_applied_quantity > v_ml.quantity then
    raise exception 'applied_quantity exceeds the movement line''s own remaining quantity (already applied %, line quantity %)',
      v_existing_sum, v_ml.quantity using errcode = '22023';
  end if;

  insert into repair_order_line_movement_links
    (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
  values
    (p_repair_order_line_id, p_inventory_movement_line_id, p_applied_quantity, p_relation_type)
  on conflict (repair_order_line_id, inventory_movement_line_id, relation_type) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'This movement line is already attributed to this RepairOrderLine with this relation type'
      using errcode = '23505';
  end if;

  -- IC-5: keep the projection in sync with this new attribution,
  -- immediately, same transaction -- receipt lands at the movement
  -- line's own destination; issue departs from its own source.
  v_bucket_location_id := case when p_relation_type = 'receipt' then v_ml.destination_location_id
                                else v_ml.source_location_id end;

  if v_bucket_location_id is not null then
    perform rebuild_repair_order_projection_bucket_internal(
      v_ro.organization_id, v_ro.branch_id, v_bucket_location_id, v_ml.variant_id
    );
  end if;

  return jsonb_build_object(
    'id', v_new_id,
    'repair_order_line_id', p_repair_order_line_id,
    'inventory_movement_line_id', p_inventory_movement_line_id,
    'applied_quantity', p_applied_quantity,
    'relation_type', p_relation_type
  );
end;
$function$;
