-- =============================================================================
-- Receiving zone: a lighter read for the start page, one shared item list.
--
--   * _inventory_receiving_items        what waits in the receiving zone, one row
--                                       per item (ZL line, ZW line or free stock),
--                                       without names, orders or containers
--   * inventory_receiving_pending       unchanged result; now reads the items
--                                       from the helper and only adds details
--   * inventory_receiving_pending_count how many items wait; the start page
--                                       needs the number only
--
-- The start page used to call inventory_receiving_pending just to count the
-- items, which joined some twenty tables for every visit. The count reads the
-- same item list, so the number on the start page and the rows on the putaway
-- page always agree.
--
-- Also: free stock is no longer worked out with a subquery per stock row, and
-- the last receipt number is looked up only for variants that have free stock.
--
-- Idempotent: safe to run again.
-- =============================================================================

-- 1. The item list ---------------------------------------------------------------
-- Internal: no permission check of its own, so only the two functions below
-- may call it.

CREATE OR REPLACE FUNCTION public._inventory_receiving_items(
  p_organization_id uuid,
  p_branch_id uuid,
  p_receiving uuid
)
 RETURNS TABLE (
  variant_id uuid,
  repair_order_line_id uuid,
  internal_order_line_id uuid,
  transfer_id uuid,
  qty numeric,
  document_number text
 )
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
 ROWS 200
AS $function$
  WITH stock AS (
    SELECT b.variant_id, b.on_hand_quantity AS on_hand
    FROM public.inventory_balances b
    WHERE b.organization_id = p_organization_id AND b.branch_id = p_branch_id
      AND b.location_id = p_receiving AND b.on_hand_quantity > 0
  ),
  attributed AS (
    SELECT sle.variant_id, rolml.repair_order_line_id,
      SUM(CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
          * sle.quantity * (rolml.applied_quantity / iml.quantity)) AS qty,
      MAX(CASE WHEN rolml.relation_type = 'receipt' THEN imh_orig.document_number END) AS document_number
    FROM public.repair_order_line_movement_links rolml
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
      AND sle.location_id = p_receiving
    GROUP BY sle.variant_id, rolml.repair_order_line_id
    HAVING SUM(CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
               * sle.quantity * (rolml.applied_quantity / iml.quantity)) > 0
  ),
  -- Parts reserved under a ZW alone (no repair order) still in the zone.
  zw AS (
    SELECT rl.variant_id, rl.internal_order_line_id,
      CASE WHEN r.reference_type = 'branch_transfer' THEN r.reference_id END AS transfer_id,
      SUM(rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity) AS qty,
      MAX(h.document_number) AS document_number
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    LEFT JOIN public.inventory_movement_lines iml ON iml.id = rl.source_movement_line_id
    LEFT JOIN public.inventory_movement_headers h ON h.id = iml.movement_id
    WHERE rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
      AND rl.location_id = p_receiving
      AND rl.internal_order_line_id IS NOT NULL AND rl.repair_order_line_id IS NULL
      AND r.status <> 'cancelled' AND r.deleted_at IS NULL
    GROUP BY rl.variant_id, rl.internal_order_line_id,
      CASE WHEN r.reference_type = 'branch_transfer' THEN r.reference_id END
    HAVING SUM(rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity) > 0
  ),
  attributed_total AS (
    SELECT a.variant_id, SUM(a.qty) AS qty FROM attributed a GROUP BY a.variant_id
  ),
  zw_total AS (
    SELECT z.variant_id, SUM(z.qty) AS qty FROM zw z GROUP BY z.variant_id
  ),
  free AS (
    SELECT s.variant_id,
      s.on_hand - COALESCE(atot.qty, 0) - COALESCE(ztot.qty, 0) AS qty
    FROM stock s
    LEFT JOIN attributed_total atot ON atot.variant_id = s.variant_id
    LEFT JOIN zw_total ztot ON ztot.variant_id = s.variant_id
  ),
  last_pz AS (
    SELECT DISTINCT ON (iml.variant_id) iml.variant_id, h.document_number
    FROM public.inventory_movement_lines iml
    JOIN public.inventory_movement_headers h ON h.id = iml.movement_id
    WHERE h.organization_id = p_organization_id AND h.branch_id = p_branch_id
      AND h.status = 'posted' AND h.movement_type_code = '101'
      AND iml.destination_location_id = p_receiving AND iml.deleted_at IS NULL
      AND iml.variant_id IN (SELECT f.variant_id FROM free f WHERE f.qty > 0)
    ORDER BY iml.variant_id, h.posted_at DESC
  )
  SELECT a.variant_id, a.repair_order_line_id, NULL::uuid, NULL::uuid,
    LEAST(a.qty, s.on_hand), a.document_number
  FROM attributed a JOIN stock s ON s.variant_id = a.variant_id
  UNION ALL
  SELECT z.variant_id, NULL::uuid, z.internal_order_line_id, z.transfer_id,
    LEAST(z.qty, s.on_hand), z.document_number
  FROM zw z JOIN stock s ON s.variant_id = z.variant_id
  UNION ALL
  SELECT f.variant_id, NULL::uuid, NULL::uuid, NULL::uuid, f.qty, lp.document_number
  FROM free f LEFT JOIN last_pz lp ON lp.variant_id = f.variant_id
  WHERE f.qty > 0;
$function$;

REVOKE ALL ON FUNCTION public._inventory_receiving_items(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 2. The full list, same result as before -----------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_receiving_pending(p_organization_id uuid, p_branch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving uuid;
  v_rows jsonb;
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.read') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.read permission' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_receiving
  FROM public.warehouse_locations
  WHERE organization_id = p_organization_id AND branch_id = p_branch_id
    AND purpose = 'receiving' AND deleted_at IS NULL AND can_store_inventory = true;

  IF v_receiving IS NULL THEN
    RETURN jsonb_build_object('receiving_location_id', NULL, 'items', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'variant_id', i.variant_id,
      'product_id', p.id,
      'sku', v.sku,
      'product_name', p.name,
      'unit_id', p.base_unit_id,
      'unit_code', u.code,
      'quantity', i.qty,
      'document_number', i.document_number,
      'repair_order_line_id', i.repair_order_line_id,
      'repair_order_id', ro.id,
      'zl_number', ro.zl_number,
      'vehicle_brand', ro.vehicle_brand,
      'internal_order_line_id', i.internal_order_line_id,
      'internal_order_id', io.id,
      'internal_order_number', io.order_number,
      'internal_order_external_number', io.external_number,
      'internal_order_client', io.client_name,
      'internal_order_destination', io.destination_code,
      'transfer_id', i.transfer_id,
      'transfer_number', bt.transfer_number,
      'transfer_status', bt.status,
      'handling_mode', COALESCE(st.handling_mode, 'standard'),
      'default_location_id', st.default_location_id,
      'default_location_code', dl.code,
      'default_location_name', dl.name,
      'container_id', c.id,
      'container_code', c.code,
      'container_location_id', c.current_location_id,
      'container_location_code', cl.code,
      'container_location_name', cl.name
    ) ORDER BY ro.zl_number NULLS LAST, io.order_number NULLS LAST, v.sku), '[]'::jsonb)
  INTO v_rows
  FROM public._inventory_receiving_items(p_organization_id, p_branch_id, v_receiving) i
  JOIN public.inventory_variants v ON v.id = i.variant_id
  JOIN public.inventory_products p ON p.id = v.product_id
  LEFT JOIN public.inventory_units u ON u.id = p.base_unit_id
  LEFT JOIN public.repair_order_lines rol ON rol.id = i.repair_order_line_id
  LEFT JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
  LEFT JOIN public.internal_order_lines iol ON iol.id = i.internal_order_line_id
  LEFT JOIN public.internal_orders io ON io.id = iol.internal_order_id
  LEFT JOIN public.inventory_branch_transfers bt ON bt.id = i.transfer_id
  LEFT JOIN public.inventory_product_branch_settings st
    ON st.product_id = p.id AND st.branch_id = p_branch_id
  LEFT JOIN public.warehouse_locations dl ON dl.id = st.default_location_id
  LEFT JOIN LATERAL (
    SELECT ic.id, ic.code, ic.current_location_id
    FROM public.inventory_containers ic
    WHERE ro.id IS NOT NULL
      AND ic.organization_id = p_organization_id AND ic.branch_id = p_branch_id
      AND ic.reference_type = 'repair_order' AND ic.reference_id = ro.id::text
      AND ic.deleted_at IS NULL AND ic.status IN ('active', 'empty')
    ORDER BY (ic.status = 'active') DESC, ic.created_at
    LIMIT 1
  ) c ON true
  LEFT JOIN public.warehouse_locations cl ON cl.id = c.current_location_id;

  RETURN jsonb_build_object('receiving_location_id', v_receiving, 'items', v_rows);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_receiving_pending(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_receiving_pending(uuid, uuid) TO authenticated;

-- 3. Just the number, for the start page ------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_receiving_pending_count(p_organization_id uuid, p_branch_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving uuid;
  v_count integer;
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.read') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.read permission' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_receiving
  FROM public.warehouse_locations
  WHERE organization_id = p_organization_id AND branch_id = p_branch_id
    AND purpose = 'receiving' AND deleted_at IS NULL AND can_store_inventory = true;

  IF v_receiving IS NULL THEN
    RETURN 0;
  END IF;

  -- Same rows as the full list: every item's variant has a product.
  SELECT count(*)::integer INTO v_count
  FROM public._inventory_receiving_items(p_organization_id, p_branch_id, v_receiving) i
  JOIN public.inventory_variants v ON v.id = i.variant_id
  JOIN public.inventory_products p ON p.id = v.product_id;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_receiving_pending_count(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_receiving_pending_count(uuid, uuid) TO authenticated;
