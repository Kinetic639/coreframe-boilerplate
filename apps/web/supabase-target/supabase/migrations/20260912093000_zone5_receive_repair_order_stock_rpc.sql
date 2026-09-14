-- =============================================================================
-- Migration: zone5_receive_repair_order_stock_rpc
-- Zone:      05 (Receiving / Putaway) -- Phase 4
-- Date:      2026-09-12
-- =============================================================================
-- Approved architecture: docs/mvp/zones/05-receiving-putaway-implementation-plan.md
-- sections 2, 8, 9, 10.
--
-- receive_repair_order_stock: a NEW, Zone-5-owned SECURITY DEFINER
-- orchestration RPC. It calls the EXISTING, UNMODIFIED
-- inventory_create_and_finalize('101', ...) from inside itself -- the
-- generic engine gains zero RepairOrder awareness -- then performs its own
-- domain writes (repair_order_line_movement_links, repair_order_line_locations)
-- in the SAME transaction, achieving atomicity by construction (one function,
-- one implicit transaction; any failure anywhere rolls back everything).
--
-- *** VERIFICATION GAP -- same caveat as the Phase 3 migration ***
-- This function calls `public.inventory_create_and_finalize(...)` with the
-- exact named-parameter shape found in
-- apps/web/src/server/services/inventory-movements.service.ts (real,
-- tracked application code, high confidence) but that RPC's own body has NO
-- tracked migration anywhere in this repo (confirmed, accepted pre-existing
-- tech debt per this zone's approved plan, NOT reconstructed here). This
-- migration does not alter that function; it only calls it. NOT applied to
-- any live database this session (Supabase MCP unavailable).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.receive_repair_order_stock(
  p_actor_user_id      uuid,
  p_organization_id    uuid,
  p_branch_id          uuid,
  p_lines              jsonb,   -- [{ variant_id, unit_id, quantity, source_line_id }]
  p_operation_date     date DEFAULT NULL,
  p_document_date      date DEFAULT NULL,
  p_external_reference text DEFAULT NULL,
  p_note               text DEFAULT NULL,
  p_idempotency_key    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_receiving_location_id uuid;
  v_engine_lines           jsonb := '[]'::jsonb;
  v_line                    jsonb;
  v_line_index              integer := 0;
  v_source_line_id          uuid;
  v_resolved_rol_id         uuid;
  v_resolved_ro_id          uuid;
  v_resolved_variant_id     uuid;
  v_candidate_count         integer;
  v_attribution             jsonb := '[]'::jsonb;  -- parallel array: repair_order_line_id or null, per input line order
  v_engine_result           jsonb;
  v_movement_id             uuid;
  v_movement_line_ids       uuid[];
  v_movement_line_id        uuid;
  v_i                       integer;
  v_qty                     numeric;
BEGIN
  -- Actor identity: reject a delegated/spoofed actor, same pattern as
  -- materialize_repair_orders_from_session / approve_wdd_matcher_session.
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  -- Authorization: checked against the CALLER-SUPPLIED org/branch here, same
  -- as every other movement-creating call in this engine (operate/adjust
  -- gates 101 creation) -- p_organization_id/p_branch_id are not "trusted
  -- blindly"; they are the keys this permission check runs against, and are
  -- independently re-validated below against every resolved RepairOrder line.
  IF NOT (
    public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Not authorized to receive stock for this branch' USING ERRCODE = '42501';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  -- Resolve the branch's receiving location server-side -- re-validated
  -- every call (org/branch/purpose/can_store_inventory/deleted_at), never
  -- cached, never supplied by the caller (plan §5/§8).
  v_receiving_location_id := public.resolve_branch_receiving_location(p_organization_id, p_branch_id);

  -- Resolve provenance and build the engine-facing line array. Every line's
  -- destination is forced to the receiving location -- the caller never
  -- supplies or overrides it.
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_index := v_line_index + 1;
    v_source_line_id := NULLIF(v_line->>'source_line_id', '')::uuid;
    v_resolved_rol_id := NULL;
    v_resolved_ro_id := NULL;
    v_resolved_variant_id := NULL;

    IF v_source_line_id IS NOT NULL THEN
      -- Resolve via the Matcher -> RepairOrderLine lineage chain, server-side.
      -- The caller supplies EVIDENCE (a Matcher line id); the DB resolves the
      -- authoritative relationship -- never the other way around (plan §2/§9).
      -- Live-verification correction: standard PostgreSQL has no built-in
      -- min(uuid) aggregate -- cast to text for the aggregate, then back to
      -- uuid. Safe: these values are only actually used when v_candidate_count
      -- = 1 (checked immediately below), i.e. exactly one row to "min" over.
      SELECT count(*), min(rol.id::text)::uuid, min(rol.repair_order_id::text)::uuid, min(rol.variant_id::text)::uuid
        INTO v_candidate_count, v_resolved_rol_id, v_resolved_ro_id, v_resolved_variant_id
      FROM public.workshop_source_document_lines wsdl
      JOIN public.repair_order_line_source_links rols ON rols.workshop_source_document_line_id = wsdl.id
      JOIN public.repair_order_lines rol ON rol.id = rols.repair_order_line_id
      WHERE wsdl.wdd_matcher_line_id = v_source_line_id;

      IF v_candidate_count = 0 THEN
        RAISE EXCEPTION 'source_line_id % (line %) did not resolve to any RepairOrderLine -- broken provenance must never be silently received as unattributed', v_source_line_id, v_line_index
          USING ERRCODE = 'P0002';
      ELSIF v_candidate_count > 1 THEN
        RAISE EXCEPTION 'source_line_id % (line %) resolved ambiguously to % RepairOrderLine candidates -- ambiguous provenance must never be silently resolved by picking one', v_source_line_id, v_line_index, v_candidate_count
          USING ERRCODE = '55000';
      END IF;

      -- Target-entity-authoritative validation: the resolved RepairOrder's
      -- own org/branch must match this call's org/branch -- never trusted
      -- merely because the caller asked for this org/branch.
      IF NOT EXISTS (
        SELECT 1 FROM public.repair_orders ro
        WHERE ro.id = v_resolved_ro_id
          AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id
      ) THEN
        RAISE EXCEPTION 'Resolved RepairOrder for line % does not belong to the target organization/branch', v_line_index USING ERRCODE = '42501';
      END IF;

      -- Variant cross-check: only when the RepairOrderLine has one set
      -- (repair_order_lines.variant_id is nullable by Zone 3's own design --
      -- "manual lines may exist with no catalog match yet").
      IF v_resolved_variant_id IS NOT NULL AND v_resolved_variant_id IS DISTINCT FROM (v_line->>'variant_id')::uuid THEN
        RAISE EXCEPTION 'Resolved RepairOrderLine variant for line % does not match the received variant', v_line_index USING ERRCODE = '22023';
      END IF;
    END IF;

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_line->>'variant_id',
      'unit_id', v_line->>'unit_id',
      'quantity', (v_line->>'quantity')::numeric,
      'source_location_id', NULL,
      'destination_location_id', v_receiving_location_id,
      'note', v_line->>'note'
    ));
    v_attribution := v_attribution || jsonb_build_array(v_resolved_rol_id);
  END LOOP;

  -- Duplicate-work suppression only (plan §12.1) -- NOT authorization. Real
  -- authorization already happened above via has_branch_permission.
  PERFORM set_config('ambra.repair_order_attribution_authoritative', 'on', true);

  v_engine_result := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '101', v_engine_lines,
    p_operation_date, p_document_date, NULL, p_external_reference, p_note,
    p_idempotency_key, p_actor_user_id
  );

  v_movement_id := (v_engine_result->>'movement_id')::uuid;

  -- Correlate the engine's created lines back to our input order. The engine
  -- assigns sequential line_number per line in submission order (established,
  -- documented engine behavior) -- ordering by line_number recovers the
  -- correspondence to v_attribution's own parallel array.
  SELECT array_agg(id ORDER BY line_number) INTO v_movement_line_ids
  FROM public.inventory_movement_lines
  WHERE movement_id = v_movement_id;

  FOR v_i IN 1..coalesce(array_length(v_movement_line_ids, 1), 0)
  LOOP
    v_resolved_rol_id := NULLIF(v_attribution->>(v_i - 1), 'null')::uuid;
    CONTINUE WHEN v_resolved_rol_id IS NULL;

    v_movement_line_id := v_movement_line_ids[v_i];
    v_qty := (v_engine_lines->(v_i - 1)->>'quantity')::numeric;
    SELECT repair_order_id INTO v_resolved_ro_id FROM public.repair_order_lines WHERE id = v_resolved_rol_id;

    -- Business-quantity ledger (Zone 3's own table, unchanged semantics --
    -- 'receipt' only, never 'putaway'/'relocation').
    INSERT INTO public.repair_order_line_movement_links
      (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
    VALUES (v_resolved_rol_id, v_movement_line_id, v_qty, 'receipt');

    -- Spatial projection seed -- known-true, written directly (nothing to
    -- infer; this is a fresh receipt with no prior attribution to reconcile
    -- against).
    INSERT INTO public.repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES (p_organization_id, p_branch_id, v_resolved_ro_id, v_resolved_rol_id,
            (v_engine_lines->(v_i - 1)->>'variant_id')::uuid, v_receiving_location_id, v_qty)
    ON CONFLICT (repair_order_line_id, location_id)
    DO UPDATE SET quantity = public.repair_order_line_locations.quantity + EXCLUDED.quantity;
  END LOOP;

  RETURN v_engine_result || jsonb_build_object('receiving_location_id', v_receiving_location_id);
END;
$function$;

COMMENT ON FUNCTION public.receive_repair_order_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) IS
  'Zone 5 Phase 4: RepairOrder-aware receiving. Calls inventory_create_and_finalize(''101'', ...)
   unmodified, forces destination to the branch''s resolve_branch_receiving_location(), resolves
   Matcher-line provenance to an exact RepairOrderLine server-side (hard error on zero or
   ambiguous resolution -- plan §9), and writes repair_order_line_movement_links
   (relation_type=''receipt'') + the seed repair_order_line_locations row directly, atomically,
   in this same transaction.';

REVOKE ALL ON FUNCTION public.receive_repair_order_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.receive_repair_order_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.receive_repair_order_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) TO authenticated;
