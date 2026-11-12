-- ============================================================================
-- Products list: a filter for every column
-- ============================================================================
-- inventory_product_page_by_stock (20261112100000) paged products by their
-- stock sums with a stock condition. The list now filters every column:
-- name and SKU (contains), type, status, the four quantities (from / to) and
-- the last change (from / to). The quantities need the per-product sums, so
-- they filter here; v2 adds the ranges and the change dates, the rest is v1.
-- v1 stays (no DROP here); nothing calls it after this release.
-- SECURITY INVOKER: every row read is the caller's to read (RLS).
--
-- p_ranges: {"on_hand": {"min": 1, "max": 10}, "available": {...},
--            "reserved": {...}, "blocked": {...}} -- any key, any bound.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_product_page_by_stock_v2(
  p_org_id uuid,
  p_branch_id uuid,
  p_sort_field text,
  p_ascending boolean,
  p_search text,
  p_name text,
  p_statuses text[],
  p_types text[],
  p_only_ids uuid[],
  p_stock text,
  p_ranges jsonb,
  p_updated_from timestamptz,
  p_updated_to timestamptz,
  p_limit integer,
  p_offset integer
)
RETURNS TABLE (product_id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.id, p.updated_at,
      CASE p_sort_field
        WHEN 'name' THEN p.name
        WHEN 'status' THEN p.status::text
        WHEN 'product_type' THEN p.product_type::text
        ELSE NULL
      END AS sort_text
    FROM inventory_products p
    WHERE p.organization_id = p_org_id
      AND p.deleted_at IS NULL
      AND (p_statuses IS NULL OR p.status::text = ANY (p_statuses))
      AND (p_types IS NULL OR p.product_type::text = ANY (p_types))
      AND (p_only_ids IS NULL OR p.id = ANY (p_only_ids))
      AND (p_name IS NULL OR p.name ILIKE p_name)
      AND (p_updated_from IS NULL OR p.updated_at >= p_updated_from)
      AND (p_updated_to IS NULL OR p.updated_at < p_updated_to)
      AND (
        p_search IS NULL
        OR p.name ILIKE p_search
        OR EXISTS (
          SELECT 1 FROM inventory_variants v
          WHERE v.product_id = p.id
            AND v.organization_id = p_org_id
            AND v.deleted_at IS NULL
            AND (v.sku ILIKE p_search OR v.barcode ILIKE p_search)
        )
      )
  ),
  totals AS (
    SELECT
      b.id,
      b.updated_at,
      b.sort_text,
      COALESCE(SUM(bal.on_hand_quantity), 0) AS on_hand,
      COALESCE(SUM(bal.available_quantity), 0) AS available,
      COALESCE(SUM(bal.reserved_quantity + bal.allocated_quantity), 0) AS reserved,
      COALESCE(SUM(bal.blocked), 0) AS blocked
    FROM base b
    LEFT JOIN inventory_variants v
      ON v.product_id = b.id AND v.organization_id = p_org_id AND v.deleted_at IS NULL
    LEFT JOIN inventory_balances bal
      ON bal.variant_id = v.id
     AND bal.organization_id = p_org_id
     AND (p_branch_id IS NULL OR bal.branch_id = p_branch_id)
    GROUP BY b.id, b.updated_at, b.sort_text
  ),
  filtered AS (
    SELECT t.*,
      CASE p_sort_field
        WHEN 'on_hand_quantity' THEN t.on_hand
        WHEN 'available_quantity' THEN t.available
        WHEN 'reserved_total_quantity' THEN t.reserved
        WHEN 'blocked_quantity' THEN t.blocked
        ELSE NULL
      END AS sort_value
    FROM totals t
    WHERE (
        p_stock IS NULL
        OR ('available' = ANY (string_to_array(p_stock, ',')) AND t.available > 0)
        OR ('unavailable' = ANY (string_to_array(p_stock, ',')) AND t.available <= 0)
        OR ('reserved' = ANY (string_to_array(p_stock, ',')) AND t.reserved > 0)
        OR ('blocked' = ANY (string_to_array(p_stock, ',')) AND t.blocked > 0)
      )
      AND (p_ranges #>> '{on_hand,min}' IS NULL OR t.on_hand >= (p_ranges #>> '{on_hand,min}')::numeric)
      AND (p_ranges #>> '{on_hand,max}' IS NULL OR t.on_hand <= (p_ranges #>> '{on_hand,max}')::numeric)
      AND (p_ranges #>> '{available,min}' IS NULL OR t.available >= (p_ranges #>> '{available,min}')::numeric)
      AND (p_ranges #>> '{available,max}' IS NULL OR t.available <= (p_ranges #>> '{available,max}')::numeric)
      AND (p_ranges #>> '{reserved,min}' IS NULL OR t.reserved >= (p_ranges #>> '{reserved,min}')::numeric)
      AND (p_ranges #>> '{reserved,max}' IS NULL OR t.reserved <= (p_ranges #>> '{reserved,max}')::numeric)
      AND (p_ranges #>> '{blocked,min}' IS NULL OR t.blocked >= (p_ranges #>> '{blocked,min}')::numeric)
      AND (p_ranges #>> '{blocked,max}' IS NULL OR t.blocked <= (p_ranges #>> '{blocked,max}')::numeric)
  )
  SELECT f.id, count(*) OVER ()
  FROM filtered f
  ORDER BY
    CASE WHEN p_ascending THEN f.sort_value END ASC NULLS LAST,
    CASE WHEN NOT p_ascending THEN f.sort_value END DESC NULLS LAST,
    CASE WHEN p_ascending THEN f.sort_text END ASC,
    CASE WHEN NOT p_ascending THEN f.sort_text END DESC,
    CASE WHEN p_ascending THEN f.updated_at END ASC,
    CASE WHEN NOT p_ascending THEN f.updated_at END DESC,
    f.id
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset);
$$;

REVOKE ALL ON FUNCTION public.inventory_product_page_by_stock_v2(
  uuid, uuid, text, boolean, text, text, text[], text[], uuid[], text, jsonb, timestamptz,
  timestamptz, integer, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_product_page_by_stock_v2(
  uuid, uuid, text, boolean, text, text, text[], text[], uuid[], text, jsonb, timestamptz,
  timestamptz, integer, integer
) TO authenticated;
