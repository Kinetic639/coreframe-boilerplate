-- Global search (Ctrl+K), F4 performance follow-up to 20261009060958_global_search.
--
-- 1. Fragment search needs at least 3 characters. Trigram indexes cannot serve shorter
--    patterns, so a 2-character query would scan whole tables and evaluate RLS on every row.
--    Short identifiers are still found by the exact-hit lookups in the server action.
-- 2. Candidates are collected per index with UNION (part-number fingerprint, name, product
--    name; order text, order lines) instead of OR across tables, which the planner cannot
--    serve from several indexes and turns into a full scan on large tables.
-- 3. Stock levels are summed only for the rows that are returned (after LIMIT).
--
-- CREATE OR REPLACE only (no DROP): safe to apply through the Supabase MCP.

CREATE OR REPLACE FUNCTION public.search_global(
  p_org uuid,
  p_branch uuid,
  p_query text,
  p_sources text[],
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  q text := btrim(coalesce(p_query, ''));
  lim integer := least(greatest(coalesce(p_limit, 5), 1), 20);
  pat text;
  prefix text;
  fp text;
  result jsonb := '[]'::jsonb;
BEGIN
  IF p_org IS NULL OR length(q) < 3 OR length(q) > 80 THEN
    RETURN result;
  END IF;

  -- LIKE wildcards in the query are literal characters
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  pat := '%' || q || '%';
  prefix := q || '%';
  fp := coalesce(public.inventory_sku_fingerprint(btrim(p_query)), '');

  IF 'repairOrders' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT
          'repairOrder' AS type,
          ro.id,
          coalesce(ro.order_no, ro.zl_number, ro.order_number) AS code,
          nullif(concat_ws(' · ', ro.client_name, ro.vehicle_brand), '') AS title,
          ro.status,
          jsonb_strip_nulls(jsonb_build_object(
            'warehouseCode', ro.warehouse_code,
            'vin', ro.vin,
            'matchedPart', CASE WHEN c.by_text THEN NULL ELSE c.part END
          )) AS meta
        FROM (
          SELECT id, bool_or(by_text) AS by_text, max(part) AS part
          FROM (
            SELECT ro2.id, true AS by_text, NULL::text AS part
            FROM public.repair_orders ro2
            WHERE ro2.organization_id = p_org
              AND (p_branch IS NULL OR ro2.branch_id = p_branch)
              AND ro2.deleted_at IS NULL
              AND (coalesce(ro2.order_no, '') || ' ' || coalesce(ro2.zl_number, '') || ' '
                    || coalesce(ro2.order_number, '') || ' ' || coalesce(ro2.vin, '') || ' '
                    || coalesce(ro2.client_name, '') || ' ' || coalesce(ro2.vehicle_brand, ''))
                  ILIKE pat
            UNION ALL
            SELECT l.repair_order_id, false, l.product_code
            FROM public.repair_order_lines l
            WHERE length(fp) >= 4
              AND l.deleted_at IS NULL
              AND public.inventory_sku_fingerprint(l.product_code) LIKE '%' || fp || '%'
          ) hits
          GROUP BY id
        ) c
        JOIN public.repair_orders ro ON ro.id = c.id
        WHERE ro.organization_id = p_org
          AND (p_branch IS NULL OR ro.branch_id = p_branch)
          AND ro.deleted_at IS NULL
        ORDER BY (coalesce(ro.order_no, ro.zl_number, '') ILIKE prefix) DESC, ro.created_at DESC
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'items' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT
          'item' AS type,
          top.product_id AS id,
          top.sku AS code,
          top.title,
          NULL::text AS status,
          jsonb_strip_nulls(jsonb_build_object(
            'onHand', stock.on_hand,
            'available', stock.available
          )) AS meta
        FROM (
          SELECT v.id, v.product_id, v.sku, coalesce(nullif(v.name, ''), p.name) AS title
          FROM (
            SELECT v1.id FROM public.inventory_variants v1
            WHERE length(fp) >= 3 AND v1.organization_id = p_org AND v1.deleted_at IS NULL
              AND public.inventory_sku_fingerprint(v1.sku) LIKE '%' || fp || '%'
            UNION
            SELECT v2.id FROM public.inventory_variants v2
            WHERE v2.organization_id = p_org AND v2.deleted_at IS NULL AND v2.name ILIKE pat
            UNION
            SELECT v3.id FROM public.inventory_variants v3
            WHERE v3.organization_id = p_org AND v3.deleted_at IS NULL
              AND v3.barcode = btrim(p_query)
            UNION
            SELECT v4.id FROM public.inventory_products p4
            JOIN public.inventory_variants v4 ON v4.product_id = p4.id AND v4.deleted_at IS NULL
            WHERE p4.organization_id = p_org AND p4.deleted_at IS NULL AND p4.name ILIKE pat
          ) cand
          JOIN public.inventory_variants v ON v.id = cand.id
          JOIN public.inventory_products p ON p.id = v.product_id AND p.deleted_at IS NULL
          ORDER BY (public.inventory_sku_fingerprint(v.sku) LIKE fp || '%') DESC, p.name
          LIMIT lim
        ) top
        LEFT JOIN LATERAL (
          SELECT sum(b.on_hand_quantity) AS on_hand, sum(b.available_quantity) AS available
          FROM public.inventory_balances b
          WHERE b.variant_id = top.id AND b.organization_id = p_org
            AND (p_branch IS NULL OR b.branch_id = p_branch)
        ) stock ON true
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'locations' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT 'location' AS type, wl.id, wl.code, wl.name AS title, NULL::text AS status,
               '{}'::jsonb AS meta
        FROM public.warehouse_locations wl
        WHERE wl.organization_id = p_org
          AND (p_branch IS NULL OR wl.branch_id = p_branch)
          AND wl.deleted_at IS NULL
          AND (coalesce(wl.code, '') || ' ' || coalesce(wl.name, '')) ILIKE pat
        ORDER BY (coalesce(wl.code, '') ILIKE prefix) DESC, wl.code
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'containers' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT 'container' AS type, c.id, c.code, NULL::text AS title, c.status,
               jsonb_strip_nulls(jsonb_build_object('locationCode', wl.code)) AS meta
        FROM public.inventory_containers c
        LEFT JOIN public.warehouse_locations wl ON wl.id = c.current_location_id
        WHERE c.organization_id = p_org
          AND (p_branch IS NULL OR c.branch_id = p_branch)
          AND c.deleted_at IS NULL
          AND c.code ILIKE pat
        ORDER BY (c.code ILIKE prefix) DESC, c.created_at DESC
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'documents' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT 'document' AS type, h.id,
               coalesce(h.document_number, h.draft_number) AS code,
               h.counterparty_name AS title, h.status,
               jsonb_strip_nulls(jsonb_build_object(
                 'documentType', h.document_type_code,
                 'date', coalesce(h.document_date::text, h.created_at::date::text)
               )) AS meta
        FROM public.inventory_movement_headers h
        WHERE h.organization_id = p_org
          AND (p_branch IS NULL OR h.branch_id = p_branch)
          AND h.deleted_at IS NULL
          AND (coalesce(h.document_number, '') || ' ' || coalesce(h.draft_number, '') || ' '
                || coalesce(h.counterparty_name, '') || ' ' || coalesce(h.external_reference, '')
                || ' ' || coalesce(h.source_document_reference, '')) ILIKE pat
        ORDER BY h.created_at DESC
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'tickets' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT 'ticket' AS type, t.id, t.ticket_number AS code, t.title, t.status,
               '{}'::jsonb AS meta
        FROM public.helpdesk_tickets t
        WHERE t.org_id = p_org
          AND t.deleted_at IS NULL
          AND (coalesce(t.ticket_number, '') || ' ' || coalesce(t.title, '')) ILIKE pat
        ORDER BY t.created_at DESC
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'people' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT 'person' AS type, u.id,
               NULL::text AS code,
               coalesce(nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''),
                        u.email) AS title,
               NULL::text AS status,
               jsonb_strip_nulls(jsonb_build_object('email', u.email)) AS meta
        FROM public.organization_members m
        JOIN public.users u ON u.id = m.user_id AND u.deleted_at IS NULL
        WHERE m.organization_id = p_org
          AND m.deleted_at IS NULL
          AND m.status = 'active'
          AND (coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '') || ' '
                || coalesce(u.email, '')) ILIKE pat
        ORDER BY u.first_name, u.last_name
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  RETURN result;
END;
$$;
