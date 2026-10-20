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

-- 1. Putaway ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_putaway_internal(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_container_id uuid,
  p_lines jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving uuid;
  v_line jsonb;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_i integer := 0;
  v_variant uuid;
  v_qty numeric;
  v_rol_id uuid;
  v_product record;
  v_handling text;
  v_rol record;
  v_container_ro uuid;
  v_free jsonb := '{}'::jsonb;
  v_pending jsonb;
  v_key text;
  v_req numeric;
  v_on_hand numeric;
  v_attributed numeric;
  v_consumed jsonb := '{}'::jsonb;
  v_physical numeric;
  v_total_known numeric;
  v_available numeric;
  v_already numeric;
  v_contribution record;
  v_src record;
  v_take numeric;
  v_left numeric;
  v_moved jsonb := '{}'::jsonb;
  v_moved_i jsonb;
  v_engine jsonb := '[]'::jsonb;
  v_mm jsonb;
  v_movement_id uuid;
  v_doc text;
  v_ml_ids uuid[];
  v_ml uuid;
  v_mv record;
  v_new_line uuid;
  v_reserved numeric;
  v_need numeric;
  v_rest numeric;
  v_res_docs jsonb := '{}'::jsonb;
  v_res_id uuid;
  v_res_number text;
  v_dest jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_ro_id uuid;
  v_ro_zl text;
  v_cid uuid;
  v_ccode text;
  v_container_created boolean;
  v_containers jsonb := '{}'::jsonb;
  v_code text;
  v_n integer;
  v_alloc_lines jsonb;
  v_single_res uuid;
  v_alloc jsonb;
  v_al record;
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

  v_receiving := public.resolve_branch_receiving_location(p_organization_id, p_branch_id);

  IF p_location_id IS NULL OR p_location_id = v_receiving OR NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_location_id AND organization_id = p_organization_id
      AND branch_id = p_branch_id AND can_store_inventory = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination is not a valid stockable location in this branch' USING ERRCODE = '22023';
  END IF;

  IF p_container_id IS NOT NULL THEN
    SELECT reference_id::uuid INTO v_container_ro
    FROM public.inventory_containers
    WHERE id = p_container_id AND organization_id = p_organization_id AND branch_id = p_branch_id
      AND reference_type = 'repair_order' AND current_location_id = p_location_id
      AND status IN ('active', 'empty') AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Container does not belong to this repair order at this location' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Parse and check every line before anything moves.
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_i := v_i + 1;
    v_variant := NULLIF(v_line->>'variant_id', '')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_rol_id := NULLIF(v_line->>'repair_order_line_id', '')::uuid;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
    END IF;

    SELECT p.id, p.base_unit_id INTO v_product
    FROM public.inventory_variants v
    JOIN public.inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
    WHERE v.id = v_variant AND v.organization_id = p_organization_id AND v.deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT COALESCE(handling_mode, 'standard') INTO v_handling
    FROM public.inventory_product_branch_settings
    WHERE product_id = v_product.id AND branch_id = p_branch_id;
    v_handling := COALESCE(v_handling, 'standard');

    IF v_rol_id IS NULL THEN
      IF p_container_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only repair-order parts go into a repair-order container' USING ERRCODE = '22023';
      END IF;
      v_free := v_free || jsonb_build_object(
        v_variant::text, COALESCE((v_free->>v_variant::text)::numeric, 0) + v_qty);
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'idx', v_i, 'variant_id', v_variant, 'unit_id', v_product.base_unit_id,
        'quantity', v_qty, 'handling', v_handling));
    ELSE
      SELECT rol.id, rol.variant_id, rol.ordered_quantity, ro.id AS repair_order_id, ro.zl_number
      INTO v_rol
      FROM public.repair_order_lines rol
      JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
      WHERE rol.id = v_rol_id AND rol.deleted_at IS NULL AND ro.deleted_at IS NULL
        AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id
      FOR UPDATE OF rol;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'RepairOrderLine not found' USING ERRCODE = 'P0002';
      END IF;
      IF v_rol.variant_id IS NOT NULL AND v_rol.variant_id <> v_variant THEN
        RAISE EXCEPTION 'Item does not match the RepairOrderLine''s product' USING ERRCODE = '22023';
      END IF;
      IF p_container_id IS NOT NULL AND v_rol.repair_order_id IS DISTINCT FROM v_container_ro THEN
        RAISE EXCEPTION 'A part of another repair order cannot go into this container' USING ERRCODE = '22023';
      END IF;
      IF v_rol.variant_id IS NULL THEN
        UPDATE public.repair_order_lines SET variant_id = v_variant, updated_at = now() WHERE id = v_rol.id;
      END IF;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'idx', v_i, 'variant_id', v_variant, 'unit_id', v_product.base_unit_id,
        'quantity', v_qty, 'handling', v_handling,
        'repair_order_line_id', v_rol.id, 'repair_order_id', v_rol.repair_order_id,
        'zl_number', v_rol.zl_number, 'ordered_quantity', v_rol.ordered_quantity));
    END IF;
  END LOOP;

  -- Free stock: what lies in the receiving zone minus what belongs to orders.
  IF v_free <> '{}'::jsonb THEN
    v_pending := public.inventory_receiving_pending(p_organization_id, p_branch_id);
    FOR v_key, v_req IN SELECT key, value::numeric FROM jsonb_each_text(v_free)
    LOOP
      PERFORM 1 FROM public.inventory_balances
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND location_id = v_receiving AND variant_id = v_key::uuid
      FOR UPDATE;

      SELECT COALESCE(SUM((it->>'quantity')::numeric), 0) INTO v_attributed
      FROM jsonb_array_elements(v_pending->'items') it
      WHERE (it->>'variant_id')::uuid = v_key::uuid AND it->>'repair_order_line_id' IS NOT NULL;

      v_on_hand := NULL;
      SELECT on_hand_quantity INTO v_on_hand
      FROM public.inventory_balances
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND location_id = v_receiving AND variant_id = v_key::uuid;

      IF COALESCE(v_on_hand, 0) - v_attributed < v_req THEN
        RAISE EXCEPTION 'Not enough free stock of this item in the receiving zone' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  -- Repair-order parts: what the receipt links say is in the receiving zone
  -- for each line (same check as putaway_repair_order_stock, A8).
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) WHERE value ? 'repair_order_line_id'
  LOOP
    v_i := (v_item->>'idx')::integer;
    v_rol_id := (v_item->>'repair_order_line_id')::uuid;
    v_variant := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    PERFORM on_hand_quantity FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving AND variant_id = v_variant
    FOR UPDATE;

    v_physical := NULL;
    SELECT on_hand_quantity INTO v_physical
    FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving AND variant_id = v_variant;
    v_physical := COALESCE(v_physical, 0);

    v_total_known := 0;
    v_available := 0;
    FOR v_contribution IN
      SELECT rol.id AS repair_order_line_id,
        SUM(
          CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
          * sle.quantity * (rolml.applied_quantity / iml.quantity)
        ) AS net_qty
      FROM public.repair_order_line_movement_links rolml
      JOIN public.repair_order_lines rol ON rol.id = rolml.repair_order_line_id
      JOIN public.inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
      JOIN public.inventory_movement_headers imh_orig ON imh_orig.id = iml.movement_id
      JOIN LATERAL (
        SELECT iml.id AS ml_id
        UNION ALL
        SELECT rev_line.id
        FROM public.inventory_movement_lines rev_line
        WHERE imh_orig.reversal_movement_id IS NOT NULL
          AND rev_line.movement_id = imh_orig.reversal_movement_id
          AND rev_line.line_number = iml.line_number
      ) candidate ON true
      JOIN public.inventory_stock_ledger_entries sle
        ON sle.movement_line_id = candidate.ml_id AND sle.balance_field = 'on_hand'
      WHERE iml.organization_id = p_organization_id AND iml.branch_id = p_branch_id
        AND sle.location_id = v_receiving AND sle.variant_id = v_variant
      GROUP BY rol.id
      HAVING SUM(
        CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
        * sle.quantity * (rolml.applied_quantity / iml.quantity)
      ) <> 0
    LOOP
      IF v_contribution.net_qty < 0 THEN
        RAISE EXCEPTION 'Line %: attribution history at the receiving location is inconsistent -- putaway is not permitted until it is reconciled', v_i
          USING ERRCODE = 'P0008';
      END IF;
      v_total_known := v_total_known + v_contribution.net_qty;
      IF v_contribution.repair_order_line_id = v_rol_id THEN
        v_available := v_contribution.net_qty;
      END IF;
    END LOOP;

    IF v_total_known > v_physical THEN
      RAISE EXCEPTION 'Line %: attribution history at the receiving location is inconsistent -- putaway is not permitted until it is reconciled', v_i
        USING ERRCODE = 'P0008';
    END IF;

    v_already := COALESCE((v_consumed->>(v_rol_id::text))::numeric, 0);
    v_available := v_available - v_already;
    IF v_available < v_qty THEN
      RAISE EXCEPTION 'Line % requests % but only % is currently attributed to this RepairOrderLine at the receiving location', v_i, v_qty, v_available
        USING ERRCODE = '22023';
    END IF;
    v_consumed := jsonb_set(v_consumed, ARRAY[v_rol_id::text], to_jsonb(v_already + v_qty));

    -- Its reservation leaves the receiving zone with it (re-added at the
    -- destination once the MM is posted).
    v_left := v_qty;
    v_moved_i := '[]'::jsonb;
    FOR v_src IN
      SELECT rl.id, rl.reservation_id,
             rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity AS remaining
      FROM public.inventory_reservation_lines rl
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      WHERE rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
        AND rl.location_id = v_receiving AND rl.variant_id = v_variant
        AND COALESCE(rl.repair_order_line_id,
                     CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = v_rol_id
        AND r.status <> 'cancelled' AND r.deleted_at IS NULL
        AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0
      ORDER BY rl.created_at
      FOR UPDATE OF rl
    LOOP
      EXIT WHEN v_left <= 0;
      v_take := LEAST(v_left, v_src.remaining);
      PERFORM public.inventory_reservation_release_internal(v_src.id, v_take, 'moved', NULL, p_actor_user_id);
      v_moved_i := v_moved_i || jsonb_build_array(jsonb_build_object(
        'line_id', v_src.id, 'reservation_id', v_src.reservation_id, 'quantity', v_take));
      v_left := v_left - v_take;
    END LOOP;
    v_moved := v_moved || jsonb_build_object(v_i::text, v_moved_i);
  END LOOP;

  -- ONE MM for every part of the selection.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_engine := v_engine || jsonb_build_array(jsonb_build_object(
      'variant_id', v_item->>'variant_id', 'unit_id', v_item->>'unit_id',
      'quantity', (v_item->>'quantity')::numeric,
      'source_location_id', v_receiving, 'destination_location_id', p_location_id, 'note', NULL));
  END LOOP;

  v_mm := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '801', v_engine,
    NULL, NULL, NULL, NULL, NULL, NULL, p_actor_user_id);
  v_movement_id := (v_mm->>'movement_id')::uuid;
  v_doc := v_mm->>'document_number';

  SELECT array_agg(id ORDER BY line_number) INTO v_ml_ids
  FROM public.inventory_movement_lines WHERE movement_id = v_movement_id;

  -- Per part: relocation link, reservation at the destination.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_i := (v_item->>'idx')::integer;
    v_ml := v_ml_ids[v_i];
    v_variant := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    IF NOT v_item ? 'repair_order_line_id' THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'mode', 'free', 'movement_id', v_movement_id, 'document_number', v_doc,
        'destination_location_id', p_location_id, 'quantity', v_qty, 'variant_id', v_variant));
      CONTINUE;
    END IF;

    v_rol_id := (v_item->>'repair_order_line_id')::uuid;
    v_ro_id := (v_item->>'repair_order_id')::uuid;
    v_ro_zl := v_item->>'zl_number';

    BEGIN
      PERFORM public.write_repair_order_line_movement_link_internal(v_rol_id, v_ml, v_qty, 'relocation');
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;

    v_reserved := 0;
    FOR v_mv IN
      SELECT * FROM jsonb_to_recordset(COALESCE(v_moved->(v_i::text), '[]'::jsonb))
        AS x(line_id uuid, reservation_id uuid, quantity numeric)
    LOOP
      v_new_line := public.inventory_reservation_add_line_internal(
        v_mv.reservation_id, v_variant, p_location_id, v_mv.quantity,
        v_rol_id, v_ml, v_mv.line_id, p_actor_user_id);
      PERFORM public.inventory_reservation_log_internal(
        v_new_line, 'moved', v_mv.quantity, v_receiving, p_location_id,
        v_movement_id, v_ml, 'Rozlokowanie ' || COALESCE(v_doc, ''), p_actor_user_id);
      v_dest := v_dest || jsonb_build_array(jsonb_build_object(
        'repair_order_id', v_ro_id, 'zl_number', v_ro_zl, 'handling', v_item->>'handling',
        'variant_id', v_variant, 'line_id', v_new_line,
        'reservation_id', v_mv.reservation_id, 'quantity', v_mv.quantity));
      v_reserved := v_reserved + v_mv.quantity;
    END LOOP;

    -- Not reserved yet (e.g. received before reservations existed): reserve
    -- what the order still needs, on one REZ per order for this batch.
    v_rest := v_qty - v_reserved;
    IF v_rest > 0 THEN
      SELECT (v_item->>'ordered_quantity')::numeric
             - COALESCE(SUM(rl.reserved_quantity - rl.released_quantity), 0)
      INTO v_need
      FROM public.inventory_reservation_lines rl
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      WHERE COALESCE(rl.repair_order_line_id,
                     CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = v_rol_id
        AND r.status <> 'cancelled' AND r.deleted_at IS NULL;
      v_rest := LEAST(v_rest, GREATEST(COALESCE(v_need, (v_item->>'ordered_quantity')::numeric), 0));

      IF v_rest > 0 THEN
        IF v_res_docs ? v_ro_id::text THEN
          v_res_id := (v_res_docs->>(v_ro_id::text))::uuid;
        ELSE
          v_res_number := public.inventory_next_commitment_number_internal(
            p_organization_id, 'reservation', p_actor_user_id);
          INSERT INTO public.inventory_reservations (
            organization_id, branch_id, reservation_number, reference_type, reference_id,
            reference_number, notes, created_by
          ) VALUES (
            p_organization_id, p_branch_id, v_res_number, 'repair_order', v_ro_id,
            v_ro_zl, 'Rozlokowanie ' || COALESCE(v_doc, ''), p_actor_user_id
          )
          RETURNING id INTO v_res_id;
          v_res_docs := v_res_docs || jsonb_build_object(v_ro_id::text, v_res_id);
        END IF;

        v_new_line := public.inventory_reservation_add_line_internal(
          v_res_id, v_variant, p_location_id, v_rest, v_rol_id, v_ml, NULL, p_actor_user_id,
          'Rozlokowanie ' || COALESCE(v_doc, ''));
        v_dest := v_dest || jsonb_build_array(jsonb_build_object(
          'repair_order_id', v_ro_id, 'zl_number', v_ro_zl, 'handling', v_item->>'handling',
          'variant_id', v_variant, 'line_id', v_new_line,
          'reservation_id', v_res_id, 'quantity', v_rest));
        v_reserved := v_reserved + v_rest;
      END IF;
    END IF;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'mode', CASE WHEN v_item->>'handling' = 'bulk' THEN 'bulk' ELSE 'container' END,
      'movement_id', v_movement_id, 'document_number', v_doc,
      'destination_location_id', p_location_id, 'quantity', v_qty,
      'reserved_quantity', v_reserved, 'variant_id', v_variant,
      'repair_order_line_id', v_rol_id, 'repair_order_id', v_ro_id, 'zl_number', v_ro_zl));
  END LOOP;

  -- Per repair order: its container at the destination and ONE KON with
  -- every part that goes into it (bulk items stay loose and reserved).
  FOR v_ro_id IN
    SELECT DISTINCT (d->>'repair_order_id')::uuid
    FROM jsonb_array_elements(v_dest) d
    WHERE d->>'handling' <> 'bulk'
  LOOP
    SELECT d->>'zl_number' INTO v_ro_zl
    FROM jsonb_array_elements(v_dest) d
    WHERE (d->>'repair_order_id')::uuid = v_ro_id LIMIT 1;

    v_cid := NULL;
    v_ccode := NULL;
    v_container_created := false;
    IF p_container_id IS NOT NULL THEN
      SELECT id, code INTO v_cid, v_ccode FROM public.inventory_containers WHERE id = p_container_id;
    ELSE
      SELECT id, code INTO v_cid, v_ccode FROM public.inventory_containers
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND reference_type = 'repair_order' AND reference_id = v_ro_id::text
        AND current_location_id = p_location_id
        AND status IN ('active', 'empty') AND deleted_at IS NULL
      ORDER BY (status = 'active') DESC, created_at
      LIMIT 1;
    END IF;

    IF v_cid IS NULL THEN
      SELECT count(*) + 1 INTO v_n FROM public.inventory_containers
      WHERE organization_id = p_organization_id AND reference_type = 'repair_order'
        AND reference_id = v_ro_id::text AND deleted_at IS NULL;
      LOOP
        v_code := 'K-' || COALESCE(v_ro_zl, 'ZL') || '-' || lpad(v_n::text, 2, '0');
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.inventory_containers
          WHERE organization_id = p_organization_id AND branch_id = p_branch_id
            AND lower(code) = lower(v_code) AND deleted_at IS NULL);
        v_n := v_n + 1;
      END LOOP;
      SELECT (c->>'container_id')::uuid, v_code INTO v_cid, v_ccode
      FROM (SELECT public.inventory_create_container(
        p_actor_user_id, p_organization_id, p_branch_id, v_code, p_location_id,
        'container', 'repair_order', v_ro_id::text) AS c) x;
      v_container_created := true;
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
             'variant_id', d->>'variant_id', 'location_id', p_location_id,
             'quantity', (d->>'quantity')::numeric, 'reservation_line_id', d->>'line_id')),
           CASE WHEN count(DISTINCT d->>'reservation_id') = 1
                THEN (min(d->>'reservation_id'))::uuid END
    INTO v_alloc_lines, v_single_res
    FROM jsonb_array_elements(v_dest) d
    WHERE (d->>'repair_order_id')::uuid = v_ro_id AND d->>'handling' <> 'bulk';

    v_alloc := public.inventory_create_allocation(
      p_organization_id, p_branch_id, v_alloc_lines, v_single_res,
      'repair_order', v_ro_id, v_ro_zl, p_actor_user_id);

    FOR v_al IN
      SELECT id, allocated_quantity FROM public.inventory_allocation_lines
      WHERE allocation_id = (v_alloc->>'allocation_id')::uuid
    LOOP
      PERFORM public.repair_order_add_allocation_to_container(
        p_actor_user_id, p_organization_id, p_branch_id, v_cid, v_al.id, v_al.allocated_quantity);
    END LOOP;

    v_containers := v_containers || jsonb_build_object(v_ro_id::text, jsonb_build_object(
      'id', v_cid, 'code', v_ccode, 'created', v_container_created,
      'allocation_number', v_alloc->>'allocation_number'));
  END LOOP;

  SELECT COALESCE(jsonb_agg(
           CASE
             WHEN r->>'mode' = 'free' THEN r
             ELSE r || jsonb_build_object(
               'container_id', v_containers->(r->>'repair_order_id')->'id',
               'container_code', v_containers->(r->>'repair_order_id')->'code',
               'container_created',
                 COALESCE((v_containers->(r->>'repair_order_id')->>'created')::boolean, false)
                 AND r->>'mode' = 'container',
               'allocation_number', v_containers->(r->>'repair_order_id')->'allocation_number')
           END
           ORDER BY ord), '[]'::jsonb)
  INTO v_results
  FROM jsonb_array_elements(v_results) WITH ORDINALITY AS t(r, ord);

  -- Bulk items never get a container.
  SELECT jsonb_agg(
           CASE WHEN r->>'mode' = 'bulk'
                THEN r || jsonb_build_object('container_id', NULL, 'container_code', NULL, 'container_created', false)
                ELSE r END
           ORDER BY ord)
  INTO v_results
  FROM jsonb_array_elements(v_results) WITH ORDINALITY AS t(r, ord);

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'document_number', v_doc,
    'location_id', p_location_id,
    'containers', v_containers,
    'line_count', jsonb_array_length(v_results),
    'lines', v_results);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_putaway_internal(uuid, uuid, uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

-- One part from the desktop "Do rozlokowania" dialog: the same path.
CREATE OR REPLACE FUNCTION public.inventory_putaway_from_receiving(
  p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_variant_id uuid,
  p_quantity numeric, p_destination_location_id uuid,
  p_repair_order_line_id uuid DEFAULT NULL::uuid, p_container_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  v_result := public.inventory_putaway_internal(
    p_actor_user_id, p_organization_id, p_branch_id, p_destination_location_id,
    CASE WHEN p_repair_order_line_id IS NULL THEN NULL ELSE p_container_id END,
    jsonb_build_array(jsonb_build_object(
      'variant_id', p_variant_id, 'quantity', p_quantity,
      'repair_order_line_id', p_repair_order_line_id)));

  RETURN v_result->'lines'->0;
END;
$function$;

-- A selection (scan flow): one MM for all of it.
CREATE OR REPLACE FUNCTION public.inventory_putaway_batch(
  p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_location_id uuid,
  p_container_id uuid, p_new_container_repair_order_id uuid, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_location uuid := p_location_id;
  v_container record;
  v_container_id uuid;
  v_container_code text;
  v_container_created boolean := false;
  v_ro record;
  v_n integer;
  v_code text;
  v_result jsonb;
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

  IF p_container_id IS NOT NULL AND p_new_container_repair_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'Pick an existing container or a new one, not both' USING ERRCODE = '22023';
  END IF;

  IF p_container_id IS NOT NULL THEN
    SELECT id, code, current_location_id, reference_id INTO v_container
    FROM public.inventory_containers
    WHERE id = p_container_id AND organization_id = p_organization_id AND branch_id = p_branch_id
      AND reference_type = 'repair_order' AND status IN ('active', 'empty') AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Container not found or not usable' USING ERRCODE = 'P0002';
    END IF;
    IF v_container.current_location_id IS NULL THEN
      RAISE EXCEPTION 'Container has no location' USING ERRCODE = '22023';
    END IF;
    v_location := v_container.current_location_id;
    v_container_id := v_container.id;
    v_container_code := v_container.code;
  END IF;

  IF v_location IS NULL THEN
    RAISE EXCEPTION 'A destination location is required' USING ERRCODE = '22023';
  END IF;

  IF p_new_container_repair_order_id IS NOT NULL THEN
    SELECT id, zl_number, status INTO v_ro
    FROM public.repair_orders
    WHERE id = p_new_container_repair_order_id AND organization_id = p_organization_id
      AND branch_id = p_branch_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Repair order not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_ro.status <> 'open' THEN
      RAISE EXCEPTION 'Repair order is not open' USING ERRCODE = '55000';
    END IF;

    SELECT count(*) + 1 INTO v_n FROM public.inventory_containers
    WHERE organization_id = p_organization_id AND reference_type = 'repair_order'
      AND reference_id = v_ro.id::text AND deleted_at IS NULL;
    LOOP
      v_code := 'K-' || COALESCE(v_ro.zl_number, 'ZL') || '-' || lpad(v_n::text, 2, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.inventory_containers
        WHERE organization_id = p_organization_id AND branch_id = p_branch_id
          AND lower(code) = lower(v_code) AND deleted_at IS NULL);
      v_n := v_n + 1;
    END LOOP;

    v_container_id := (public.inventory_create_container(
      p_actor_user_id, p_organization_id, p_branch_id, v_code, v_location,
      'container', 'repair_order', v_ro.id::text)->>'container_id')::uuid;
    v_container_code := v_code;
    v_container_created := true;
  END IF;

  v_result := public.inventory_putaway_internal(
    p_actor_user_id, p_organization_id, p_branch_id, v_location, v_container_id, p_lines);

  RETURN jsonb_build_object(
    'location_id', v_location,
    'container_id', v_container_id,
    'container_code', v_container_code,
    'container_created', v_container_created,
    'movement_id', v_result->'movement_id',
    'document_number', v_result->'document_number',
    'line_count', v_result->'line_count',
    'lines', v_result->'lines');
END;
$function$;

