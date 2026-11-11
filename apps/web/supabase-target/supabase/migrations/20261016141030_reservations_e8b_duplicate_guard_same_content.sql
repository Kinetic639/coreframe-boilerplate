-- E8 follow-up: a document counts as already imported only with the same ZL, ZW AND the same
-- lines (part codes and quantities); a split delivery on the same ZW is imported as usual.

CREATE OR REPLACE FUNCTION public.repair_orders_import(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_orders jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order jsonb;
  v_line jsonb;
  v_zl text;
  v_ro record;
  v_ro_id uuid;
  v_outcome text;
  v_session_id uuid;
  v_block_id uuid;
  v_doc_id uuid;
  v_doc_line_id uuid;
  v_rol_id uuid;
  v_qty numeric;
  v_code text;
  v_added integer;
  v_results jsonb := '[]'::jsonb;
  v_created integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_conflicts integer := 0;
  v_doc_number text;
  v_earlier record;
  v_fingerprint text;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_branch_permission(p_organization_id, p_branch_id, 'workshop.repair_orders.manage_own')
    OR public.has_branch_permission(p_organization_id, p_branch_id, 'workshop.repair_orders.manage_all')
  ) THEN
    RAISE EXCEPTION 'Not authorized to import repair orders for this branch' USING ERRCODE = '42501';
  END IF;

  IF p_orders IS NULL OR jsonb_typeof(p_orders) <> 'array' OR jsonb_array_length(p_orders) = 0 THEN
    RAISE EXCEPTION 'At least one repair order is required' USING ERRCODE = '22023';
  END IF;

  FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    v_zl := NULLIF(trim(v_order->>'zl_number'), '');
    IF v_zl IS NULL THEN
      v_conflicts := v_conflicts + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'zl_number', NULL, 'outcome', 'conflict', 'reason', 'missing_zl'));
      CONTINUE;
    END IF;

    v_session_id := NULLIF(v_order #>> '{source,session_id}', '')::uuid;
    v_block_id := NULLIF(v_order #>> '{source,block_id}', '')::uuid;
    IF v_session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.wdd_matcher_sessions s
      WHERE s.id = v_session_id AND s.organization_id = p_organization_id AND s.branch_id = p_branch_id
    ) THEN
      RAISE EXCEPTION 'Matcher session does not belong to this branch' USING ERRCODE = '42501';
    END IF;

    -- The document's own number (ZW/...) from its Matcher block.
    v_doc_number := NULL;
    IF v_block_id IS NOT NULL THEN
      SELECT NULLIF(trim(b.metadata->>'zw_number'), '') INTO v_doc_number
      FROM public.wdd_matcher_blocks b
      WHERE b.id = v_block_id AND b.organization_id = p_organization_id;
    END IF;

    -- The same document already imported in another session: nothing to add.
    IF v_doc_number IS NOT NULL AND v_session_id IS NOT NULL THEN
      -- The document's content: its part codes and quantities.
      SELECT string_agg(COALESCE(x.code, '') || ':' || trim_scale(x.qty)::text, '|' ORDER BY COALESCE(x.code, ''), x.qty) INTO v_fingerprint
      FROM (
        SELECT public.repair_order_normalize_product_code(l->>'product_code') AS code,
               NULLIF(l->>'quantity', '')::numeric AS qty
        FROM jsonb_array_elements(COALESCE(v_order->'lines', '[]'::jsonb)) l
        WHERE NULLIF(l->>'quantity', '')::numeric > 0
      ) x;

      SELECT d.id, d.source_session_id, s.name AS session_name INTO v_earlier
      FROM public.workshop_source_documents d
      LEFT JOIN public.wdd_matcher_sessions s ON s.id = d.source_session_id
      WHERE d.organization_id = p_organization_id AND d.branch_id = p_branch_id
        AND d.document_type = 'zl' AND d.external_document_number = v_zl
        AND d.source_document_number = v_doc_number
        AND d.source_session_id IS DISTINCT FROM v_session_id
        AND v_fingerprint IS NOT NULL
        AND v_fingerprint = (
          SELECT string_agg(COALESCE(public.repair_order_normalize_product_code(dl.product_code), '') || ':' || trim_scale(dl.quantity)::text,
                            '|' ORDER BY COALESCE(public.repair_order_normalize_product_code(dl.product_code), ''), dl.quantity)
          FROM public.workshop_source_document_lines dl
          WHERE dl.workshop_source_document_id = d.id AND dl.quantity > 0)
      ORDER BY d.created_at
      LIMIT 1;
      IF FOUND THEN
        v_unchanged := v_unchanged + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'zl_number', v_zl,
          'repair_order_id', (SELECT ro.id FROM public.repair_orders ro
                              WHERE ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id
                                AND ro.zl_number = v_zl AND ro.deleted_at IS NULL),
          'outcome', 'unchanged', 'reason', 'document_already_imported',
          'source_document_number', v_doc_number,
          'earlier_session_id', v_earlier.source_session_id,
          'earlier_session_name', v_earlier.session_name,
          'added_lines', 0));
        CONTINUE;
      END IF;
    END IF;

    SELECT id, status INTO v_ro
    FROM public.repair_orders
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND zl_number = v_zl AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND AND v_ro.status <> 'open' THEN
      v_conflicts := v_conflicts + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'zl_number', v_zl, 'repair_order_id', v_ro.id, 'outcome', 'conflict',
        'reason', 'repair_order_' || v_ro.status));
      CONTINUE;
    END IF;

    IF FOUND THEN
      v_ro_id := v_ro.id;
      v_outcome := 'unchanged';
      UPDATE public.repair_orders
      SET order_number = COALESCE(order_number, NULLIF(trim(v_order->>'order_number'), '')),
          vin = COALESCE(vin, NULLIF(trim(v_order->>'vin'), '')),
          vehicle_brand = COALESCE(vehicle_brand, NULLIF(trim(v_order->>'vehicle_brand'), '')),
          client_name = COALESCE(client_name, NULLIF(trim(v_order->>'client_name'), '')),
          dealer_name = COALESCE(dealer_name, NULLIF(trim(v_order->>'dealer_name'), '')),
          updated_at = now()
      WHERE id = v_ro_id;
    ELSE
      INSERT INTO public.repair_orders (
        organization_id, branch_id, zl_number, order_number, identity_status,
        vin, vehicle_brand, client_name, dealer_name, status, created_by
      ) VALUES (
        p_organization_id, p_branch_id, v_zl, NULLIF(trim(v_order->>'order_number'), ''), 'resolved',
        NULLIF(trim(v_order->>'vin'), ''), NULLIF(trim(v_order->>'vehicle_brand'), ''),
        NULLIF(trim(v_order->>'client_name'), ''), NULLIF(trim(v_order->>'dealer_name'), ''),
        'open', p_actor_user_id
      )
      ON CONFLICT (organization_id, branch_id, zl_number) WHERE zl_number IS NOT NULL AND deleted_at IS NULL
      DO NOTHING
      RETURNING id INTO v_ro_id;

      IF v_ro_id IS NULL THEN
        SELECT id INTO v_ro_id FROM public.repair_orders
        WHERE organization_id = p_organization_id AND branch_id = p_branch_id
          AND zl_number = v_zl AND deleted_at IS NULL;
        v_outcome := 'unchanged';
      ELSE
        v_outcome := 'created';
      END IF;
    END IF;

    v_doc_id := NULL;
    IF v_session_id IS NOT NULL THEN
      INSERT INTO public.workshop_source_documents (
        organization_id, branch_id, document_type, external_document_number,
        source_session_id, official_warehouse_code, block_id, source_document_number
      ) VALUES (
        p_organization_id, p_branch_id, 'zl', v_zl, v_session_id,
        (regexp_match(v_zl, '/(\d{3,4})/BL$'))[1], v_block_id, v_doc_number
      )
      ON CONFLICT (organization_id, branch_id, document_type, external_document_number, source_session_id)
      DO NOTHING
      RETURNING id INTO v_doc_id;

      IF v_doc_id IS NULL THEN
        SELECT id INTO v_doc_id FROM public.workshop_source_documents
        WHERE organization_id = p_organization_id AND branch_id = p_branch_id
          AND document_type = 'zl' AND external_document_number = v_zl
          AND source_session_id = v_session_id;
        UPDATE public.workshop_source_documents
        SET source_document_number = COALESCE(source_document_number, v_doc_number)
        WHERE id = v_doc_id;
      END IF;

      INSERT INTO public.repair_order_source_document_links (repair_order_id, workshop_source_document_id, linked_by)
      VALUES (v_ro_id, v_doc_id, p_actor_user_id)
      ON CONFLICT (repair_order_id, workshop_source_document_id) DO NOTHING;
    END IF;

    v_added := 0;
    FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(v_order->'lines', '[]'::jsonb))
    LOOP
      v_qty := NULLIF(v_line->>'quantity', '')::numeric;
      v_code := NULLIF(trim(v_line->>'product_code'), '');
      IF v_qty IS NULL OR v_qty <= 0 THEN
        CONTINUE;
      END IF;

      v_doc_line_id := NULL;
      IF v_doc_id IS NOT NULL AND NULLIF(v_line->>'matcher_line_id', '') IS NOT NULL THEN
        INSERT INTO public.workshop_source_document_lines (
          workshop_source_document_id, wdd_matcher_line_id, product_code, product_name, quantity, unit, raw_text
        ) VALUES (
          v_doc_id, (v_line->>'matcher_line_id')::uuid, v_code, NULLIF(trim(v_line->>'product_name'), ''),
          v_qty, NULLIF(trim(v_line->>'unit'), ''), v_line->>'raw_text'
        )
        ON CONFLICT (workshop_source_document_id, wdd_matcher_line_id) WHERE wdd_matcher_line_id IS NOT NULL
        DO NOTHING
        RETURNING id INTO v_doc_line_id;

        IF v_doc_line_id IS NULL THEN
          CONTINUE;
        END IF;
      END IF;

      v_rol_id := NULL;
      IF v_code IS NOT NULL THEN
        SELECT id INTO v_rol_id FROM public.repair_order_lines
        WHERE repair_order_id = v_ro_id AND deleted_at IS NULL
          AND public.repair_order_normalize_product_code(product_code)
              = public.repair_order_normalize_product_code(v_code)
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE;
      END IF;

      IF v_rol_id IS NULL THEN
        INSERT INTO public.repair_order_lines (
          repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit
        ) VALUES (
          v_ro_id, NULL, v_code,
          COALESCE(NULLIF(trim(v_line->>'product_name'), ''), NULLIF(v_line->>'raw_text', ''), v_code, 'Nieznana część'),
          v_qty, NULLIF(trim(v_line->>'unit'), '')
        )
        RETURNING id INTO v_rol_id;
        v_added := v_added + 1;
      ELSIF v_doc_line_id IS NOT NULL THEN
        UPDATE public.repair_order_lines
        SET ordered_quantity = ordered_quantity + v_qty, updated_at = now()
        WHERE id = v_rol_id;
        v_added := v_added + 1;
      ELSE
        CONTINUE;
      END IF;

      IF v_doc_line_id IS NOT NULL THEN
        INSERT INTO public.repair_order_line_source_links (
          repair_order_line_id, workshop_source_document_line_id, quantity_contribution
        ) VALUES (v_rol_id, v_doc_line_id, v_qty)
        ON CONFLICT (workshop_source_document_line_id) DO NOTHING;
      END IF;
    END LOOP;

    IF v_outcome = 'unchanged' AND v_added > 0 THEN
      v_outcome := 'updated';
    END IF;

    IF v_outcome = 'created' THEN
      v_created := v_created + 1;
    ELSIF v_outcome = 'updated' THEN
      v_updated := v_updated + 1;
    ELSE
      v_unchanged := v_unchanged + 1;
    END IF;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'zl_number', v_zl, 'repair_order_id', v_ro_id, 'outcome', v_outcome, 'added_lines', v_added));
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created, 'updated', v_updated, 'unchanged', v_unchanged,
    'conflicts', v_conflicts, 'orders', v_results);
END;
$function$;
