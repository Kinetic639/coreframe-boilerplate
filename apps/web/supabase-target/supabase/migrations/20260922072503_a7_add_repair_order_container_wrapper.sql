-- A7 SIMPLIFICATION -- domain-boundary extraction (step 1 of 2: add the
-- RepairOrder-domain wrapper FIRST, so a safe path exists before the
-- generic primitive is narrowed in the next migration).
--
-- inventory_add_to_container (a generic, domain-agnostic Handling-Unit
-- primitive any Warehouse container action calls) currently contains an
-- inline branch reaching repair_order_lines via a 3-table JOIN
-- (inventory_reservation_lines -> inventory_reservations ->
-- repair_order_lines) whenever the target container is RepairOrder-
-- owned. This is the one confirmed backward dependency the architecture
-- compression review's own module-boundary-review.md flagged (generic
-- Inventory Core -> RepairOrder module) -- re-confirmed live this pass,
-- still the only one (repo-wide prosrc scan of every inventory_%
-- function).
--
-- This migration extracts that branch verbatim into a new, RepairOrder-
-- domain wrapper, repair_order_add_allocation_to_container, which
-- performs the SAME actor-identity + permission + ownership check, THEN
-- calls the now-still-unnarrowed inventory_add_to_container as a nested
-- call in the SAME transaction (no second round-trip). The next
-- migration removes the branch from the generic primitive itself.
--
-- TOCTOU: re-verified live this pass (not merely trusted from the prior
-- audit) that inventory_containers.reference_type/reference_id and
-- inventory_allocation_lines.reservation_line_id are write-once --
-- zero UPDATE statements touching either anywhere in pg_proc or in any
-- TypeScript writer, in either apps/web or apps/public-web. Both are
-- set only once, at creation time, by inventory_create_container and
-- inventory_create_allocation respectively. Because these specific
-- values cannot change post-creation, the wrapper's own unlocked read
-- (no FOR UPDATE) cannot race with the generic primitive's own later
-- FOR UPDATE read of the same rows -- see docs/inventory/reviews/
-- inventory-a7-repairorder-container-boundary-review/boundary-
-- evidence.md for the full re-verification. This is a load-bearing
-- invariant of this design: if either column ever becomes mutable in a
-- future feature, this wrapper's own TOCTOU-safety analysis must be
-- re-opened.

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

  -- Unlocked read is intentional and safe -- see the write-once
  -- invariant documented above and in boundary-evidence.md. The nested
  -- call below re-reads and locks (FOR UPDATE) the same container row
  -- itself; this read exists only to learn reference_type/reference_id
  -- before deciding whether the RepairOrder-ownership check applies.
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

  RETURN public.inventory_add_to_container(
    p_actor_user_id, p_organization_id, p_branch_id, p_container_id, p_allocation_line_id, p_quantity
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.repair_order_add_allocation_to_container(uuid, uuid, uuid, uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_order_add_allocation_to_container(uuid, uuid, uuid, uuid, uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.repair_order_add_allocation_to_container(uuid, uuid, uuid, uuid, uuid, numeric) TO authenticated, service_role;
