-- Global search (Ctrl+K), phase F4: text search across operational data.
--
-- search_global() is SECURITY INVOKER: every source is read with the caller's RLS, exactly like
-- a normal list query. The server action decides which sources the caller may search (module
-- entitlement + permissions) and passes them in p_sources; branch-bound data (repair orders,
-- locations, containers, stock documents, stock levels) is limited to p_branch.
--
-- Part numbers are compared by inventory_sku_fingerprint() (upper-case, alphanumerics only), so
-- "2K5 807-221" finds "2K5807221KGRU". Repair orders are also found by a part number on any of
-- their lines. Trigram GIN indexes back every ILIKE '%…%' below; each index expression is
-- repeated verbatim in the function so the planner can use it.
--
-- Additive only (no DROP): safe to apply through the Supabase MCP.

CREATE INDEX IF NOT EXISTS repair_orders_search_trgm_idx
  ON public.repair_orders USING gin (
    (coalesce(order_no, '') || ' ' || coalesce(zl_number, '') || ' ' || coalesce(order_number, '')
      || ' ' || coalesce(vin, '') || ' ' || coalesce(client_name, '') || ' '
      || coalesce(vehicle_brand, '')) extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS repair_order_lines_code_fingerprint_trgm_idx
  ON public.repair_order_lines USING gin (
    public.inventory_sku_fingerprint(product_code) extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_variants_sku_fingerprint_trgm_idx
  ON public.inventory_variants USING gin (
    public.inventory_sku_fingerprint(sku) extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_variants_name_trgm_idx
  ON public.inventory_variants USING gin (name extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_products_name_trgm_idx
  ON public.inventory_products USING gin (name extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS warehouse_locations_search_trgm_idx
  ON public.warehouse_locations USING gin (
    (coalesce(code, '') || ' ' || coalesce(name, '')) extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_containers_code_trgm_idx
  ON public.inventory_containers USING gin (code extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_movement_headers_search_trgm_idx
  ON public.inventory_movement_headers USING gin (
    (coalesce(document_number, '') || ' ' || coalesce(draft_number, '') || ' '
      || coalesce(counterparty_name, '') || ' ' || coalesce(external_reference, '') || ' '
      || coalesce(source_document_reference, '')) extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS helpdesk_tickets_search_trgm_idx
  ON public.helpdesk_tickets USING gin (
    (coalesce(ticket_number, '') || ' ' || coalesce(title, '')) extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS users_search_trgm_idx
  ON public.users USING gin (
    (coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, ''))
      extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;

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
  IF p_org IS NULL OR length(q) < 2 OR length(q) > 80 THEN
    RETURN result;
  END IF;

  -- LIKE wildcards in the query are literal characters
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  pat := '%' || q || '%';
  prefix := q || '%';
  fp := public.inventory_sku_fingerprint(btrim(p_query));

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
            'matchedPart', CASE
              WHEN (coalesce(ro.order_no, '') || ' ' || coalesce(ro.zl_number, '') || ' '
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
          )) AS meta
        FROM public.repair_orders ro
        WHERE ro.organization_id = p_org
          AND (p_branch IS NULL OR ro.branch_id = p_branch)
          AND ro.deleted_at IS NULL
          AND (
            (coalesce(ro.order_no, '') || ' ' || coalesce(ro.zl_number, '') || ' '
              || coalesce(ro.order_number, '') || ' ' || coalesce(ro.vin, '') || ' '
              || coalesce(ro.client_name, '') || ' ' || coalesce(ro.vehicle_brand, ''))
              ILIKE pat
            OR (length(fp) >= 4 AND ro.id IN (
              SELECT l.repair_order_id FROM public.repair_order_lines l
              WHERE l.deleted_at IS NULL
                AND public.inventory_sku_fingerprint(l.product_code) LIKE '%' || fp || '%'
            ))
          )
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
          p.id,
          v.sku AS code,
          coalesce(nullif(v.name, ''), p.name) AS title,
          NULL::text AS status,
          jsonb_strip_nulls(jsonb_build_object(
            'onHand', stock.on_hand,
            'available', stock.available
          )) AS meta
        FROM public.inventory_variants v
        JOIN public.inventory_products p ON p.id = v.product_id AND p.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT sum(b.on_hand_quantity) AS on_hand, sum(b.available_quantity) AS available
          FROM public.inventory_balances b
          WHERE b.variant_id = v.id AND b.organization_id = p_org
            AND (p_branch IS NULL OR b.branch_id = p_branch)
        ) stock ON true
        WHERE v.organization_id = p_org
          AND v.deleted_at IS NULL
          AND (
            (length(fp) >= 2 AND public.inventory_sku_fingerprint(v.sku) LIKE '%' || fp || '%')
            OR v.name ILIKE pat
            OR p.name ILIKE pat
            OR v.barcode = btrim(p_query)
          )
        ORDER BY (public.inventory_sku_fingerprint(v.sku) LIKE fp || '%') DESC, p.name
        LIMIT lim
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

REVOKE ALL ON FUNCTION public.search_global(uuid, uuid, text, text[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_global(uuid, uuid, text, text[], integer) TO authenticated;
