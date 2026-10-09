-- Global search (Ctrl+K): candidate lookup built for production scale
-- (~750k repair orders per organization, millions of order lines, hundreds of thousands of parts).
--
-- Measured on 100k orders / 400k lines (warm cache), candidate phase without RLS:
--   * contains + ORDER BY over every match ("kowal", "WVW" — most rows match): ~51 ms, linear in
--     table size (~400 ms at 750k). Cause: all matches are fetched and sorted before LIMIT.
--   * the same contains capped at 300 rows before sorting: ~3 ms, constant (the planner stops early).
--   * prefix through a text_pattern_ops index + ORDER BY: still 35 ms for broad prefixes — that
--     operator class finds the prefix but cannot deliver the ORDER BY, so all matches are sorted.
--   * prefix through a COLLATE "C" b-tree (organization, [branch,] value): 0.02–0.13 ms for every
--     prefix, broad or not — logarithmic, so the same at 750k.
-- Known pitfall (pgsql-hackers): with a very common trigram a GIN bitmap must be built in full
-- before LIMIT applies (45 s vs 29 ms seq scan + LIMIT in a reported case). The planner can only
-- pick the cheap plan when it sees the actual pattern, so the lookups below run as dynamic SQL with
-- literal values (format %L) — a custom plan per query — instead of generic PL/pgSQL plans.
--
-- Tiers per source, best first, deduplicated, LIMIT p_limit:
--   1. identifier prefix (order no, ZL, VIN, part number fingerprint, location / container code,
--      document number, HD- number) through the "C" b-trees — exact-looking input ranks first;
--   2. order lines: part-number prefix (and contains for 5+ characters), capped;
--   3. contains through the trigram GIN indexes, capped at 300 rows before ranking.
--
-- Security: still SECURITY DEFINER returning ids + rank only, refusing non-members of p_org; every
-- value reaches SQL through format('%L') (quoted literal), identifiers are fixed. search_global()
-- reads the rows under RLS as before.
--
-- Indexes: additive. On a production-size database create them CONCURRENTLY from the SQL editor
-- first (CREATE INDEX CONCURRENTLY IF NOT EXISTS …) — this migration then finds them existing.

CREATE INDEX IF NOT EXISTS repair_orders_search_order_no_c_idx
  ON public.repair_orders (organization_id, branch_id, (order_no COLLATE "C")) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS repair_orders_search_zl_c_idx
  ON public.repair_orders (organization_id, branch_id, (upper(zl_number) COLLATE "C")) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS repair_orders_search_vin_c_idx
  ON public.repair_orders (organization_id, branch_id, (upper(vin) COLLATE "C")) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS repair_orders_search_order_number_c_idx
  ON public.repair_orders (organization_id, branch_id, (upper(order_number) COLLATE "C")) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS repair_order_lines_search_fp_c_idx
  ON public.repair_order_lines ((public.inventory_sku_fingerprint(product_code) COLLATE "C")) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS inventory_variants_search_fp_c_idx
  ON public.inventory_variants (organization_id, (public.inventory_sku_fingerprint(sku) COLLATE "C")) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warehouse_locations_search_code_c_idx
  ON public.warehouse_locations (organization_id, branch_id, (upper(code) COLLATE "C")) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS inventory_containers_search_code_c_idx
  ON public.inventory_containers (organization_id, branch_id, (upper(code) COLLATE "C")) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS inventory_movement_headers_search_doc_c_idx
  ON public.inventory_movement_headers (organization_id, branch_id, (upper(document_number) COLLATE "C")) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS helpdesk_tickets_search_number_c_idx
  ON public.helpdesk_tickets (org_id, (ticket_number COLLATE "C")) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.search_global_candidates(
  p_org uuid,
  p_branch uuid,
  p_query text,
  p_source text,
  p_limit integer
)
RETURNS TABLE (id uuid, rank integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  raw text := btrim(coalesce(p_query, ''));
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  cap constant integer := 300;
  esc text;          -- query with LIKE wildcards escaped
  up text;           -- upper-cased escaped query, for identifier prefixes
  fp text;           -- part-number fingerprint of the query (alphanumerics, upper case)
  pat text;          -- '%query%' for contains
  br text := '';     -- branch filter for branch-bound tables
  br_ro text := '';
  ids uuid[] := '{}';
  part uuid[];
BEGIN
  IF p_org IS NULL OR length(raw) < 3 OR length(raw) > 80 OR NOT public.is_org_member(p_org) THEN
    RETURN;
  END IF;

  esc := replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_');
  up := upper(esc);
  pat := '%' || esc || '%';
  fp := coalesce(public.inventory_sku_fingerprint(raw), '');
  IF p_branch IS NOT NULL THEN
    br := format(' AND branch_id = %L', p_branch);
    br_ro := format(' AND ro.branch_id = %L', p_branch);
  END IF;

  IF p_source = 'repairOrders' THEN
    -- 1. identifier prefixes
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id), '{}') FROM (
        (SELECT id FROM public.repair_orders WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
           AND (order_no COLLATE "C") LIKE %3$L ORDER BY (order_no COLLATE "C") LIMIT %4$s)
        UNION ALL
        (SELECT id FROM public.repair_orders WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
           AND (upper(zl_number) COLLATE "C") LIKE %5$L ORDER BY (upper(zl_number) COLLATE "C") LIMIT %4$s)
        UNION ALL
        (SELECT id FROM public.repair_orders WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
           AND (upper(vin) COLLATE "C") LIKE %5$L ORDER BY (upper(vin) COLLATE "C") LIMIT %4$s)
        UNION ALL
        (SELECT id FROM public.repair_orders WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
           AND (upper(order_number) COLLATE "C") LIKE %5$L ORDER BY (upper(order_number) COLLATE "C") LIMIT %4$s)
      ) s$sql$, p_org, br, esc || '%', lim, up || '%') INTO part;
    ids := ids || part;

    -- 2. part number on an order line (prefix; contains from 5 characters)
    IF length(fp) >= 3 THEN
      EXECUTE format($sql$
        SELECT coalesce(array_agg(repair_order_id), '{}') FROM (
          SELECT l.repair_order_id FROM public.repair_order_lines l
          JOIN public.repair_orders ro ON ro.id = l.repair_order_id
          WHERE l.deleted_at IS NULL
            AND (public.inventory_sku_fingerprint(l.product_code) COLLATE "C") LIKE %1$L
            AND ro.organization_id = %2$L%3$s AND ro.deleted_at IS NULL
          ORDER BY (public.inventory_sku_fingerprint(l.product_code) COLLATE "C")
          LIMIT %4$s
        ) s$sql$, fp || '%', p_org, br_ro, lim) INTO part;
      ids := ids || part;
    END IF;
    IF length(fp) >= 5 THEN
      EXECUTE format($sql$
        SELECT coalesce(array_agg(repair_order_id), '{}') FROM (
          SELECT l.repair_order_id FROM public.repair_order_lines l
          JOIN public.repair_orders ro ON ro.id = l.repair_order_id
          WHERE l.deleted_at IS NULL
            AND public.inventory_sku_fingerprint(l.product_code) LIKE %1$L
            AND ro.organization_id = %2$L%3$s AND ro.deleted_at IS NULL
          LIMIT %4$s
        ) s$sql$, '%' || fp || '%', p_org, br_ro, cap) INTO part;
      ids := ids || part;
    END IF;

    -- 3. contains (number, VIN, client, brand), capped before ranking
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.repair_orders
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
          AND (coalesce(order_no, '') || ' ' || coalesce(zl_number, '') || ' ' || coalesce(order_number, '')
                || ' ' || coalesce(vin, '') || ' ' || coalesce(client_name, '') || ' '
                || coalesce(vehicle_brand, '')) ILIKE %3$L
        LIMIT %4$s
      ) s$sql$, p_org, br, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'items' THEN
    IF length(fp) >= 2 THEN
      EXECUTE format($sql$
        SELECT coalesce(array_agg(id), '{}') FROM (
          SELECT id FROM public.inventory_variants
          WHERE organization_id = %1$L AND deleted_at IS NULL
            AND (public.inventory_sku_fingerprint(sku) COLLATE "C") LIKE %2$L
          ORDER BY (public.inventory_sku_fingerprint(sku) COLLATE "C")
          LIMIT %3$s
        ) s$sql$, p_org, fp || '%', lim) INTO part;
      ids := ids || part;
    END IF;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id), '{}') FROM (
        SELECT id FROM public.inventory_variants
        WHERE organization_id = %1$L AND deleted_at IS NULL AND barcode = %2$L
        LIMIT %3$s
      ) s$sql$, p_org, raw, lim) INTO part;
    ids := ids || part;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY name), '{}') FROM (
        (SELECT v.id, v.name FROM public.inventory_variants v
         WHERE v.organization_id = %1$L AND v.deleted_at IS NULL
           AND (v.name ILIKE %2$L OR (%3$s AND public.inventory_sku_fingerprint(v.sku) LIKE %4$L))
         LIMIT %5$s)
        UNION
        (SELECT v.id, p.name FROM public.inventory_products p
         JOIN public.inventory_variants v ON v.product_id = p.id AND v.deleted_at IS NULL
         WHERE p.organization_id = %1$L AND p.deleted_at IS NULL AND p.name ILIKE %2$L
         LIMIT %5$s)
      ) s$sql$, p_org, pat, (length(fp) >= 4)::text, '%' || fp || '%', cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'locations' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id), '{}') FROM (
        SELECT id FROM public.warehouse_locations
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
          AND (upper(code) COLLATE "C") LIKE %3$L
        ORDER BY (upper(code) COLLATE "C") LIMIT %4$s
      ) s$sql$, p_org, br, up || '%', lim) INTO part;
    ids := ids || part;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY code), '{}') FROM (
        SELECT id, code FROM public.warehouse_locations
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
          AND (coalesce(code, '') || ' ' || coalesce(name, '')) ILIKE %3$L
        LIMIT %4$s
      ) s$sql$, p_org, br, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'containers' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id), '{}') FROM (
        SELECT id FROM public.inventory_containers
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
          AND (upper(code) COLLATE "C") LIKE %3$L
        ORDER BY (upper(code) COLLATE "C") LIMIT %4$s
      ) s$sql$, p_org, br, up || '%', lim) INTO part;
    ids := ids || part;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.inventory_containers
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL AND code ILIKE %3$L
        LIMIT %4$s
      ) s$sql$, p_org, br, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'documents' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id), '{}') FROM (
        SELECT id FROM public.inventory_movement_headers
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
          AND (upper(document_number) COLLATE "C") LIKE %3$L
        ORDER BY (upper(document_number) COLLATE "C") DESC LIMIT %4$s
      ) s$sql$, p_org, br, up || '%', lim) INTO part;
    ids := ids || part;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.inventory_movement_headers
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
          AND (coalesce(document_number, '') || ' ' || coalesce(draft_number, '') || ' '
                || coalesce(counterparty_name, '') || ' ' || coalesce(external_reference, '')
                || ' ' || coalesce(source_document_reference, '')) ILIKE %3$L
        LIMIT %4$s
      ) s$sql$, p_org, br, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'tickets' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id), '{}') FROM (
        SELECT id FROM public.helpdesk_tickets
        WHERE org_id = %1$L AND deleted_at IS NULL AND (ticket_number COLLATE "C") LIKE %2$L
        ORDER BY (ticket_number COLLATE "C") DESC LIMIT %3$s
      ) s$sql$, p_org, up || '%', lim) INTO part;
    ids := ids || part;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.helpdesk_tickets
        WHERE org_id = %1$L AND deleted_at IS NULL
          AND (coalesce(ticket_number, '') || ' ' || coalesce(title, '')) ILIKE %2$L
        LIMIT %3$s
      ) s$sql$, p_org, pat, cap) INTO part;
    ids := ids || part;
  END IF;

  -- First occurrence wins: earlier tiers rank higher
  RETURN QUERY
  SELECT u.id, min(u.ord)::integer
  FROM unnest(ids) WITH ORDINALITY AS u(id, ord)
  GROUP BY u.id
  ORDER BY 2
  LIMIT lim;
END;
$$;

REVOKE ALL ON FUNCTION public.search_global_candidates(uuid, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_global_candidates(uuid, uuid, text, text, integer) TO authenticated;
