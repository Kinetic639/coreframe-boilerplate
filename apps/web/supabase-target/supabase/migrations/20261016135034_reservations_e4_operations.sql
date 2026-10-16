-- ============================================================================
-- Reservations & blocks, stage E4: operations (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- * repair_order_line_open_need: what a repair-order line still needs
--   (ordered - everything reserved for it that was not released).
-- * inventory_reserve_for_repair_order: "Zarezerwuj z magazynu" -- several
--   parts of one repair order, from D, in ONE reservation document
--   (reference_type 'repair_order', one line per part).
-- * inventory_release_reservation_lines: release (R -> D) with a reason.
-- * inventory_transfer_reservation: move a reserved quantity to another
--   repair order's line, with a reason, in one transaction (never in D).
-- * inventory_release_reservation (whole document; branch transfers, the
--   repair order page) now writes history events.
-- * repair_order_add_allocation_to_container reads the repair-order line
--   from the reservation line (repair-order documents too).
-- Every operation requires warehouse.inventory.operate.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.repair_order_line_open_need(p_repair_order_line_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT rol.ordered_quantity - COALESCE((
    SELECT SUM(rl.reserved_quantity - rl.released_quantity)
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    WHERE COALESCE(rl.repair_order_line_id,
                   CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = rol.id
      AND r.status <> 'cancelled' AND r.deleted_at IS NULL
  ), 0)
  FROM public.repair_order_lines rol
  WHERE rol.id = p_repair_order_line_id;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_reserve_for_repair_order(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_repair_order_id uuid,
  p_lines jsonb,
  p_reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ro record;
  v_line jsonb;
  v_index integer := 0;
  v_rol record;
  v_variant uuid;
  v_qty numeric;
  v_need numeric;
  v_location uuid;
  v_res_id uuid;
  v_number text;
  v_line_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'Rezerwacja z magazynu');
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, zl_number, status INTO v_ro
  FROM public.repair_orders
  WHERE id = p_repair_order_id AND organization_id = p_organization_id
    AND branch_id = p_branch_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair order not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_ro.status <> 'open' THEN
    RAISE EXCEPTION 'Repair order is not open' USING ERRCODE = '55000';
  END IF;

  v_number := public.inventory_next_commitment_number_internal(p_organization_id, 'reservation', p_actor_user_id);
  INSERT INTO public.inventory_reservations (
    organization_id, branch_id, reservation_number, reference_type, reference_id,
    reference_number, notes, created_by
  ) VALUES (
    p_organization_id, p_branch_id, v_number, 'repair_order', v_ro.id,
    v_ro.zl_number, v_reason, p_actor_user_id
  )
  RETURNING id INTO v_res_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_index := v_index + 1;
    v_qty := NULLIF(v_line->>'quantity', '')::numeric;
    v_location := NULLIF(v_line->>'location_id', '')::uuid;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line % quantity must be positive', v_index USING ERRCODE = '22023';
    END IF;

    SELECT id, variant_id INTO v_rol
    FROM public.repair_order_lines
    WHERE id = NULLIF(v_line->>'repair_order_line_id', '')::uuid
      AND repair_order_id = v_ro.id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line % does not belong to this repair order', v_index USING ERRCODE = 'P0002';
    END IF;

    v_variant := COALESCE(v_rol.variant_id, NULLIF(v_line->>'variant_id', '')::uuid);
    IF v_variant IS NULL THEN
      RAISE EXCEPTION 'Line %: the part has no catalog item yet', v_index USING ERRCODE = '22023';
    END IF;
    IF v_rol.variant_id IS NOT NULL AND NULLIF(v_line->>'variant_id', '') IS NOT NULL
       AND (v_line->>'variant_id')::uuid <> v_rol.variant_id THEN
      RAISE EXCEPTION 'Line %: item does not match the repair-order line', v_index USING ERRCODE = '22023';
    END IF;
    IF v_rol.variant_id IS NULL THEN
      UPDATE public.repair_order_lines SET variant_id = v_variant, updated_at = now() WHERE id = v_rol.id;
    END IF;

    IF v_location IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.warehouse_locations
      WHERE id = v_location AND organization_id = p_organization_id AND branch_id = p_branch_id
        AND can_store_inventory = true AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Line %: not a stock location of this branch', v_index USING ERRCODE = '22023';
    END IF;

    v_need := public.repair_order_line_open_need(v_rol.id);
    IF v_qty > GREATEST(v_need, 0) THEN
      RAISE EXCEPTION 'Line %: the repair order still needs only %', v_index, GREATEST(v_need, 0) USING ERRCODE = '22023';
    END IF;

    v_line_id := public.inventory_reservation_add_line_internal(
      v_res_id, v_variant, v_location, v_qty, v_rol.id, NULL, NULL, p_actor_user_id, v_reason);

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'reservation_line_id', v_line_id, 'repair_order_line_id', v_rol.id,
      'location_id', v_location, 'quantity', v_qty));
  END LOOP;

  RETURN jsonb_build_object(
    'reservation_id', v_res_id, 'reservation_number', v_number,
    'repair_order_id', v_ro.id, 'zl_number', v_ro.zl_number, 'lines', v_result);
END;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_release_reservation_lines(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_lines jsonb,
  p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_line jsonb;
  v_index integer := 0;
  v_rl record;
  v_remaining numeric;
  v_qty numeric;
  v_total numeric := 0;
  v_reason text := NULLIF(trim(p_reason), '');
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required to release a reservation' USING ERRCODE = '22023';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_index := v_index + 1;
    SELECT rl.* INTO v_rl
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    WHERE rl.id = NULLIF(v_line->>'reservation_line_id', '')::uuid
      AND rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
      AND r.deleted_at IS NULL
    FOR UPDATE OF rl;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line %: reservation not found', v_index USING ERRCODE = 'P0002';
    END IF;

    v_remaining := v_rl.reserved_quantity - v_rl.released_quantity - v_rl.fulfilled_quantity;
    v_qty := COALESCE(NULLIF(v_line->>'quantity', '')::numeric, v_remaining);
    IF v_qty <= 0 OR v_qty > v_remaining THEN
      RAISE EXCEPTION 'Line %: only % can be released (parts already in a container are taken out of it first)',
        v_index, v_remaining USING ERRCODE = '22023';
    END IF;

    PERFORM public.inventory_reservation_release_internal(v_rl.id, v_qty, 'released', v_reason, p_actor_user_id);
    v_total := v_total + v_qty;
  END LOOP;

  RETURN jsonb_build_object('line_count', v_index, 'released_quantity', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_transfer_reservation(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_reservation_line_id uuid,
  p_quantity numeric,
  p_target_repair_order_line_id uuid,
  p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rl record;
  v_src_rol uuid;
  v_src_zl text;
  v_target record;
  v_remaining numeric;
  v_need numeric;
  v_res_id uuid;
  v_number text;
  v_new_line uuid;
  v_reason text := NULLIF(trim(p_reason), '');
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required to transfer a reservation' USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT rl.*, COALESCE(rl.repair_order_line_id,
                        CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) AS rol_id
  INTO v_rl
  FROM public.inventory_reservation_lines rl
  JOIN public.inventory_reservations r ON r.id = rl.reservation_id
  WHERE rl.id = p_reservation_line_id
    AND rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
    AND r.deleted_at IS NULL
  FOR UPDATE OF rl;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found' USING ERRCODE = 'P0002';
  END IF;
  v_src_rol := v_rl.rol_id;

  v_remaining := v_rl.reserved_quantity - v_rl.released_quantity - v_rl.fulfilled_quantity;
  IF p_quantity > v_remaining THEN
    RAISE EXCEPTION 'Only % can be transferred (parts already in a container are taken out of it first)', v_remaining
      USING ERRCODE = '22023';
  END IF;

  SELECT rol.id, rol.variant_id, ro.id AS repair_order_id, ro.zl_number, ro.status
  INTO v_target
  FROM public.repair_order_lines rol
  JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
  WHERE rol.id = p_target_repair_order_line_id AND rol.deleted_at IS NULL AND ro.deleted_at IS NULL
    AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id
  FOR UPDATE OF rol;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target repair-order line not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_target.status <> 'open' THEN
    RAISE EXCEPTION 'Target repair order is not open' USING ERRCODE = '55000';
  END IF;
  IF v_target.id = v_src_rol THEN
    RAISE EXCEPTION 'The reservation already belongs to this line' USING ERRCODE = '22023';
  END IF;
  IF v_target.variant_id IS NOT NULL AND v_target.variant_id <> v_rl.variant_id THEN
    RAISE EXCEPTION 'The target line is for a different part' USING ERRCODE = '22023';
  END IF;
  IF v_target.variant_id IS NULL THEN
    UPDATE public.repair_order_lines SET variant_id = v_rl.variant_id, updated_at = now() WHERE id = v_target.id;
  END IF;

  v_need := public.repair_order_line_open_need(v_target.id);
  IF p_quantity > GREATEST(v_need, 0) THEN
    RAISE EXCEPTION 'The target repair order still needs only %', GREATEST(v_need, 0) USING ERRCODE = '22023';
  END IF;

  SELECT ro.zl_number INTO v_src_zl
  FROM public.repair_order_lines rol JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
  WHERE rol.id = v_src_rol;

  -- Off the source line and onto the target in the same transaction.
  PERFORM public.inventory_reservation_release_internal(v_rl.id, p_quantity, 'moved', NULL, p_actor_user_id);
  PERFORM public.inventory_reservation_log_internal(
    v_rl.id, 'transferred', p_quantity, v_rl.location_id, NULL, NULL, NULL,
    'Przeniesienie na ' || COALESCE(v_target.zl_number, '') || ': ' || v_reason,
    p_actor_user_id, v_target.id);

  v_number := public.inventory_next_commitment_number_internal(p_organization_id, 'reservation', p_actor_user_id);
  INSERT INTO public.inventory_reservations (
    organization_id, branch_id, reservation_number, reference_type, reference_id,
    reference_number, notes, created_by
  ) VALUES (
    p_organization_id, p_branch_id, v_number, 'repair_order', v_target.repair_order_id,
    v_target.zl_number, 'Przeniesienie z ' || COALESCE(v_src_zl, '') || ': ' || v_reason, p_actor_user_id
  )
  RETURNING id INTO v_res_id;

  v_new_line := public.inventory_reservation_add_line_internal(
    v_res_id, v_rl.variant_id, v_rl.location_id, p_quantity, v_target.id,
    v_rl.source_movement_line_id, v_rl.id, p_actor_user_id);
  PERFORM public.inventory_reservation_log_internal(
    v_new_line, 'created', p_quantity, v_rl.location_id, NULL, NULL, NULL,
    'Przeniesienie z ' || COALESCE(v_src_zl, '') || ': ' || v_reason, p_actor_user_id);

  RETURN jsonb_build_object(
    'reservation_id', v_res_id, 'reservation_number', v_number,
    'reservation_line_id', v_new_line, 'quantity', p_quantity,
    'from_repair_order_line_id', v_src_rol, 'to_repair_order_line_id', v_target.id);
END;
$function$;

-- Whole-document release / cancel, now with history.
CREATE OR REPLACE FUNCTION public.inventory_release_reservation(p_reservation_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_cancel boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
  v_line record;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_reservation
  FROM public.inventory_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_reservation.organization_id, v_reservation.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Reservation not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_line IN
    SELECT id, reserved_quantity - released_quantity - fulfilled_quantity AS remaining
    FROM public.inventory_reservation_lines
    WHERE reservation_id = v_reservation.id
    ORDER BY created_at
    FOR UPDATE
  LOOP
    IF v_line.remaining > 0 THEN
      PERFORM public.inventory_reservation_release_internal(
        v_line.id, v_line.remaining, 'released',
        CASE WHEN p_cancel THEN 'Anulowanie rezerwacji ' ELSE 'Zwolnienie rezerwacji ' END
          || v_reservation.reservation_number,
        p_actor_user_id);
    END IF;
  END LOOP;

  IF p_cancel THEN
    UPDATE public.inventory_reservations
    SET status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_actor_user_id
    WHERE id = v_reservation.id;
  END IF;

  RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', CASE WHEN p_cancel THEN 'cancelled' ELSE v_reservation.status END);
END;
$function$;

-- Containers: the repair order comes from the reservation line (also for
-- one-document-per-order reservations).
CREATE OR REPLACE FUNCTION public.repair_order_add_allocation_to_container(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_container_id uuid, p_allocation_line_id uuid, p_quantity numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    JOIN repair_order_lines rol
      ON rol.id = COALESCE(rl.repair_order_line_id,
                           CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END)
    WHERE rl.id = v_reservation_line_id;

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

REVOKE ALL ON FUNCTION public.repair_order_line_open_need(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_order_line_open_need(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_reserve_for_repair_order(uuid, uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_reserve_for_repair_order(uuid, uuid, uuid, uuid, jsonb, text) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_release_reservation_lines(uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_release_reservation_lines(uuid, uuid, uuid, jsonb, text) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_transfer_reservation(uuid, uuid, uuid, uuid, numeric, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_transfer_reservation(uuid, uuid, uuid, uuid, numeric, uuid, text) TO authenticated;
