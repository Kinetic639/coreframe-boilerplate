-- INVENTORY CORE A8 -- REPAIR ORDER PROJECTION SIMPLIFICATION (4 of 7)
--
-- putaway_repair_order_stock: replaces the removed repair_order_line_
-- locations/repair_order_location_attribution_uncertain reads and writes
-- with a single, pre-engine-call, live-computed availability + bucket-
-- consistency check, reusing the exact same reversal-aware proportional
-- contribution formula as get_repair_order_line_physical_state (migration
-- 1 of this set) -- not independently re-derived.
--
-- WHY ONLY ONE PASS (not the old unlocked-pre-check + locked-post-engine-
-- recheck shape): the engine call itself mutates inventory_balances.
-- on_hand_quantity at this same bucket, so a POST-engine re-derivation
-- from physical balance would incorrectly compare live attribution
-- against an ALREADY-REDUCED on_hand and falsely fail (found and fixed
-- live during this pass, before being applied here). Locking inventory_
-- balances in this single pass, BEFORE the engine call, and holding it
-- for the rest of the transaction achieves the same cross-transaction
-- serialization the old post-engine FOR UPDATE achieved, on the real
-- physical resource rather than a derived projection row.
--
-- v_consumed_by_line guards ONLY the same repair_order_line_id appearing
-- twice within ONE call -- two DIFFERENT lines sharing a bucket are
-- independent by design (same-SKU independence, IC-5) and are already
-- jointly protected by the bucket-level total_known > physical_on_hand
-- check; each line's own available share is a disjoint slice of that same
-- total_known, computed from ITS OWN canonical links.
--
-- The old repair_order_location_attribution_uncertain "cannot putaway,
-- ambiguous" gate (55000) is replaced by the same explicit P0008 history-
-- inconsistency contract used everywhere else in this pass -- under the
-- new architecture there is no more heuristic guessing to be ambiguous
-- about; the only failure mode left is a genuine, detectable inconsistency
-- between canonical attribution and physical reality.
--
-- The removed repair_order_line_locations UPDATE/INSERT (source
-- decrement, dest increment) is gone; only the canonical relocation link
-- (write_repair_order_line_movement_link_internal, unchanged) is written,
-- after the engine call as before (a real movement_line_id is required).
--
-- All physical movement semantics (inventory_create_and_finalize call,
-- destination validation, actor/permission checks) are unchanged.

CREATE OR REPLACE FUNCTION public.putaway_repair_order_stock(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_lines jsonb, p_destination_location_id uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving_location_id uuid;
  v_line                   jsonb;
  v_line_index             integer := 0;
  v_rol_id                 uuid;
  v_ro_id                  uuid;
  v_line_variant_id        uuid;
  v_qty                    numeric;
  v_available_qty          numeric;
  v_already_consumed       numeric;
  v_consumed_by_line       jsonb := '{}'::jsonb;
  v_engine_lines           jsonb := '[]'::jsonb;
  v_engine_result          jsonb;
  v_movement_id            uuid;
  v_movement_line_ids      uuid[];
  v_movement_line_id       uuid;
  v_physical_on_hand       numeric;
  v_total_known            numeric;
  v_contribution           RECORD;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Not authorized to putaway stock for this branch' USING ERRCODE = '42501';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;
  IF p_destination_location_id IS NULL THEN
    RAISE EXCEPTION 'A destination location is required' USING ERRCODE = '22023';
  END IF;

  v_receiving_location_id := public.resolve_branch_receiving_location(p_organization_id, p_branch_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id AND organization_id = p_organization_id
      AND branch_id = p_branch_id AND deleted_at IS NULL AND can_store_inventory = true
  ) THEN
    RAISE EXCEPTION 'Destination location % is not a valid stockable location for this branch', p_destination_location_id USING ERRCODE = '22023';
  END IF;
  IF p_destination_location_id = v_receiving_location_id THEN
    RAISE EXCEPTION 'Destination cannot be the receiving location itself' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_index := v_line_index + 1;
    v_rol_id := (v_line->>'repair_order_line_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_line_variant_id := (v_line->>'variant_id')::uuid;

    IF v_rol_id IS NULL THEN
      RAISE EXCEPTION 'Line % is missing repair_order_line_id -- putaway always names an exact line, never inferred' , v_line_index USING ERRCODE = '22023';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line % quantity must be positive', v_line_index USING ERRCODE = '22023';
    END IF;

    SELECT rol.repair_order_id INTO v_ro_id
    FROM public.repair_order_lines rol
    JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
    WHERE rol.id = v_rol_id AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id;

    IF v_ro_id IS NULL THEN
      RAISE EXCEPTION 'repair_order_line_id % (line %) does not belong to this organization/branch', v_rol_id, v_line_index USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.repair_order_lines WHERE id = v_rol_id AND variant_id IS NOT NULL AND variant_id IS DISTINCT FROM v_line_variant_id
    ) THEN
      RAISE EXCEPTION 'Line % variant does not match the RepairOrderLine''s own variant', v_line_index USING ERRCODE = '22023';
    END IF;

    PERFORM on_hand_quantity FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving_location_id AND variant_id = v_line_variant_id
    FOR UPDATE;

    SELECT on_hand_quantity INTO v_physical_on_hand
    FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving_location_id AND variant_id = v_line_variant_id;
    v_physical_on_hand := COALESCE(v_physical_on_hand, 0);

    v_total_known := 0;
    v_available_qty := 0;
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
        AND sle.location_id = v_receiving_location_id AND sle.variant_id = v_line_variant_id
      GROUP BY rol.id
      HAVING SUM(
        CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
        * sle.quantity * (rolml.applied_quantity / iml.quantity)
      ) <> 0
    LOOP
      IF v_contribution.net_qty < 0 THEN
        RAISE EXCEPTION 'Line %: attribution history at the receiving location is inconsistent -- putaway is not permitted until it is reconciled', v_line_index
          USING ERRCODE = 'P0008';
      END IF;
      v_total_known := v_total_known + v_contribution.net_qty;
      IF v_contribution.repair_order_line_id = v_rol_id THEN
        v_available_qty := v_contribution.net_qty;
      END IF;
    END LOOP;

    IF v_total_known > v_physical_on_hand THEN
      RAISE EXCEPTION 'Line %: attribution history at the receiving location is inconsistent -- putaway is not permitted until it is reconciled', v_line_index
        USING ERRCODE = 'P0008';
    END IF;

    v_already_consumed := COALESCE((v_consumed_by_line->>(v_rol_id::text))::numeric, 0);
    v_available_qty := v_available_qty - v_already_consumed;

    IF v_available_qty < v_qty THEN
      RAISE EXCEPTION 'Line % requests % but only % is currently attributed to this RepairOrderLine at the receiving location', v_line_index, v_qty, v_available_qty USING ERRCODE = '22023';
    END IF;

    v_consumed_by_line := jsonb_set(
      v_consumed_by_line, ARRAY[v_rol_id::text], to_jsonb(v_already_consumed + v_qty)
    );

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_line_variant_id,
      'unit_id', v_line->>'unit_id',
      'quantity', v_qty,
      'source_location_id', v_receiving_location_id,
      'destination_location_id', p_destination_location_id,
      'note', NULL
    ));
  END LOOP;

  v_engine_result := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '801', v_engine_lines,
    NULL, NULL, NULL, NULL, NULL, p_idempotency_key, p_actor_user_id
  );
  v_movement_id := (v_engine_result->>'movement_id')::uuid;

  SELECT array_agg(id ORDER BY line_number) INTO v_movement_line_ids
  FROM public.inventory_movement_lines
  WHERE movement_id = v_movement_id;

  v_line_index := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_index := v_line_index + 1;
    v_rol_id := (v_line->>'repair_order_line_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_movement_line_id := v_movement_line_ids[v_line_index];

    IF v_movement_line_id IS NOT NULL THEN
      BEGIN
        PERFORM public.write_repair_order_line_movement_link_internal(v_rol_id, v_movement_line_id, v_qty, 'relocation');
      EXCEPTION WHEN unique_violation THEN
        NULL; -- duplicate relocation link (idempotent retry) -- matches the prior ON CONFLICT DO NOTHING silence
      END;
    END IF;
  END LOOP;

  RETURN v_engine_result || jsonb_build_object('source_location_id', v_receiving_location_id, 'destination_location_id', p_destination_location_id);
END;
$function$;
