-- ============================================================================
-- Reservations & blocks, stage E2/E3 part B (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- Putaway of a repair-order part carries its reservation with it: the
-- reservation the PZ made in the receiving zone is taken off there, the MM
-- is posted, and the same reservation document gets a line at the
-- destination (moved_from_line_id -> the receiving-zone line, event 'moved').
-- Parts received before this change (no reservation in the receiving zone)
-- are reserved at the destination as before. Free stock: unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_putaway_from_receiving(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_variant_id uuid, p_quantity numeric, p_destination_location_id uuid, p_repair_order_line_id uuid DEFAULT NULL::uuid, p_container_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving uuid;
  v_product record;
  v_handling text;
  v_on_hand numeric;
  v_attributed_total numeric;
  v_rol record;
  v_result jsonb;
  v_movement_id uuid;
  v_mm_line uuid;
  v_doc text;
  v_need numeric;
  v_reserve_qty numeric := 0;
  v_reservation jsonb;
  v_reservation_id uuid;
  v_allocation jsonb;
  v_allocation_line_id uuid;
  v_container record;
  v_container_created boolean := false;
  v_code text;
  v_n integer;
  v_mode text;
  v_src record;
  v_take numeric;
  v_left numeric;
  v_moved jsonb := '[]'::jsonb;
  v_dest jsonb := '[]'::jsonb;
  v_mv record;
  v_new_line uuid;
  v_rest numeric;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
  END IF;

  v_receiving := public.resolve_branch_receiving_location(p_organization_id, p_branch_id);

  IF p_destination_location_id IS NULL OR p_destination_location_id = v_receiving OR NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id AND organization_id = p_organization_id
      AND branch_id = p_branch_id AND can_store_inventory = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination is not a valid stockable location in this branch' USING ERRCODE = '22023';
  END IF;

  SELECT p.id, p.base_unit_id INTO v_product
  FROM public.inventory_variants v
  JOIN public.inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
  WHERE v.id = p_variant_id AND v.organization_id = p_organization_id AND v.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(handling_mode, 'standard') INTO v_handling
  FROM public.inventory_product_branch_settings
  WHERE product_id = v_product.id AND branch_id = p_branch_id;
  v_handling := COALESCE(v_handling, 'standard');

  IF p_repair_order_line_id IS NULL THEN
    PERFORM 1 FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving AND variant_id = p_variant_id
    FOR UPDATE;

    SELECT COALESCE(SUM((it->>'quantity')::numeric), 0) INTO v_attributed_total
    FROM jsonb_array_elements(public.inventory_receiving_pending(p_organization_id, p_branch_id)->'items') it
    WHERE (it->>'variant_id')::uuid = p_variant_id AND it->>'repair_order_line_id' IS NOT NULL;

    SELECT COALESCE(on_hand_quantity, 0) INTO v_on_hand
    FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving AND variant_id = p_variant_id;

    IF COALESCE(v_on_hand, 0) - v_attributed_total < p_quantity THEN
      RAISE EXCEPTION 'Not enough free stock of this item in the receiving zone' USING ERRCODE = '22023';
    END IF;

    v_result := public.inventory_create_and_finalize(
      p_organization_id, p_branch_id, '801',
      jsonb_build_array(jsonb_build_object(
        'variant_id', p_variant_id, 'unit_id', v_product.base_unit_id, 'quantity', p_quantity,
        'source_location_id', v_receiving, 'destination_location_id', p_destination_location_id, 'note', NULL)),
      NULL, NULL, NULL, NULL, NULL, NULL, p_actor_user_id
    );

    RETURN jsonb_build_object(
      'mode', 'free',
      'movement_id', v_result->>'movement_id',
      'document_number', v_result->>'document_number',
      'destination_location_id', p_destination_location_id,
      'quantity', p_quantity
    );
  END IF;

  SELECT rol.id, rol.variant_id, rol.ordered_quantity, ro.id AS repair_order_id, ro.zl_number
  INTO v_rol
  FROM public.repair_order_lines rol
  JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
  WHERE rol.id = p_repair_order_line_id AND rol.deleted_at IS NULL AND ro.deleted_at IS NULL
    AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id
  FOR UPDATE OF rol;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RepairOrderLine not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_rol.variant_id IS NOT NULL AND v_rol.variant_id <> p_variant_id THEN
    RAISE EXCEPTION 'Item does not match the RepairOrderLine''s product' USING ERRCODE = '22023';
  END IF;
  IF v_rol.variant_id IS NULL THEN
    UPDATE public.repair_order_lines SET variant_id = p_variant_id, updated_at = now() WHERE id = v_rol.id;
  END IF;

  -- 1. Take this line's reservation off the receiving zone (it travels with the MM).
  v_left := p_quantity;
  FOR v_src IN
    SELECT rl.id, rl.reservation_id,
           rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity AS remaining
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    WHERE rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
      AND rl.location_id = v_receiving AND rl.variant_id = p_variant_id
      AND COALESCE(rl.repair_order_line_id,
                   CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = v_rol.id
      AND r.status <> 'cancelled' AND r.deleted_at IS NULL
      AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0
    ORDER BY rl.created_at
    FOR UPDATE OF rl
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(v_left, v_src.remaining);
    PERFORM public.inventory_reservation_release_internal(v_src.id, v_take, 'moved', NULL, p_actor_user_id);
    v_moved := v_moved || jsonb_build_array(jsonb_build_object(
      'line_id', v_src.id, 'reservation_id', v_src.reservation_id, 'quantity', v_take));
    v_left := v_left - v_take;
  END LOOP;

  -- 2. The MM.
  v_result := public.putaway_repair_order_stock(
    p_actor_user_id, p_organization_id, p_branch_id,
    jsonb_build_array(jsonb_build_object(
      'repair_order_line_id', v_rol.id, 'variant_id', p_variant_id,
      'unit_id', v_product.base_unit_id, 'quantity', p_quantity)),
    p_destination_location_id, NULL
  );
  v_movement_id := (v_result->>'movement_id')::uuid;
  v_doc := v_result->>'document_number';
  SELECT id INTO v_mm_line FROM public.inventory_movement_lines
  WHERE movement_id = v_movement_id ORDER BY line_number LIMIT 1;

  -- 3. The same reservation continues at the destination.
  FOR v_mv IN SELECT * FROM jsonb_to_recordset(v_moved) AS x(line_id uuid, reservation_id uuid, quantity numeric)
  LOOP
    v_new_line := public.inventory_reservation_add_line_internal(
      v_mv.reservation_id, p_variant_id, p_destination_location_id, v_mv.quantity,
      v_rol.id, v_mm_line, v_mv.line_id, p_actor_user_id);
    PERFORM public.inventory_reservation_log_internal(
      v_new_line, 'moved', v_mv.quantity, v_receiving, p_destination_location_id,
      v_movement_id, v_mm_line, 'Rozlokowanie ' || COALESCE(v_doc, ''), p_actor_user_id);
    v_dest := v_dest || jsonb_build_array(jsonb_build_object(
      'line_id', v_new_line, 'reservation_id', v_mv.reservation_id, 'quantity', v_mv.quantity));
    v_reserve_qty := v_reserve_qty + v_mv.quantity;
  END LOOP;

  -- 4. Parts received before reservations at the PZ: reserve at the
  --    destination up to what the line still needs.
  v_rest := p_quantity - v_reserve_qty;
  IF v_rest > 0 THEN
    SELECT v_rol.ordered_quantity - COALESCE(SUM(rl.reserved_quantity - rl.released_quantity), 0)
    INTO v_need
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    WHERE COALESCE(rl.repair_order_line_id,
                   CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = v_rol.id
      AND r.status <> 'cancelled' AND r.deleted_at IS NULL;
    v_rest := LEAST(v_rest, GREATEST(COALESCE(v_need, v_rol.ordered_quantity), 0));

    IF v_rest > 0 THEN
      v_reservation := public.inventory_create_reservation(
        p_organization_id, p_branch_id,
        jsonb_build_array(jsonb_build_object(
          'variant_id', p_variant_id, 'location_id', p_destination_location_id, 'quantity', v_rest)),
        'repair_order_line', v_rol.id, v_rol.zl_number, NULL,
        'Rozlokowanie ' || COALESCE(v_doc, ''), p_actor_user_id
      );
      v_reservation_id := (v_reservation->>'reservation_id')::uuid;
      SELECT id INTO v_new_line FROM public.inventory_reservation_lines WHERE reservation_id = v_reservation_id;
      UPDATE public.inventory_reservation_lines SET source_movement_line_id = v_mm_line WHERE id = v_new_line;
      v_dest := v_dest || jsonb_build_array(jsonb_build_object(
        'line_id', v_new_line, 'reservation_id', v_reservation_id, 'quantity', v_rest));
      v_reserve_qty := v_reserve_qty + v_rest;
    END IF;
  END IF;

  v_mode := CASE WHEN v_handling = 'bulk' THEN 'bulk' ELSE 'container' END;

  -- 5. A standard part goes into a container of its repair order.
  IF v_mode = 'container' AND jsonb_array_length(v_dest) > 0 THEN
    IF p_container_id IS NOT NULL THEN
      SELECT id, code INTO v_container FROM public.inventory_containers
      WHERE id = p_container_id AND organization_id = p_organization_id AND branch_id = p_branch_id
        AND reference_type = 'repair_order' AND reference_id = v_rol.repair_order_id::text
        AND current_location_id = p_destination_location_id
        AND status IN ('active', 'empty') AND deleted_at IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Container does not belong to this repair order at this location' USING ERRCODE = '22023';
      END IF;
    ELSE
      SELECT id, code INTO v_container FROM public.inventory_containers
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND reference_type = 'repair_order' AND reference_id = v_rol.repair_order_id::text
        AND current_location_id = p_destination_location_id
        AND status IN ('active', 'empty') AND deleted_at IS NULL
      ORDER BY (status = 'active') DESC, created_at
      LIMIT 1;
    END IF;

    IF v_container.id IS NULL THEN
      SELECT count(*) + 1 INTO v_n FROM public.inventory_containers
      WHERE organization_id = p_organization_id AND reference_type = 'repair_order'
        AND reference_id = v_rol.repair_order_id::text AND deleted_at IS NULL;
      LOOP
        v_code := 'K-' || COALESCE(v_rol.zl_number, 'ZL') || '-' || lpad(v_n::text, 2, '0');
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.inventory_containers
          WHERE organization_id = p_organization_id AND branch_id = p_branch_id
            AND lower(code) = lower(v_code) AND deleted_at IS NULL);
        v_n := v_n + 1;
      END LOOP;
      SELECT (c->>'container_id')::uuid AS id, v_code AS code INTO v_container
      FROM (SELECT public.inventory_create_container(
        p_actor_user_id, p_organization_id, p_branch_id, v_code, p_destination_location_id,
        'container', 'repair_order', v_rol.repair_order_id::text) AS c) x;
      v_container_created := true;
    END IF;

    FOR v_mv IN SELECT * FROM jsonb_to_recordset(v_dest) AS x(line_id uuid, reservation_id uuid, quantity numeric)
    LOOP
      v_allocation := public.inventory_create_allocation(
        p_organization_id, p_branch_id,
        jsonb_build_array(jsonb_build_object(
          'variant_id', p_variant_id, 'location_id', p_destination_location_id,
          'quantity', v_mv.quantity, 'reservation_line_id', v_mv.line_id)),
        v_mv.reservation_id, 'repair_order_line', v_rol.id, v_rol.zl_number, p_actor_user_id
      );
      SELECT id INTO v_allocation_line_id FROM public.inventory_allocation_lines
      WHERE allocation_id = (v_allocation->>'allocation_id')::uuid;

      PERFORM public.repair_order_add_allocation_to_container(
        p_actor_user_id, p_organization_id, p_branch_id, v_container.id, v_allocation_line_id, v_mv.quantity);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'movement_id', v_movement_id,
    'document_number', v_doc,
    'destination_location_id', p_destination_location_id,
    'quantity', p_quantity,
    'reserved_quantity', v_reserve_qty,
    'repair_order_id', v_rol.repair_order_id,
    'zl_number', v_rol.zl_number,
    'container_id', CASE WHEN v_mode = 'container' THEN v_container.id END,
    'container_code', CASE WHEN v_mode = 'container' THEN v_container.code END,
    'container_created', v_container_created
  );
END;
$function$;
