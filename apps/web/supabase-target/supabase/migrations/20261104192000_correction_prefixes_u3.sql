-- ============================================================================
-- U3: a correction is K + the document it corrects (KPZ, KWU, KMM, KINW…)
-- ============================================================================
-- As in AutoStacja, the storno of a document is numbered with K before the
-- prefix of the document it corrects: storno of PZ(115)/… is KPZ(115)/…, of
-- WU(515)/… KWU(515)/…, of MM(115)/… KMM(115)/….
--
-- A correction and the movement type of the same name (102 "KPZ") share one
-- counter per magazyn and year, so a number is never given twice: both count
-- in the document type named like the prefix when one exists (KPZ), else in
-- the storno document type.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_document_number_parts(p_movement_id uuid)
RETURNS TABLE (prefix text, warehouse_code text, unit_code text, document_type_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_header record;
  v_issue record;
  v_wh uuid;
  v_prefix text;
  v_whs uuid[];
  v_dt uuid;
BEGIN
  SELECT h.id, h.organization_id, h.movement_type_code, h.warehouse_id, h.original_movement_id,
         h.reference_type, h.reference_id, dt.code AS doc_code, dt.id AS dt_id
  INTO v_header
  FROM public.inventory_movement_headers h
  JOIN public.inventory_movement_types mt ON mt.id = h.movement_type_id
  JOIN public.inventory_document_types dt ON dt.id = mt.document_type_id
  WHERE h.id = p_movement_id;
  IF NOT FOUND OR v_header.movement_type_code IN ('303', '305') THEN
    RETURN;  -- MMJ keeps its own numbering until U4
  END IF;

  v_wh := v_header.warehouse_id;
  v_issue := v_header;

  IF v_header.movement_type_code = '900' AND v_header.original_movement_id IS NOT NULL THEN
    SELECT o.id, o.movement_type_code, o.warehouse_id, o.reference_type, o.reference_id,
           dt.code AS doc_code
    INTO v_issue
    FROM public.inventory_movement_headers o
    JOIN public.inventory_movement_types mt ON mt.id = o.movement_type_id
    JOIN public.inventory_document_types dt ON dt.id = mt.document_type_id
    WHERE o.id = v_header.original_movement_id;
    v_wh := COALESCE(v_wh, v_issue.warehouse_id);
    v_prefix := 'K' || CASE WHEN v_issue.movement_type_code = '261' THEN 'WU' ELSE v_issue.doc_code END;
  ELSE
    v_prefix := CASE WHEN v_header.movement_type_code = '261' THEN 'WU' ELSE v_header.doc_code END;
  END IF;

  -- An issue to a repair order: the magazyn of the order's reservations of
  -- the issued parts (of the original issue for its storno), when all are of
  -- one magazyn.
  IF v_wh IS NULL AND v_issue.movement_type_code = '261'
     AND v_issue.reference_type = 'repair_order' THEN
    SELECT array_agg(DISTINCT rl.warehouse_id) INTO v_whs
    FROM public.inventory_movement_lines ml
    JOIN public.repair_order_lines rol ON rol.repair_order_id::text = v_issue.reference_id
    JOIN public.inventory_reservation_lines rl
      ON rl.repair_order_line_id = rol.id AND rl.variant_id = ml.variant_id
    WHERE ml.movement_id = v_issue.id AND ml.deleted_at IS NULL AND rl.warehouse_id IS NOT NULL;
    IF array_length(v_whs, 1) = 1 THEN
      v_wh := v_whs[1];
    END IF;
  END IF;

  IF v_wh IS NULL THEN
    RETURN;  -- without magazyn: old numbering
  END IF;

  -- The counter: the document type named like the prefix (KPZ for both the
  -- 102 correction and the storno of a PZ), else the movement's own type.
  SELECT d.id INTO v_dt
  FROM public.inventory_document_types d
  JOIN public.inventory_movement_types t ON t.document_type_id = d.id
  WHERE d.code = v_prefix
    AND (t.organization_id IS NULL OR t.organization_id = v_header.organization_id)
  ORDER BY d.id
  LIMIT 1;

  RETURN QUERY
  SELECT v_prefix, w.code, u.code, COALESCE(v_dt, v_header.dt_id)
  FROM public.unit_warehouses w
  JOIN public.branch_warehouses u ON u.id = w.unit_id
  WHERE w.id = v_wh;
END;
$$;

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.inventory_finalize_posting_internal(uuid,uuid,jsonb)'::regprocedure);
  IF position('inventory_document_number_parts' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$public.inventory_document_warehouse_parts(v_header.id)$a$,
      $b$public.inventory_document_number_parts(v_header.id)$b$);
    v_new := replace(v_new,
      $a$    VALUES (v_header.organization_id, v_mvt_type.dt_id, v_year,
            v_whp.prefix || '(' || v_whp.warehouse_code || ')')$a$,
      $b$    VALUES (v_header.organization_id, v_whp.document_type_id, v_year,
            v_whp.prefix || '(' || v_whp.warehouse_code || ')')$b$);
    v_new := replace(v_new,
      $a$      AND document_type_id = v_mvt_type.dt_id
      AND branch_id IS NULL
      AND series = v_whp.prefix || '(' || v_whp.warehouse_code || ')'$a$,
      $b$      AND document_type_id = v_whp.document_type_id
      AND branch_id IS NULL
      AND series = v_whp.prefix || '(' || v_whp.warehouse_code || ')'$b$);
    IF (length(v_new) - length(v_def)) <> (length('inventory_document_number_parts') - length('inventory_document_warehouse_parts'))
         + 2 * (length('v_whp.document_type_id') - length('v_mvt_type.dt_id')) THEN
      RAISE EXCEPTION 'inventory_finalize_posting_internal patch did not apply cleanly';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;
