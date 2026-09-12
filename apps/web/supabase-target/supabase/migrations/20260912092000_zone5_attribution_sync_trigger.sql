-- =============================================================================
-- Migration: zone5_attribution_sync_trigger
-- Zone:      05 (Receiving / Putaway) -- Phase 3
-- Date:      2026-09-12
-- =============================================================================
-- Approved architecture: docs/mvp/zones/05-receiving-putaway-implementation-plan.md
-- sections 1.3/1.3a/1.3b/1.6a/1.6b/1.6c/2/3/5/6/12.1/13 (final pseudocode).
--
-- *** SECOND CORRECTION ROUND (this revision) -- ZERO-CLEAR ORDERING BUG ***
-- The prior revision deleted the source bucket's UNKNOWN marker as its very
-- first act whenever `NEW.balance_after = 0`, then fell through into the
-- generic marker-gate/math logic below. That destroyed the "was this bucket
-- UNKNOWN before this event" signal before it could be used: a bucket that
-- had just gone physically empty could re-enter the math test against
-- stale, no-longer-trustworthy rows, either re-marking UNKNOWN (harmless but
-- wrong -- contradicts "on_hand=0 clears the marker") or, worse, finding a
-- coincidental arithmetic match and propagating a GUESSED attribution to a
-- transfer's destination. Fixed by: (1) capturing whether the source was
-- already UNKNOWN *before* any mutation; (2) treating "balance_after = 0" as
-- its own decisive, physical-truth-is-authoritative branch that unconditionally
-- wipes ALL repair_order_line_locations rows for that exact bucket (not just
-- the one row a normal decrement would touch) and clears the marker, and
-- that either propagates KNOWN attribution to a transfer's destination (only
-- when the source was confidently KNOWN, computed BEFORE the wipe) or marks
-- the destination UNKNOWN (when the source was UNKNOWN or ambiguous) -- and
-- (3) never falling through from that branch into the generic logic
-- afterward.
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
  v_source_was_unknown boolean;
  v_confident_known    boolean;
BEGIN
  -- 1.3a: physical stock only. reserved/allocated/blocked/consignment effects
  -- never touch spatial RepairOrder attribution.
  IF NEW.balance_field IS DISTINCT FROM 'on_hand' THEN
    RETURN NULL;
  END IF;

  -- Duplicate-work suppression ONLY (plan §12.1) -- NOT authorization. A
  -- RepairOrder-aware RPC has already written its own explicit, known-true
  -- attribution for the one line it touched. It still gets the harmless,
  -- physical-truth-only zero cleanup below (nothing else, and nothing that
  -- requires knowing "was this bucket UNKNOWN before" -- that question only
  -- matters for the generic marker/math reasoning further down, which this
  -- branch never reaches).
  IF current_setting('ambra.repair_order_attribution_authoritative', true) = 'on' THEN
    IF NEW.balance_after = 0 THEN
      DELETE FROM public.repair_order_location_attribution_uncertain
        WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
          AND location_id = NEW.location_id AND variant_id = NEW.variant_id;
    END IF;
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

  -- Look up the movement line once -- needed on every remaining branch, to
  -- know whether this is transfer-shaped (801) or a pure decrease (402 /
  -- future issue).
  SELECT destination_location_id INTO v_dest
  FROM public.inventory_movement_lines
  WHERE id = NEW.movement_line_id;

  -- CORRECTNESS FIX (external review, second round): capture whether the
  -- SOURCE bucket was already marked UNKNOWN *before* anything below can
  -- mutate it -- this must be known BEFORE any destructive clearing happens,
  -- not after. The previous revision deleted the zero-bucket's marker as its
  -- very first act, which destroyed exactly this signal and let a bucket
  -- that had just gone physically empty fall through into the generic
  -- math test using stale, no-longer-trustworthy rows -- reintroducing a
  -- guess (or a spurious re-mark) the marker-gate design was supposed to
  -- prevent. Locked (FOR UPDATE is valid inside a plain EXISTS subquery --
  -- unlike the top-level aggregate case fixed in the previous round, this is
  -- not an aggregate query).
  SELECT EXISTS (
    SELECT 1 FROM public.repair_order_location_attribution_uncertain
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
    FOR UPDATE
  ) INTO v_source_was_unknown;

  -- If the source was NOT already marked uncertain, it is safe to attempt
  -- the math test (1.6a: never run this when a marker already exists --
  -- stale rows are not trustworthy inputs to any calculation). Locks the
  -- rows via a CTE first, then aggregates over the locked set in the same
  -- statement (the aggregate+FOR UPDATE fix from the previous round).
  v_confident_known := false;
  IF NOT v_source_was_unknown THEN
    v_pre_effect_on_hand := NEW.balance_after + NEW.quantity;

    WITH locked_rows AS (
      SELECT quantity, repair_order_line_id, repair_order_id
      FROM public.repair_order_line_locations
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id
      FOR UPDATE
    )
    SELECT sum(quantity), count(DISTINCT repair_order_line_id), max(repair_order_line_id), max(repair_order_id)
      INTO v_attributed_sum, v_distinct_lines, v_line_id, v_ro_id
      FROM locked_rows;

    v_confident_known := (v_attributed_sum IS NOT DISTINCT FROM v_pre_effect_on_hand) AND v_distinct_lines = 1;
  END IF;

  -- =========================================================================
  -- SPECIAL CASE (external review, second round): physical truth says the
  -- source bucket is now EMPTY. This is handled as its own decisive branch,
  -- BEFORE the generic marker-gate/math logic below, and never falls through
  -- to it -- on_hand = 0 is authoritative regardless of prior KNOWN/UNKNOWN
  -- state, so ANY leftover projection row for this exact bucket (stale or
  -- not) is provably wrong and must be removed, not left for a later
  -- statement to (mis)judge.
  -- =========================================================================
  IF NEW.balance_after = 0 THEN
    DELETE FROM public.repair_order_line_locations
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id;

    DELETE FROM public.repair_order_location_attribution_uncertain
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id;

    IF v_dest IS NOT NULL THEN
      IF v_confident_known THEN
        -- Source was KNOWN, single-line, and exactly emptied by this event --
        -- propagate the real, known attribution to the destination (computed
        -- above, BEFORE the DELETE just above wiped the source rows).
        INSERT INTO public.repair_order_line_locations
          (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
        VALUES (NEW.organization_id, NEW.branch_id, v_ro_id, v_line_id, NEW.variant_id, v_dest, NEW.quantity)
        ON CONFLICT (repair_order_line_id, location_id)
        DO UPDATE SET quantity = public.repair_order_line_locations.quantity + NEW.quantity;
      ELSE
        -- Source was UNKNOWN (v_source_was_unknown), or was ambiguous/
        -- commingled (math ran but did not resolve to one confident line):
        -- stock of unproven provenance moved to the destination -- never
        -- guess. Mark it UNKNOWN, unconditionally, even if it had zero prior
        -- attribution rows of its own.
        INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
          VALUES (NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id)
          ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
      END IF;
    END IF;
    -- v_dest IS NULL: pure decrease to zero -- source cleared, nothing else
    -- to do; there is no destination bucket for a pure decrease.
    RETURN NULL;
  END IF;

  -- =========================================================================
  -- Non-zero-result decrease: the bucket still has stock remaining. Existing
  -- marker-gate-then-math logic, unchanged in spirit from the prior round.
  -- =========================================================================
  IF v_source_was_unknown THEN
    -- Re-affirm at source (idempotent) and extend to destination if
    -- transfer-shaped -- stock of already-unknown provenance is now moving
    -- further, spreading the uncertainty rather than curing it. Never
    -- cleared merely because a later math check would have looked
    -- unambiguous (1.6a) -- and indeed no math was even attempted above.
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

  IF NOT v_confident_known THEN
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

  -- Unambiguous, non-zero remainder: exactly one repair_order_line_id
  -- accounts for 100% of the reconstructed pre-effect on-hand -- v_line_id/
  -- v_ro_id were already captured from the locked read above.
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
   UNKNOWN via repair_order_location_attribution_uncertain and takes no other action. When
   on_hand reaches exactly zero, physical truth is authoritative regardless of prior KNOWN/
   UNKNOWN state: ALL projection rows for that bucket are wiped and its marker cleared; a
   transfer''s destination is credited with real attribution only if the source was confidently
   KNOWN before the wipe, otherwise the destination is marked UNKNOWN. See the migration header
   for the disclosed, unresolved verification gap on inventory_stock_ledger_entries''s exact
   column list.';

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
