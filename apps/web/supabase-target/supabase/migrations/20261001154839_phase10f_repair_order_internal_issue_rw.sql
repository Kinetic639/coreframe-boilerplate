-- Phase 10F -- internal issue of parts to a repair order: movement 261,
-- document RW ("Rozchód wewnętrzny"; AutoStacja calls it WU). Product
-- correction 2026-10-01: issuing parts to the body/paint technician is an
-- INTERNAL issue (RW), not an external one (WZ/201, kept free for future
-- sales). The engine (inventory_create_draft / inventory_finalize_posting)
-- is reused unchanged -- the commitment is consumed in this domain RPC in
-- the same transaction, before posting, exactly like Phase 10E.

-- Idempotent catalog entry: RW document type + 261 movement type + effect.
CREATE OR REPLACE FUNCTION public.inventory_ensure_repair_order_issue_type(p_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_doc_id uuid;
  v_type_id uuid;
BEGIN
  INSERT INTO public.inventory_document_types (
    organization_id, code, name, name_pl, name_en, category, numbering_template, is_system
  ) VALUES (
    p_organization_id, 'RW', 'Internal Issue', 'Rozchód Wewnętrzny',
    'Internal Issue', 'issue', 'RW/{year}/{seq:6}', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_doc_id;

  IF v_doc_id IS NULL THEN
    SELECT id INTO v_doc_id FROM public.inventory_document_types
    WHERE organization_id = p_organization_id AND code = 'RW' AND deleted_at IS NULL;
  END IF;

  INSERT INTO public.inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system
  ) VALUES (
    p_organization_id, '261', v_doc_id, 'Goods Issue to Repair Order (RW)',
    'Rozchód wewnętrzny na zlecenie', 'Goods Issue to Repair Order', 'issue',
    true, false, 'decrease', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_id;

  IF v_type_id IS NULL THEN
    SELECT id INTO v_type_id FROM public.inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '261' AND deleted_at IS NULL;
  END IF;

  INSERT INTO public.inventory_movement_type_effects (
    movement_type_id, effect_order, target, balance_field, direction, is_required, description
  ) VALUES (
    v_type_id, 1, 'source', 'on_hand', 'decrease', true, 'Issue stock from source bin to the repair order'
  )
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;

  RETURN v_type_id;
END;
$function$;

-- Seed every organization that already has a movement catalog.
SELECT public.inventory_ensure_repair_order_issue_type(o.organization_id)
FROM (SELECT DISTINCT organization_id FROM public.inventory_movement_types WHERE deleted_at IS NULL) o;

-- Issue parts of one repair order.
-- p_lines: [{ "repair_order_line_id": uuid, "quantity": n,
--             "allocation_line_id": uuid }       -- from a container / allocation
--          | { ..., "reservation_line_id": uuid }] -- bulk material at its fixed bin
-- Consumes the commitment exactly once (allocation: allocated -> fulfilled,
-- never re-touching the reservation line; reservation: reserved ->
-- fulfilled), takes the parts out of their container (container empties
-- when nothing is left), posts one RW (261) with the recipient, and links
-- every line to its RepairOrderLine (relation 'issue'). All atomic.
CREATE OR REPLACE FUNCTION public.repair_order_issue_parts(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_repair_order_id uuid,
  p_lines jsonb,
  p_recipient text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ro record;
  v_line jsonb;
  v_index integer := 0;
  v_rol record;
  v_qty numeric;
  v_alloc record;
  v_resl record;
  v_balance public.inventory_balances%ROWTYPE;
  v_unit uuid;
  v_location uuid;
  v_variant uuid;
  v_container_id uuid;
  v_left numeric;
  v_link record;
  v_take numeric;
  v_engine_lines jsonb := '[]'::jsonb;
  v_meta jsonb := '[]'::jsonb;
  v_draft jsonb;
  v_movement_id uuid;
  v_posted jsonb;
  v_ml_ids uuid[];
  v_i integer;
  v_touched uuid[] := ARRAY[]::uuid[];
  v_c uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_recipient IS NULL OR length(trim(p_recipient)) = 0 THEN
    RAISE EXCEPTION 'A recipient is required' USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, zl_number INTO v_ro
  FROM public.repair_orders
  WHERE id = p_repair_order_id AND organization_id = p_organization_id
    AND branch_id = p_branch_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repair order not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.inventory_ensure_repair_order_issue_type(p_organization_id);
  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_index := v_index + 1;
    v_qty := (v_line->>'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line % quantity must be positive', v_index USING ERRCODE = '22023';
    END IF;

    SELECT rol.id, rol.variant_id INTO v_rol
    FROM public.repair_order_lines rol
    WHERE rol.id = (v_line->>'repair_order_line_id')::uuid
      AND rol.repair_order_id = v_ro.id AND rol.deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line % does not belong to this repair order', v_index USING ERRCODE = 'P0002';
    END IF;

    v_container_id := NULL;

    IF NULLIF(v_line->>'allocation_line_id', '') IS NOT NULL THEN
      -- Allocation (container) path.
      SELECT al.* INTO v_alloc
      FROM public.inventory_allocation_lines al
      JOIN public.inventory_reservation_lines rl ON rl.id = al.reservation_line_id
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      WHERE al.id = (v_line->>'allocation_line_id')::uuid
        AND al.organization_id = p_organization_id AND al.branch_id = p_branch_id
        AND r.reference_type = 'repair_order_line' AND r.reference_id = v_rol.id
      FOR UPDATE OF al;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Line %: allocation does not belong to this repair-order line', v_index USING ERRCODE = 'P0002';
      END IF;
      IF v_alloc.allocated_quantity - v_alloc.fulfilled_quantity < v_qty THEN
        RAISE EXCEPTION 'Line %: only % left to issue from this allocation', v_index,
          v_alloc.allocated_quantity - v_alloc.fulfilled_quantity USING ERRCODE = '22023';
      END IF;

      v_balance := public.inventory_get_or_create_balance_for_update(
        p_organization_id, p_branch_id, v_alloc.location_id, v_alloc.variant_id, NULL,
        v_alloc.lot_id, v_alloc.serial_id);
      UPDATE public.inventory_balances
      SET allocated_quantity = GREATEST(0, allocated_quantity - v_qty)
      WHERE id = v_balance.id;
      UPDATE public.inventory_allocation_lines
      SET fulfilled_quantity = fulfilled_quantity + v_qty
      WHERE id = v_alloc.id;

      -- Take the parts out of their container(s), oldest placement first.
      v_left := v_qty;
      FOR v_link IN
        SELECT l.id AS link_id, l.quantity AS link_qty, cl.id AS cline_id, cl.quantity AS cline_qty, cl.container_id
        FROM public.inventory_allocation_container_links l
        JOIN public.inventory_container_lines cl ON cl.id = l.container_line_id
        WHERE l.allocation_line_id = v_alloc.id AND l.deleted_at IS NULL AND cl.deleted_at IS NULL
        ORDER BY l.created_at
        FOR UPDATE OF l, cl
      LOOP
        EXIT WHEN v_left <= 0;
        v_take := LEAST(v_left, v_link.link_qty);
        IF v_take >= v_link.link_qty THEN
          UPDATE public.inventory_allocation_container_links SET deleted_at = now() WHERE id = v_link.link_id;
        ELSE
          UPDATE public.inventory_allocation_container_links SET quantity = quantity - v_take WHERE id = v_link.link_id;
        END IF;
        IF v_take >= v_link.cline_qty THEN
          UPDATE public.inventory_container_lines SET deleted_at = now(), updated_at = now() WHERE id = v_link.cline_id;
        ELSE
          UPDATE public.inventory_container_lines SET quantity = quantity - v_take, updated_at = now() WHERE id = v_link.cline_id;
        END IF;
        v_container_id := COALESCE(v_container_id, v_link.container_id);
        v_touched := array_append(v_touched, v_link.container_id);
        v_left := v_left - v_take;
      END LOOP;

      v_location := v_alloc.location_id;
      v_variant := v_alloc.variant_id;

    ELSIF NULLIF(v_line->>'reservation_line_id', '') IS NOT NULL THEN
      -- Reservation (bulk material at its fixed bin) path.
      SELECT rl.* INTO v_resl
      FROM public.inventory_reservation_lines rl
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      WHERE rl.id = (v_line->>'reservation_line_id')::uuid
        AND rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
        AND r.reference_type = 'repair_order_line' AND r.reference_id = v_rol.id
        AND r.status <> 'cancelled'
      FOR UPDATE OF rl;
      IF NOT FOUND OR v_resl.location_id IS NULL THEN
        RAISE EXCEPTION 'Line %: reservation does not belong to this repair-order line', v_index USING ERRCODE = 'P0002';
      END IF;
      IF v_resl.reserved_quantity - v_resl.released_quantity - v_resl.fulfilled_quantity < v_qty THEN
        RAISE EXCEPTION 'Line %: only % left to issue from this reservation', v_index,
          v_resl.reserved_quantity - v_resl.released_quantity - v_resl.fulfilled_quantity USING ERRCODE = '22023';
      END IF;

      v_balance := public.inventory_get_or_create_balance_for_update(
        p_organization_id, p_branch_id, v_resl.location_id, v_resl.variant_id, NULL,
        v_resl.lot_id, v_resl.serial_id);
      UPDATE public.inventory_balances
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_qty)
      WHERE id = v_balance.id;
      UPDATE public.inventory_reservation_lines
      SET fulfilled_quantity = fulfilled_quantity + v_qty
      WHERE id = v_resl.id;

      v_location := v_resl.location_id;
      v_variant := v_resl.variant_id;
    ELSE
      RAISE EXCEPTION 'Line % must name an allocation or a reservation to issue from', v_index USING ERRCODE = '22023';
    END IF;

    SELECT p.base_unit_id INTO v_unit
    FROM public.inventory_variants v
    JOIN public.inventory_products p ON p.id = v.product_id
    WHERE v.id = v_variant;

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_variant,
      'unit_id', v_unit,
      'quantity', v_qty,
      'source_location_id', v_location,
      'note', NULL));
    v_meta := v_meta || jsonb_build_array(jsonb_build_object(
      'repair_order_line_id', v_rol.id, 'quantity', v_qty, 'container_id', v_container_id));
  END LOOP;

  -- Containers left with nothing inside are empty.
  FOREACH v_c IN ARRAY v_touched
  LOOP
    UPDATE public.inventory_containers c
    SET status = 'empty', updated_at = now(), updated_by = p_actor_user_id
    WHERE c.id = v_c AND c.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_container_lines cl
        WHERE cl.container_id = c.id AND cl.deleted_at IS NULL);
  END LOOP;

  -- The physical issue: one RW (261) for the whole issue.
  v_draft := public.inventory_create_draft(
    p_organization_id, p_branch_id, '261', v_engine_lines,
    NULL, NULL, trim(p_recipient), v_ro.zl_number, NULLIF(trim(p_note), ''), NULL, p_actor_user_id);
  v_movement_id := (v_draft->>'movement_id')::uuid;

  UPDATE public.inventory_movement_headers
  SET reference_type = 'repair_order', reference_id = v_ro.id::text, recipient_name = trim(p_recipient)
  WHERE id = v_movement_id;

  SELECT array_agg(id ORDER BY line_number) INTO v_ml_ids
  FROM public.inventory_movement_lines WHERE movement_id = v_movement_id;

  FOR v_i IN 1..jsonb_array_length(v_meta)
  LOOP
    IF (v_meta->(v_i - 1)->>'container_id') IS NOT NULL THEN
      UPDATE public.inventory_movement_lines
      SET container_id = (v_meta->(v_i - 1)->>'container_id')::uuid
      WHERE id = v_ml_ids[v_i];
    END IF;
  END LOOP;

  v_posted := public.inventory_finalize_posting(v_movement_id, p_actor_user_id);

  FOR v_i IN 1..jsonb_array_length(v_meta)
  LOOP
    PERFORM public.attach_repair_order_line_movement(
      p_actor_user_id,
      (v_meta->(v_i - 1)->>'repair_order_line_id')::uuid,
      v_ml_ids[v_i],
      (v_meta->(v_i - 1)->>'quantity')::numeric,
      'issue');
  END LOOP;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'document_number', v_posted->>'document_number',
    'line_count', jsonb_array_length(v_meta),
    'recipient', trim(p_recipient));
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_ensure_repair_order_issue_type(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.repair_order_issue_parts(uuid, uuid, uuid, uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_order_issue_parts(uuid, uuid, uuid, uuid, jsonb, text, text) TO authenticated;
