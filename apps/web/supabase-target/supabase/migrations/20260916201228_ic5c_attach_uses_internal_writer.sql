-- IC-5 CORRECTION PASS -- refactor attach_repair_order_line_movement to
-- delegate the actual link INSERT (existence/org-branch/status/variant/
-- cap/duplicate validation) to the new internal canonical writer. The
-- PUBLIC CONTRACT IS FROZEN: relation_type is still restricted to
-- ('receipt', 'issue') only (unchanged check, kept first) -- an ordinary
-- authenticated caller can never submit 'relocation'/'reversal' through
-- this RPC. Category/reference-type validation (relation-specific, not a
-- generic invariant) stays here, unchanged, and runs BEFORE the internal
-- writer is ever called. The GUC-guarded auto-rebuild (fixed in the
-- previous IC-5 pass) is unchanged.
CREATE OR REPLACE FUNCTION public.attach_repair_order_line_movement(p_actor_user_id uuid, p_repair_order_line_id uuid, p_inventory_movement_line_id uuid, p_applied_quantity numeric, p_relation_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_ro record;
  v_ml record;
  v_write_result jsonb;
  v_bucket_location_id uuid;
begin
  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'p_actor_user_id must match the authenticated caller' using errcode = '28000';
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

  select iml.id, iml.destination_location_id, iml.source_location_id,
         imh.status, imh.reference_type, imh.reference_id, imt.category
    into v_ml
    from inventory_movement_lines iml
    join inventory_movement_headers imh on imh.id = iml.movement_id
    join inventory_movement_types imt on imt.id = imh.movement_type_id
   where iml.id = p_inventory_movement_line_id
     and iml.deleted_at is null;

  if not found then
    raise exception 'Inventory movement line not found: %', p_inventory_movement_line_id using errcode = 'P0002';
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

  -- All remaining generic invariants (RepairOrderLine/movement-line
  -- existence re-check under lock, org/branch compatibility, posted
  -- status, variant compatibility, quantity cap, duplicate handling) are
  -- enforced by the shared internal writer.
  v_write_result := write_repair_order_line_movement_link_internal(
    p_repair_order_line_id, p_inventory_movement_line_id, p_applied_quantity, p_relation_type
  );

  if current_setting('ambra.repair_order_attribution_authoritative', true) is distinct from 'on' then
    v_bucket_location_id := case when p_relation_type = 'receipt' then v_ml.destination_location_id
                                  else v_ml.source_location_id end;

    if v_bucket_location_id is not null then
      perform rebuild_repair_order_projection_bucket_internal(
        v_ro.organization_id, v_ro.branch_id, v_bucket_location_id, (v_write_result->>'variant_id')::uuid
      );
    end if;
  end if;

  return v_write_result;
end;
$function$;
