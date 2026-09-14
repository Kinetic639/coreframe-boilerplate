-- =============================================================================
-- Migration: zone5_attribution_sync_trigger_max_uuid_fix
-- Zone:      05 (Receiving / Putaway) -- Phase 3 forward correction
-- Date:      2026-09-13
-- =============================================================================
-- *** LIVE-VERIFICATION CORRECTION (fourth correction pass, live/MCP session) ***
--
-- 20260912092000_zone5_attribution_sync_trigger.sql -- ALREADY APPLIED to the
-- live database as of this session -- contains a real, execution-time bug
-- that no static/schema-level review could have caught: its ambiguity-test
-- query aggregates two `uuid` columns with `max()`:
--
--   SELECT sum(quantity), count(DISTINCT repair_order_line_id),
--          max(repair_order_line_id), max(repair_order_id)
--     FROM locked_rows;
--
-- Standard PostgreSQL has no built-in `max(uuid)`/`min(uuid)` aggregate (the
-- `uuid` type defines comparison operators but no default aggregate). This
-- raises `ERROR: function max(uuid) does not exist` the moment the ambiguity
-- test's aggregate branch actually executes -- discovered only by live
-- execution of pgTAP test 095 (test #2, the single-unambiguous-source
-- propagation branch), not by any migration/type/constraint inspection, since
-- the bug is in aggregate-function *availability*, not column shape.
--
-- Per the working rules: this migration NEVER edits the already-applied
-- 20260912092000 migration file in place. It is a forward correction --
-- CREATE OR REPLACE FUNCTION re-defines the SAME function (same name, same
-- signature, same OID), which the already-attached trigger picks up
-- automatically; no DROP/CREATE TRIGGER is needed or done.
--
-- Fix: cast the two `uuid` columns to `text` for the aggregate, then cast the
-- result back to `uuid`. This is provably safe and semantically identical to
-- the original intent: `max(...)` here is used ONLY as a way to pull the one
-- value out of a set already proven (via the same statement's own
-- `count(DISTINCT repair_order_line_id) = 1` check performed immediately
-- after) to contain exactly one distinct `repair_order_line_id` -- and,
-- because `repair_order_id` is functionally dependent on
-- `repair_order_line_id` (a line belongs to exactly one RepairOrder), exactly
-- one distinct `repair_order_id` too. `max()` over a single repeated value is
-- that value, regardless of the comparison/ordering semantics used to reach
-- it -- text-based lexicographic max is exactly as safe as any other ordering
-- would be here, since there is only ever one candidate. No other logic in
-- the function changes.
--
-- No new migration for 093/094/096/097 pgTAP is needed -- 095's own fixture
-- (already live-verification-corrected this pass for FK/constraint gaps) is
-- unchanged by this fix; it is simply re-run against the corrected function.
-- =============================================================================

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
  IF NEW.balance_field IS DISTINCT FROM 'on_hand' THEN
    RETURN NULL;
  END IF;

  IF current_setting('ambra.repair_order_attribution_authoritative', true) = 'on' THEN
    IF NEW.balance_after = 0 THEN
      DELETE FROM public.repair_order_location_attribution_uncertain
        WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
          AND location_id = NEW.location_id AND variant_id = NEW.variant_id;
    END IF;
    RETURN NULL;
  END IF;

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

  IF NEW.direction <> 'decrease' THEN
    RETURN NULL;
  END IF;

  SELECT destination_location_id INTO v_dest
  FROM public.inventory_movement_lines
  WHERE id = NEW.movement_line_id;

  SELECT EXISTS (
    SELECT 1 FROM public.repair_order_location_attribution_uncertain
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
    FOR UPDATE
  ) INTO v_source_was_unknown;

  v_confident_known := false;
  IF NOT v_source_was_unknown THEN
    v_pre_effect_on_hand := NEW.balance_after + NEW.quantity;

    -- FIX (this migration): max(uuid) does not exist in standard PostgreSQL --
    -- cast to text for the aggregate, then back to uuid. Safe: only used when
    -- v_distinct_lines (computed in the same statement) turns out to be 1,
    -- i.e. exactly one distinct value exists to "max" over.
    WITH locked_rows AS (
      SELECT quantity, repair_order_line_id, repair_order_id
      FROM public.repair_order_line_locations
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id
      FOR UPDATE
    )
    SELECT sum(quantity), count(DISTINCT repair_order_line_id),
           max(repair_order_line_id::text)::uuid, max(repair_order_id::text)::uuid
      INTO v_attributed_sum, v_distinct_lines, v_line_id, v_ro_id
      FROM locked_rows;

    v_confident_known := (v_attributed_sum IS NOT DISTINCT FROM v_pre_effect_on_hand) AND v_distinct_lines = 1;
  END IF;

  IF NEW.balance_after = 0 THEN
    DELETE FROM public.repair_order_line_locations
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id;

    DELETE FROM public.repair_order_location_attribution_uncertain
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id;

    IF v_dest IS NOT NULL THEN
      IF v_confident_known THEN
        INSERT INTO public.repair_order_line_locations
          (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
        VALUES (NEW.organization_id, NEW.branch_id, v_ro_id, v_line_id, NEW.variant_id, v_dest, NEW.quantity)
        ON CONFLICT (repair_order_line_id, location_id)
        DO UPDATE SET quantity = public.repair_order_line_locations.quantity + NEW.quantity;
      ELSE
        INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
          VALUES (NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id)
          ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
      END IF;
    END IF;
    RETURN NULL;
  END IF;

  IF v_source_was_unknown THEN
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
   KNOWN before the wipe, otherwise the destination is marked UNKNOWN. [Live-verification fix,
   fourth pass:] the ambiguity-test aggregate casts repair_order_line_id/repair_order_id to text
   for max() (PostgreSQL has no built-in max(uuid)), then back to uuid -- safe because it is only
   evaluated when exactly one distinct repair_order_line_id exists in the locked set.';
