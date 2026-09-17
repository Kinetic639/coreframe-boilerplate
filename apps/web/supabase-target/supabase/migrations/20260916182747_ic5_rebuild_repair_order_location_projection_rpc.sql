-- IC-5: authoritative, user-callable reconciliation entry point, scoped
-- to one RepairOrder. Finds every bucket that RepairOrder's own
-- attribution history has ever touched (via the ledger+links join, the
-- same canonical source the internal primitive itself uses) and
-- rebuilds each. Does not touch buckets this RepairOrder has never
-- contributed to (UNKNOWN markers are bucket-scoped, not RepairOrder-
-- scoped -- a per-order call correctly recomputes whether ITS OWN
-- buckets are now known/unknown against the FULL physical picture
-- there, but cannot and does not attempt a blind, unscoped sweep).
CREATE OR REPLACE FUNCTION public.rebuild_repair_order_location_projection(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_repair_order_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ro RECORD;
  v_bucket RECORD;
  v_results jsonb := '[]'::jsonb;
  v_bucket_count integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT id, organization_id, branch_id INTO v_ro
  FROM public.repair_orders
  WHERE id = p_repair_order_id AND organization_id = p_organization_id AND branch_id = p_branch_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RepairOrder not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'RepairOrder not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  FOR v_bucket IN
    SELECT DISTINCT sle.location_id, sle.variant_id
    FROM public.repair_order_lines rol
    JOIN public.repair_order_line_movement_links rolml ON rolml.repair_order_line_id = rol.id
    JOIN public.inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
    JOIN public.inventory_stock_ledger_entries sle
      ON sle.movement_line_id = iml.id AND sle.balance_field = 'on_hand'
    WHERE rol.repair_order_id = p_repair_order_id
      AND iml.organization_id = p_organization_id AND iml.branch_id = p_branch_id
  LOOP
    v_results := v_results || jsonb_build_array(
      public.rebuild_repair_order_projection_bucket_internal(
        p_organization_id, p_branch_id, v_bucket.location_id, v_bucket.variant_id
      )
    );
    v_bucket_count := v_bucket_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'repair_order_id', p_repair_order_id,
    'buckets_rebuilt', v_bucket_count,
    'results', v_results
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rebuild_repair_order_location_projection(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebuild_repair_order_location_projection(uuid, uuid, uuid, uuid) TO authenticated, service_role;
