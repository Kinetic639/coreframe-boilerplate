-- ============================================================================
-- Reservations & blocks, stage E2/E3 part C (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- * RW 261 for a repair order (repair_order_issue_parts) writes an 'issued'
--   event for every reservation it uses up.
-- * Reversal (storno) of a PZ releases the reservations the PZ made that
--   still sit where the PZ put the parts, before the reversal is posted.
-- * A PZ correction releases the repair-order share it takes back.
-- * Closing / archiving a repair order releases its open (not yet in a
--   container, not issued) reservations.
-- Every release is an event with its reason.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.repair_order_issue_parts(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_repair_order_id uuid, p_lines jsonb, p_recipient text, p_note text DEFAULT NULL::text)
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
  v_qty numeric;
  v_alloc record;
  v_resl record;
  v_balance public.inventory_balances%ROWTYPE;
  v_unit uuid;
  v_location uuid;
  v_variant uuid;
  v_container_id uuid;
  v_left numeric;
  v_link record;
  v_take numeric;
  v_engine_lines jsonb := '[]'::jsonb;
  v_meta jsonb := '[]'::jsonb;
  v_draft jsonb;
  v_movement_id uuid;
  v_posted jsonb;
  v_ml_ids uuid[];
  v_i integer;
  v_touched uuid[] := ARRAY[]::uuid[];
  v_c uuid;
  v_reservation_line_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_recipient IS NULL OR length(trim(p_recipient)) = 0 THEN
    RAISE EXCEPTION 'A recipient is required' USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, zl_number INTO v_ro
  FROM public.repair_orders
  WHERE id = p_repair_order_id AND organization_id = p_organization_id
    AND branch_id = p_branch_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair order not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.inventory_ensure_repair_order_issue_type(p_organization_id);
  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_index := v_index + 1;
    v_qty := (v_line->>'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line % quantity must be positive', v_index USING ERRCODE = '22023';
    END IF;

    SELECT rol.id, rol.variant_id INTO v_rol
    FROM public.repair_order_lines rol
    WHERE rol.id = (v_line->>'repair_order_line_id')::uuid
      AND rol.repair_order_id = v_ro.id AND rol.deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line % does not belong to this repair order', v_index USING ERRCODE = 'P0002';
    END IF;

    v_container_id := NULL;
    v_reservation_line_id := NULL;

    IF NULLIF(v_line->>'allocation_line_id', '') IS NOT NULL THEN
      SELECT al.* INTO v_alloc
      FROM public.inventory_allocation_lines al
      JOIN public.inventory_reservation_lines rl ON rl.id = al.reservation_line_id
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      WHERE al.id = (v_line->>'allocation_line_id')::uuid
        AND al.organization_id = p_organization_id AND al.branch_id = p_branch_id
        AND COALESCE(rl.repair_order_line_id,
                     CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = v_rol.id
      FOR UPDATE OF al;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Line %: allocation does not belong to this repair-order line', v_index USING ERRCODE = 'P0002';
      END IF;
      IF v_alloc.allocated_quantity - v_alloc.fulfilled_quantity < v_qty THEN
        RAISE EXCEPTION 'Line %: only % left to issue from this allocation', v_index,
          v_alloc.allocated_quantity - v_alloc.fulfilled_quantity USING ERRCODE = '22023';
      END IF;

      v_balance := public.inventory_get_or_create_balance_for_update(
        p_organization_id, p_branch_id, v_alloc.location_id, v_alloc.variant_id, NULL,
        v_alloc.lot_id, v_alloc.serial_id);
      UPDATE public.inventory_balances
      SET allocated_quantity = GREATEST(0, allocated_quantity - v_qty)
      WHERE id = v_balance.id;
      UPDATE public.inventory_allocation_lines
      SET fulfilled_quantity = fulfilled_quantity + v_qty
      WHERE id = v_alloc.id;

      v_left := v_qty;
      FOR v_link IN
        SELECT l.id AS link_id, l.quantity AS link_qty, cl.id AS cline_id, cl.quantity AS cline_qty, cl.container_id
        FROM public.inventory_allocation_container_links l
        JOIN public.inventory_container_lines cl ON cl.id = l.container_line_id
        WHERE l.allocation_line_id = v_alloc.id AND l.deleted_at IS NULL AND cl.deleted_at IS NULL
        ORDER BY l.created_at
        FOR UPDATE OF l, cl
      LOOP
        EXIT WHEN v_left <= 0;
        v_take := LEAST(v_left, v_link.link_qty);
        IF v_take >= v_link.link_qty THEN
          UPDATE public.inventory_allocation_container_links SET deleted_at = now() WHERE id = v_link.link_id;
        ELSE
          UPDATE public.inventory_allocation_container_links SET quantity = quantity - v_take WHERE id = v_link.link_id;
        END IF;
        IF v_take >= v_link.cline_qty THEN
          UPDATE public.inventory_container_lines SET deleted_at = now(), updated_at = now() WHERE id = v_link.cline_id;
        ELSE
          UPDATE public.inventory_container_lines SET quantity = quantity - v_take, updated_at = now() WHERE id = v_link.cline_id;
        END IF;
        v_container_id := COALESCE(v_container_id, v_link.container_id);
        v_touched := array_append(v_touched, v_link.container_id);
        v_left := v_left - v_take;
      END LOOP;

      v_location := v_alloc.location_id;
      v_variant := v_alloc.variant_id;
      v_reservation_line_id := v_alloc.reservation_line_id;

    ELSIF NULLIF(v_line->>'reservation_line_id', '') IS NOT NULL THEN
      SELECT rl.* INTO v_resl
      FROM public.inventory_reservation_lines rl
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      WHERE rl.id = (v_line->>'reservation_line_id')::uuid
        AND rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
        AND COALESCE(rl.repair_order_line_id,
                     CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = v_rol.id
        AND r.status <> 'cancelled'
      FOR UPDATE OF rl;
      IF NOT FOUND OR v_resl.location_id IS NULL THEN
        RAISE EXCEPTION 'Line %: reservation does not belong to this repair-order line', v_index USING ERRCODE = 'P0002';
      END IF;
      IF v_resl.reserved_quantity - v_resl.released_quantity - v_resl.fulfilled_quantity < v_qty THEN
        RAISE EXCEPTION 'Line %: only % left to issue from this reservation', v_index,
          v_resl.reserved_quantity - v_resl.released_quantity - v_resl.fulfilled_quantity USING ERRCODE = '22023';
      END IF;

      v_balance := public.inventory_get_or_create_balance_for_update(
        p_organization_id, p_branch_id, v_resl.location_id, v_resl.variant_id, NULL,
        v_resl.lot_id, v_resl.serial_id);
      UPDATE public.inventory_balances
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_qty)
      WHERE id = v_balance.id;
      UPDATE public.inventory_reservation_lines
      SET fulfilled_quantity = fulfilled_quantity + v_qty
      WHERE id = v_resl.id;

      v_location := v_resl.location_id;
      v_variant := v_resl.variant_id;
      v_reservation_line_id := v_resl.id;
    ELSE
      RAISE EXCEPTION 'Line % must name an allocation or a reservation to issue from', v_index USING ERRCODE = '22023';
    END IF;

    SELECT p.base_unit_id INTO v_unit
    FROM public.inventory_variants v
    JOIN public.inventory_products p ON p.id = v.product_id
    WHERE v.id = v_variant;

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_variant,
      'unit_id', v_unit,
      'quantity', v_qty,
      'source_location_id', v_location,
      'note', NULL));
    v_meta := v_meta || jsonb_build_array(jsonb_build_object(
      'repair_order_line_id', v_rol.id, 'quantity', v_qty, 'container_id', v_container_id,
      'reservation_line_id', v_reservation_line_id, 'location_id', v_location));
  END LOOP;

  FOREACH v_c IN ARRAY v_touched
  LOOP
    UPDATE public.inventory_containers c
    SET status = 'empty', updated_at = now(), updated_by = p_actor_user_id
    WHERE c.id = v_c AND c.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_container_lines cl
        WHERE cl.container_id = c.id AND cl.deleted_at IS NULL);
  END LOOP;

  v_draft := public.inventory_create_draft(
    p_organization_id, p_branch_id, '261', v_engine_lines,
    NULL, NULL, trim(p_recipient), v_ro.zl_number, NULLIF(trim(p_note), ''), NULL, p_actor_user_id);
  v_movement_id := (v_draft->>'movement_id')::uuid;

  UPDATE public.inventory_movement_headers
  SET reference_type = 'repair_order', reference_id = v_ro.id::text, recipient_name = trim(p_recipient)
  WHERE id = v_movement_id;

  SELECT array_agg(id ORDER BY line_number) INTO v_ml_ids
  FROM public.inventory_movement_lines WHERE movement_id = v_movement_id;

  FOR v_i IN 1..jsonb_array_length(v_meta)
  LOOP
    IF (v_meta->(v_i - 1)->>'container_id') IS NOT NULL THEN
      UPDATE public.inventory_movement_lines
      SET container_id = (v_meta->(v_i - 1)->>'container_id')::uuid
      WHERE id = v_ml_ids[v_i];
    END IF;
  END LOOP;

  v_posted := public.inventory_finalize_posting(v_movement_id, p_actor_user_id);

  FOR v_i IN 1..jsonb_array_length(v_meta)
  LOOP
    PERFORM public.attach_repair_order_line_movement(
      p_actor_user_id,
      (v_meta->(v_i - 1)->>'repair_order_line_id')::uuid,
      v_ml_ids[v_i],
      (v_meta->(v_i - 1)->>'quantity')::numeric,
      'issue');

    IF (v_meta->(v_i - 1)->>'reservation_line_id') IS NOT NULL THEN
      PERFORM public.inventory_reservation_log_internal(
        (v_meta->(v_i - 1)->>'reservation_line_id')::uuid, 'issued',
        (v_meta->(v_i - 1)->>'quantity')::numeric,
        (v_meta->(v_i - 1)->>'location_id')::uuid, NULL,
        v_movement_id, v_ml_ids[v_i],
        'Wydanie ' || COALESCE(v_posted->>'document_number', '') || ' dla ' || trim(p_recipient),
        p_actor_user_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'document_number', v_posted->>'document_number',
    'line_count', jsonb_array_length(v_meta),
    'recipient', trim(p_recipient));
END;
$function$;

-- Reversal (storno): a PZ's reservations still in place are released first.
CREATE OR REPLACE FUNCTION public.inventory_reverse_movement(p_movement_id uuid, p_actor_user_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_original RECORD;
  v_reason text;
  v_reversal_id uuid := gen_random_uuid();
  v_reversal_type_id uuid;
  v_line RECORD;
  v_line_number integer := 0;
  v_line_effects jsonb;
  v_orig_effect RECORD;
  v_inverse_direction text;
  v_explicit_effects jsonb := '{}'::jsonb;
  v_finalize_result jsonb;
  v_res RECORD;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  v_reason := NULLIF(TRIM(p_reason), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A non-blank reason is required to reverse a movement' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_original FROM inventory_movement_headers
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_original.organization_id, v_original.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Movement not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF v_original.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted movements can be reversed (status=%). Draft movements use cancellation, not reversal.', v_original.status
      USING ERRCODE = 'P0007';
  END IF;

  IF v_original.original_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'A reversal movement cannot itself be reversed' USING ERRCODE = 'P0005';
  END IF;

  IF v_original.reversal_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Movement has already been reversed (reversal_movement_id=%)', v_original.reversal_movement_id
      USING ERRCODE = 'P0006';
  END IF;

  SELECT id INTO v_reversal_type_id
  FROM inventory_movement_types
  WHERE organization_id = v_original.organization_id AND code = '900' AND deleted_at IS NULL;

  IF v_reversal_type_id IS NULL THEN
    RAISE EXCEPTION 'Reversal movement type not configured for this organization' USING ERRCODE = 'P0002';
  END IF;

  SET LOCAL ambra.inventory_movement_engine = 'on';
  SET LOCAL ambra.repair_order_attribution_authoritative = 'on';

  INSERT INTO inventory_movement_headers (
    id, organization_id, branch_id, movement_type_id, movement_type_code,
    status, reference_type, reference_id, original_movement_id, created_by
  ) VALUES (
    v_reversal_id, v_original.organization_id, v_original.branch_id, v_reversal_type_id, '900',
    'draft', 'movement_reversal', v_original.id::text, v_original.id, p_actor_user_id
  );

  FOR v_line IN
    SELECT * FROM inventory_movement_lines
    WHERE movement_id = v_original.id AND deleted_at IS NULL
    ORDER BY line_number
  LOOP
    v_line_number := v_line_number + 1;

    INSERT INTO inventory_movement_lines (
      id, movement_id, organization_id, branch_id, line_number,
      variant_id, unit_id, quantity,
      source_location_id, destination_location_id,
      lot_id, serial_id, unit_cost, currency, note
    ) VALUES (
      gen_random_uuid(), v_reversal_id, v_original.organization_id, v_original.branch_id, v_line_number,
      v_line.variant_id, v_line.unit_id, v_line.quantity,
      v_line.source_location_id, v_line.destination_location_id,
      v_line.lot_id, v_line.serial_id, v_line.unit_cost, v_line.currency,
      'Reversal of ' || v_original.document_number || ' line ' || v_line.line_number
    );

    v_line_effects := '[]'::jsonb;
    FOR v_orig_effect IN
      SELECT * FROM inventory_movement_type_effects
      WHERE movement_type_id = v_original.movement_type_id
      ORDER BY effect_order
    LOOP
      v_inverse_direction := CASE v_orig_effect.direction
        WHEN 'increase' THEN 'decrease'
        WHEN 'decrease' THEN 'increase'
        ELSE v_orig_effect.direction
      END;
      v_line_effects := v_line_effects || jsonb_build_array(jsonb_build_object(
        'id', v_orig_effect.id,
        'target', v_orig_effect.target,
        'balance_field', v_orig_effect.balance_field,
        'direction', v_inverse_direction,
        'effect_order', v_orig_effect.effect_order,
        'is_required', v_orig_effect.is_required
      ));
    END LOOP;

    IF jsonb_array_length(v_line_effects) = 0 THEN
      RAISE EXCEPTION 'Original movement type has no effects to invert for line %', v_line.line_number USING ERRCODE = 'P0002';
    END IF;

    v_explicit_effects := v_explicit_effects || jsonb_build_object(v_line_number::text, v_line_effects);
  END LOOP;

  IF v_line_number = 0 THEN
    RAISE EXCEPTION 'Original movement has no lines to reverse' USING ERRCODE = 'P0002';
  END IF;

  -- A PZ's own reservations that still sit where the PZ put the parts are
  -- released (with the reason) before the stock leaves.
  IF v_original.movement_type_code = '101' THEN
    FOR v_res IN
      SELECT rl.id, rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity AS remaining
      FROM public.inventory_reservation_lines rl
      JOIN public.inventory_movement_lines ml ON ml.id = rl.source_movement_line_id
      WHERE ml.movement_id = v_original.id
        AND rl.location_id = ml.destination_location_id
        AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0
      ORDER BY rl.created_at
      FOR UPDATE OF rl
    LOOP
      PERFORM public.inventory_reservation_release_internal(
        v_res.id, v_res.remaining, 'released',
        'Storno ' || COALESCE(v_original.document_number, '') || ': ' || v_reason,
        p_actor_user_id, v_reversal_id, NULL);
    END LOOP;
  END IF;

  v_finalize_result := public.inventory_finalize_posting_internal(v_reversal_id, p_actor_user_id, v_explicit_effects);

  UPDATE inventory_movement_headers
  SET status = 'reversed',
      reversal_movement_id = v_reversal_id,
      reversed_by = p_actor_user_id,
      reversed_at = now(),
      updated_at = now()
  WHERE id = v_original.id;

  INSERT INTO inventory_movement_audit_log (
    organization_id, movement_id, action, old_status, new_status,
    entity_type, entity_id, actor_user_id, reason_text,
    changes, transaction_id
  ) VALUES (
    v_original.organization_id, v_original.id, 'reversed', 'posted', 'reversed',
    'header', v_original.id, p_actor_user_id, v_reason,
    jsonb_build_object('reversal_movement_id', v_reversal_id, 'reversal_document_number', v_finalize_result->>'document_number'),
    txid_current()::text
  );

  RETURN jsonb_build_object(
    'status', 'posted',
    'reversal_movement_id', v_reversal_id,
    'reversal_document_number', v_finalize_result->>'document_number',
    'original_movement_id', v_original.id,
    'original_document_number', v_original.document_number
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('28000', '22023', 'P0002', 'P0003', 'P0005', 'P0006', 'P0007') THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'Movement reversal failed unexpectedly' USING ERRCODE = 'P0001';
END;
$function$;

-- PZ correction: the repair-order share it takes back is released first.
CREATE OR REPLACE FUNCTION public.inventory_post_receipt_correction(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_movement_id uuid, p_lines jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pz record;
  v_line jsonb;
  v_ml record;
  v_qty numeric;
  v_done numeric;
  v_remaining numeric;
  v_ro_remaining numeric;
  v_ro_take numeric;
  v_take numeric;
  v_link record;
  v_link_left numeric;
  v_engine_lines jsonb := '[]'::jsonb;
  v_meta jsonb := '[]'::jsonb;
  v_ro_takes jsonb;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_draft jsonb;
  v_movement_id uuid;
  v_posted jsonb;
  v_ml_ids uuid[];
  v_i integer;
  v_take_row jsonb;
  v_res record;
  v_rel_left numeric;
  v_rel numeric;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A correction reason is required' USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, document_number, status, movement_type_code INTO v_pz
  FROM public.inventory_movement_headers
  WHERE id = p_movement_id AND organization_id = p_organization_id AND branch_id = p_branch_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_pz.movement_type_code <> '101' OR v_pz.status <> 'posted' THEN
    RAISE EXCEPTION 'Only a posted PZ can be corrected' USING ERRCODE = '55000';
  END IF;

  PERFORM public.inventory_ensure_receipt_correction_type(p_organization_id);
  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := NULLIF(v_line->>'quantity', '')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id, variant_id, unit_id, quantity, destination_location_id INTO v_ml
    FROM public.inventory_movement_lines
    WHERE id = NULLIF(v_line->>'original_line_id', '')::uuid
      AND movement_id = p_movement_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line does not belong to this PZ' USING ERRCODE = '22023';
    END IF;

    IF v_ml.id = ANY (v_seen) THEN
      RAISE EXCEPTION 'A PZ line may appear only once per correction' USING ERRCODE = '22023';
    END IF;
    v_seen := array_append(v_seen, v_ml.id);

    SELECT COALESCE(SUM(c.quantity), 0) INTO v_done
    FROM public.inventory_movement_correction_lines c
    JOIN public.inventory_movement_headers h ON h.id = c.correction_movement_id
    WHERE c.original_line_id = v_ml.id AND h.status = 'posted';

    v_remaining := v_ml.quantity - v_done;
    IF v_qty > v_remaining THEN
      RAISE EXCEPTION 'Only % left to correct on this line', v_remaining USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(SUM(l.applied_quantity), 0) INTO v_ro_remaining
    FROM public.repair_order_line_movement_links l
    WHERE l.inventory_movement_line_id = v_ml.id AND l.relation_type = 'receipt';
    v_ro_remaining := v_ro_remaining - COALESCE((
      SELECT SUM(l.applied_quantity)
      FROM public.inventory_movement_correction_lines c
      JOIN public.inventory_movement_headers h ON h.id = c.correction_movement_id AND h.status = 'posted'
      JOIN public.repair_order_line_movement_links l
        ON l.inventory_movement_line_id = c.correction_line_id AND l.relation_type = 'reversal'
      WHERE c.original_line_id = v_ml.id
    ), 0);

    v_ro_take := GREATEST(v_qty - (v_remaining - GREATEST(v_ro_remaining, 0)), 0);
    v_ro_takes := '[]'::jsonb;
    FOR v_link IN
      SELECT l.repair_order_line_id, l.applied_quantity
      FROM public.repair_order_line_movement_links l
      WHERE l.inventory_movement_line_id = v_ml.id AND l.relation_type = 'receipt'
      ORDER BY l.created_at
    LOOP
      EXIT WHEN v_ro_take <= 0;
      v_link_left := v_link.applied_quantity - COALESCE((
        SELECT SUM(l2.applied_quantity)
        FROM public.inventory_movement_correction_lines c
        JOIN public.inventory_movement_headers h ON h.id = c.correction_movement_id AND h.status = 'posted'
        JOIN public.repair_order_line_movement_links l2
          ON l2.inventory_movement_line_id = c.correction_line_id AND l2.relation_type = 'reversal'
        WHERE c.original_line_id = v_ml.id AND l2.repair_order_line_id = v_link.repair_order_line_id
      ), 0);
      v_take := LEAST(v_ro_take, GREATEST(v_link_left, 0));
      IF v_take > 0 THEN
        v_ro_takes := v_ro_takes || jsonb_build_array(jsonb_build_object(
          'repair_order_line_id', v_link.repair_order_line_id, 'quantity', v_take));
        v_ro_take := v_ro_take - v_take;
      END IF;
    END LOOP;

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_ml.variant_id,
      'unit_id', v_ml.unit_id,
      'quantity', v_qty,
      'source_location_id', v_ml.destination_location_id,
      'note', NULL));
    v_meta := v_meta || jsonb_build_array(jsonb_build_object(
      'original_line_id', v_ml.id, 'quantity', v_qty, 'ro_takes', v_ro_takes,
      'location_id', v_ml.destination_location_id));
  END LOOP;

  IF jsonb_array_length(v_meta) = 0 THEN
    RAISE EXCEPTION 'At least one line with a positive quantity is required' USING ERRCODE = '22023';
  END IF;

  v_draft := public.inventory_create_draft(
    p_organization_id, p_branch_id, '102', v_engine_lines,
    NULL, NULL, NULL, v_pz.document_number, trim(p_reason), NULL, p_actor_user_id);
  v_movement_id := (v_draft->>'movement_id')::uuid;

  UPDATE public.inventory_movement_headers
  SET reference_type = 'movement_correction', reference_id = v_pz.id::text
  WHERE id = v_movement_id;

  SELECT array_agg(id ORDER BY line_number) INTO v_ml_ids
  FROM public.inventory_movement_lines WHERE movement_id = v_movement_id;

  -- The repair-order share taken back: release its reservations from this
  -- PZ line where they still sit (the receiving zone).
  FOR v_i IN 1..jsonb_array_length(v_meta)
  LOOP
    FOR v_take_row IN SELECT * FROM jsonb_array_elements(v_meta->(v_i - 1)->'ro_takes')
    LOOP
      v_rel_left := (v_take_row->>'quantity')::numeric;
      FOR v_res IN
        SELECT rl.id, rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity AS remaining
        FROM public.inventory_reservation_lines rl
        JOIN public.inventory_reservations r ON r.id = rl.reservation_id
        WHERE rl.source_movement_line_id = (v_meta->(v_i - 1)->>'original_line_id')::uuid
          AND rl.location_id = (v_meta->(v_i - 1)->>'location_id')::uuid
          AND COALESCE(rl.repair_order_line_id,
                       CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END)
              = (v_take_row->>'repair_order_line_id')::uuid
          AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0
        ORDER BY rl.created_at
        FOR UPDATE OF rl
      LOOP
        EXIT WHEN v_rel_left <= 0;
        v_rel := LEAST(v_rel_left, v_res.remaining);
        PERFORM public.inventory_reservation_release_internal(
          v_res.id, v_rel, 'released',
          'Korekta PZ ' || COALESCE(v_pz.document_number, '') || ': ' || trim(p_reason),
          p_actor_user_id, v_movement_id, v_ml_ids[v_i]);
        v_rel_left := v_rel_left - v_rel;
      END LOOP;
    END LOOP;
  END LOOP;

  v_posted := public.inventory_finalize_posting(v_movement_id, p_actor_user_id);

  FOR v_i IN 1..jsonb_array_length(v_meta)
  LOOP
    INSERT INTO public.inventory_movement_correction_lines (
      organization_id, branch_id, correction_movement_id, correction_line_id,
      original_movement_id, original_line_id, quantity
    ) VALUES (
      p_organization_id, p_branch_id, v_movement_id, v_ml_ids[v_i],
      v_pz.id, (v_meta->(v_i - 1)->>'original_line_id')::uuid, (v_meta->(v_i - 1)->>'quantity')::numeric
    );

    FOR v_take_row IN SELECT * FROM jsonb_array_elements(v_meta->(v_i - 1)->'ro_takes')
    LOOP
      PERFORM public.write_repair_order_line_movement_link_internal(
        (v_take_row->>'repair_order_line_id')::uuid, v_ml_ids[v_i],
        (v_take_row->>'quantity')::numeric, 'reversal');
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'document_number', v_posted->>'document_number',
    'line_count', jsonb_array_length(v_meta),
    'original_movement_id', v_pz.id);
END;
$function$;

-- Closing / archiving a repair order releases its open reservations.
CREATE OR REPLACE FUNCTION public.repair_orders_release_reservations_on_close()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_res record;
BEGIN
  IF OLD.status = 'open' AND NEW.status <> 'open' THEN
    FOR v_res IN
      SELECT rl.id, rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity AS remaining
      FROM public.inventory_reservation_lines rl
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      JOIN public.repair_order_lines rol
        ON rol.id = COALESCE(rl.repair_order_line_id,
                             CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END)
      WHERE rol.repair_order_id = NEW.id
        AND r.status <> 'cancelled' AND r.deleted_at IS NULL
        AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0
      ORDER BY rl.created_at
      FOR UPDATE OF rl
    LOOP
      PERFORM public.inventory_reservation_release_internal(
        v_res.id, v_res.remaining, 'released',
        CASE WHEN NEW.status = 'closed' THEN 'Zamknięcie zlecenia ' ELSE 'Archiwizacja zlecenia ' END
          || COALESCE(NEW.zl_number, ''),
        auth.uid(), NULL, NULL);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER repair_orders_release_reservations_on_close
  AFTER UPDATE OF status ON public.repair_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.repair_orders_release_reservations_on_close();

REVOKE ALL ON FUNCTION public.repair_orders_release_reservations_on_close() FROM PUBLIC, anon, authenticated;
