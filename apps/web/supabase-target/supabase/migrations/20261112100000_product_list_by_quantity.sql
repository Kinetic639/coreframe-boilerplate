-- ============================================================================
-- Products list: sort and filter by stock (per branch, or the whole org)
-- ============================================================================
-- The list's quantities (on hand, available, R = reserved + allocated,
-- B = blocked) are sums of inventory_balances over a product's live variants.
-- They were computed in the app after a page was read, so the list could not
-- sort by them (it fell back to updated_at) nor filter on them.
--
-- inventory_product_page_by_stock returns one page of product ids in the
-- asked order, with the total count, for the same filters the list has
-- (search in name / variant SKU / barcode, status, type, ids pre-resolved by
-- tags or custom fields) plus a stock filter. SECURITY INVOKER: every row
-- read is the caller's to read (RLS on products, variants, balances).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_product_page_by_stock(
  p_org_id uuid,
  p_branch_id uuid,
  p_sort_field text,
  p_ascending boolean,
  p_search text,
  p_statuses text[],
  p_types text[],
  p_only_ids uuid[],
  p_stock text,
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
    SELECT p.id, p.updated_at
    FROM inventory_products p
    WHERE p.organization_id = p_org_id
      AND p.deleted_at IS NULL
      AND (p_statuses IS NULL OR p.status::text = ANY (p_statuses))
      AND (p_types IS NULL OR p.product_type::text = ANY (p_types))
      AND (p_only_ids IS NULL OR p.id = ANY (p_only_ids))
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
    GROUP BY b.id, b.updated_at
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
    -- p_stock: a comma-separated list of conditions, any of which keeps the row.
    WHERE p_stock IS NULL
       OR ('available' = ANY (string_to_array(p_stock, ',')) AND t.available > 0)
       OR ('unavailable' = ANY (string_to_array(p_stock, ',')) AND t.available <= 0)
       OR ('reserved' = ANY (string_to_array(p_stock, ',')) AND t.reserved > 0)
       OR ('blocked' = ANY (string_to_array(p_stock, ',')) AND t.blocked > 0)
  )
  SELECT f.id, count(*) OVER ()
  FROM filtered f
  ORDER BY
    CASE WHEN p_ascending THEN f.sort_value END ASC NULLS LAST,
    CASE WHEN NOT p_ascending THEN f.sort_value END DESC NULLS LAST,
    CASE WHEN p_ascending THEN f.updated_at END ASC,
    CASE WHEN NOT p_ascending THEN f.updated_at END DESC,
    f.id
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset);
$$;

REVOKE ALL ON FUNCTION public.inventory_product_page_by_stock(
  uuid, uuid, text, boolean, text, text[], text[], uuid[], text, integer, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_product_page_by_stock(
  uuid, uuid, text, boolean, text, text[], text[], uuid[], text, integer, integer
) TO authenticated;
