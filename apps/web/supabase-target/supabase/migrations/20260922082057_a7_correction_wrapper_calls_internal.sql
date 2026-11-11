-- A7 FOLLOW-UP CORRECTION PASS (2 of 3): redirect the RepairOrder
-- wrapper to call the new internal helper directly instead of the
-- still-public inventory_add_to_container. Applied BEFORE narrowing
-- the public entry point (next migration) so there is never a window
-- where the wrapper's own nested call would be broken -- same "safe
-- order" discipline A7 itself used (wrapper-safe-path-first).
--
-- Zero behavior change from this migration alone: inventory_add_to_
-- container_internal's body is byte-identical to inventory_add_to_
-- container's own current body (previous migration was a verbatim
-- copy), so redirecting the wrapper's own nested call target changes
-- nothing observable yet.

CREATE OR REPLACE FUNCTION public.repair_order_add_allocation_to_container(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_container_id uuid,
  p_allocation_line_id uuid,
  p_quantity numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_container_reference_type text;
  v_container_reference_id text;
  v_reservation_line_id uuid;
  v_resolved_repair_order_id uuid;
BEGIN
  IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  SELECT reference_type, reference_id
  INTO v_container_reference_type, v_container_reference_id
  FROM inventory_containers
  WHERE id = p_container_id
    AND organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Container not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_container_reference_type = 'repair_order' THEN
    SELECT reservation_line_id INTO v_reservation_line_id
    FROM inventory_allocation_lines
    WHERE id = p_allocation_line_id
      AND organization_id = p_organization_id
      AND branch_id = p_branch_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Allocation line not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT rol.repair_order_id INTO v_resolved_repair_order_id
    FROM inventory_reservation_lines rl
    JOIN inventory_reservations r ON r.id = rl.reservation_id
    JOIN repair_order_lines rol ON rol.id = r.reference_id
    WHERE rl.id = v_reservation_line_id
      AND r.reference_type = 'repair_order_line';

    IF v_resolved_repair_order_id IS NULL
       OR v_resolved_repair_order_id::text IS DISTINCT FROM v_container_reference_id THEN
      RAISE EXCEPTION 'Allocation does not belong to this container''s own RepairOrder' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN public.inventory_add_to_container_internal(
    p_actor_user_id, p_organization_id, p_branch_id, p_container_id, p_allocation_line_id, p_quantity
  );
END;
$function$;
