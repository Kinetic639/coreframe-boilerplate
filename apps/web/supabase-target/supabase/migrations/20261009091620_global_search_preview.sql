-- Global search (Ctrl+K), F5: preview pane data for the highlighted result.
--
-- SECURITY INVOKER: every read goes through the caller's RLS — the pane shows nothing the
-- user could not open anyway. Bounded work: one product / one repair order, a few rows each.
--
--   search_preview_item(product, branch)   — SKUs, stock per location in the branch, open repair
--                                            orders that need the part (by variant or by the
--                                            part-number fingerprint of Matcher lines)
--   search_preview_repair_order(order)     — header, line counts, first lines
--
-- CREATE OR REPLACE only (no DROP): safe to apply through the Supabase MCP.

CREATE OR REPLACE FUNCTION public.search_preview_item(p_product uuid, p_branch uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH v AS (
    SELECT id, sku, public.inventory_sku_fingerprint(sku) AS fp
    FROM public.inventory_variants
    WHERE product_id = p_product AND deleted_at IS NULL
  ),
  stock AS (
    SELECT wl.code, wl.name,
           sum(b.on_hand_quantity) AS on_hand,
           sum(b.reserved_quantity + b.allocated_quantity) AS committed,
           sum(b.available_quantity) AS available
    FROM public.inventory_balances b
    JOIN v ON v.id = b.variant_id
    LEFT JOIN public.warehouse_locations wl ON wl.id = b.location_id
    WHERE (p_branch IS NULL OR b.branch_id = p_branch) AND b.on_hand_quantity <> 0
    GROUP BY wl.code, wl.name
    ORDER BY sum(b.on_hand_quantity) DESC
    LIMIT 6
  ),
  orders AS (
    SELECT ro.id, coalesce(ro.order_no, ro.zl_number, ro.order_number) AS code, ro.client_name,
           ro.warehouse_code, ro.status, sum(l.ordered_quantity) AS quantity
    FROM public.repair_order_lines l
    JOIN public.repair_orders ro ON ro.id = l.repair_order_id AND ro.deleted_at IS NULL
    WHERE l.deleted_at IS NULL
      AND ro.status = 'open'
      AND (p_branch IS NULL OR ro.branch_id = p_branch)
      AND (
        l.variant_id IN (SELECT id FROM v)
        OR (public.inventory_sku_fingerprint(l.product_code) COLLATE "C") IN (
          SELECT fp COLLATE "C" FROM v WHERE fp <> ''
        )
      )
    GROUP BY ro.id
    ORDER BY max(ro.created_at) DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'name', (SELECT name FROM public.inventory_products WHERE id = p_product AND deleted_at IS NULL),
    'brand', (SELECT brand_name FROM public.inventory_products WHERE id = p_product),
    'skus', coalesce((SELECT jsonb_agg(sku ORDER BY sku) FROM v), '[]'::jsonb),
    'onHand', coalesce((SELECT sum(on_hand) FROM stock), 0),
    'committed', coalesce((SELECT sum(committed) FROM stock), 0),
    'available', coalesce((SELECT sum(available) FROM stock), 0),
    'locations', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'code', code, 'name', name, 'onHand', on_hand)) FROM stock), '[]'::jsonb),
    'orders', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'code', code, 'client', client_name, 'warehouseCode', warehouse_code,
        'quantity', quantity)) FROM orders), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.search_preview_repair_order(p_order uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE WHEN ro.id IS NULL THEN NULL ELSE jsonb_build_object(
    'code', coalesce(ro.order_no, ro.zl_number, ro.order_number),
    'zlNumber', ro.zl_number,
    'orderYear', ro.order_year,
    'warehouseCode', ro.warehouse_code,
    'client', ro.client_name,
    'dealer', ro.dealer_name,
    'vehicleBrand', ro.vehicle_brand,
    'vin', ro.vin,
    'status', ro.status,
    'createdAt', ro.created_at,
    'lineCount', (SELECT count(*) FROM public.repair_order_lines l
                  WHERE l.repair_order_id = ro.id AND l.deleted_at IS NULL),
    'linkedLineCount', (SELECT count(*) FROM public.repair_order_lines l
                        WHERE l.repair_order_id = ro.id AND l.deleted_at IS NULL
                          AND l.variant_id IS NOT NULL),
    'lines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'code', x.product_code, 'name', x.product_name,
               'quantity', x.ordered_quantity, 'unit', x.unit) ORDER BY x.created_at)
      FROM (SELECT product_code, product_name, ordered_quantity, unit, created_at
            FROM public.repair_order_lines
            WHERE repair_order_id = ro.id AND deleted_at IS NULL
            ORDER BY created_at
            LIMIT 5) x
    ), '[]'::jsonb)
  ) END
  FROM (SELECT 1) one
  LEFT JOIN public.repair_orders ro ON ro.id = p_order AND ro.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.search_preview_item(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_preview_item(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.search_preview_repair_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_preview_repair_order(uuid) TO authenticated;
