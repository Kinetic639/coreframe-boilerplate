-- =============================================================================
-- Migration: zone5_receive_repair_order_stock_use_canonical_attach
-- Zone:      05 (Receiving / Putaway) -- Phase 10 attribution integration
-- Date:      2026-09-14
-- =============================================================================
-- FORWARD MIGRATION (receive_repair_order_stock is already live -- this does
-- NOT edit the already-applied 20260912093000/20260914124640 migration files
-- in place; CREATE OR REPLACE FUNCTION redefines the same function,
-- same name/signature/OID, live callers pick up the new body automatically).
--
-- Zone 3 Phase 10 (branch mvp-readiness, commit 52fc0913, live on this same
-- target project as of this session) established
-- public.attach_repair_order_line_movement(...) as the ONE canonical,
-- fully-validated production writer for repair_order_line_movement_links,
-- and closed the direct-INSERT write boundary
-- (20260914052934_repair_order_line_movement_links_close_direct_insert.sql
-- -- a deny-all INSERT policy; the table's RLS is FORCE-enabled but
-- SECURITY DEFINER functions owned by `postgres` bypass RLS via
-- rolbypassrls regardless, which is exactly why receive_repair_order_stock's
-- own direct INSERT has silently kept working until now even after that
-- policy closed -- the overlap this migration resolves).
--
-- Live pre-apply verification this pass (Supabase MCP, transaction-scoped,
-- rolled back):
--   - attach_repair_order_line_movement's every invariant (posted status,
--     receipt category, RepairOrder reference consistency, variant
--     compatibility, org/branch match) is already guaranteed true by the
--     time receive_repair_order_stock reaches this call -- confirmed
--     against a real committed '101' movement's actual header shape
--     (status='posted', category='receipt', reference_type IS NULL,
--     reference_id IS NULL -- inventory_create_and_finalize's own signature
--     has no reference_type/reference_id parameter at all, so the
--     reference-mismatch branch can never fire for a Zone-5-created
--     receipt).
--   - Nested SECURITY DEFINER auth.uid() propagation confirmed live via a
--     throwaway wrapper function structurally mirroring this exact call
--     shape: the real actor succeeds through the nested call; a spoofed
--     actor is rejected. auth.uid() reads a session-level GUC
--     (request.jwt.claims), unaffected by SECURITY DEFINER role-switching,
--     so nesting one SECURITY DEFINER function inside another does not
--     change which identity either function's own auth.uid() check sees.
--
-- Final ownership split (unchanged from the architecture, now enforced in
-- code): attach_repair_order_line_movement owns BUSINESS movement
-- attribution (repair_order_line_movement_links); Zone 5 continues to own
-- SPATIAL seed attribution (repair_order_line_locations) directly, in the
-- same transaction, immediately after. These are not merged.
--
-- Everything else in this function is byte-for-byte unchanged: same
-- signature, same actor/permission/provenance-resolution logic, same
-- engine call, same spatial-seed write. Only the
-- `INSERT INTO repair_order_line_movement_links ...` statement is replaced
-- with `PERFORM public.attach_repair_order_line_movement(...)`.
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

    -- Business-quantity ledger -- Phase 10 integration: the canonical,
    -- fully-validated writer owns this write now, not a direct INSERT.
    -- Called INSIDE this same transaction/orchestration -- a failure here
    -- (which should never actually happen for a Zone-5-created receipt line,
    -- since every one of attach_repair_order_line_movement's own invariants
    -- is already guaranteed true at this point -- see this migration's
    -- header) still rolls back the whole receive_repair_order_stock call,
    -- exactly as the direct INSERT it replaces did.
    PERFORM public.attach_repair_order_line_movement(
      p_actor_user_id, v_resolved_rol_id, v_movement_line_id, v_qty, 'receipt'
    );

    -- Spatial projection seed -- known-true, written directly (nothing to
    -- infer; this is a fresh receipt with no prior attribution to reconcile
    -- against). Zone 5 continues to own this write; the canonical RPC above
    -- has no spatial awareness and must not gain any.
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
  'Zone 5 Phase 4 (Phase-10-integrated): RepairOrder-aware receiving. Calls
   inventory_create_and_finalize(''101'', ...) unmodified, forces destination to the branch''s
   resolve_branch_receiving_location(), resolves Matcher-line provenance to an exact
   RepairOrderLine server-side (hard error on zero or ambiguous resolution -- plan §9), attributes
   business quantity via the canonical public.attach_repair_order_line_movement(...) RPC
   (Zone 3 Phase 10 -- the ONE production writer for repair_order_line_movement_links), and
   writes the seed repair_order_line_locations row directly (Zone 5''s own spatial attribution,
   unchanged) -- all atomically, in this same transaction.';

REVOKE ALL ON FUNCTION public.receive_repair_order_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.receive_repair_order_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.receive_repair_order_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) TO authenticated;
