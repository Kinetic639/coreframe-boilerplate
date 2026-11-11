-- ============================================================================
-- IC-3 self-caught defect, fixed BEFORE any test exercised it: the previous
-- migration's `inventory_receive_purchase_order` incremented `received_
-- quantity` (and validated over-receipt) BEFORE calling the idempotency-
-- aware `inventory_receive_stock` primitive. A retry with the SAME derived
-- idempotency key would therefore double-increment `received_quantity` even
-- though the underlying PHYSICAL movement is correctly deduplicated by the
-- primitive -- the wrapper's own business-state mutation was not idempotent,
-- violating the explicit IC-3 requirement that "the wrapper must not
-- duplicate business attribution/state writes" on an idempotent hit.
--
-- FIX: pre-check for an existing movement under the derived idempotency key
-- IMMEDIATELY after acquiring the PO row's own `FOR UPDATE` lock (already
-- present, unchanged) and BEFORE touching any PO line. If found, short-
-- circuit and return the PO's current (already-correct) state without any
-- further mutation. This is RACE-SAFE against two genuinely concurrent
-- calls for the SAME purchase_order_id, not merely sequential-retry-safe:
-- both sessions contend for the SAME `v_po` row lock at the very start of
-- the function (unchanged from the original design), so a second, losing
-- session blocks until the first COMMITS, then re-reads and correctly sees
-- the now-committed movement row and takes the short-circuit path BEFORE
-- any duplicate `received_quantity` increment -- the pre-existing PO-row
-- lock is what makes this pattern safe, not a new locking mechanism.

CREATE OR REPLACE FUNCTION public.inventory_receive_purchase_order(p_purchase_order_id uuid, p_lines jsonb, p_actor_user_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_po public.inventory_purchase_orders%ROWTYPE;
  v_line jsonb;
  v_po_line public.inventory_purchase_order_lines%ROWTYPE;
  v_receipt_lines jsonb := '[]'::jsonb;
  v_qty numeric(18, 6);
  v_location_id uuid;
  v_movement jsonb;
  v_remaining_open integer;
  v_final_status text;
  v_derived_idempotency_key text;
  v_existing_movement_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_po
  FROM public.inventory_purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_po.organization_id, v_po.branch_id, 'warehouse.procurement.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.procurement.manage permission' USING ERRCODE = '42501';
  END IF;

  v_derived_idempotency_key := CASE WHEN p_idempotency_key IS NOT NULL
    THEN 'po-receipt-' || v_po.id::text || '-' || p_idempotency_key
    ELSE NULL END;

  IF v_derived_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_movement_id
    FROM public.inventory_movement_headers
    WHERE organization_id = v_po.organization_id AND idempotency_key = v_derived_idempotency_key;

    IF v_existing_movement_id IS NOT NULL THEN
      -- Idempotent retry of an already-processed PO receipt (or the losing
      -- side of a genuine concurrent race, now unblocked and re-reading
      -- post-commit state under the same v_po row lock): return current
      -- state without re-validating or re-mutating any PO line.
      RETURN jsonb_build_object(
        'purchase_order_id', v_po.id,
        'status', v_po.status,
        'movement_id', v_existing_movement_id,
        'document_number', (SELECT document_number FROM public.inventory_movement_headers WHERE id = v_existing_movement_id),
        'lines', (
          SELECT jsonb_agg(jsonb_build_object(
            'line_number', line_number, 'movement_line_id', id,
            'variant_id', variant_id, 'quantity', quantity,
            'destination_location_id', destination_location_id
          ) ORDER BY line_number)
          FROM public.inventory_movement_lines
          WHERE movement_id = v_existing_movement_id AND deleted_at IS NULL
        )
      );
    END IF;
  END IF;

  IF v_po.status IN ('received', 'closed', 'cancelled') THEN
    RAISE EXCEPTION 'Purchase order cannot be received in current status' USING ERRCODE = '55000';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one receipt line is required' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_po_line
    FROM public.inventory_purchase_order_lines
    WHERE id = (v_line ->> 'purchase_order_line_id')::uuid
      AND purchase_order_id = v_po.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase order line not found' USING ERRCODE = 'P0002';
    END IF;

    v_qty := (v_line ->> 'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 OR v_po_line.received_quantity + v_qty > v_po_line.ordered_quantity THEN
      RAISE EXCEPTION 'Receipt quantity exceeds open purchase order quantity' USING ERRCODE = '22023';
    END IF;

    v_location_id := coalesce(nullif(v_line ->> 'destination_location_id', '')::uuid, v_po.delivery_location_id);
    IF v_location_id IS NULL THEN
      RAISE EXCEPTION 'Receipt destination location is required' USING ERRCODE = '22023';
    END IF;

    UPDATE public.inventory_purchase_order_lines
    SET received_quantity = received_quantity + v_qty, updated_at = now()
    WHERE id = v_po_line.id;

    v_receipt_lines := v_receipt_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_po_line.variant_id,
      'unit_id', v_po_line.unit_id,
      'quantity', v_qty,
      'destination_location_id', v_location_id,
      'unit_cost', v_po_line.unit_cost
    ));
  END LOOP;

  v_movement := public.inventory_receive_stock(
    p_actor_user_id, v_po.organization_id, v_po.branch_id, v_receipt_lines,
    NULL, NULL, NULL, 'Purchase order receipt', v_derived_idempotency_key
  );

  SELECT count(*) INTO v_remaining_open
  FROM public.inventory_purchase_order_lines
  WHERE purchase_order_id = v_po.id
    AND received_quantity < ordered_quantity;

  v_final_status := CASE WHEN v_remaining_open = 0 THEN 'received' ELSE 'partially_received' END;

  UPDATE public.inventory_purchase_orders
  SET status = v_final_status, updated_at = now()
  WHERE id = v_po.id;

  RETURN jsonb_build_object(
    'purchase_order_id', v_po.id,
    'status', v_final_status,
    'movement_id', v_movement ->> 'movement_id',
    'document_number', v_movement ->> 'document_number',
    'lines', v_movement -> 'lines'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_receive_purchase_order(uuid, jsonb, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_receive_purchase_order(uuid, jsonb, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_receive_purchase_order(uuid, jsonb, uuid, text) TO authenticated, service_role;
