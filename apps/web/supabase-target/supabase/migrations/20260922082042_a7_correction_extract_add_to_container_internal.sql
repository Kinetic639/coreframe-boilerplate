-- A7 FOLLOW-UP CORRECTION PASS -- closes the disclosed direct-caller
-- tradeoff A7 itself left open: inventory_add_to_container (public,
-- generic) currently has zero RepairOrder-table knowledge (correct,
-- per A7), but also has zero opinion at all about whether the target
-- container is domain-owned -- meaning a direct, permissioned caller
-- bypassing repair_order_add_allocation_to_container can place an
-- unrelated allocation into a RepairOrder-owned container. LIVE
-- RE-REPRODUCED this pass, fresh, before any fix: a direct call with a
-- cross-RepairOrder allocation into a RepairOrder-owned container
-- SUCCEEDED.
--
-- Fix (3 migrations, this is 1 of 3): extract the actual placement
-- implementation into a new INTERNAL-ONLY helper,
-- inventory_add_to_container_internal -- byte-identical to the current
-- public inventory_add_to_container body, just renamed. Not yet wired
-- to anything; harmless addition. The next 2 migrations redirect the
-- RepairOrder wrapper to call this internal helper directly (closing
-- the loop before any behavior changes), then narrow the PUBLIC
-- inventory_add_to_container to add a generic-eligibility gate before
-- delegating to this same internal helper.
--
-- Security model matches the established _internal pattern exactly
-- (inventory_finalize_posting_internal, write_repair_order_line_
-- movement_link_internal, live-confirmed this pass): SECURITY DEFINER,
-- owner postgres, EXECUTE granted to NO role at all except the owner
-- itself (reachable only via same-owner nesting from another
-- postgres-owned SECURITY DEFINER function) -- not even service_role,
-- matching those two functions' own exact ACL shape.

CREATE OR REPLACE FUNCTION public.inventory_add_to_container_internal(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_container_id uuid, p_allocation_line_id uuid, p_quantity numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_container record;
  v_alloc record;
  v_existing_sum numeric;
  v_container_line_id uuid;
  v_unit_id uuid;
  v_link_id uuid;
  v_existing_line record;
BEGIN
  IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT id, organization_id, branch_id, status, current_location_id, reference_type, reference_id
  INTO v_container
  FROM inventory_containers
  WHERE id = p_container_id
    AND organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Container not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_container.status NOT IN ('active', 'empty') THEN
    RAISE EXCEPTION 'Container is not open for adding stock (status: %)', v_container.status USING ERRCODE = '55000';
  END IF;

  SELECT id, organization_id, branch_id, variant_id, location_id, lot_id, serial_id, allocated_quantity, reservation_line_id
  INTO v_alloc
  FROM inventory_allocation_lines
  WHERE id = p_allocation_line_id
    AND organization_id = p_organization_id
    AND branch_id = p_branch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation line not found' USING ERRCODE = 'P0002';
  END IF;

  -- Phase 10C correction: the allocation's own physical location must match
  -- the container's own current physical location. Phase 10C is pure
  -- physical grouping -- it never relocates stock, so placing an allocation
  -- into a container sitting at a different location would silently
  -- misrepresent where that stock physically is, with no movement posted
  -- and no balance changed. Phase 10E owns real container relocation.
  IF v_alloc.location_id IS DISTINCT FROM v_container.current_location_id THEN
    RAISE EXCEPTION 'Allocation location does not match the container''s own current location' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_existing_sum
  FROM inventory_allocation_container_links
  WHERE allocation_line_id = v_alloc.id
    AND deleted_at IS NULL;

  IF v_existing_sum + p_quantity > v_alloc.allocated_quantity THEN
    RAISE EXCEPTION 'Placement quantity exceeds the allocation line''s own allocated quantity (already placed %, allocated %)', v_existing_sum, v_alloc.allocated_quantity USING ERRCODE = '22023';
  END IF;

  SELECT p.base_unit_id INTO v_unit_id
  FROM inventory_variants v
  JOIN inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
  WHERE v.id = v_alloc.variant_id AND v.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to resolve unit for this allocation line''s own variant' USING ERRCODE = 'P0002';
  END IF;

  SELECT id, quantity INTO v_existing_line
  FROM inventory_container_lines
  WHERE container_id = v_container.id
    AND organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND variant_id = v_alloc.variant_id
    AND coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_alloc.lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_alloc.serial_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    v_container_line_id := v_existing_line.id;
    UPDATE inventory_container_lines
    SET quantity = quantity + p_quantity, updated_at = now()
    WHERE id = v_container_line_id;
  ELSE
    INSERT INTO inventory_container_lines (
      organization_id, branch_id, container_id, variant_id, unit_id, lot_id, serial_id, quantity
    ) VALUES (
      p_organization_id, p_branch_id, v_container.id, v_alloc.variant_id, v_unit_id, v_alloc.lot_id, v_alloc.serial_id, p_quantity
    )
    RETURNING id INTO v_container_line_id;
  END IF;

  INSERT INTO inventory_allocation_container_links (
    organization_id, branch_id, allocation_line_id, container_line_id, quantity, created_by
  ) VALUES (
    p_organization_id, p_branch_id, v_alloc.id, v_container_line_id, p_quantity, p_actor_user_id
  )
  RETURNING id INTO v_link_id;

  IF v_container.status = 'empty' THEN
    UPDATE inventory_containers SET status = 'active', updated_at = now(), updated_by = p_actor_user_id WHERE id = v_container.id;
  END IF;

  RETURN jsonb_build_object(
    'link_id', v_link_id,
    'container_line_id', v_container_line_id,
    'quantity', p_quantity,
    'container_status', (CASE WHEN v_container.status = 'empty' THEN 'active' ELSE v_container.status END)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_add_to_container_internal(uuid, uuid, uuid, uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_add_to_container_internal(uuid, uuid, uuid, uuid, uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.inventory_add_to_container_internal(uuid, uuid, uuid, uuid, uuid, numeric) FROM authenticated;
REVOKE ALL ON FUNCTION public.inventory_add_to_container_internal(uuid, uuid, uuid, uuid, uuid, numeric) FROM service_role;
