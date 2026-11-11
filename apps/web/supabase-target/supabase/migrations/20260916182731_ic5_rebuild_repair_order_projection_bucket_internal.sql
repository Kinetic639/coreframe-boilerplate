-- IC-5: the single authoritative, deterministic derivation of the
-- RepairOrder physical projection (Concept C) from canonical physical
-- history (Concept A: inventory_stock_ledger_entries) and canonical
-- business attribution (Concept B: repair_order_line_movement_links),
-- for exactly one (org, branch, location, variant) bucket -- the same
-- granularity the ledger-sync trigger itself already operates at.
--
-- Internal-only: not directly callable by ordinary authenticated users
-- (see the grant revocation below). Two callers, by design:
--   1. The ledger-sync trigger, for the narrow reversal case (see the
--      next migration) -- this IS the incremental fast path for
--      reversal, not merely a fallback, so rebuild-equals-incremental
--      holds BY CONSTRUCTION for that case.
--   2. rebuild_repair_order_location_projection (public wrapper, next
--      migration but one), for authoritative on-demand reconciliation.
--
-- Deterministic, idempotent, safe to re-run: always DELETEs then fully
-- recomputes this bucket's own known rows and UNKNOWN marker from
-- scratch, purely from immutable ledger + attribution history. Creates
-- no movement/ledger history. Does not alter business attribution
-- history (repair_order_line_movement_links is read-only here, except
-- for the reversal-mirroring INSERT performed by the trigger caller
-- BEFORE it invokes this function -- this function itself never writes
-- that table).
--
-- Never clamps: a negative or over-attributed reconciliation result
-- raises P0008 rather than silently correcting itself, per the explicit
-- "no negative projection, no silent clamping" instruction.
CREATE OR REPLACE FUNCTION public.rebuild_repair_order_projection_bucket_internal(
  p_organization_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_variant_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_physical_on_hand numeric;
  v_contribution RECORD;
  v_total_known numeric := 0;
  v_line_count integer := 0;
  v_marked_unknown boolean := false;
BEGIN
  -- Lock the bucket via the SAME row every other writer of this bucket
  -- already locks (inventory_balances) -- no new lock primitive
  -- introduced. Reentrant-safe: a caller already holding this lock in
  -- the same transaction (e.g. the posting engine, earlier in the same
  -- call) can re-acquire it without deadlocking itself.
  SELECT on_hand_quantity INTO v_physical_on_hand
  FROM public.inventory_balances
  WHERE organization_id = p_organization_id AND branch_id = p_branch_id
    AND location_id = p_location_id AND variant_id = p_variant_id
  FOR UPDATE;

  v_physical_on_hand := COALESCE(v_physical_on_hand, 0);

  DELETE FROM public.repair_order_line_locations
  WHERE organization_id = p_organization_id AND branch_id = p_branch_id
    AND location_id = p_location_id AND variant_id = p_variant_id;

  -- Recompute every RepairOrderLine's own net attributed contribution to
  -- this exact bucket, purely from canonical history: for every link
  -- (receipt/issue/reversal) on a movement line whose own ledger effects
  -- touched this bucket, prorate the ledger's own physical quantity by
  -- the fraction of that movement line's own quantity this link
  -- attributes to this RepairOrderLine (1:1 when the whole line is
  -- attributed to one line; split proportionally when attributed across
  -- multiple RepairOrderLines; a reversal's own link naturally nets
  -- against the original via the ledger's own opposite-signed effect at
  -- the SAME location, since reversal writes its own separate ledger
  -- rows referencing its own separate, but linked, movement line).
  FOR v_contribution IN
    SELECT rol.id AS repair_order_line_id, rol.repair_order_id,
      SUM(
        CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
        * sle.quantity * (rolml.applied_quantity / iml.quantity)
      ) AS net_qty
    FROM public.repair_order_line_movement_links rolml
    JOIN public.repair_order_lines rol ON rol.id = rolml.repair_order_line_id
    JOIN public.inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
    JOIN public.inventory_stock_ledger_entries sle
      ON sle.movement_line_id = iml.id AND sle.balance_field = 'on_hand'
    WHERE iml.organization_id = p_organization_id AND iml.branch_id = p_branch_id
      AND sle.location_id = p_location_id AND sle.variant_id = p_variant_id
    GROUP BY rol.id, rol.repair_order_id
    HAVING SUM(
      CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
      * sle.quantity * (rolml.applied_quantity / iml.quantity)
    ) <> 0
  LOOP
    IF v_contribution.net_qty < 0 THEN
      RAISE EXCEPTION 'Projection rebuild found a negative net contribution (%) for RepairOrderLine % at location %, variant % -- history inconsistency, not clamped',
        v_contribution.net_qty, v_contribution.repair_order_line_id, p_location_id, p_variant_id
        USING ERRCODE = 'P0008';
    END IF;

    INSERT INTO public.repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES (p_organization_id, p_branch_id, v_contribution.repair_order_id, v_contribution.repair_order_line_id,
            p_variant_id, p_location_id, v_contribution.net_qty);

    v_total_known := v_total_known + v_contribution.net_qty;
    v_line_count := v_line_count + 1;
  END LOOP;

  IF v_total_known > v_physical_on_hand THEN
    RAISE EXCEPTION 'Projection rebuild found known attribution (%) exceeding physical on_hand (%) at location %, variant % -- history inconsistency',
      v_total_known, v_physical_on_hand, p_location_id, p_variant_id
      USING ERRCODE = 'P0008';
  END IF;

  DELETE FROM public.repair_order_location_attribution_uncertain
  WHERE organization_id = p_organization_id AND branch_id = p_branch_id
    AND location_id = p_location_id AND variant_id = p_variant_id;

  IF v_total_known < v_physical_on_hand THEN
    INSERT INTO public.repair_order_location_attribution_uncertain
      (organization_id, branch_id, location_id, variant_id, first_uncertain_at)
    VALUES (p_organization_id, p_branch_id, p_location_id, p_variant_id, now());
    v_marked_unknown := true;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id, 'branch_id', p_branch_id,
    'location_id', p_location_id, 'variant_id', p_variant_id,
    'physical_on_hand', v_physical_on_hand, 'total_known', v_total_known,
    'known_line_count', v_line_count, 'unknown', v_marked_unknown
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rebuild_repair_order_projection_bucket_internal(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
