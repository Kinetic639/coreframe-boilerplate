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
-- *** THIRD CORRECTION ROUND (this revision) -- TWO FIXES ***
--
-- FIX 1 -- UNKNOWN source bucket was trusted as authoritative. The previous
-- revision validated quantity-available against `repair_order_line_locations`
-- alone, never checking `repair_order_location_attribution_uncertain`. Per
-- the architecture, existence of a marker row means the RepairOrder
-- attribution for that (location, variant) bucket is UNKNOWN -- the
-- projection rows are then only last-known/stale, never authoritative
-- physical identity. A caller naming a `repair_order_line_id` is not
-- physical proof once the bucket itself has lost provenance. Fixed: EVERY
-- line's receiving-location + variant is checked against the marker table,
-- TWICE -- once BEFORE the engine call (a plain, non-locking read; this is
-- the actually-authoritative gate, deliberately placed before the engine
-- call rather than after -- see FIX 2's lock-order note for exactly why a
-- post-call-only check would be unsafe here) and once again AFTER the
-- engine call (this time FOR UPDATE, as defense-in-depth against the narrow
-- window between the pre-check and the engine call). Either check existing
-- is a HARD ERROR (SQLSTATE 55000); no reconciliation is attempted, no
-- physical identity is inferred, and the caller cannot "prove" the line by
-- merely naming its id.
--
-- FIX 2 -- lock-order inversion / deadlock risk. The previous revision took
-- `SELECT quantity ... FOR UPDATE` on `repair_order_line_locations` BEFORE
-- calling `inventory_create_and_finalize`, which internally locks
-- `inventory_balances`. Every OTHER path that touches both resource
-- families (the ledger-sync trigger, fired from inside the engine's own
-- ledger insert) locks `inventory_balances` first and
-- `repair_order_line_locations` / `repair_order_location_attribution_uncertain`
-- second. Two transactions contending for the same (location, variant)
-- bucket in opposite lock orders -- this putaway RPC vs. any concurrent
-- generic movement on the same bucket (e.g. Zone 6's own relocation UI) --
-- is a textbook AB-BA deadlock: T1 (putaway) holds the projection lock,
-- waits on the balance lock (inside its own engine call); T2 (generic
-- movement) holds the balance lock, waits on the projection lock (inside
-- the ledger-sync trigger the engine's own insert fires). PostgreSQL
-- resolves an actual deadlock by aborting one side, but the correct fix is
-- one consistent global lock order, not a race that occasionally aborts.
-- Fixed: `repair_order_line_locations` / `repair_order_location_attribution_uncertain`
-- are never locked (FOR UPDATE) until AFTER the engine call returns --
-- matching the generic engine + ledger-sync trigger's own order everywhere
-- else (balance, then attribution/projection). The pre-existing
-- quantity-available check is kept as a fast, non-locking pre-call read
-- too (safe: unlike the marker, nothing touches `repair_order_line_locations`
-- under this RPC's own bypass, so this value cannot be self-erased by this
-- transaction's own engine call) and is re-validated, this time FOR UPDATE,
-- in the correct post-call position -- so a request this RPC's own rules
-- would reject still fails with its own friendly message before an engine
-- call is even attempted, in the common case.
--
-- Why the UNKNOWN-marker gate could not simply move to "after the engine
-- call" to make FIX 2 trivial: this RPC sets
-- `ambra.repair_order_attribution_authoritative` before calling the engine
-- (duplicate-work suppression). The ledger-sync trigger's own zero-clear
-- branch still runs even under that bypass (it is pure physical-truth
-- cleanup, not attribution inference -- see the Phase 3 migration) and
-- unconditionally clears a stale MARKER (not the projection rows -- the
-- bypass branch never touches `repair_order_line_locations`) the instant
-- this putaway's own decrease brings the bucket to exactly zero. If the
-- ONLY UNKNOWN-marker check happened after the engine call, a bucket that
-- WAS UNKNOWN right up until this exact putaway call could have its own
-- evidence erased as a side effect of the very movement being validated,
-- and the post-call check would wrongly see "no marker" and let it through.
-- The pre-call, non-locking check reads the true pre-movement state and is
-- therefore the actually-authoritative gate; the post-call, locked
-- re-check exists only to catch a fully independent, concurrent
-- transaction racing a fresh marker into the narrow gap between the two.
--
-- Same verification-gap caveat as Phase 4's migration applies here (calls
-- inventory_create_and_finalize, whose own body has no tracked migration;
-- NOT applied to any live database this session). This revision ADDS a
-- further, NEW pre-apply requirement: a live/MCP session must independently
-- confirm `inventory_balances`'s exact key shape and the exact locking
-- behavior of `inventory_finalize_posting` before this corrected lock order
-- can be trusted under real concurrency -- see review-context.md's
-- "Concurrency" section and the still-outstanding two-session live test
-- plan documented there. This migration's own restructuring is the
-- furthest this session can safely go without that live confirmation; it
-- is NOT a substitute for it.
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

  -- =========================================================================
  -- LOOP 1 (BEFORE the engine call): identity/ownership/variant validation
  -- (unchanged) plus the actually-authoritative UNKNOWN-source gate (NEW,
  -- third correction pass). Deliberately no row-locking read is taken in
  -- this loop -- see the migration header's FIX 2 for why locking
  -- repair_order_line_locations / repair_order_location_attribution_uncertain
  -- before the engine call is the exact lock-order inversion this pass
  -- fixes, and the header's note on FIX 1 for why the UNKNOWN check
  -- specifically cannot be deferred to after the engine call.
  -- =========================================================================
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

    -- NEW (third correction pass) -- the actually-authoritative UNKNOWN
    -- gate. Existence of a marker row for this exact (org, branch,
    -- receiving_location, variant) bucket means its RepairOrder attribution
    -- is UNKNOWN -- repair_order_line_locations rows for it are only
    -- last-known/stale, never physical proof. The caller naming this exact
    -- repair_order_line_id does not override that. A plain (non-locking)
    -- read is deliberate here, not an oversight: it captures the bucket's
    -- true pre-movement state, before this transaction's own engine call
    -- can run -- see the migration header for why a lock here, or a check
    -- only after the engine call, would each be wrong in their own way.
    IF EXISTS (
      SELECT 1 FROM public.repair_order_location_attribution_uncertain
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND location_id = v_receiving_location_id AND variant_id = v_line_variant_id
    ) THEN
      RAISE EXCEPTION 'Line %: the receiving location''s attribution for this variant is UNKNOWN (a prior generic movement made it ambiguous) -- putaway is not permitted until it is reconciled', v_line_index
        USING ERRCODE = '55000';
    END IF;

    -- Fast, non-authoritative quantity pre-check (plain read, no lock):
    -- rejects an obviously-oversized request with this RPC's own friendly
    -- message before an engine call is even attempted. Safe to do
    -- unlocked here -- unlike the marker above, nothing in this function's
    -- own bypassed trigger path ever mutates repair_order_line_locations
    -- itself (only the marker table can be touched under bypass), so this
    -- value cannot be self-erased by this transaction's own engine call.
    -- The AUTHORITATIVE, race-safe check (row-locked) happens again after
    -- the engine call, in LOOP 2 below, in the correct global lock order.
    SELECT quantity INTO v_available_qty
    FROM public.repair_order_line_locations
    WHERE repair_order_line_id = v_rol_id AND location_id = v_receiving_location_id;

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
  -- existing multi-line-document semantics; no new movement type. This is
  -- also, deliberately, the FIRST point in this function that can acquire
  -- any lock on inventory_balances (via the engine's own internal locking)
  -- -- see the migration header's FIX 2.
  v_engine_result := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '801', v_engine_lines,
    NULL, NULL, NULL, NULL, NULL, p_idempotency_key, p_actor_user_id
  );
  v_movement_id := (v_engine_result->>'movement_id')::uuid;

  -- =========================================================================
  -- LOOP 2 (AFTER the engine call): only now does this function acquire any
  -- lock on repair_order_line_locations / repair_order_location_attribution_uncertain
  -- -- matching the exact global lock order the generic engine + ledger-sync
  -- trigger already use everywhere else (balance, then attribution/
  -- projection). Re-checks the UNKNOWN marker (defense-in-depth for the
  -- narrow pre-check-to-engine-call race window; LOOP 1's plain read above
  -- is the actually-authoritative gate, not this one), re-validates
  -- quantity-available under lock (LOOP 1's own plain-read pre-check above
  -- is fast-fail only, not authoritative -- this locked re-check is what
  -- FIX 2 actually requires), then writes exact, known-true spatial attribution directly --
  -- nothing to infer, the caller named the exact line. This does NOT clear
  -- any pre-existing UNKNOWN marker on either bucket (plan's earlier
  -- correction): proving one line's own quantity does not prove the whole
  -- (location, variant) bucket, and a destination bucket already marked
  -- UNKNOWN stays UNKNOWN even after gaining a known contribution.
  -- =========================================================================
  v_line_index := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_index := v_line_index + 1;
    v_rol_id := (v_line->>'repair_order_line_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_line_variant_id := (v_line->>'variant_id')::uuid;
    SELECT repair_order_id INTO v_ro_id FROM public.repair_order_lines WHERE id = v_rol_id;

    IF EXISTS (
      SELECT 1 FROM public.repair_order_location_attribution_uncertain
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND location_id = v_receiving_location_id AND variant_id = v_line_variant_id
      FOR UPDATE
    ) THEN
      RAISE EXCEPTION 'Line %: the receiving location''s attribution for this variant is UNKNOWN (a prior generic movement made it ambiguous) -- putaway is not permitted until it is reconciled', v_line_index
        USING ERRCODE = '55000';
    END IF;

    -- Quantity-available validation against the LIVE projection, locked --
    -- reject, never silently clamp.
    SELECT quantity INTO v_available_qty
    FROM public.repair_order_line_locations
    WHERE repair_order_line_id = v_rol_id AND location_id = v_receiving_location_id
    FOR UPDATE;

    IF v_available_qty IS NULL OR v_available_qty < v_qty THEN
      RAISE EXCEPTION 'Line % requests % but only % is currently attributed to this RepairOrderLine at the receiving location', v_line_index, v_qty, coalesce(v_available_qty, 0) USING ERRCODE = '22023';
    END IF;

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
   N lines, all sourced from resolve_branch_receiving_location(). Rejects (SQLSTATE 55000) any
   line whose receiving-location+variant bucket is marked UNKNOWN in
   repair_order_location_attribution_uncertain -- checked before AND after the engine call, in
   that order, deliberately (third correction pass; see this migration''s own header). Writes
   spatial attribution directly (known-true, operator-named) only for buckets confirmed KNOWN --
   never clears a bucket-wide UNKNOWN marker just because one line is now known (an earlier
   correction), and never clears a destination bucket''s own pre-existing UNKNOWN marker just
   because it gained a known contribution. Writes NO repair_order_line_movement_links row --
   relocation is not a business-quantity event. Locks repair_order_line_locations /
   repair_order_location_attribution_uncertain only AFTER the engine call, matching the generic
   engine + ledger-sync trigger''s own lock order (balance, then attribution/projection) -- see
   this migration''s header for the lock-order-inversion fix this corrects.';

REVOKE ALL ON FUNCTION public.putaway_repair_order_stock(uuid, uuid, uuid, jsonb, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.putaway_repair_order_stock(uuid, uuid, uuid, jsonb, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.putaway_repair_order_stock(uuid, uuid, uuid, jsonb, uuid, text) TO authenticated;
