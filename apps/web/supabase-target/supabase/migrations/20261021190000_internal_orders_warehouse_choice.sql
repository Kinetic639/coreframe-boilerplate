-- ============================================================================
-- Internal orders (ZW): the unit (warehouse) of a ZW made in Ambra
-- ============================================================================
-- internal_order_open = internal_order_create + p_warehouse_code: a branch
-- with several units (3112, 3142, ...) numbers the ZW in the chosen one.
-- Without a choice: the repair order's unit, the branch's first warehouse,
-- then the unit of its latest ZW / repair order. internal_order_create calls
-- it unchanged (no choice).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.internal_order_open(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_repair_order_id uuid,
  p_external_number text,
  p_client_name text,
  p_destination_code text,
  p_lines jsonb,
  p_notes text DEFAULT NULL,
  p_warehouse_code text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ro record;
  v_ro_zl text;
  v_ro_client text;
  v_wh text := NULLIF(upper(trim(COALESCE(p_warehouse_code, ''))), '');
  v_ext text := NULLIF(upper(trim(COALESCE(p_external_number, ''))), '');
  v_num jsonb;
  v_io_id uuid;
  v_line jsonb;
  v_n integer := 0;
  v_qty numeric;
  v_variant uuid;
  v_rol_id uuid;
  v_code text;
  v_name text;
  v_unit text;
  v_iol_id uuid;
  v_reserve jsonb;
  v_r jsonb;
  v_doc jsonb;
  v_reserved integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  IF p_repair_order_id IS NOT NULL THEN
    SELECT id, status, zl_number, warehouse_code, client_name INTO v_ro
    FROM public.repair_orders
    WHERE id = p_repair_order_id AND organization_id = p_organization_id
      AND branch_id = p_branch_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Repair order not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_ro.status <> 'open' THEN
      RAISE EXCEPTION 'Repair order is not open' USING ERRCODE = '55000';
    END IF;
    v_wh := COALESCE(v_wh, NULLIF(v_ro.warehouse_code, ''));
    v_ro_zl := v_ro.zl_number;
    v_ro_client := v_ro.client_name;
  ELSIF NULLIF(trim(COALESCE(p_client_name, '')), '') IS NULL
        AND NULLIF(trim(COALESCE(p_destination_code, '')), '') IS NULL THEN
    RAISE EXCEPTION 'An internal order without a repair order needs a client or a branch' USING ERRCODE = '22023';
  END IF;

  -- The chosen unit must be one of the branch's warehouses (when it has any).
  IF p_warehouse_code IS NOT NULL AND v_wh IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.branch_warehouses
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND deleted_at IS NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM public.branch_warehouses
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND deleted_at IS NULL
      AND upper(code) = v_wh
  ) THEN
    RAISE EXCEPTION 'Warehouse % is not a warehouse of this branch', v_wh USING ERRCODE = '22023';
  END IF;
  IF v_wh IS NULL THEN
    SELECT code INTO v_wh FROM public.branch_warehouses
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1;
  END IF;
  -- No warehouse registered: the unit of the branch's latest ZW or repair order.
  IF v_wh IS NULL THEN
    SELECT warehouse_code INTO v_wh FROM public.internal_orders
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
    ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_wh IS NULL THEN
    SELECT warehouse_code INTO v_wh FROM public.repair_orders
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND deleted_at IS NULL AND NULLIF(warehouse_code, '') IS NOT NULL
    ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_wh IS NULL THEN
    RAISE EXCEPTION 'The branch has no warehouse code to number the order' USING ERRCODE = '22023';
  END IF;

  IF v_ext IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.internal_orders WHERE organization_id = p_organization_id AND external_number = v_ext
  ) THEN
    RAISE EXCEPTION 'An internal order with this AutoStacja number already exists' USING ERRCODE = '23505';
  END IF;

  v_num := public.internal_order_next_number_internal(p_organization_id, v_wh);
  INSERT INTO public.internal_orders (
    organization_id, branch_id, order_number, order_no, order_year, warehouse_code,
    external_number, external_zl_number, repair_order_id, client_kind, client_name,
    destination_code, source, notes, created_by
  ) VALUES (
    p_organization_id, p_branch_id, v_num->>'order_number', (v_num->>'order_no')::int,
    (v_num->>'order_year')::smallint, v_num->>'warehouse_code',
    v_ext, v_ro_zl, p_repair_order_id,
    CASE WHEN p_repair_order_id IS NOT NULL THEN 'repair_order'
         WHEN NULLIF(trim(COALESCE(p_destination_code, '')), '') IS NOT NULL THEN 'branch'
         ELSE 'other' END,
    COALESCE(NULLIF(trim(COALESCE(p_client_name, '')), ''), v_ro_client),
    NULLIF(upper(trim(COALESCE(p_destination_code, ''))), ''),
    'manual', NULLIF(trim(COALESCE(p_notes, '')), ''), p_actor_user_id
  )
  RETURNING id INTO v_io_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_n := v_n + 1;
    v_qty := (v_line->>'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line %: quantity must be positive', v_n USING ERRCODE = '22023';
    END IF;
    v_variant := NULLIF(v_line->>'variant_id', '')::uuid;
    v_rol_id := NULLIF(v_line->>'repair_order_line_id', '')::uuid;
    v_code := NULLIF(trim(COALESCE(v_line->>'product_code', '')), '');
    v_name := NULLIF(trim(COALESCE(v_line->>'product_name', '')), '');
    v_unit := NULL;

    IF v_variant IS NOT NULL THEN
      SELECT COALESCE(v_code, v.sku), COALESCE(v_name, p.name), u.code
      INTO v_code, v_name, v_unit
      FROM public.inventory_variants v
      JOIN public.inventory_products p ON p.id = v.product_id
      LEFT JOIN public.inventory_units u ON u.id = p.base_unit_id
      WHERE v.id = v_variant AND v.organization_id = p_organization_id AND v.deleted_at IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Line %: part not found', v_n USING ERRCODE = 'P0002';
      END IF;
    END IF;

    IF v_rol_id IS NOT NULL THEN
      IF p_repair_order_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.repair_order_lines
        WHERE id = v_rol_id AND repair_order_id = p_repair_order_id AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Line %: position does not belong to this repair order', v_n USING ERRCODE = 'P0002';
      END IF;
      SELECT COALESCE(v_code, product_code), COALESCE(v_name, product_name), COALESCE(v_variant, variant_id)
      INTO v_code, v_name, v_variant
      FROM public.repair_order_lines WHERE id = v_rol_id;
    ELSIF p_repair_order_id IS NOT NULL THEN
      -- A new part for the order becomes a new position of it.
      IF v_name IS NULL AND v_code IS NULL THEN
        RAISE EXCEPTION 'Line %: a part or its code and name is required', v_n USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.repair_order_lines (repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
      VALUES (p_repair_order_id, v_variant, v_code, COALESCE(v_name, v_code), v_qty, v_unit)
      RETURNING id INTO v_rol_id;
    ELSIF v_name IS NULL AND v_code IS NULL THEN
      RAISE EXCEPTION 'Line %: a part or its code and name is required', v_n USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.internal_order_lines (
      internal_order_id, organization_id, branch_id, line_number, product_code, product_name,
      variant_id, quantity, ordered, repair_order_line_id, source, created_by
    ) VALUES (
      v_io_id, p_organization_id, p_branch_id, v_n, v_code, COALESCE(v_name, v_code),
      v_variant, v_qty, true, v_rol_id, 'manual', p_actor_user_id
    )
    RETURNING id INTO v_iol_id;

    -- What is in stock is reserved straight away.
    v_reserve := COALESCE(v_line->'reserve', '[]'::jsonb);
    IF jsonb_typeof(v_reserve) = 'array' AND jsonb_array_length(v_reserve) > 0 THEN
      IF (SELECT COALESCE(SUM((r->>'quantity')::numeric), 0) FROM jsonb_array_elements(v_reserve) r) > v_qty THEN
        RAISE EXCEPTION 'Line %: cannot reserve more than ordered', v_n USING ERRCODE = '22023';
      END IF;
      IF v_doc IS NULL THEN
        v_doc := public.internal_order_reservation_doc_internal(
          p_actor_user_id, v_io_id, 'Zamówienie ' || (v_num->>'order_number'));
      END IF;
      FOR v_r IN SELECT * FROM jsonb_array_elements(v_reserve)
      LOOP
        IF COALESCE((v_r->>'quantity')::numeric, 0) <= 0 THEN CONTINUE; END IF;
        PERFORM public.internal_order_reserve_line_internal(
          p_actor_user_id, (v_doc->>'id')::uuid, v_iol_id, (v_r->>'location_id')::uuid,
          (v_r->>'quantity')::numeric, 'Zamówienie ' || (v_num->>'order_number'));
        v_reserved := v_reserved + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'internal_order_id', v_io_id,
    'order_number', v_num->>'order_number',
    'line_count', v_n,
    'reservation_id', v_doc->>'id',
    'reservation_number', v_doc->>'number',
    'reserved_lines', v_reserved);
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_open(uuid, uuid, uuid, uuid, text, text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_open(uuid, uuid, uuid, uuid, text, text, text, jsonb, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_order_create(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_repair_order_id uuid,
  p_external_number text,
  p_client_name text,
  p_destination_code text,
  p_lines jsonb,
  p_notes text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.internal_order_open(
    p_actor_user_id, p_organization_id, p_branch_id, p_repair_order_id, p_external_number,
    p_client_name, p_destination_code, p_lines, p_notes, NULL);
$function$;
