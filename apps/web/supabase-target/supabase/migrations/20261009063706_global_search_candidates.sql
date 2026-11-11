-- Global search (Ctrl+K), F4 performance fix: two-phase search.
--
-- Problem (measured): under RLS the planner may not evaluate a non-leakproof qual such as
-- ILIKE before the policy quals, so the trigram indexes were unusable — every row of
-- repair_orders / inventory_variants / … ran has_branch_permission() before the text filter.
-- 3 000 repair orders took ~620 ms per query even with no match at all.
--
-- Fix:
--   1. search_global_candidates() — SECURITY DEFINER, returns ONLY ids (+ rank) of the best
--      matches per source, using the trigram indexes without RLS. It refuses callers that
--      are not active members of p_org and returns no other data.
--   2. search_global() — still SECURITY INVOKER: reads the candidate rows by primary key
--      (uuid equality is leakproof, so it is an index lookup) and RLS decides, row by row,
--      what the caller may see. RLS is evaluated for at most a few dozen rows.
-- Candidates are over-fetched (4 × limit) so rows hidden by RLS rarely shorten the list.
--
-- CREATE OR REPLACE only (no DROP): safe to apply through the Supabase MCP.

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
  q text := btrim(coalesce(p_query, ''));
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  pat text;
  prefix text;
  fp text;
BEGIN
  IF p_org IS NULL OR length(q) < 3 OR length(q) > 80 OR NOT public.is_org_member(p_org) THEN
    RETURN;
  END IF;

  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  pat := '%' || q || '%';
  prefix := q || '%';
  fp := coalesce(public.inventory_sku_fingerprint(btrim(p_query)), '');

  IF p_source = 'repairOrders' THEN
    RETURN QUERY
    SELECT c.id, (row_number() OVER (ORDER BY c.is_prefix DESC, c.created_at DESC))::integer
    FROM (
      SELECT ro.id, bool_or(coalesce(ro.order_no, ro.zl_number, '') ILIKE prefix) AS is_prefix,
             max(ro.created_at) AS created_at
      FROM (
        SELECT ro2.id FROM public.repair_orders ro2
        WHERE ro2.organization_id = p_org
          AND (p_branch IS NULL OR ro2.branch_id = p_branch)
          AND ro2.deleted_at IS NULL
          AND (coalesce(ro2.order_no, '') || ' ' || coalesce(ro2.zl_number, '') || ' '
                || coalesce(ro2.order_number, '') || ' ' || coalesce(ro2.vin, '') || ' '
                || coalesce(ro2.client_name, '') || ' ' || coalesce(ro2.vehicle_brand, ''))
              ILIKE pat
        UNION
        SELECT l.repair_order_id FROM public.repair_order_lines l
        WHERE length(fp) >= 4
          AND l.deleted_at IS NULL
          AND public.inventory_sku_fingerprint(l.product_code) LIKE '%' || fp || '%'
      ) hits
      JOIN public.repair_orders ro ON ro.id = hits.id
      WHERE ro.organization_id = p_org
        AND (p_branch IS NULL OR ro.branch_id = p_branch)
        AND ro.deleted_at IS NULL
      GROUP BY ro.id
    ) c
    ORDER BY 2
    LIMIT lim;

  ELSIF p_source = 'items' THEN
    RETURN QUERY
    SELECT v.id,
           (row_number() OVER (
             ORDER BY (public.inventory_sku_fingerprint(v.sku) LIKE fp || '%') DESC, p.name
           ))::integer
    FROM (
      SELECT v1.id FROM public.inventory_variants v1
      WHERE length(fp) >= 3 AND v1.organization_id = p_org AND v1.deleted_at IS NULL
        AND public.inventory_sku_fingerprint(v1.sku) LIKE '%' || fp || '%'
      UNION
      SELECT v2.id FROM public.inventory_variants v2
      WHERE v2.organization_id = p_org AND v2.deleted_at IS NULL AND v2.name ILIKE pat
      UNION
      SELECT v3.id FROM public.inventory_variants v3
      WHERE v3.organization_id = p_org AND v3.deleted_at IS NULL AND v3.barcode = btrim(p_query)
      UNION
      SELECT v4.id FROM public.inventory_products p4
      JOIN public.inventory_variants v4 ON v4.product_id = p4.id AND v4.deleted_at IS NULL
      WHERE p4.organization_id = p_org AND p4.deleted_at IS NULL AND p4.name ILIKE pat
    ) cand
    JOIN public.inventory_variants v ON v.id = cand.id
    JOIN public.inventory_products p ON p.id = v.product_id AND p.deleted_at IS NULL
    ORDER BY 2
    LIMIT lim;

  ELSIF p_source = 'locations' THEN
    RETURN QUERY
    SELECT wl.id,
           (row_number() OVER (ORDER BY (coalesce(wl.code, '') ILIKE prefix) DESC, wl.code))::integer
    FROM public.warehouse_locations wl
    WHERE wl.organization_id = p_org
      AND (p_branch IS NULL OR wl.branch_id = p_branch)
      AND wl.deleted_at IS NULL
      AND (coalesce(wl.code, '') || ' ' || coalesce(wl.name, '')) ILIKE pat
    ORDER BY 2
    LIMIT lim;

  ELSIF p_source = 'containers' THEN
    RETURN QUERY
    SELECT c.id,
           (row_number() OVER (ORDER BY (c.code ILIKE prefix) DESC, c.created_at DESC))::integer
    FROM public.inventory_containers c
    WHERE c.organization_id = p_org
      AND (p_branch IS NULL OR c.branch_id = p_branch)
      AND c.deleted_at IS NULL
      AND c.code ILIKE pat
    ORDER BY 2
    LIMIT lim;

  ELSIF p_source = 'documents' THEN
    RETURN QUERY
    SELECT h.id, (row_number() OVER (ORDER BY h.created_at DESC))::integer
    FROM public.inventory_movement_headers h
    WHERE h.organization_id = p_org
      AND (p_branch IS NULL OR h.branch_id = p_branch)
      AND h.deleted_at IS NULL
      AND (coalesce(h.document_number, '') || ' ' || coalesce(h.draft_number, '') || ' '
            || coalesce(h.counterparty_name, '') || ' ' || coalesce(h.external_reference, '')
            || ' ' || coalesce(h.source_document_reference, '')) ILIKE pat
    ORDER BY 2
    LIMIT lim;

  ELSIF p_source = 'tickets' THEN
    RETURN QUERY
    SELECT t.id, (row_number() OVER (ORDER BY t.created_at DESC))::integer
    FROM public.helpdesk_tickets t
    WHERE t.org_id = p_org
      AND t.deleted_at IS NULL
      AND (coalesce(t.ticket_number, '') || ' ' || coalesce(t.title, '')) ILIKE pat
    ORDER BY 2
    LIMIT lim;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.search_global_candidates(uuid, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_global_candidates(uuid, uuid, text, text, integer) TO authenticated;

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
  cand_lim integer := least(greatest(coalesce(p_limit, 5), 1), 20) * 4;
  pat text;
  fp text;
  result jsonb := '[]'::jsonb;
BEGIN
  IF p_org IS NULL OR length(q) < 3 OR length(q) > 80 THEN
    RETURN result;
  END IF;

  pat := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  fp := coalesce(public.inventory_sku_fingerprint(q), '');

  IF 'repairOrders' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
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
            'matchedPart', CASE
              WHEN length(fp) < 4
                OR (coalesce(ro.order_no, '') || ' ' || coalesce(ro.zl_number, '') || ' '
                    || coalesce(ro.order_number, '') || ' ' || coalesce(ro.vin, '') || ' '
                    || coalesce(ro.client_name, '') || ' ' || coalesce(ro.vehicle_brand, ''))
                   ILIKE pat THEN NULL
              ELSE (
                SELECT l.product_code FROM public.repair_order_lines l
                WHERE l.repair_order_id = ro.id AND l.deleted_at IS NULL
                  AND public.inventory_sku_fingerprint(l.product_code) LIKE '%' || fp || '%'
                LIMIT 1
              )
            END
          )) AS meta,
          c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'repairOrders', cand_lim) c
        JOIN public.repair_orders ro ON ro.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'items' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
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
          )) AS meta,
          top.rank
        FROM (
          SELECT v.id, v.product_id, v.sku, coalesce(nullif(v.name, ''), p.name) AS title, c.rank
          FROM public.search_global_candidates(p_org, p_branch, p_query, 'items', cand_lim) c
          JOIN public.inventory_variants v ON v.id = c.id
          JOIN public.inventory_products p ON p.id = v.product_id
          ORDER BY c.rank
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
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'location' AS type, wl.id, wl.code, wl.name AS title, NULL::text AS status,
               '{}'::jsonb AS meta, c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'locations', cand_lim) c
        JOIN public.warehouse_locations wl ON wl.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'containers' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'container' AS type, ct.id, ct.code, NULL::text AS title, ct.status,
               jsonb_strip_nulls(jsonb_build_object('locationCode', wl.code)) AS meta, c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'containers', cand_lim) c
        JOIN public.inventory_containers ct ON ct.id = c.id
        LEFT JOIN public.warehouse_locations wl ON wl.id = ct.current_location_id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'documents' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'document' AS type, h.id,
               coalesce(h.document_number, h.draft_number) AS code,
               h.counterparty_name AS title, h.status,
               jsonb_strip_nulls(jsonb_build_object(
                 'documentType', h.document_type_code,
                 'date', coalesce(h.document_date::text, h.created_at::date::text)
               )) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'documents', cand_lim) c
        JOIN public.inventory_movement_headers h ON h.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'tickets' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'ticket' AS type, t.id, t.ticket_number AS code, t.title, t.status,
               '{}'::jsonb AS meta, c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'tickets', cand_lim) c
        JOIN public.helpdesk_tickets t ON t.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  -- People: one organization's members, a small set — read directly under RLS
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
