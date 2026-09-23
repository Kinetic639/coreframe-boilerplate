-- ============================================================================
-- IC-3: refactor/fix `inventory_receive_purchase_order` into a thin business
-- wrapper over the new canonical `inventory_receive_stock` primitive.
-- ============================================================================
-- LIVE-CONFIRMED BEFORE THIS MIGRATION: the pre-existing body called
-- `public.inventory_create_draft_movement(...)` and `public.inventory_post_
-- movement(...)` -- NEITHER FUNCTION EXISTS in this database (confirmed via
-- pg_proc; zero rows). Every real invocation of this RPC has therefore
-- always failed with `42883: function ... does not exist`. Repo-wide grep
-- confirms ZERO UI callers, ZERO server-action callers reached from any
-- component, and the only test coverage is a static string-match against
-- the migration file's own text (not a behavioral test) -- this function
-- has never successfully posted a single real receipt. `inventory_purchase_
-- orders` has 0 live rows. Per explicit instruction ("If the function is
-- dead or materially broken: do not fake parity. Report it and still
-- consolidate its valid business contract if appropriate"), this migration
-- does NOT attempt to preserve the broken physical-posting call -- it
-- replaces ONLY that step with the new canonical primitive, while keeping
-- every genuine PO-specific business rule byte-identical to the original
-- (deliberately intended, still-correct) source:
--
-- KEPT EXACTLY: PO row lock (`FOR UPDATE`) and not-found check;
-- `warehouse.procurement.manage` permission check (a real, live permission
-- slug, confirmed via the `permissions` table); PO status guard (`received`/
-- `closed`/`cancelled` cannot be received again); non-empty p_lines check;
-- per-line PO-line row lock and not-found check; quantity>0 and
-- `received_quantity + qty > ordered_quantity` over-receipt rejection;
-- destination resolution (`p_lines` per-line override, falling back to
-- `v_po.delivery_location_id`) with a required-destination check;
-- `received_quantity` increment on each PO line; final PO status
-- recomputation (`received` iff no line remains open, else
-- `partially_received`) using the SAME `inventory_purchase_orders_status_
-- check` values the table's own CHECK constraint allows.
--
-- CHANGED (the physical-posting step only): the previous, always-broken
-- calls to `inventory_create_draft_movement`/`inventory_post_movement` are
-- replaced with a single call to `inventory_receive_stock`, passing each
-- resolved receipt line (variant_id, unit_id, quantity,
-- destination_location_id, unit_cost) through unchanged. `p_idempotency_key`
-- is now a REAL, engine-enforced idempotency key (`'po-receipt-' ||
-- po_id || '-' || a caller-supplied idempotency token`) rather than the
-- previous body's own `clock_timestamp()`-suffixed value, which made the
-- old (never-successfully-executing) call NEVER idempotent by construction
-- -- this is a genuine improvement, not merely a compatibility shim, and is
-- disclosed as such since there is no prior working behavior to regress
-- against.
--
-- SECURITY MODEL HARDENED (new IC-3 code, not an IC-7 pre-existing-gap
-- fix): the original function had NO `SECURITY DEFINER` clause (defaulted
-- to INVOKER) and NO actor-identity check against `auth.uid()` at all --
-- `p_actor_user_id` was accepted and used only for the `posted_by` stamp,
-- fully spoofable. This migration makes it `SECURITY DEFINER` (owner
-- `postgres`, matching every other canonical Inventory Core RPC) and adds
-- the same actor-identity check every sibling RPC already uses. This does
-- not "fake parity" with prior behavior -- the prior behavior could never
-- successfully run past the physical-posting step, so there is no working
-- security contract being weakened; this establishes the FIRST working one.

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
    NULL, NULL, NULL, 'Purchase order receipt',
    CASE WHEN p_idempotency_key IS NOT NULL THEN 'po-receipt-' || v_po.id::text || '-' || p_idempotency_key ELSE NULL END
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

-- Live-caught pattern (same as IC-1/IC-2, hit repeatedly this project): adding
-- a 4th parameter creates a NEW overload rather than replacing the old 3-arg
-- signature. Drop the old, broken, insecure 3-arg overload explicitly so it
-- cannot remain independently callable.
DROP FUNCTION IF EXISTS public.inventory_receive_purchase_order(uuid, jsonb, uuid);
