-- Global search (Ctrl+K), F8: P3 sources — kanban boards, warehouse maps (layouts), Help Desk ticket
-- types, invitations, comment text and attachment names. Same two phases: candidates SECURITY DEFINER
-- (ids only, members only, capped contains through trigram indexes), rows read under RLS — comments
-- and attachments through their existing target-based policies (internal comments stay internal).
-- Indexes are additive; on a production-size database create them CONCURRENTLY first.
-- CREATE OR REPLACE only (no DROP): safe to apply through the Supabase MCP.

CREATE INDEX IF NOT EXISTS planning_kanban_boards_search_trgm_idx
  ON public.planning_kanban_boards USING gin (
    (coalesce(title, '') || ' ' || coalesce(description, '')) extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warehouse_layouts_search_trgm_idx
  ON public.warehouse_layouts USING gin (
    (coalesce(name, '') || ' ' || coalesce(description, '')) extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS helpdesk_ticket_types_search_trgm_idx
  ON public.helpdesk_ticket_types USING gin (
    (coalesce(name, '') || ' ' || coalesce(key, '') || ' ' || coalesce(description, '')) extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invitations_search_trgm_idx
  ON public.invitations USING gin (
    (coalesce(email, '') || ' ' || coalesce(invited_first_name, '') || ' ' || coalesce(invited_last_name, ''))
      extensions.gin_trgm_ops
  ) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS app_comments_search_trgm_idx
  ON public.app_comments USING gin (coalesce(body_plain, '') extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS app_attachments_search_trgm_idx
  ON public.app_attachments USING gin (coalesce(file_name, '') extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

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
  ELSIF p_source = 'parties' THEN
    -- NIP / VAT id by prefix (alphanumerics only), then name, ids, e-mail, phone
    IF length(fp) >= 3 THEN
      EXECUTE format($sql$
        SELECT coalesce(array_agg(id), '{}') FROM (
          SELECT id FROM public.crm_parties
          WHERE organization_id = %1$L AND deleted_at IS NULL
            AND (public.inventory_sku_fingerprint(coalesce(tax_id, '')) COLLATE "C") LIKE %2$L
          ORDER BY (public.inventory_sku_fingerprint(coalesce(tax_id, '')) COLLATE "C") LIMIT %3$s
        ) s$sql$, p_org, fp || '%', lim) INTO part;
      ids := ids || part;
    END IF;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY display_name), '{}') FROM (
        SELECT id, display_name FROM public.crm_parties
        WHERE organization_id = %1$L AND deleted_at IS NULL
          AND (coalesce(display_name, '') || ' ' || coalesce(legal_name, '') || ' ' || coalesce(tax_id, '')
                || ' ' || coalesce(vat_id, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')) ILIKE %2$L
        LIMIT %3$s
      ) s$sql$, p_org, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'contacts' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY display_name), '{}') FROM (
        SELECT id, display_name FROM public.crm_contacts
        WHERE organization_id = %1$L AND deleted_at IS NULL
          AND (coalesce(display_name, '') || ' ' || coalesce(first_name, '') || ' ' || coalesce(last_name, '')
                || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(mobile, '')
                || ' ' || coalesce(job_title, '')) ILIKE %2$L
        LIMIT %3$s
      ) s$sql$, p_org, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'tasks' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id), '{}') FROM (
        SELECT id FROM public.planning_tasks
        WHERE organization_id = %1$L AND deleted_at IS NULL AND (task_number COLLATE "C") LIKE %2$L
        ORDER BY (task_number COLLATE "C") DESC LIMIT %3$s
      ) s$sql$, p_org, up || '%', lim) INTO part;
    ids := ids || part;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.planning_tasks
        WHERE organization_id = %1$L AND deleted_at IS NULL
          AND (coalesce(task_number, '') || ' ' || coalesce(title, '')) ILIKE %2$L
        LIMIT %3$s
      ) s$sql$, p_org, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'audits' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id), '{}') FROM (
        SELECT id FROM public.inventory_count_sessions
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
          AND (upper(count_number) COLLATE "C") LIKE %3$L
        ORDER BY (upper(count_number) COLLATE "C") DESC LIMIT %4$s
      ) s$sql$, p_org, br, up || '%', lim) INTO part;
    ids := ids || part;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.inventory_count_sessions
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
          AND (coalesce(count_number, '') || ' ' || coalesce(notes, '')) ILIKE %3$L
        LIMIT %4$s
      ) s$sql$, p_org, br, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'matcherSessions' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.wdd_matcher_sessions
        WHERE organization_id = %1$L%2$s AND coalesce(name, '') ILIKE %3$L
        LIMIT %4$s
      ) s$sql$, p_org, br, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'qrCodes' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id), '{}') FROM (
        SELECT id FROM public.qr_codes
        WHERE organization_id = %1$L AND deleted_at IS NULL AND (upper(token) COLLATE "C") LIKE %2$L
        ORDER BY (upper(token) COLLATE "C") LIMIT %3$s
      ) s$sql$, p_org, up || '%', lim) INTO part;
    ids := ids || part;
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY label), '{}') FROM (
        SELECT id, label FROM public.qr_codes
        WHERE organization_id = %1$L AND deleted_at IS NULL
          AND (coalesce(token, '') || ' ' || coalesce(label, '')) ILIKE %2$L
        LIMIT %3$s
      ) s$sql$, p_org, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'boards' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY title), '{}') FROM (
        SELECT id, title FROM public.planning_kanban_boards
        WHERE organization_id = %1$L AND deleted_at IS NULL
          AND (coalesce(title, '') || ' ' || coalesce(description, '')) ILIKE %2$L
        LIMIT %3$s
      ) s$sql$, p_org, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'maps' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY name), '{}') FROM (
        SELECT id, name FROM public.warehouse_layouts
        WHERE organization_id = %1$L%2$s AND deleted_at IS NULL
          AND (coalesce(name, '') || ' ' || coalesce(description, '')) ILIKE %3$L
        LIMIT %4$s
      ) s$sql$, p_org, br, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'ticketTypes' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY name), '{}') FROM (
        SELECT id, name FROM public.helpdesk_ticket_types
        WHERE org_id = %1$L AND deleted_at IS NULL
          AND (coalesce(name, '') || ' ' || coalesce(key, '') || ' ' || coalesce(description, '')) ILIKE %2$L
        LIMIT %3$s
      ) s$sql$, p_org, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'invitations' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.invitations
        WHERE organization_id = %1$L AND deleted_at IS NULL
          AND (coalesce(email, '') || ' ' || coalesce(invited_first_name, '') || ' '
                || coalesce(invited_last_name, '')) ILIKE %2$L
        LIMIT %3$s
      ) s$sql$, p_org, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'comments' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.app_comments
        WHERE org_id = %1$L AND deleted_at IS NULL AND coalesce(body_plain, '') ILIKE %2$L
        LIMIT %3$s
      ) s$sql$, p_org, pat, cap) INTO part;
    ids := ids || part;

  ELSIF p_source = 'attachments' THEN
    EXECUTE format($sql$
      SELECT coalesce(array_agg(id ORDER BY created_at DESC), '{}') FROM (
        SELECT id, created_at FROM public.app_attachments
        WHERE org_id = %1$L AND deleted_at IS NULL AND coalesce(file_name, '') ILIKE %2$L
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

  IF 'parties' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'party' AS type, p.id, p.tax_id AS code, p.display_name AS title, p.status,
               jsonb_strip_nulls(jsonb_build_object(
                 'roles', (SELECT string_agg(pr.role, ',' ORDER BY pr.role) FROM public.crm_party_roles pr
                           WHERE pr.party_id = p.id),
                 'email', p.email, 'phone', p.phone
               )) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'parties', cand_lim) c
        JOIN public.crm_parties p ON p.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'contacts' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'contact' AS type, ct.id, NULL::text AS code,
               coalesce(nullif(ct.display_name, ''),
                        nullif(btrim(coalesce(ct.first_name, '') || ' ' || coalesce(ct.last_name, '')), ''),
                        ct.email) AS title,
               NULL::text AS status,
               jsonb_strip_nulls(jsonb_build_object(
                 'email', ct.email, 'phone', coalesce(ct.mobile, ct.phone), 'jobTitle', ct.job_title
               )) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'contacts', cand_lim) c
        JOIN public.crm_contacts ct ON ct.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'tasks' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'task' AS type, tk.id, tk.task_number AS code, tk.title, tk.status,
               jsonb_strip_nulls(jsonb_build_object('date', coalesce(tk.due_date::text, tk.due_at::date::text))) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'tasks', cand_lim) c
        JOIN public.planning_tasks tk ON tk.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'audits' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'audit' AS type, a.id, a.count_number AS code, nullif(a.notes, '') AS title, a.status,
               jsonb_strip_nulls(jsonb_build_object('branchId', a.branch_id, 'date', a.created_at::date::text)) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'audits', cand_lim) c
        JOIN public.inventory_count_sessions a ON a.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'matcherSessions' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'matcherSession' AS type, ms.id, NULL::text AS code, ms.name AS title, ms.status,
               jsonb_strip_nulls(jsonb_build_object('branchId', ms.branch_id, 'date', ms.created_at::date::text)) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'matcherSessions', cand_lim) c
        JOIN public.wdd_matcher_sessions ms ON ms.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'qrCodes' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'qrCode' AS type, q.id, q.token AS code, q.label AS title, q.status,
               jsonb_strip_nulls(jsonb_build_object(
                 'targetType', (SELECT qa.target_type FROM public.qr_assignments qa
                                WHERE qa.qr_code_id = q.id AND qa.revoked_at IS NULL
                                ORDER BY qa.assigned_at DESC LIMIT 1)
               )) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'qrCodes', cand_lim) c
        JOIN public.qr_codes q ON q.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'boards' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'board' AS type, b.id, NULL::text AS code, b.title, NULL::text AS status,
               jsonb_strip_nulls(jsonb_build_object('visibility', b.visibility)) AS meta, c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'boards', cand_lim) c
        JOIN public.planning_kanban_boards b ON b.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'maps' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'map' AS type, m.id, NULL::text AS code, m.name AS title, m.status,
               jsonb_strip_nulls(jsonb_build_object('branchId', m.branch_id)) AS meta, c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'maps', cand_lim) c
        JOIN public.warehouse_layouts m ON m.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'ticketTypes' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'ticketType' AS type, tt.id, NULL::text AS code, tt.name AS title,
               CASE WHEN tt.is_active THEN 'active' ELSE 'inactive' END AS status,
               '{}'::jsonb AS meta, c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'ticketTypes', cand_lim) c
        JOIN public.helpdesk_ticket_types tt ON tt.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'invitations' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'invitation' AS type, i.id, NULL::text AS code, i.email AS title, i.status,
               jsonb_strip_nulls(jsonb_build_object(
                 'name', nullif(btrim(coalesce(i.invited_first_name, '') || ' ' || coalesce(i.invited_last_name, '')), ''),
                 'date', i.expires_at::date::text
               )) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'invitations', cand_lim) c
        JOIN public.invitations i ON i.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  -- Comments and attachments: RLS on app_comments / app_attachments follows their target
  IF 'comments' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'comment' AS type, cm.id, NULL::text AS code,
               left(regexp_replace(coalesce(cm.body_plain, ''), '\s+', ' ', 'g'), 140) AS title,
               NULL::text AS status,
               jsonb_strip_nulls(jsonb_build_object(
                 'targetType', cm.target_type, 'targetId', cm.target_id::text,
                 'date', cm.created_at::date::text
               )) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'comments', cand_lim) c
        JOIN public.app_comments cm ON cm.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  IF 'attachments' = ANY (p_sources) THEN
    result := result || coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.rank)
      FROM (
        SELECT 'attachment' AS type, a.id, NULL::text AS code, a.file_name AS title, NULL::text AS status,
               jsonb_strip_nulls(jsonb_build_object(
                 'targetType', a.target_type, 'targetId', a.target_id::text,
                 'date', a.created_at::date::text, 'size', a.size_bytes
               )) AS meta,
               c.rank
        FROM public.search_global_candidates(p_org, p_branch, p_query, 'attachments', cand_lim) c
        JOIN public.app_attachments a ON a.id = c.id
        ORDER BY c.rank
        LIMIT lim
      ) r
    ), '[]'::jsonb);
  END IF;

  RETURN result;
END;
$$;
