-- ============================================================================
-- Internal orders (ZW), stage E3 (docs/INTERNAL_ORDERS_PLAN.md)
-- ============================================================================
-- 1. internal_order_create: a ZW made in Ambra -- from a repair order (its
--    lines are the order's parts: an existing position, or a new part that
--    becomes a new position) or on its own (for another branch). Lines are
--    "ordered" (status Z). What is in stock is reserved straight away, on ONE
--    REZ for the operation.
-- 2. internal_order_reserve_from_stock: reserve free stock (D) for ZW lines,
--    ONE REZ, never more than a line still needs.
-- 3. internal_order_cancel_line: status A, with a reason; its open
--    reservations are released (in a container: refused).
-- 4. internal_order_set_external_number: the AutoStacja ZW number, set once.
-- 5. A delivery of a ZW made in Ambra joins its ordered line (same part)
--    instead of adding a new one, and a ZW line of a repair order is reserved
--    through exactly its position.
-- Additive: no existing row is changed or removed.
-- ============================================================================

-- Shared: one REZ document for a ZW operation (through its repair order when
-- it has one, otherwise under the ZW).
CREATE OR REPLACE FUNCTION public.internal_order_reservation_doc_internal(
  p_actor_user_id uuid,
  p_internal_order_id uuid,
  p_note text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_io record;
  v_number text;
  v_id uuid;
BEGIN
  SELECT io.id, io.organization_id, io.branch_id, io.order_number, io.repair_order_id, ro.zl_number
  INTO v_io
  FROM public.internal_orders io
  LEFT JOIN public.repair_orders ro ON ro.id = io.repair_order_id
  WHERE io.id = p_internal_order_id;

  v_number := public.inventory_next_commitment_number_internal(v_io.organization_id, 'reservation', p_actor_user_id);
  INSERT INTO public.inventory_reservations (
    organization_id, branch_id, reservation_number, reference_type, reference_id,
    reference_number, notes, created_by
  ) VALUES (
    v_io.organization_id, v_io.branch_id, v_number,
    CASE WHEN v_io.repair_order_id IS NOT NULL THEN 'repair_order' ELSE 'internal_order' END,
    COALESCE(v_io.repair_order_id, v_io.id),
    CASE WHEN v_io.repair_order_id IS NOT NULL THEN v_io.zl_number ELSE v_io.order_number END,
    p_note, p_actor_user_id
  )
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'number', v_number);
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_reservation_doc_internal(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- Shared: reserve p_quantity of a ZW line at a location on a given REZ.
CREATE OR REPLACE FUNCTION public.internal_order_reserve_line_internal(
  p_actor_user_id uuid,
  p_reservation_id uuid,
  p_internal_order_line_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_reason text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_line record;
  v_rl uuid;
BEGIN
  SELECT iol.id, iol.variant_id, iol.repair_order_line_id, iol.organization_id, iol.branch_id
  INTO v_line
  FROM public.internal_order_lines iol
  WHERE iol.id = p_internal_order_line_id;
  IF v_line.variant_id IS NULL THEN
    RAISE EXCEPTION 'The part of this line is not in the catalogue yet' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_location_id AND organization_id = v_line.organization_id
      AND branch_id = v_line.branch_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Location not found in this branch' USING ERRCODE = 'P0002';
  END IF;
  v_rl := public.inventory_reservation_add_line_internal(
    p_reservation_id, v_line.variant_id, p_location_id, p_quantity,
    v_line.repair_order_line_id, NULL, NULL, p_actor_user_id, p_reason);
  UPDATE public.inventory_reservation_lines SET internal_order_line_id = v_line.id WHERE id = v_rl;
  RETURN v_rl;
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_reserve_line_internal(uuid, uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;

-- 1. A ZW made in Ambra ----------------------------------------------------------

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
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ro record;
  v_ro_zl text;
  v_ro_client text;
  v_wh text;
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
    v_wh := NULLIF(v_ro.warehouse_code, '');
    v_ro_zl := v_ro.zl_number;
    v_ro_client := v_ro.client_name;
  ELSIF NULLIF(trim(COALESCE(p_client_name, '')), '') IS NULL
        AND NULLIF(trim(COALESCE(p_destination_code, '')), '') IS NULL THEN
    RAISE EXCEPTION 'An internal order without a repair order needs a client or a branch' USING ERRCODE = '22023';
  END IF;

  IF v_wh IS NULL THEN
    SELECT code INTO v_wh FROM public.branch_warehouses
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1;
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

REVOKE ALL ON FUNCTION public.internal_order_create(uuid, uuid, uuid, uuid, text, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_create(uuid, uuid, uuid, uuid, text, text, text, jsonb, text) TO authenticated;

-- 2. Reserve from stock for ZW lines ----------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_order_reserve_from_stock(
  p_actor_user_id uuid,
  p_internal_order_id uuid,
  p_lines jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_io record;
  v_line jsonb;
  v_iol record;
  v_need numeric;
  v_asked jsonb := '{}'::jsonb;
  v_doc jsonb;
  v_n integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  SELECT id, organization_id, branch_id, order_number, status INTO v_io
  FROM public.internal_orders WHERE id = p_internal_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Internal order not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_branch_permission(v_io.organization_id, v_io.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF v_io.status <> 'open' THEN
    RAISE EXCEPTION 'Internal order is not open' USING ERRCODE = '55000';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_n := v_n + 1;
    IF COALESCE((v_line->>'quantity')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Line %: quantity must be positive', v_n USING ERRCODE = '22023';
    END IF;
    SELECT iol.id, iol.quantity, iol.cancelled_at, s.reserved_quantity, s.issued_quantity INTO v_iol
    FROM public.internal_order_lines iol
    JOIN public.internal_order_line_status s ON s.internal_order_line_id = iol.id
    WHERE iol.id = NULLIF(v_line->>'internal_order_line_id', '')::uuid
      AND iol.internal_order_id = v_io.id
    FOR UPDATE OF iol;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line %: not a line of this internal order', v_n USING ERRCODE = 'P0002';
    END IF;
    IF v_iol.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Line %: the line is cancelled', v_n USING ERRCODE = '55000';
    END IF;
    v_need := v_iol.quantity - v_iol.reserved_quantity - v_iol.issued_quantity
              - COALESCE((v_asked->>v_iol.id::text)::numeric, 0);
    IF (v_line->>'quantity')::numeric > v_need THEN
      RAISE EXCEPTION 'Line %: only % still needed', v_n, trim_scale(GREATEST(v_need, 0)) USING ERRCODE = '22023';
    END IF;
    v_asked := v_asked || jsonb_build_object(v_iol.id::text,
      COALESCE((v_asked->>v_iol.id::text)::numeric, 0) + (v_line->>'quantity')::numeric);

    IF v_doc IS NULL THEN
      v_doc := public.internal_order_reservation_doc_internal(
        p_actor_user_id, v_io.id, 'Rezerwacja z magazynu ' || v_io.order_number);
    END IF;
    PERFORM public.internal_order_reserve_line_internal(
      p_actor_user_id, (v_doc->>'id')::uuid, v_iol.id, NULLIF(v_line->>'location_id', '')::uuid,
      (v_line->>'quantity')::numeric, 'Rezerwacja z magazynu ' || v_io.order_number);
  END LOOP;

  RETURN jsonb_build_object('reservation_id', v_doc->>'id', 'reservation_number', v_doc->>'number', 'line_count', v_n);
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_reserve_from_stock(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_reserve_from_stock(uuid, uuid, jsonb) TO authenticated;

-- 3. Cancel a line (A) --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_order_cancel_line(
  p_actor_user_id uuid,
  p_internal_order_line_id uuid,
  p_reason text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_line record;
  v_rl record;
  v_released numeric := 0;
  v_reason text := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023';
  END IF;
  SELECT iol.id, iol.organization_id, iol.branch_id, iol.cancelled_at, io.order_number
  INTO v_line
  FROM public.internal_order_lines iol
  JOIN public.internal_orders io ON io.id = iol.internal_order_id
  WHERE iol.id = p_internal_order_line_id
  FOR UPDATE OF iol;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Internal order line not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_branch_permission(v_line.organization_id, v_line.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF v_line.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'The line is already cancelled' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inventory_allocation_lines al
    JOIN public.inventory_reservation_lines rl ON rl.id = al.reservation_line_id
    WHERE rl.internal_order_line_id = v_line.id AND al.allocated_quantity > al.fulfilled_quantity
  ) THEN
    RAISE EXCEPTION 'Part of this line is in a repair-order container: take it out first' USING ERRCODE = '55000';
  END IF;

  FOR v_rl IN
    SELECT rl.id, rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity AS open_qty
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    WHERE rl.internal_order_line_id = v_line.id
      AND r.status <> 'cancelled' AND r.deleted_at IS NULL
      AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0
    FOR UPDATE OF rl
  LOOP
    PERFORM public.inventory_reservation_release_internal(
      v_rl.id, v_rl.open_qty, 'released',
      'Anulowanie pozycji ' || v_line.order_number || ': ' || v_reason, p_actor_user_id);
    v_released := v_released + v_rl.open_qty;
  END LOOP;

  UPDATE public.internal_order_lines
  SET cancelled_at = now(), cancelled_by = p_actor_user_id, cancel_reason = v_reason
  WHERE id = v_line.id;

  RETURN jsonb_build_object('internal_order_line_id', v_line.id, 'released_quantity', v_released);
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_cancel_line(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_cancel_line(uuid, uuid, text) TO authenticated;

-- 4. The AutoStacja number --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_order_set_external_number(
  p_actor_user_id uuid,
  p_internal_order_id uuid,
  p_external_number text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_io record;
  v_ext text := NULLIF(upper(trim(COALESCE(p_external_number, ''))), '');
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF v_ext IS NULL THEN
    RAISE EXCEPTION 'The AutoStacja number is required' USING ERRCODE = '22023';
  END IF;
  SELECT id, organization_id, branch_id, external_number INTO v_io
  FROM public.internal_orders WHERE id = p_internal_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Internal order not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_branch_permission(v_io.organization_id, v_io.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF v_io.external_number IS NOT NULL THEN
    RAISE EXCEPTION 'The AutoStacja number is already set' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.internal_orders WHERE organization_id = v_io.organization_id AND external_number = v_ext) THEN
    RAISE EXCEPTION 'An internal order with this AutoStacja number already exists' USING ERRCODE = '23505';
  END IF;
  UPDATE public.internal_orders SET external_number = v_ext, updated_at = now() WHERE id = v_io.id;
  RETURN jsonb_build_object('internal_order_id', v_io.id, 'external_number', v_ext);
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_set_external_number(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_set_external_number(uuid, uuid, text) TO authenticated;

-- 5. Deliveries of a ZW made in Ambra ------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_order_for_matcher_line_internal(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_matcher_line_id uuid,
  p_variant_id uuid,
  p_quantity numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_line record;
  v_block record;
  v_meta jsonb;
  v_order_meta jsonb := '{}'::jsonb;
  v_brand_id uuid;
  v_zw text;
  v_zl text;
  v_note text;
  v_client text;
  v_wh text;
  v_num jsonb;
  v_ro_id uuid;
  v_io public.internal_orders%ROWTYPE;
  v_iol_id uuid;
  v_n integer;
BEGIN
  SELECT l.id, l.block_id, l.product_code, l.product_name, s.id AS session_id, s.branch_id
  INTO v_line
  FROM public.wdd_matcher_lines l
  JOIN public.wdd_matcher_sessions s ON s.id = l.session_id
  WHERE l.id = p_matcher_line_id AND l.organization_id = p_organization_id;
  IF NOT FOUND OR v_line.branch_id IS DISTINCT FROM p_branch_id THEN
    RETURN NULL;
  END IF;

  SELECT id, block_type, COALESCE(metadata, '{}'::jsonb) AS metadata INTO v_block
  FROM public.wdd_matcher_blocks
  WHERE id = v_line.block_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_meta := v_block.metadata;

  -- A WDD line belongs to the brand order block it was matched with (same
  -- choice as the PZ import: the most confident match).
  IF v_block.block_type = 'wdd_reconciliation' THEN
    SELECT m.brand_block_id INTO v_brand_id
    FROM public.wdd_matcher_block_matches m
    WHERE m.organization_id = p_organization_id
      AND COALESCE(m.bc_block_id, m.wdd_block_id) = v_block.id
    ORDER BY m.block_confidence DESC
    LIMIT 1;
    IF v_brand_id IS NOT NULL THEN
      SELECT COALESCE(metadata, '{}'::jsonb) INTO v_order_meta
      FROM public.wdd_matcher_blocks WHERE id = v_brand_id;
    END IF;
  END IF;

  v_zw := NULLIF(trim(COALESCE(v_order_meta->>'zw_number', v_meta->>'zw_number')), '');
  IF v_zw IS NULL THEN
    RETURN NULL;
  END IF;
  v_zw := upper(v_zw);
  v_zl := NULLIF(trim(COALESCE(v_order_meta->>'zl_number', v_meta->>'zl_number')), '');
  v_note := NULLIF(trim(COALESCE(v_order_meta->>'manual_note', v_meta->>'manual_note')), '');
  v_client := NULLIF(trim(COALESCE(v_order_meta->>'client_name', v_meta->>'client_name')), '');

  SELECT * INTO v_io
  FROM public.internal_orders
  WHERE organization_id = p_organization_id AND external_number = v_zw
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Same unit/warehouse as the AutoStacja number: ZW/466/26/3142 -> 3142.
    v_wh := NULLIF(split_part(v_zw, '/', 4), '');
    v_wh := COALESCE(v_wh, NULLIF(v_order_meta->>'zl_warehouse_code', ''), NULLIF(v_meta->>'zl_warehouse_code', ''));
    IF v_wh IS NULL THEN
      SELECT code INTO v_wh FROM public.branch_warehouses
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    END IF;
    IF v_wh IS NULL THEN
      RETURN NULL;
    END IF;

    IF v_zl IS NOT NULL THEN
      SELECT id INTO v_ro_id FROM public.repair_orders
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND zl_number = v_zl AND deleted_at IS NULL;
    END IF;

    v_num := public.internal_order_next_number_internal(p_organization_id, v_wh);
    INSERT INTO public.internal_orders (
      organization_id, branch_id, order_number, order_no, order_year, warehouse_code,
      external_number, external_zl_number, repair_order_id, client_kind, client_name,
      destination_code, source, source_session_id, source_block_id, created_by
    ) VALUES (
      p_organization_id, p_branch_id, v_num->>'order_number', (v_num->>'order_no')::int,
      (v_num->>'order_year')::smallint, v_num->>'warehouse_code',
      v_zw, v_zl, v_ro_id,
      CASE WHEN v_zl IS NOT NULL THEN 'repair_order' WHEN v_note IS NOT NULL THEN 'branch' ELSE 'other' END,
      v_client,
      CASE WHEN v_zl IS NULL THEN v_note END,
      'matcher', v_line.session_id, COALESCE(v_brand_id, v_block.id), p_actor_user_id
    )
    RETURNING * INTO v_io;
  ELSIF v_io.repair_order_id IS NULL AND COALESCE(v_io.external_zl_number, v_zl) IS NOT NULL THEN
    -- The repair order may have been created since the ZW was.
    SELECT id INTO v_ro_id FROM public.repair_orders
    WHERE organization_id = p_organization_id AND branch_id = v_io.branch_id
      AND zl_number = COALESCE(v_io.external_zl_number, v_zl) AND deleted_at IS NULL;
    IF v_ro_id IS NOT NULL THEN
      UPDATE public.internal_orders
      SET repair_order_id = v_ro_id, external_zl_number = COALESCE(external_zl_number, v_zl), updated_at = now()
      WHERE id = v_io.id;
      v_io.repair_order_id := v_ro_id;
    END IF;
  END IF;

  IF v_io.branch_id IS DISTINCT FROM p_branch_id THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_iol_id FROM public.internal_order_lines
  WHERE source_matcher_line_id = p_matcher_line_id;

  -- A ZW made in Ambra: the delivered part joins its ordered line (same part,
  -- not received in full yet) instead of becoming a new one.
  IF v_iol_id IS NULL THEN
    SELECT iol.id INTO v_iol_id
    FROM public.internal_order_lines iol
    WHERE iol.internal_order_id = v_io.id AND iol.source = 'manual' AND iol.cancelled_at IS NULL
      AND public.repair_order_normalize_product_code(iol.product_code)
          = public.repair_order_normalize_product_code(v_line.product_code)
      AND iol.quantity > COALESCE((
        SELECT SUM(k.applied_quantity) FROM public.internal_order_line_movement_links k
        WHERE k.internal_order_line_id = iol.id AND k.relation_type = 'receipt'), 0)
    ORDER BY iol.line_number
    LIMIT 1;
    IF v_iol_id IS NOT NULL THEN
      UPDATE public.internal_order_lines SET variant_id = COALESCE(variant_id, p_variant_id)
      WHERE id = v_iol_id;
    END IF;
  END IF;

  IF v_iol_id IS NULL THEN
    SELECT COALESCE(max(line_number), 0) + 1 INTO v_n
    FROM public.internal_order_lines WHERE internal_order_id = v_io.id;
    INSERT INTO public.internal_order_lines (
      internal_order_id, organization_id, branch_id, line_number, product_code, product_name,
      variant_id, quantity, source, source_matcher_line_id, created_by
    ) VALUES (
      v_io.id, p_organization_id, p_branch_id, v_n, v_line.product_code,
      COALESCE(NULLIF(trim(v_line.product_name), ''), v_line.product_code, '-'),
      p_variant_id, p_quantity, 'matcher', p_matcher_line_id, p_actor_user_id
    )
    RETURNING id INTO v_iol_id;
  END IF;

  RETURN jsonb_build_object(
    'internal_order_id', v_io.id,
    'internal_order_line_id', v_iol_id,
    'order_number', v_io.order_number,
    'external_number', v_io.external_number,
    'zl_number', COALESCE(v_io.external_zl_number, v_zl),
    'repair_order_id', v_io.repair_order_id,
    'repair_order_line_id', (SELECT repair_order_line_id FROM public.internal_order_lines WHERE id = v_iol_id));
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_for_matcher_line_internal(uuid, uuid, uuid, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.inventory_attribute_receipt_to_repair_orders(p_actor_user_id uuid, p_movement_id uuid, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_header record;
  v_line jsonb;
  v_ml record;
  v_zl text;
  v_code text;
  v_ro record;
  v_rol record;
  v_outstanding numeric;
  v_apply numeric;
  v_rest numeric;
  v_reason text;
  v_rol_id uuid;
  v_io jsonb;
  v_iol_id uuid;
  v_attributed jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_res_id uuid;
  v_res_number text;
  v_rl_id uuid;
  -- One reservation document per repair order and one per stand-alone ZW of
  -- this PZ: {id: {id, number}}.
  v_docs jsonb := '{}'::jsonb;
  v_zw_docs jsonb := '{}'::jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT h.id, h.organization_id, h.branch_id, h.status, h.document_number, t.category
  INTO v_header
  FROM public.inventory_movement_headers h
  JOIN public.inventory_movement_types t ON t.id = h.movement_type_id
  WHERE h.id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF v_header.status <> 'posted' OR v_header.category <> 'receipt' THEN
    RAISE EXCEPTION 'Only a posted receipt can be attributed' USING ERRCODE = '55000';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_ml := NULL;
    SELECT id, variant_id, quantity, destination_location_id INTO v_ml
    FROM public.inventory_movement_lines
    WHERE id = NULLIF(v_line->>'movement_line_id', '')::uuid
      AND movement_id = p_movement_id AND deleted_at IS NULL;

    IF v_ml.id IS NULL THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_line->>'movement_line_id', 'reason', 'invalid_line'));
      CONTINUE;
    END IF;

    BEGIN
      v_code := public.repair_order_normalize_product_code(v_line->>'product_code');
      v_zl := NULLIF(trim(v_line->>'zl_number'), '');

      -- The ZW of the Matcher line the part came from (when it names one).
      v_io := NULL;
      v_iol_id := NULL;
      IF NULLIF(v_line->>'source_line_id', '') IS NOT NULL THEN
        v_io := public.internal_order_for_matcher_line_internal(
          p_actor_user_id, v_header.organization_id, v_header.branch_id,
          (v_line->>'source_line_id')::uuid, v_ml.variant_id, v_ml.quantity);
        IF v_io IS NOT NULL THEN
          v_iol_id := (v_io->>'internal_order_line_id')::uuid;
          -- The document's own ZL, never the "order number" fallback.
          v_zl := v_io->>'zl_number';
        END IF;
      END IF;

      IF v_iol_id IS NULL AND (v_zl IS NULL OR v_code IS NULL) THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'movement_line_id', v_ml.id, 'reason', 'invalid_line'));
        CONTINUE;
      END IF;

      -- Through the repair order, as before.
      v_apply := 0;
      v_rol_id := NULL;
      v_reason := NULL;
      IF v_zl IS NULL OR v_code IS NULL THEN
        v_reason := 'no_repair_order';
      ELSE
        v_ro := NULL;
        SELECT id, status INTO v_ro
        FROM public.repair_orders
        WHERE organization_id = v_header.organization_id AND branch_id = v_header.branch_id
          AND zl_number = v_zl AND deleted_at IS NULL;

        IF v_ro.id IS NULL THEN
          v_reason := 'no_repair_order';
        ELSIF v_ro.status <> 'open' THEN
          v_reason := 'repair_order_' || v_ro.status;
        ELSE
          v_rol := NULL;
          SELECT id, variant_id INTO v_rol
          FROM public.repair_order_lines
          WHERE repair_order_id = v_ro.id AND deleted_at IS NULL
            -- A ZW line of the order is received onto exactly its position.
            AND CASE WHEN v_io->>'repair_order_line_id' IS NOT NULL
                     THEN id = (v_io->>'repair_order_line_id')::uuid
                     ELSE public.repair_order_normalize_product_code(product_code) = v_code END
          ORDER BY created_at
          LIMIT 1
          FOR UPDATE;

          IF v_rol.id IS NULL THEN
            v_reason := 'no_repair_order_line';
          ELSIF v_rol.variant_id IS NOT NULL AND v_rol.variant_id <> v_ml.variant_id THEN
            v_reason := 'variant_mismatch';
          ELSE
            v_outstanding := public.repair_order_line_outstanding_receipt(v_rol.id);
            v_apply := LEAST(v_ml.quantity, GREATEST(v_outstanding, 0));
            IF v_apply <= 0 THEN
              v_apply := 0;
              v_reason := 'already_received';
            END IF;
          END IF;
        END IF;
      END IF;

      IF v_apply > 0 THEN
        IF v_rol.variant_id IS NULL THEN
          UPDATE public.repair_order_lines SET variant_id = v_ml.variant_id, updated_at = now()
          WHERE id = v_rol.id AND variant_id IS NULL;
        END IF;

        PERFORM public.attach_repair_order_line_movement(p_actor_user_id, v_rol.id, v_ml.id, v_apply, 'receipt');

        IF v_docs ? v_ro.id::text THEN
          v_res_id := (v_docs -> v_ro.id::text ->> 'id')::uuid;
          v_res_number := v_docs -> v_ro.id::text ->> 'number';
        ELSE
          v_res_number := public.inventory_next_commitment_number_internal(
            v_header.organization_id, 'reservation', p_actor_user_id);
          INSERT INTO public.inventory_reservations (
            organization_id, branch_id, reservation_number, reference_type, reference_id,
            reference_number, notes, created_by
          ) VALUES (
            v_header.organization_id, v_header.branch_id, v_res_number, 'repair_order', v_ro.id,
            v_zl, 'Przyjęcie ' || COALESCE(v_header.document_number, ''), p_actor_user_id
          )
          RETURNING id INTO v_res_id;
          v_docs := v_docs || jsonb_build_object(v_ro.id::text, jsonb_build_object('id', v_res_id, 'number', v_res_number));
        END IF;

        v_rl_id := public.inventory_reservation_add_line_internal(
          v_res_id, v_ml.variant_id, v_ml.destination_location_id, v_apply,
          v_rol.id, v_ml.id, NULL, p_actor_user_id,
          'Przyjęcie ' || COALESCE(v_header.document_number, ''));
        v_rol_id := v_rol.id;

        IF v_iol_id IS NOT NULL THEN
          UPDATE public.inventory_reservation_lines SET internal_order_line_id = v_iol_id WHERE id = v_rl_id;
          UPDATE public.internal_order_lines SET repair_order_line_id = v_rol.id
          WHERE id = v_iol_id AND repair_order_line_id IS NULL;
          INSERT INTO public.internal_order_line_movement_links (
            internal_order_line_id, inventory_movement_line_id, applied_quantity, relation_type, repair_order_line_id
          ) VALUES (v_iol_id, v_ml.id, v_apply, 'receipt', v_rol.id);
        END IF;

        v_attributed := v_attributed || jsonb_build_array(jsonb_build_object(
          'movement_line_id', v_ml.id, 'repair_order_id', v_ro.id, 'repair_order_line_id', v_rol.id,
          'zl_number', v_zl, 'quantity', v_apply,
          'free_quantity', CASE WHEN v_iol_id IS NULL THEN v_ml.quantity - v_apply ELSE 0 END,
          'reservation_id', v_res_id, 'reservation_number', v_res_number,
          'internal_order_id', v_io->>'internal_order_id',
          'internal_order_number', v_io->>'order_number'));
      END IF;

      -- What the repair order does not take stays under the ZW alone.
      v_rest := v_ml.quantity - v_apply;
      IF v_iol_id IS NOT NULL AND v_rest > 0 THEN
        IF v_zw_docs ? (v_io->>'internal_order_id') THEN
          v_res_id := (v_zw_docs -> (v_io->>'internal_order_id') ->> 'id')::uuid;
          v_res_number := v_zw_docs -> (v_io->>'internal_order_id') ->> 'number';
        ELSE
          v_res_number := public.inventory_next_commitment_number_internal(
            v_header.organization_id, 'reservation', p_actor_user_id);
          INSERT INTO public.inventory_reservations (
            organization_id, branch_id, reservation_number, reference_type, reference_id,
            reference_number, notes, created_by
          ) VALUES (
            v_header.organization_id, v_header.branch_id, v_res_number, 'internal_order',
            (v_io->>'internal_order_id')::uuid, v_io->>'order_number',
            'Przyjęcie ' || COALESCE(v_header.document_number, ''), p_actor_user_id
          )
          RETURNING id INTO v_res_id;
          v_zw_docs := v_zw_docs || jsonb_build_object(v_io->>'internal_order_id',
            jsonb_build_object('id', v_res_id, 'number', v_res_number));
        END IF;

        v_rl_id := public.inventory_reservation_add_line_internal(
          v_res_id, v_ml.variant_id, v_ml.destination_location_id, v_rest,
          NULL, v_ml.id, NULL, p_actor_user_id,
          'Przyjęcie ' || COALESCE(v_header.document_number, ''));
        UPDATE public.inventory_reservation_lines SET internal_order_line_id = v_iol_id WHERE id = v_rl_id;
        INSERT INTO public.internal_order_line_movement_links (
          internal_order_line_id, inventory_movement_line_id, applied_quantity, relation_type
        ) VALUES (v_iol_id, v_ml.id, v_rest, 'receipt');

        v_attributed := v_attributed || jsonb_build_array(jsonb_build_object(
          'movement_line_id', v_ml.id, 'repair_order_id', NULL, 'repair_order_line_id', NULL,
          'zl_number', v_zl, 'quantity', v_rest, 'free_quantity', 0,
          'reservation_id', v_res_id, 'reservation_number', v_res_number,
          'internal_order_id', v_io->>'internal_order_id',
          'internal_order_number', v_io->>'order_number',
          'repair_order_reason', v_reason));
      ELSIF v_apply = 0 THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', v_reason));
      END IF;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'already_attributed'));
    END;
  END LOOP;

  RETURN jsonb_build_object('movement_id', p_movement_id, 'attributed', v_attributed, 'skipped', v_skipped);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_attribute_receipt_to_repair_orders(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_attribute_receipt_to_repair_orders(uuid, uuid, jsonb) TO authenticated;
