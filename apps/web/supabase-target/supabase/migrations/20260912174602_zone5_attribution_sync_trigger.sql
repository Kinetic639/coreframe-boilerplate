-- ============================================================================
-- IC-8 REPRODUCIBILITY RECONSTRUCTION (2026-09-22)
-- ============================================================================
-- Historically applied live, never locally mirrored. Reconstructed at its
-- own original timestamp.
--
-- COLLAPSES TWO HISTORICAL MIGRATIONS INTO ONE, DISCLOSED EXPLICITLY:
-- the live migration history additionally shows
-- `20260914123823_zone5_attribution_sync_trigger_max_uuid_fix`, applied
-- ~2 days after this one, fixing an unknown defect in this same function
-- (name suggests a `max()`-over-`uuid`-cast issue in the confidence-
-- inference aggregate below). Its EXACT original (pre-fix) text is not
-- recoverable: no locally-mirrored migration shows a diff against it
-- specifically (the next migration to touch this function,
-- `ic5_repair_order_location_attribution_sync_reversal_aware`, replaces
-- the WHOLE function body and is itself already correct/final on this
-- point). Per this pass's own explicit instruction to never invent
-- semantics, this reconstruction represents the function in its
-- ALREADY-FIXED shape directly (i.e. as of immediately before IC-5's own
-- reversal-aware rewrite) rather than fabricate a plausible bug. The
-- sibling placeholder file at the original `max_uuid_fix` timestamp
-- documents this collapse explicitly and makes no further schema change.
--
-- CONFIDENCE: HIGH for everything below the (absent, by design) reversal
-- branch. `docs/inventory/reviews/ic-5-review/migration-summary.md`'s own
-- item 5 states, of the reversal-aware rewrite that immediately follows
-- this reconstruction in migration order: "Adds a reversal-detection
-- branch ahead of the existing logic... All pre-existing logic
-- (confidence-based inference, putaway UNKNOWN-stickiness) left
-- byte-for-byte unchanged below this branch." The body below is that
-- exact "pre-existing logic," extracted by removing ONLY the reversal-
-- detection branch from the function's own final, live-captured body
-- (captured via `pg_get_functiondef` earlier in the A8 pass, before A8
-- dropped this function) -- not independently re-derived.
--
-- See docs/inventory/reviews/ic-8-final-production-readiness-review/
-- migration-reproducibility.md for the full evidence trail.

CREATE OR REPLACE FUNCTION public.repair_order_location_attribution_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pre_effect_on_hand numeric;
  v_attributed_sum     numeric;
  v_distinct_lines     integer;
  v_dest               uuid;
  v_source             uuid;
  v_line_id            uuid;
  v_ro_id               uuid;
  v_source_was_unknown boolean;
  v_confident_known    boolean;
BEGIN
  IF NEW.balance_field IS DISTINCT FROM 'on_hand' THEN
    RETURN NULL;
  END IF;

  IF NEW.direction <> 'decrease' THEN
    RETURN NULL;
  END IF;

  IF current_setting('ambra.repair_order_attribution_authoritative', true) = 'on' THEN
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

REVOKE ALL ON FUNCTION public.repair_order_location_attribution_sync() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER repair_order_line_locations_ledger_sync
  AFTER INSERT ON public.inventory_stock_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.repair_order_location_attribution_sync();
