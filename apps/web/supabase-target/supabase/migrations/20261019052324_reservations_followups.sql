-- ============================================================================
-- Reservations & blocks: follow-ups (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- 1. A PZ makes ONE reservation document per repair order (a line per part),
--    like "Zarezerwuj z magazynu" -- instead of one document per order line.
-- 2. Approving a stock count whose shortage would take reserved (R) or
--    blocked (B) parts stops with a clear message (what is free, what is
--    reserved / blocked, what to do) instead of the engine's technical
--    "would strand committed stock" error. Nothing is released implicitly.
-- 3. (Demo-org reset: see 20261019052400_reservations_followups_demo_reset.sql.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_attribute_receipt_to_repair_orders(p_actor_user_id uuid, p_movement_id uuid, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_header record;
  v_line jsonb;
  v_ml record;
  v_zl text;
  v_code text;
  v_ro record;
  v_rol record;
  v_outstanding numeric;
  v_apply numeric;
  v_attributed jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_res_id uuid;
  v_res_number text;
  -- One reservation document per repair order of this PZ: {repair_order_id: {id, number}}.
  v_docs jsonb := '{}'::jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT h.id, h.organization_id, h.branch_id, h.status, h.document_number, t.category
  INTO v_header
  FROM public.inventory_movement_headers h
  JOIN public.inventory_movement_types t ON t.id = h.movement_type_id
  WHERE h.id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF v_header.status <> 'posted' OR v_header.category <> 'receipt' THEN
    RAISE EXCEPTION 'Only a posted receipt can be attributed' USING ERRCODE = '55000';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    SELECT id, variant_id, quantity, destination_location_id INTO v_ml
    FROM public.inventory_movement_lines
    WHERE id = NULLIF(v_line->>'movement_line_id', '')::uuid
      AND movement_id = p_movement_id AND deleted_at IS NULL;

    v_zl := NULLIF(trim(v_line->>'zl_number'), '');
    v_code := public.repair_order_normalize_product_code(v_line->>'product_code');

    IF v_ml.id IS NULL OR v_zl IS NULL OR v_code IS NULL THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_line->>'movement_line_id', 'reason', 'invalid_line'));
      CONTINUE;
    END IF;

    SELECT id, status INTO v_ro
    FROM public.repair_orders
    WHERE organization_id = v_header.organization_id AND branch_id = v_header.branch_id
      AND zl_number = v_zl AND deleted_at IS NULL;

    IF NOT FOUND THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'no_repair_order'));
      CONTINUE;
    END IF;

    IF v_ro.status <> 'open' THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'repair_order_' || v_ro.status));
      CONTINUE;
    END IF;

    SELECT id, variant_id INTO v_rol
    FROM public.repair_order_lines
    WHERE repair_order_id = v_ro.id AND deleted_at IS NULL
      AND public.repair_order_normalize_product_code(product_code) = v_code
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'no_repair_order_line'));
      CONTINUE;
    END IF;

    IF v_rol.variant_id IS NOT NULL AND v_rol.variant_id <> v_ml.variant_id THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'variant_mismatch'));
      CONTINUE;
    END IF;

    v_outstanding := public.repair_order_line_outstanding_receipt(v_rol.id);
    v_apply := LEAST(v_ml.quantity, GREATEST(v_outstanding, 0));
    IF v_apply <= 0 THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'already_received'));
      CONTINUE;
    END IF;

    IF v_rol.variant_id IS NULL THEN
      UPDATE public.repair_order_lines SET variant_id = v_ml.variant_id, updated_at = now()
      WHERE id = v_rol.id AND variant_id IS NULL;
    END IF;

    BEGIN
      PERFORM public.attach_repair_order_line_movement(p_actor_user_id, v_rol.id, v_ml.id, v_apply, 'receipt');

      IF v_docs ? v_ro.id::text THEN
        v_res_id := (v_docs -> v_ro.id::text ->> 'id')::uuid;
        v_res_number := v_docs -> v_ro.id::text ->> 'number';
      ELSE
        v_res_number := public.inventory_next_commitment_number_internal(
          v_header.organization_id, 'reservation', p_actor_user_id);
        INSERT INTO public.inventory_reservations (
          organization_id, branch_id, reservation_number, reference_type, reference_id,
          reference_number, notes, created_by
        ) VALUES (
          v_header.organization_id, v_header.branch_id, v_res_number, 'repair_order', v_ro.id,
          v_zl, 'Przyjęcie ' || COALESCE(v_header.document_number, ''), p_actor_user_id
        )
        RETURNING id INTO v_res_id;
      END IF;

      PERFORM public.inventory_reservation_add_line_internal(
        v_res_id, v_ml.variant_id, v_ml.destination_location_id, v_apply,
        v_rol.id, v_ml.id, NULL, p_actor_user_id,
        'Przyjęcie ' || COALESCE(v_header.document_number, ''));

      -- Remembered only once the line is in: a failed line rolls its document back.
      v_docs := v_docs || jsonb_build_object(v_ro.id::text, jsonb_build_object('id', v_res_id, 'number', v_res_number));

      v_attributed := v_attributed || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'repair_order_id', v_ro.id, 'repair_order_line_id', v_rol.id,
        'zl_number', v_zl, 'quantity', v_apply, 'free_quantity', v_ml.quantity - v_apply,
        'reservation_id', v_res_id, 'reservation_number', v_res_number));
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'already_attributed'));
    END;
  END LOOP;

  RETURN jsonb_build_object('movement_id', p_movement_id, 'attributed', v_attributed, 'skipped', v_skipped);
END;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_approve_count_session(p_count_session_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.inventory_count_sessions%ROWTYPE;
  v_require_reason boolean;
  v_line record;
  v_short record;
  v_increase_lines jsonb := '[]'::jsonb;
  v_decrease_lines jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO v_session
  FROM public.inventory_count_sessions
  WHERE id = p_count_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory count session not found';
  END IF;

  IF NOT public.has_branch_permission(v_session.organization_id, v_session.branch_id, 'warehouse.inventory.adjust') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
  END IF;

  IF v_session.status NOT IN ('draft', 'counting', 'submitted') THEN
    RAISE EXCEPTION 'Inventory count cannot be approved in current status';
  END IF;

  v_require_reason := coalesce((v_session.scope ->> 'require_reason_for_variance')::boolean, true);

  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has unresolved pending lines';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'needs_recount'
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has lines flagged for recount';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'counted' AND variance_quantity <> 0
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has counted variance lines that were not reviewed and approved';
  END IF;

  IF v_require_reason AND EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id
      AND status = 'approved'
      AND variance_quantity <> 0
      AND reason_code IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has approved variance lines missing a required reason code';
  END IF;

  -- A shortage may only take free stock (D). Reserved (R) or blocked (B)
  -- parts are released / unblocked first, explicitly and with a reason.
  SELECT l.variance_quantity, b.available_quantity,
         b.reserved_quantity + b.allocated_quantity AS reserved, b.blocked,
         v.sku, w.code AS location_code
  INTO v_short
  FROM public.inventory_count_lines l
  JOIN public.inventory_balances b
    ON b.organization_id = v_session.organization_id AND b.branch_id = v_session.branch_id
   AND b.location_id = l.location_id AND b.variant_id = l.variant_id
   AND b.lot_id IS NULL AND b.serial_id IS NULL
  LEFT JOIN public.inventory_variants v ON v.id = l.variant_id
  LEFT JOIN public.warehouse_locations w ON w.id = l.location_id
  WHERE l.count_session_id = v_session.id AND l.status = 'approved'
    AND l.variance_quantity < 0 AND abs(l.variance_quantity) > b.available_quantity
  ORDER BY w.code, v.sku
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Count shortage of % for % at % exceeds the free stock (D %): % reserved (R) and % blocked (B) there. Release those reservations or unblock first, then approve.',
      abs(v_short.variance_quantity), COALESCE(v_short.sku, '?'), COALESCE(v_short.location_code, '?'),
      v_short.available_quantity, v_short.reserved, v_short.blocked
      USING ERRCODE = '22023';
  END IF;

  PERFORM public.inventory_seed_movement_types(v_session.organization_id, p_actor_user_id);

  FOR v_line IN
    SELECT *
    FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id
      AND status = 'approved'
      AND variance_quantity <> 0
    ORDER BY location_id, variant_id
  LOOP
    IF v_line.variance_quantity > 0 THEN
      v_increase_lines := v_increase_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'destination_location_id', v_line.location_id,
        'unit_id', v_line.unit_id,
        'quantity', v_line.variance_quantity
      ));
    ELSE
      v_decrease_lines := v_decrease_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'source_location_id', v_line.location_id,
        'unit_id', v_line.unit_id,
        'quantity', abs(v_line.variance_quantity)
      ));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_increase_lines) > 0 THEN
    v_result := public.inventory_create_draft(
      v_session.organization_id,
      v_session.branch_id,
      '401',
      v_increase_lines,
      NULL,
      NULL,
      NULL,
      v_session.count_number,
      'Inventory count ' || v_session.count_number,
      'count-increase-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_finalize_posting((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  IF jsonb_array_length(v_decrease_lines) > 0 THEN
    v_result := public.inventory_create_draft(
      v_session.organization_id,
      v_session.branch_id,
      '402',
      v_decrease_lines,
      NULL,
      NULL,
      NULL,
      v_session.count_number,
      'Inventory count ' || v_session.count_number,
      'count-decrease-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_finalize_posting((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  UPDATE public.inventory_count_sessions
  SET status = 'approved',
      approved_at = now(),
      approved_by = p_actor_user_id
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'count_session_id', v_session.id,
    'count_number', v_session.count_number,
    'status', 'approved',
    'increase_lines', jsonb_array_length(v_increase_lines),
    'decrease_lines', jsonb_array_length(v_decrease_lines)
  );
END;
$function$;

