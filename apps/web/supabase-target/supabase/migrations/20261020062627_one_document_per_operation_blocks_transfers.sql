-- ============================================================================
-- One operation on many parts = one document (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- 1. Putaway: putting away a selection posts ONE MM with a line per part and
--    ONE KON per repair-order container, instead of an MM and a KON per part.
--    inventory_putaway_internal does the work; inventory_putaway_batch (scan
--    flow) and inventory_putaway_from_receiving (one part from the desktop)
--    are now thin wrappers around it, so there is a single path.
--    A part's reserved quantity still moves with it (same REZ, 'moved' event
--    with the MM); what was not reserved yet is reserved on one new REZ per
--    repair order of the batch.
-- 2. Moving blocked parts: inventory_move_blocked_stock_lines takes a list,
--    posts ONE MM, the blocks move with the parts. The single-line function
--    calls it.
-- 3. Moving reservations to another repair order:
--    inventory_transfer_reservation_lines takes a list of parts for ONE target
--    order and creates ONE new REZ. The single-line function calls it.
-- Existing movements and documents are not touched.
-- ============================================================================

-- 2. Moving blocked parts -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_move_blocked_stock_lines(
  p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid,
  p_lines jsonb, p_destination_location_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_line jsonb;
  v_bl public.inventory_stock_block_lines%ROWTYPE;
  v_qty numeric;
  v_open numeric;
  v_unit uuid;
  v_items jsonb := '[]'::jsonb;
  v_engine jsonb := '[]'::jsonb;
  v_item jsonb;
  v_mm jsonb;
  v_mm_id uuid;
  v_ml_ids uuid[];
  v_i integer := 0;
  v_new_line uuid;
  v_results jsonb := '[]'::jsonb;
  v_block uuid;
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
  IF p_destination_location_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id AND organization_id = p_organization_id AND branch_id = p_branch_id
      AND can_store_inventory = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination is not a valid stock location of this branch' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_bl FROM public.inventory_stock_block_lines
    WHERE id = NULLIF(v_line->>'block_line_id', '')::uuid
      AND organization_id = p_organization_id AND branch_id = p_branch_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Block not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_bl.location_id = p_destination_location_id THEN
      RAISE EXCEPTION 'Destination is not a valid stock location of this branch' USING ERRCODE = '22023';
    END IF;

    v_open := v_bl.blocked_quantity - v_bl.unblocked_quantity - v_bl.moved_quantity - v_bl.consumed_quantity;
    v_qty := COALESCE(NULLIF(v_line->>'quantity', '')::numeric, v_open);

    SELECT p.base_unit_id INTO v_unit
    FROM public.inventory_variants v JOIN public.inventory_products p ON p.id = v.product_id
    WHERE v.id = v_bl.variant_id;

    PERFORM public.inventory_stock_block_take_internal(v_bl.id, v_qty, 'moved');

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'block_line_id', v_bl.id, 'block_id', v_bl.block_id, 'variant_id', v_bl.variant_id,
      'quantity', v_qty));
    v_engine := v_engine || jsonb_build_array(jsonb_build_object(
      'variant_id', v_bl.variant_id, 'unit_id', v_unit, 'quantity', v_qty,
      'source_location_id', v_bl.location_id, 'destination_location_id', p_destination_location_id,
      'note', NULL));
  END LOOP;

  v_mm := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '801', v_engine,
    NULL, NULL, NULL, NULL, NULL, NULL, p_actor_user_id);
  v_mm_id := (v_mm->>'movement_id')::uuid;
  SELECT array_agg(id ORDER BY line_number) INTO v_ml_ids
  FROM public.inventory_movement_lines WHERE movement_id = v_mm_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_i := v_i + 1;
    v_new_line := public.inventory_stock_block_add_line_internal(
      (v_item->>'block_id')::uuid, (v_item->>'variant_id')::uuid, p_destination_location_id,
      (v_item->>'quantity')::numeric, NULL, (v_item->>'block_line_id')::uuid);
    PERFORM public.inventory_stock_block_log_internal(
      (v_item->>'block_line_id')::uuid, 'moved', (v_item->>'quantity')::numeric,
      p_destination_location_id, v_mm_id, v_ml_ids[v_i], NULL,
      'Przeniesienie ' || COALESCE(v_mm->>'document_number', ''), p_actor_user_id);
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'block_line_id', v_new_line, 'from_block_line_id', v_item->>'block_line_id',
      'quantity', (v_item->>'quantity')::numeric));
  END LOOP;

  FOR v_block IN SELECT DISTINCT (value->>'block_id')::uuid FROM jsonb_array_elements(v_items)
  LOOP
    PERFORM public.inventory_stock_block_refresh_status_internal(v_block);
  END LOOP;

  RETURN jsonb_build_object(
    'movement_id', v_mm_id, 'document_number', v_mm->>'document_number', 'lines', v_results);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_move_blocked_stock_lines(uuid, uuid, uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_move_blocked_stock_lines(uuid, uuid, uuid, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.inventory_move_blocked_stock(
  p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_block_line_id uuid,
  p_quantity numeric, p_destination_location_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.inventory_move_blocked_stock_lines(
    p_actor_user_id, p_organization_id, p_branch_id,
    jsonb_build_array(jsonb_build_object('block_line_id', p_block_line_id, 'quantity', p_quantity)),
    p_destination_location_id);
  RETURN jsonb_build_object(
    'block_line_id', v_result->'lines'->0->'block_line_id',
    'movement_id', v_result->'movement_id',
    'document_number', v_result->'document_number',
    'quantity', v_result->'lines'->0->'quantity');
END;
$function$;

-- 3. Moving reservations to another repair order ------------------------------

CREATE OR REPLACE FUNCTION public.inventory_transfer_reservation_lines(
  p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid,
  p_lines jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_line jsonb;
  v_rl record;
  v_src_rol uuid;
  v_src_zl text;
  v_qty numeric;
  v_remaining numeric;
  v_target record;
  v_target_ro uuid;
  v_need numeric;
  v_res_id uuid;
  v_number text;
  v_new_line uuid;
  v_results jsonb := '[]'::jsonb;
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
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT rl.*, COALESCE(rl.repair_order_line_id,
                          CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) AS rol_id
    INTO v_rl
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    WHERE rl.id = NULLIF(v_line->>'reservation_line_id', '')::uuid
      AND rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
      AND r.deleted_at IS NULL
    FOR UPDATE OF rl;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reservation not found' USING ERRCODE = 'P0002';
    END IF;
    v_src_rol := v_rl.rol_id;

    v_remaining := v_rl.reserved_quantity - v_rl.released_quantity - v_rl.fulfilled_quantity;
    v_qty := COALESCE(NULLIF(v_line->>'quantity', '')::numeric, v_remaining);
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
    END IF;
    IF v_qty > v_remaining THEN
      RAISE EXCEPTION 'Only % can be transferred (parts already in a container are taken out of it first)', v_remaining
        USING ERRCODE = '22023';
    END IF;

    SELECT rol.id, rol.variant_id, ro.id AS repair_order_id, ro.zl_number, ro.status
    INTO v_target
    FROM public.repair_order_lines rol
    JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
    WHERE rol.id = NULLIF(v_line->>'target_repair_order_line_id', '')::uuid
      AND rol.deleted_at IS NULL AND ro.deleted_at IS NULL
      AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id
    FOR UPDATE OF rol;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target repair-order line not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target_ro IS NULL THEN
      v_target_ro := v_target.repair_order_id;
    ELSIF v_target.repair_order_id <> v_target_ro THEN
      RAISE EXCEPTION 'All parts must go to the same repair order' USING ERRCODE = '22023';
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
    IF v_qty > GREATEST(v_need, 0) THEN
      RAISE EXCEPTION 'The target repair order still needs only %', GREATEST(v_need, 0) USING ERRCODE = '22023';
    END IF;

    SELECT ro.zl_number INTO v_src_zl
    FROM public.repair_order_lines rol JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
    WHERE rol.id = v_src_rol;

    PERFORM public.inventory_reservation_release_internal(v_rl.id, v_qty, 'moved', NULL, p_actor_user_id);
    PERFORM public.inventory_reservation_log_internal(
      v_rl.id, 'transferred', v_qty, v_rl.location_id, NULL, NULL, NULL,
      'Przeniesienie na ' || COALESCE(v_target.zl_number, '') || ': ' || v_reason,
      p_actor_user_id, v_target.id);

    IF v_res_id IS NULL THEN
      v_number := public.inventory_next_commitment_number_internal(p_organization_id, 'reservation', p_actor_user_id);
      INSERT INTO public.inventory_reservations (
        organization_id, branch_id, reservation_number, reference_type, reference_id,
        reference_number, notes, created_by
      ) VALUES (
        p_organization_id, p_branch_id, v_number, 'repair_order', v_target.repair_order_id,
        v_target.zl_number, 'Przeniesienie z ' || COALESCE(v_src_zl, '') || ': ' || v_reason, p_actor_user_id
      )
      RETURNING id INTO v_res_id;
    END IF;

    v_new_line := public.inventory_reservation_add_line_internal(
      v_res_id, v_rl.variant_id, v_rl.location_id, v_qty, v_target.id,
      v_rl.source_movement_line_id, v_rl.id, p_actor_user_id);
    PERFORM public.inventory_reservation_log_internal(
      v_new_line, 'created', v_qty, v_rl.location_id, NULL, NULL, NULL,
      'Przeniesienie z ' || COALESCE(v_src_zl, '') || ': ' || v_reason, p_actor_user_id);

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'reservation_line_id', v_new_line, 'quantity', v_qty,
      'from_repair_order_line_id', v_src_rol, 'to_repair_order_line_id', v_target.id));
  END LOOP;

  RETURN jsonb_build_object(
    'reservation_id', v_res_id, 'reservation_number', v_number, 'lines', v_results);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_transfer_reservation_lines(uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_transfer_reservation_lines(uuid, uuid, uuid, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.inventory_transfer_reservation(
  p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_reservation_line_id uuid,
  p_quantity numeric, p_target_repair_order_line_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
  END IF;
  v_result := public.inventory_transfer_reservation_lines(
    p_actor_user_id, p_organization_id, p_branch_id,
    jsonb_build_array(jsonb_build_object(
      'reservation_line_id', p_reservation_line_id, 'quantity', p_quantity,
      'target_repair_order_line_id', p_target_repair_order_line_id)),
    p_reason);
  RETURN jsonb_build_object(
    'reservation_id', v_result->'reservation_id',
    'reservation_number', v_result->'reservation_number',
    'reservation_line_id', v_result->'lines'->0->'reservation_line_id',
    'quantity', v_result->'lines'->0->'quantity',
    'from_repair_order_line_id', v_result->'lines'->0->'from_repair_order_line_id',
    'to_repair_order_line_id', v_result->'lines'->0->'to_repair_order_line_id');
END;
$function$;
