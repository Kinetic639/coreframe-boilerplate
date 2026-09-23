CREATE OR REPLACE FUNCTION public.inventory_add_to_container(
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
AS $$
DECLARE
  v_container record;
  v_alloc record;
  v_existing_sum numeric;
  v_container_line_id uuid;
  v_unit_id uuid;
  v_link_id uuid;
  v_existing_line record;
  v_resolved_repair_order_id uuid;
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

  -- Phase 10C correction: when the container itself declares RepairOrder
  -- ownership (reference_type='repair_order'), only allocations that
  -- resolve to that SAME RepairOrder -- via the accepted RepairOrderLine ->
  -- Reservation -> ReservationLine -> AllocationLine chain, exact UUID
  -- identity, never SKU -- may be placed into it. Generic (non-RepairOrder-
  -- owned) containers remain unrestricted.
  IF v_container.reference_type = 'repair_order' THEN
    SELECT rol.repair_order_id INTO v_resolved_repair_order_id
    FROM inventory_reservation_lines rl
    JOIN inventory_reservations r ON r.id = rl.reservation_id
    JOIN repair_order_lines rol ON rol.id = r.reference_id
    WHERE rl.id = v_alloc.reservation_line_id
      AND r.reference_type = 'repair_order_line';

    IF v_resolved_repair_order_id IS NULL
       OR v_resolved_repair_order_id::text IS DISTINCT FROM v_container.reference_id THEN
      RAISE EXCEPTION 'Allocation does not belong to this container''s own RepairOrder' USING ERRCODE = 'P0002';
    END IF;
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
$$;

REVOKE ALL ON FUNCTION public.inventory_add_to_container(uuid,uuid,uuid,uuid,uuid,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_add_to_container(uuid,uuid,uuid,uuid,uuid,numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_add_to_container(uuid,uuid,uuid,uuid,uuid,numeric) TO authenticated;
