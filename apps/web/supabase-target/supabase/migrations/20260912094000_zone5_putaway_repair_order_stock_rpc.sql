-- =============================================================================
-- Migration: zone5_putaway_repair_order_stock_rpc
-- Zone:      05 (Receiving / Putaway) -- Phase 6
-- Date:      2026-09-12
-- =============================================================================
-- Approved architecture: docs/mvp/zones/05-receiving-putaway-implementation-plan.md
-- sections 4, 9 (batch putaway contract), and the final correction pass on
-- UNKNOWN-marker clearing (a single RepairOrder-aware write never clears a
-- bucket-wide marker on its own).
--
-- putaway_repair_order_stock: ONE destination, ONE 801 document, N lines.
-- Calls inventory_create_and_finalize('801', ...) unmodified; source is
-- always the branch's receiving location (never caller-supplied); writes
-- exact, known-true spatial attribution directly (nothing to infer -- the
-- operator/caller names the exact repair_order_line_id per line). Does NOT
-- write repair_order_line_movement_links (putaway is not a business-quantity
-- event -- relation_type stays receipt|issue|reversal, never 'putaway').
--
-- Same verification-gap caveat as Phase 4's migration applies here (calls
-- inventory_create_and_finalize, whose own body has no tracked migration;
-- NOT applied to any live database this session).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.putaway_repair_order_stock(
  p_actor_user_id         uuid,
  p_organization_id       uuid,
  p_branch_id             uuid,
  p_lines                 jsonb,  -- [{ repair_order_line_id, variant_id, unit_id, quantity }]
  p_destination_location_id uuid,
  p_idempotency_key       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_engine_lines           jsonb := '[]'::jsonb;
  v_engine_result          jsonb;
  v_movement_id            uuid;
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

  -- Source is always the branch's receiving location -- never caller-supplied.
  v_receiving_location_id := public.resolve_branch_receiving_location(p_organization_id, p_branch_id);

  -- Destination must be a real, stockable, non-deleted location in this
  -- org/branch -- same invariant ambra-location-inventory.ts's own
  -- requireStockableLocation() already enforces elsewhere in this codebase.
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

    -- Target-entity-authoritative validation, same pattern as the receive RPC:
    -- the RepairOrderLine is re-verified to belong to this exact org/branch,
    -- even though it originates from Zone 5's own suggestion UI -- never
    -- assumed correct merely because it "came from our own UI".
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

    -- Quantity-available validation against the LIVE projection at the
    -- receiving location, locked, before building the movement payload --
    -- reject, never silently clamp.
    SELECT quantity INTO v_available_qty
    FROM public.repair_order_line_locations
    WHERE repair_order_line_id = v_rol_id AND location_id = v_receiving_location_id
    FOR UPDATE;

    IF v_available_qty IS NULL OR v_available_qty < v_qty THEN
      RAISE EXCEPTION 'Line % requests % but only % is currently attributed to this RepairOrderLine at the receiving location', v_line_index, v_qty, coalesce(v_available_qty, 0) USING ERRCODE = '22023';
    END IF;

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_line_variant_id,
      'unit_id', v_line->>'unit_id',
      'quantity', v_qty,
      'source_location_id', v_receiving_location_id,
      'destination_location_id', p_destination_location_id,
      'note', NULL
    ));
  END LOOP;

  -- Duplicate-work suppression only (plan §12.1) -- NOT authorization.
  PERFORM set_config('ambra.repair_order_attribution_authoritative', 'on', true);

  -- ONE 801 document, ALL lines, ONE destination -- matches the engine's own
  -- existing multi-line-document semantics; no new movement type.
  v_engine_result := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '801', v_engine_lines,
    NULL, NULL, NULL, NULL, NULL, p_idempotency_key, p_actor_user_id
  );
  v_movement_id := (v_engine_result->>'movement_id')::uuid;

  -- Write exact, known-true spatial attribution directly -- nothing to infer,
  -- the caller named the exact line. This does NOT clear any pre-existing
  -- UNKNOWN marker on either bucket (plan's final correction): proving one
  -- line's own quantity does not prove the whole (location, variant) bucket.
  v_line_index := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_index := v_line_index + 1;
    v_rol_id := (v_line->>'repair_order_line_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_line_variant_id := (v_line->>'variant_id')::uuid;
    SELECT repair_order_id INTO v_ro_id FROM public.repair_order_lines WHERE id = v_rol_id;

    UPDATE public.repair_order_line_locations
      SET quantity = quantity - v_qty
      WHERE repair_order_line_id = v_rol_id AND location_id = v_receiving_location_id;

    INSERT INTO public.repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES (p_organization_id, p_branch_id, v_ro_id, v_rol_id, v_line_variant_id, p_destination_location_id, v_qty)
    ON CONFLICT (repair_order_line_id, location_id)
    DO UPDATE SET quantity = public.repair_order_line_locations.quantity + EXCLUDED.quantity;

    -- Deliberately NO repair_order_line_movement_links write here -- putaway
    -- is a relocation, not a business-quantity event (plan: relation_type
    -- stays receipt|issue|reversal, never 'putaway').
  END LOOP;

  RETURN v_engine_result || jsonb_build_object('source_location_id', v_receiving_location_id, 'destination_location_id', p_destination_location_id);
END;
$function$;

COMMENT ON FUNCTION public.putaway_repair_order_stock(uuid, uuid, uuid, jsonb, uuid, text) IS
  'Zone 5 Phase 6: RepairOrder-aware putaway. One call = one destination = one 801 document =
   N lines, all sourced from resolve_branch_receiving_location(). Writes spatial attribution
   directly (known-true, operator-named) -- never clears a bucket-wide UNKNOWN marker just
   because one line is now known (plan''s final correction). Writes NO
   repair_order_line_movement_links row -- relocation is not a business-quantity event.';

REVOKE ALL ON FUNCTION public.putaway_repair_order_stock(uuid, uuid, uuid, jsonb, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.putaway_repair_order_stock(uuid, uuid, uuid, jsonb, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.putaway_repair_order_stock(uuid, uuid, uuid, jsonb, uuid, text) TO authenticated;
