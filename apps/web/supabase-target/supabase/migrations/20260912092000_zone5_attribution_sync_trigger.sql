-- =============================================================================
-- Migration: zone5_attribution_sync_trigger
-- Zone:      05 (Receiving / Putaway) -- Phase 3
-- Date:      2026-09-12
-- =============================================================================
-- Approved architecture: docs/mvp/zones/05-receiving-putaway-implementation-plan.md
-- sections 1.3/1.3a/1.3b/1.6a/1.6b/1.6c/2/3/5/6/12.1/13 (final pseudocode).
--
-- *** VERIFICATION GAP -- READ BEFORE APPLYING, DO NOT APPLY BLIND ***
-- This migration attaches a trigger to `inventory_stock_ledger_entries` and
-- references its columns (organization_id, branch_id, location_id,
-- variant_id, movement_line_id, balance_field, direction, quantity,
-- balance_after). This session verified, by direct repo search, that NO
-- tracked migration anywhere in this repository contains a CREATE TABLE for
-- `inventory_stock_ledger_entries` (nor for `inventory_movement_audit_log`) --
-- the entire table is schema-drift, not merely the RPC bodies already
-- accepted as tech debt. Supabase MCP / live DB access was unavailable this
-- session, so the exact column list below could NOT be independently
-- re-verified against a live database in this pass.
--
-- The column list used here is the CONVERGENT result of two independent
-- sources: (a) docs/warehouse-movements-refactor-plan.md's own v1 schema
-- design ("organization_id, branch_id, location_id, variant_id, ...
-- movement_id, movement_line_id, movement_type_code, ... effect_id,
-- balance_field, direction, quantity, balance_after, ..."), and (b)
-- docs/mvp/zones/07-normal-issue-movement-audit.md's LIVE VERIFIED trace
-- (Supabase MCP, prior session, via pg_get_functiondef of
-- inventory_finalize_posting), which independently cites the identical
-- column set as what that function actually inserts. Both agree; neither is
-- this session's own live confirmation.
--
-- REQUIRED BEFORE THIS MIGRATION IS ACTUALLY APPLIED to any real database:
-- a session with Supabase MCP (or equivalent reviewed access) must run
-- `\d inventory_stock_ledger_entries` (or the MCP equivalent) against the
-- live target project and confirm every column this trigger references
-- exists with the expected type/semantics, per the plan's own Phase 0 gate.
-- This is the specific, disclosed contradiction-risk the working rules asked
-- to be reported rather than silently assumed past.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: the trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repair_order_location_attribution_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_pre_effect_on_hand numeric;
  v_attributed_sum     numeric;
  v_distinct_lines     integer;
  v_dest               uuid;
  v_line_id            uuid;
  v_ro_id              uuid;
  v_marker_exists      boolean;
BEGIN
  -- 1.3a: physical stock only. reserved/allocated/blocked/consignment effects
  -- never touch spatial RepairOrder attribution.
  IF NEW.balance_field IS DISTINCT FROM 'on_hand' THEN
    RETURN NULL;
  END IF;

  -- 1.6b rule 1: the ONE automatic clearing path. Zero stock trivially means
  -- zero ambiguity. Runs unconditionally, even under the bypass flag below --
  -- it is a statement about physical reality (nothing left), not a re-trust
  -- of prior math, and RepairOrder-aware RPCs (which set the bypass flag)
  -- would otherwise never get this cleanup at all.
  IF NEW.balance_after = 0 THEN
    DELETE FROM public.repair_order_location_attribution_uncertain
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id;
  END IF;

  -- Duplicate-work suppression ONLY (plan §12.1) -- NOT authorization. A
  -- RepairOrder-aware RPC (receive_repair_order_stock / putaway_repair_order_stock)
  -- has already written its own explicit, known-true attribution for the one
  -- line it touched; it does not get to clear a bucket-wide marker just by
  -- writing (that would violate §1.6b), so nothing further is needed here
  -- besides skipping the propagate-or-mark logic below.
  IF current_setting('ambra.repair_order_attribution_authoritative', true) = 'on' THEN
    RETURN NULL;
  END IF;

  -- 1.3b: fast no-op path -- nothing attributed AND nothing already flagged
  -- uncertain at this exact (location, variant). Cheap, indexed, keeps the
  -- overhead on ordinary non-RepairOrder movements to one lookup.
  IF NOT EXISTS (
    SELECT 1 FROM public.repair_order_line_locations
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.repair_order_location_attribution_uncertain
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Only decreases are ever actionable here. Increases are either the paired
  -- destination half of a transfer (handled by the paired decrease's own
  -- invocation, which fires first: effect_order 1 before 2), or a pure
  -- receipt (101) -- receive_repair_order_stock handles that explicitly;
  -- there is nothing pre-existing to infer a fresh receipt's attribution from.
  IF NEW.direction <> 'decrease' THEN
    RETURN NULL;
  END IF;

  -- Look up the movement line once -- needed on both the marker-gate branch
  -- and the math branch, to know whether this is transfer-shaped (801) or a
  -- pure decrease (402 / future issue).
  SELECT destination_location_id INTO v_dest
  FROM public.inventory_movement_lines
  WHERE id = NEW.movement_line_id;

  -- 1.6a (the load-bearing correction): the marker GATES further reasoning.
  -- It is never bypassed by a later math check that happens to look
  -- unambiguous -- once a bucket is uncertain, it stays uncertain until
  -- authoritatively cleared (1.6b), never by arithmetic coincidence.
  SELECT EXISTS (
    SELECT 1 FROM public.repair_order_location_attribution_uncertain
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
  ) INTO v_marker_exists;

  IF v_marker_exists THEN
    -- Re-affirm at source (idempotent) and extend to destination if
    -- transfer-shaped -- stock of already-unknown provenance is now moving
    -- further, spreading the uncertainty rather than curing it.
    INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
      VALUES (NEW.organization_id, NEW.branch_id, NEW.location_id, NEW.variant_id)
      ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
    IF v_dest IS NOT NULL THEN
      INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
        VALUES (NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id)
        ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
    END IF;
    RETURN NULL;
  END IF;

  -- No pre-existing marker: safe to attempt the math test, fresh, for this
  -- movement only.
  --
  -- 1.3: reconstruct pre-effect on-hand from the ledger row's OWN columns --
  -- never re-query inventory_balances, which by the time this AFTER INSERT
  -- trigger fires already reflects the POST-effect value
  -- (inventory_finalize_posting's traced order is: update balance, THEN
  -- insert the ledger row).
  v_pre_effect_on_hand := NEW.balance_after + NEW.quantity;

  SELECT sum(quantity), count(DISTINCT repair_order_line_id)
    INTO v_attributed_sum, v_distinct_lines
    FROM public.repair_order_line_locations
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
    FOR UPDATE;

  IF v_attributed_sum IS DISTINCT FROM v_pre_effect_on_hand OR v_distinct_lines <> 1 THEN
    -- Ambiguous: never guess. Mark BOTH ends UNKNOWN if transfer-shaped
    -- (plan §2); only the source if a pure decrease (plan §5). Leave
    -- existing repair_order_line_locations rows untouched -- never deleted,
    -- never zeroed, just no longer trustworthy without the marker context.
    INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
      VALUES (NEW.organization_id, NEW.branch_id, NEW.location_id, NEW.variant_id)
      ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
    IF v_dest IS NOT NULL THEN
      INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
        VALUES (NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id)
        ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
    END IF;
    RETURN NULL;
  END IF;

  -- Unambiguous: exactly one repair_order_line_id accounts for 100% of the
  -- reconstructed pre-effect on-hand. Safe to propagate exactly.
  SELECT repair_order_line_id, repair_order_id INTO v_line_id, v_ro_id
    FROM public.repair_order_line_locations
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id;

  UPDATE public.repair_order_line_locations
    SET quantity = quantity - NEW.quantity
    WHERE repair_order_line_id = v_line_id AND location_id = NEW.location_id;

  IF v_dest IS NOT NULL THEN
    INSERT INTO public.repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES (NEW.organization_id, NEW.branch_id, v_ro_id, v_line_id, NEW.variant_id, v_dest, NEW.quantity)
    ON CONFLICT (repair_order_line_id, location_id)
    DO UPDATE SET quantity = public.repair_order_line_locations.quantity + NEW.quantity;
  END IF;
  -- v_dest IS NULL: pure decrease (issue/402-shaped) -- credited nowhere, by design.

  RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.repair_order_location_attribution_sync() IS
  'Zone 5 safety net (plan §1/§13): keeps repair_order_line_locations correct for movements NOT
   posted through a RepairOrder-aware RPC (e.g. Zone 6''s generic 801 relocation). Never guesses:
   propagates only when exactly one RepairOrderLine provably accounts for 100% of the
   reconstructed pre-effect on_hand at that (location, variant); otherwise marks the bucket(s)
   UNKNOWN via repair_order_location_attribution_uncertain and takes no other action. See the
   migration header for the disclosed, unresolved verification gap on
   inventory_stock_ledger_entries''s exact column list.';

-- ---------------------------------------------------------------------------
-- PART 2: attach the trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS repair_order_line_locations_ledger_sync ON public.inventory_stock_ledger_entries;
CREATE TRIGGER repair_order_line_locations_ledger_sync
  AFTER INSERT ON public.inventory_stock_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.repair_order_location_attribution_sync();

REVOKE ALL ON FUNCTION public.repair_order_location_attribution_sync() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_order_location_attribution_sync() FROM anon;
-- Trigger functions execute as part of the INSERT statement's own privileges via
-- SECURITY DEFINER above; no direct EXECUTE grant to `authenticated` is needed
-- or given (matching how other trigger functions in this schema are not
-- directly callable, only fired).
