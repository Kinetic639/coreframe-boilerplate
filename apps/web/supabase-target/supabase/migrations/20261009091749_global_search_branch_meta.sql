-- Global search (Ctrl+K), F5: search_global() rows of branch-bound sources (repair orders,
-- locations, containers, documents) carry meta.branchId, so the palette can tell how many matches
-- live in other branches the user can see ("inne oddziały: 3 wyniki w …"). Same function as
-- 20261009063706 otherwise; RLS unchanged. CREATE OR REPLACE only.

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
            'branchId', ro.branch_id,
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
               jsonb_build_object('branchId', wl.branch_id) AS meta, c.rank
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
               jsonb_strip_nulls(jsonb_build_object('locationCode', wl.code, 'branchId', ct.branch_id)) AS meta, c.rank
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
                 'branchId', h.branch_id,
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
