-- INVENTORY CORE A8 -- REPAIR ORDER PROJECTION SIMPLIFICATION (1 of 7)
--
-- Adds the new live-read primitive that replaces the incremental
-- repair_order_line_locations projection: get_repair_order_line_physical_
-- state(p_organization_id, p_branch_id, p_repair_order_line_id) computes a
-- RepairOrderLine's own physical-location state DIRECTLY from canonical
-- data (repair_order_line_movement_links + inventory_stock_ledger_entries
-- + inventory_balances) on every read, rather than from a persisted,
-- incrementally-maintained table.
--
-- SCOPE: bounded to exactly the (location, variant) buckets THIS
-- RepairOrderLine has ever touched via its own canonical attribution
-- links -- never the whole organization's attribution graph (per this
-- pass's own explicit "narrowest useful query" requirement).
--
-- FORMULA: reuses, verbatim, the proportional contribution formula
-- rebuild_repair_order_projection_bucket_internal used (removed later in
-- this same migration set) -- not independently re-derived. EXTENDED with
-- reversal-awareness: a linked movement line whose own header was
-- reversed (inventory_movement_headers.reversal_movement_id) also nets in
-- the reversal's own corresponding line (same line_number, guaranteed
-- identical quantity per inventory_reverse_movement's own INSERT), using
-- the SAME applied_quantity/iml.quantity ratio. This replaces the removed
-- trigger's own reversal-link-mirroring branch with a read-time JOIN
-- instead of a write-time mirrored row -- proven necessary live during
-- this pass (an initial version without reversal-awareness falsely raised
-- P0008 after a legitimate, fully-reversed receipt; fixed before this
-- migration was written).
--
-- CONSERVATION / P0008 CONTRACT: a bucket-level history inconsistency
-- (known attribution exceeding physical on_hand, or a negative net
-- contribution for any line at that bucket) fails EXPLICITLY via
-- RAISE EXCEPTION ... P0008 -- the exact SQLSTATE the old rebuild
-- primitive used for the same concept -- never silently clamped or
-- guessed. Live-reproduced against current (pre-A8) code before this
-- pass touched anything: a generic, non-RepairOrder-aware decrease at an
-- attributed bucket (no canonical link created) causes exactly this gap.
--
-- SECURITY: SECURITY INVOKER, not DEFINER. Every table read here already
-- has RLS FORCED with an authenticated SELECT grant (live-verified this
-- pass), so this function needs no actor/permission check of its own --
-- it inherits the caller's own existing visibility boundary, matching the
-- read-only design the method it replaces (RepairOrdersService.
-- getPhysicalStateForLine) has always had (no actor param, no permission
-- check, pure RLS-scoped reads).

CREATE OR REPLACE FUNCTION public.get_repair_order_line_physical_state(
  p_organization_id uuid,
  p_branch_id uuid,
  p_repair_order_line_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_bucket RECORD;
  v_locations jsonb := '[]'::jsonb;
  v_physical_on_hand numeric;
  v_total_known numeric;
  v_my_qty numeric;
  v_contribution RECORD;
BEGIN
  FOR v_bucket IN
    SELECT DISTINCT sle.location_id, sle.variant_id
    FROM public.repair_order_line_movement_links rolml
    JOIN public.inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
    JOIN public.inventory_stock_ledger_entries sle
      ON sle.movement_line_id = iml.id AND sle.balance_field = 'on_hand'
    WHERE rolml.repair_order_line_id = p_repair_order_line_id
      AND iml.organization_id = p_organization_id AND iml.branch_id = p_branch_id
  LOOP
    SELECT on_hand_quantity INTO v_physical_on_hand
    FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_bucket.location_id AND variant_id = v_bucket.variant_id;
    v_physical_on_hand := COALESCE(v_physical_on_hand, 0);

    v_total_known := 0;
    v_my_qty := 0;

    FOR v_contribution IN
      SELECT rol.id AS repair_order_line_id,
        SUM(
          CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
          * sle.quantity * (rolml.applied_quantity / iml.quantity)
        ) AS net_qty
      FROM public.repair_order_line_movement_links rolml
      JOIN public.repair_order_lines rol ON rol.id = rolml.repair_order_line_id
      JOIN public.inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
      JOIN public.inventory_movement_headers imh_orig ON imh_orig.id = iml.movement_id
      JOIN LATERAL (
        SELECT iml.id AS ml_id
        UNION ALL
        SELECT rev_line.id
        FROM public.inventory_movement_lines rev_line
        WHERE imh_orig.reversal_movement_id IS NOT NULL
          AND rev_line.movement_id = imh_orig.reversal_movement_id
          AND rev_line.line_number = iml.line_number
      ) candidate ON true
      JOIN public.inventory_stock_ledger_entries sle
        ON sle.movement_line_id = candidate.ml_id AND sle.balance_field = 'on_hand'
      WHERE iml.organization_id = p_organization_id AND iml.branch_id = p_branch_id
        AND sle.location_id = v_bucket.location_id AND sle.variant_id = v_bucket.variant_id
      GROUP BY rol.id
      HAVING SUM(
        CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
        * sle.quantity * (rolml.applied_quantity / iml.quantity)
      ) <> 0
    LOOP
      IF v_contribution.net_qty < 0 THEN
        RAISE EXCEPTION 'Physical-state computation found a negative net contribution -- history inconsistency' USING ERRCODE = 'P0008';
      END IF;
      v_total_known := v_total_known + v_contribution.net_qty;
      IF v_contribution.repair_order_line_id = p_repair_order_line_id THEN
        v_my_qty := v_contribution.net_qty;
      END IF;
    END LOOP;

    IF v_total_known > v_physical_on_hand THEN
      RAISE EXCEPTION 'Physical-state computation found known attribution exceeding physical on_hand -- history inconsistency' USING ERRCODE = 'P0008';
    END IF;

    IF v_my_qty <> 0 THEN
      v_locations := v_locations || jsonb_build_array(jsonb_build_object(
        'location_id', v_bucket.location_id,
        'variant_id', v_bucket.variant_id,
        'quantity', v_my_qty
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'repair_order_line_id', p_repair_order_line_id,
    'locations', v_locations
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_repair_order_line_physical_state(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_repair_order_line_physical_state(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_repair_order_line_physical_state(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_repair_order_line_physical_state(uuid, uuid, uuid) TO service_role;
