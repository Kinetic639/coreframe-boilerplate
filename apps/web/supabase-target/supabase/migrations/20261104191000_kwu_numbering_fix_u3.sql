-- ============================================================================
-- U3 fix: the storno of an issue to a repair order is numbered KWU(magazyn)
-- ============================================================================
-- An issue (WU, 261) takes its magazyn from the order's reservations, not
-- from its lines, so its storno found no magazyn and kept the old KOR
-- numbering. The magazyn is now looked up on the original issue as well.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_document_warehouse_parts(p_movement_id uuid)
RETURNS TABLE (prefix text, warehouse_code text, unit_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_header record;
  v_issue record;
  v_wh uuid;
  v_type text;
  v_prefix text;
  v_whs uuid[];
BEGIN
  SELECT h.id, h.movement_type_code, h.warehouse_id, h.original_movement_id,
         h.reference_type, h.reference_id, dt.code AS doc_code
  INTO v_header
  FROM public.inventory_movement_headers h
  JOIN public.inventory_movement_types mt ON mt.id = h.movement_type_id
  JOIN public.inventory_document_types dt ON dt.id = mt.document_type_id
  WHERE h.id = p_movement_id;
  IF NOT FOUND OR v_header.movement_type_code IN ('303', '305') THEN
    RETURN;  -- MMJ keeps its own numbering until U4
  END IF;

  v_wh := v_header.warehouse_id;
  v_type := v_header.movement_type_code;
  -- The issue whose magazyn may come from reservations: this one, or the
  -- original of a storno.
  v_issue := v_header;

  IF v_type = '900' AND v_header.original_movement_id IS NOT NULL THEN
    SELECT o.id, o.movement_type_code, o.warehouse_id, o.reference_type, o.reference_id
    INTO v_issue
    FROM public.inventory_movement_headers o WHERE o.id = v_header.original_movement_id;
    v_type := v_issue.movement_type_code;
    v_wh := COALESCE(v_wh, v_issue.warehouse_id);
    v_prefix := CASE WHEN v_type = '261' THEN 'KWU' ELSE 'KOR' END;
  ELSE
    v_prefix := CASE WHEN v_type = '261' THEN 'WU' ELSE v_header.doc_code END;
  END IF;

  -- An issue to a repair order: the magazyn of the order's reservations of
  -- the issued parts, when they are all of one magazyn.
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

  RETURN QUERY
  SELECT v_prefix, w.code, u.code
  FROM public.unit_warehouses w
  JOIN public.branch_warehouses u ON u.id = w.unit_id
  WHERE w.id = v_wh;
END;
$$;
