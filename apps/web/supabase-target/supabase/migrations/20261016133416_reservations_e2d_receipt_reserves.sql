-- ============================================================================
-- Reservations & blocks, stage E2/E3 part D (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- A posted PZ reserves its parts for their repair orders:
-- * inventory_attribute_receipt_to_repair_orders now creates, for every PZ
--   line matched to a repair-order line (ZL + part code, open order, same
--   branch, up to what the line still needs), a reservation document
--   REZ/... on the location the PZ put the parts (the receiving zone), with
--   the PZ line as its source and a 'created' event. The receipt link stays
--   as the document relation PZ line <-> repair-order line.
-- * inventory_create_and_finalize_receipt: posts the PZ and reserves in ONE
--   transaction (all or nothing).
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

      -- The received quantity is reserved for the repair-order line where it landed.
      v_res_number := public.inventory_next_commitment_number_internal(
        v_header.organization_id, 'reservation', p_actor_user_id);
      INSERT INTO public.inventory_reservations (
        organization_id, branch_id, reservation_number, reference_type, reference_id,
        reference_number, notes, created_by
      ) VALUES (
        v_header.organization_id, v_header.branch_id, v_res_number, 'repair_order_line', v_rol.id,
        v_zl, 'Przyjęcie ' || COALESCE(v_header.document_number, ''), p_actor_user_id
      )
      RETURNING id INTO v_res_id;

      PERFORM public.inventory_reservation_add_line_internal(
        v_res_id, v_ml.variant_id, v_ml.destination_location_id, v_apply,
        v_rol.id, v_ml.id, NULL, p_actor_user_id,
        'Przyjęcie ' || COALESCE(v_header.document_number, ''));

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

-- PZ + reservations in one transaction. p_attribution: [{line_index (1-based,
-- the PZ line order), zl_number, product_code}].
CREATE OR REPLACE FUNCTION public.inventory_create_and_finalize_receipt(
  p_organization_id uuid,
  p_branch_id uuid,
  p_lines jsonb,
  p_operation_date date DEFAULT NULL,
  p_document_date date DEFAULT NULL,
  p_counterparty_name text DEFAULT NULL,
  p_external_reference text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_attribution jsonb DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_posted jsonb;
  v_movement_id uuid;
  v_ids uuid[];
  v_attr_lines jsonb := '[]'::jsonb;
  v_item jsonb;
  v_index integer;
  v_attribution jsonb;
BEGIN
  v_posted := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '101', p_lines,
    p_operation_date, p_document_date, p_counterparty_name, p_external_reference,
    p_note, p_idempotency_key, p_actor_user_id);

  IF p_attribution IS NULL OR jsonb_typeof(p_attribution) <> 'array' OR jsonb_array_length(p_attribution) = 0 THEN
    RETURN v_posted;
  END IF;

  v_movement_id := (v_posted->>'movement_id')::uuid;
  SELECT array_agg(id ORDER BY line_number) INTO v_ids
  FROM public.inventory_movement_lines
  WHERE movement_id = v_movement_id AND deleted_at IS NULL;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_attribution)
  LOOP
    v_index := NULLIF(v_item->>'line_index', '')::integer;
    IF v_index IS NULL OR v_index < 1 OR v_index > COALESCE(array_length(v_ids, 1), 0) THEN
      CONTINUE;
    END IF;
    v_attr_lines := v_attr_lines || jsonb_build_array(jsonb_build_object(
      'movement_line_id', v_ids[v_index],
      'zl_number', v_item->>'zl_number',
      'product_code', v_item->>'product_code'));
  END LOOP;

  v_attribution := public.inventory_attribute_receipt_to_repair_orders(p_actor_user_id, v_movement_id, v_attr_lines);
  RETURN v_posted || jsonb_build_object('attribution', v_attribution);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_create_and_finalize_receipt(uuid, uuid, jsonb, date, date, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_and_finalize_receipt(uuid, uuid, jsonb, date, date, text, text, text, text, uuid, jsonb) TO authenticated;
