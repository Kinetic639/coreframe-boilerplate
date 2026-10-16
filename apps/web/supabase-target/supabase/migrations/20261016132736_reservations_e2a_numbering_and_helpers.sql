-- ============================================================================
-- Reservations & blocks, stage E2/E3 part A (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- * Document numbering for new reservations / allocations: REZ/rrrr/nnnnnn,
--   KON/rrrr/nnnnnn (counters continue from inventory_settings; numbers
--   already issued as RES-... / ALLOC-... stay as they are).
-- * Reservations and allocations are allowed in the receiving zone: parts
--   received for a repair order are reserved there from the PZ on.
-- * Engine-internal helpers: add a reservation line, release (or move out)
--   a reservation quantity, write a reservation event. Not callable by users.
-- * inventory_create_reservation / inventory_create_allocation: new
--   numbering, repair_order_line_id on the line, history events.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_next_commitment_number_internal(
  p_organization_id uuid, p_kind text, p_actor_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_n bigint;
  v_prefix text;
BEGIN
  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF p_kind = 'reservation' THEN
    v_n := v_settings.reservation_number_next;
    v_prefix := 'REZ';
    UPDATE public.inventory_settings
    SET reservation_number_next = reservation_number_next + 1,
        updated_by = COALESCE(p_actor_user_id, updated_by)
    WHERE id = v_settings.id;
  ELSIF p_kind = 'allocation' THEN
    v_n := v_settings.allocation_number_next;
    v_prefix := 'KON';
    UPDATE public.inventory_settings
    SET allocation_number_next = allocation_number_next + 1,
        updated_by = COALESCE(p_actor_user_id, updated_by)
    WHERE id = v_settings.id;
  ELSE
    RAISE EXCEPTION 'Unknown commitment number kind %', p_kind USING ERRCODE = '22023';
  END IF;

  RETURN v_prefix || '/' || extract(year from now())::int::text || '/' || lpad(v_n::text, 6, '0');
END;
$function$;

-- Receiving zone: commitments are allowed (the PZ reserves parts for their
-- repair orders right where they land). The triggers stay; the check is gone.
CREATE OR REPLACE FUNCTION public.inventory_block_commitment_at_receiving()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

-- One history row per reservation change. Context comes from the line.
CREATE OR REPLACE FUNCTION public.inventory_reservation_log_internal(
  p_reservation_line_id uuid,
  p_event_type text,
  p_quantity numeric,
  p_location_id uuid,
  p_to_location_id uuid,
  p_movement_id uuid,
  p_movement_line_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_to_repair_order_line_id uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_line record;
  v_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT rl.id, rl.organization_id, rl.branch_id, rl.reservation_id, rl.location_id,
         COALESCE(rl.repair_order_line_id,
                  CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) AS rol_id
  INTO v_line
  FROM public.inventory_reservation_lines rl
  JOIN public.inventory_reservations r ON r.id = rl.reservation_id
  WHERE rl.id = p_reservation_line_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation line not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.inventory_reservation_events (
    organization_id, branch_id, reservation_id, reservation_line_id, event_type, quantity,
    location_id, to_location_id, repair_order_line_id, to_repair_order_line_id,
    movement_id, movement_line_id, reason, actor_user_id
  ) VALUES (
    v_line.organization_id, v_line.branch_id, v_line.reservation_id, v_line.id, p_event_type, p_quantity,
    COALESCE(p_location_id, v_line.location_id), p_to_location_id, v_line.rol_id, p_to_repair_order_line_id,
    p_movement_id, p_movement_line_id, NULLIF(trim(p_reason), ''), p_actor_user_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- Add a reserved quantity to a reservation document. Takes only D.
CREATE OR REPLACE FUNCTION public.inventory_reservation_add_line_internal(
  p_reservation_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_repair_order_line_id uuid,
  p_source_movement_line_id uuid,
  p_moved_from_line_id uuid,
  p_actor_user_id uuid,
  p_reason text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res public.inventory_reservations%ROWTYPE;
  v_product_id uuid;
  v_balance public.inventory_balances%ROWTYPE;
  v_line_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Reservation quantity must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_res FROM public.inventory_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.id INTO v_product_id
  FROM public.inventory_variants v
  JOIN public.inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
  WHERE v.id = p_variant_id AND v.organization_id = v_res.organization_id AND v.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation variant not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  v_balance := public.inventory_get_or_create_balance_for_update(
    v_res.organization_id, v_res.branch_id, p_location_id, p_variant_id, NULL, NULL, NULL);

  IF v_balance.available_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock to reserve (available %, requested %)',
      v_balance.available_quantity, p_quantity USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.inventory_reservation_lines (
    organization_id, branch_id, reservation_id, product_id, variant_id, location_id,
    reserved_quantity, repair_order_line_id, source_movement_line_id, moved_from_line_id
  ) VALUES (
    v_res.organization_id, v_res.branch_id, v_res.id, v_product_id, p_variant_id, p_location_id,
    p_quantity, p_repair_order_line_id, p_source_movement_line_id, p_moved_from_line_id
  )
  RETURNING id INTO v_line_id;

  UPDATE public.inventory_balances
  SET reserved_quantity = reserved_quantity + p_quantity
  WHERE id = v_balance.id;

  IF p_moved_from_line_id IS NULL THEN
    PERFORM public.inventory_reservation_log_internal(
      v_line_id, 'created', p_quantity, p_location_id, NULL, NULL, p_source_movement_line_id,
      p_reason, p_actor_user_id);
  END IF;

  RETURN v_line_id;
END;
$function$;

-- Take a quantity off a reservation line (R -> D at its location).
-- p_event_type 'released' logs the release here; 'moved' leaves the log to
-- the caller, which knows the destination and the MM.
CREATE OR REPLACE FUNCTION public.inventory_reservation_release_internal(
  p_reservation_line_id uuid,
  p_quantity numeric,
  p_event_type text,
  p_reason text,
  p_actor_user_id uuid,
  p_movement_id uuid DEFAULT NULL,
  p_movement_line_id uuid DEFAULT NULL)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_line public.inventory_reservation_lines%ROWTYPE;
  v_remaining numeric;
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  IF p_event_type NOT IN ('released', 'moved') THEN
    RAISE EXCEPTION 'Release event type must be released or moved' USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_line FROM public.inventory_reservation_lines WHERE id = p_reservation_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation line not found' USING ERRCODE = 'P0002';
  END IF;

  v_remaining := v_line.reserved_quantity - v_line.released_quantity - v_line.fulfilled_quantity;
  IF p_quantity > v_remaining THEN
    RAISE EXCEPTION 'Only % left on this reservation line', v_remaining USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  v_balance := public.inventory_get_or_create_balance_for_update(
    v_line.organization_id, v_line.branch_id, v_line.location_id, v_line.variant_id, NULL,
    v_line.lot_id, v_line.serial_id);

  UPDATE public.inventory_balances
  SET reserved_quantity = reserved_quantity - p_quantity
  WHERE id = v_balance.id;

  UPDATE public.inventory_reservation_lines
  SET released_quantity = released_quantity + p_quantity
  WHERE id = v_line.id;

  IF p_event_type = 'released' THEN
    PERFORM public.inventory_reservation_log_internal(
      v_line.id, 'released', p_quantity, v_line.location_id, NULL, p_movement_id, p_movement_line_id,
      p_reason, p_actor_user_id);
  END IF;

  RETURN p_quantity;
END;
$function$;

-- Reservations: REZ/ numbering, repair-order line on the line, 'created' event.
CREATE OR REPLACE FUNCTION public.inventory_create_reservation(p_organization_id uuid, p_branch_id uuid, p_lines jsonb, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_reference_number text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation_id uuid;
  v_reservation_number text;
  v_line jsonb;
  v_quantity numeric(18, 6);
  v_rol_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one reservation line is required';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  v_reservation_number := public.inventory_next_commitment_number_internal(p_organization_id, 'reservation', p_actor_user_id);
  v_rol_id := CASE WHEN p_reference_type = 'repair_order_line' THEN p_reference_id END;

  INSERT INTO public.inventory_reservations (
    organization_id, branch_id, reservation_number, reference_type, reference_id,
    reference_number, expires_at, notes, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, v_reservation_number, p_reference_type, p_reference_id,
    p_reference_number, p_expires_at, p_notes, p_actor_user_id
  )
  RETURNING id INTO v_reservation_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_quantity := (v_line ->> 'quantity')::numeric;
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Reservation quantity must be positive';
    END IF;
    IF nullif(v_line ->> 'location_id', '') IS NULL THEN
      RAISE EXCEPTION 'Phase 2 hard reservations require location_id';
    END IF;
    IF nullif(v_line ->> 'lot_id', '') IS NOT NULL OR nullif(v_line ->> 'serial_id', '') IS NOT NULL THEN
      RAISE EXCEPTION 'Lot/serial reservations are not supported' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_variants v
      JOIN public.inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
      WHERE v.id = (v_line ->> 'variant_id')::uuid AND v.organization_id = p_organization_id
        AND v.status = 'active' AND p.status = 'active' AND v.deleted_at IS NULL AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Reservation variant is not active';
    END IF;

    BEGIN
      PERFORM public.inventory_reservation_add_line_internal(
        v_reservation_id, (v_line ->> 'variant_id')::uuid, (v_line ->> 'location_id')::uuid,
        v_quantity, v_rol_id, NULL, NULL, p_actor_user_id,
        COALESCE(nullif(trim(p_notes), ''), 'Rezerwacja z magazynu'));
    EXCEPTION WHEN SQLSTATE '22023' THEN
      RAISE EXCEPTION 'Insufficient available stock to reserve';
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation_id,
    'reservation_number', v_reservation_number,
    'status', 'active'
  );
END;
$function$;

-- Allocations: KON/ numbering, 'allocated' event for a reserved line.
CREATE OR REPLACE FUNCTION public.inventory_create_allocation(p_organization_id uuid, p_branch_id uuid, p_lines jsonb, p_reservation_id uuid DEFAULT NULL::uuid, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_reference_number text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allocation_id uuid;
  v_allocation_number text;
  v_line jsonb;
  v_product_id uuid;
  v_quantity numeric(18, 6);
  v_reservation_line public.inventory_reservation_lines%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one allocation line is required';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  v_allocation_number := public.inventory_next_commitment_number_internal(p_organization_id, 'allocation', p_actor_user_id);

  INSERT INTO public.inventory_allocations (
    organization_id, branch_id, allocation_number, reservation_id, reference_type,
    reference_id, reference_number, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, v_allocation_number, p_reservation_id, p_reference_type,
    p_reference_id, p_reference_number, p_actor_user_id
  )
  RETURNING id INTO v_allocation_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_quantity := (v_line ->> 'quantity')::numeric;
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Allocation quantity must be positive';
    END IF;

    SELECT p.id
    INTO v_product_id
    FROM public.inventory_variants v
    JOIN public.inventory_products p
      ON p.id = v.product_id AND p.organization_id = v.organization_id
    WHERE v.id = (v_line ->> 'variant_id')::uuid
      AND v.organization_id = p_organization_id
      AND v.status = 'active'
      AND p.status = 'active'
      AND v.deleted_at IS NULL
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Allocation variant is not active';
    END IF;

    v_balance := public.inventory_get_or_create_balance_for_update(
      p_organization_id,
      p_branch_id,
      (v_line ->> 'location_id')::uuid,
      (v_line ->> 'variant_id')::uuid,
      null,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid
    );

    IF nullif(v_line ->> 'reservation_line_id', '') IS NOT NULL THEN
      SELECT * INTO v_reservation_line
      FROM public.inventory_reservation_lines
      WHERE id = (v_line ->> 'reservation_line_id')::uuid
        AND organization_id = p_organization_id
        AND branch_id = p_branch_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation line not found for allocation';
      END IF;

      IF v_reservation_line.reserved_quantity - v_reservation_line.released_quantity - v_reservation_line.fulfilled_quantity < v_quantity THEN
        RAISE EXCEPTION 'Allocation exceeds remaining reservation quantity';
      END IF;

      UPDATE public.inventory_reservation_lines
      SET fulfilled_quantity = fulfilled_quantity + v_quantity
      WHERE id = v_reservation_line.id;

      UPDATE public.inventory_balances
      SET reserved_quantity = greatest(0, reserved_quantity - v_quantity),
          allocated_quantity = allocated_quantity + v_quantity
      WHERE id = v_balance.id;

      PERFORM public.inventory_reservation_log_internal(
        v_reservation_line.id, 'allocated', v_quantity, v_reservation_line.location_id, NULL, NULL, NULL,
        v_allocation_number, p_actor_user_id);
    ELSE
      IF v_balance.available_quantity < v_quantity THEN
        RAISE EXCEPTION 'Insufficient available stock to allocate';
      END IF;

      UPDATE public.inventory_balances
      SET allocated_quantity = allocated_quantity + v_quantity
      WHERE id = v_balance.id;
    END IF;

    INSERT INTO public.inventory_allocation_lines (
      organization_id, branch_id, allocation_id, reservation_line_id, product_id, variant_id,
      location_id, lot_id, serial_id, allocated_quantity
    )
    VALUES (
      p_organization_id, p_branch_id, v_allocation_id,
      nullif(v_line ->> 'reservation_line_id', '')::uuid,
      v_product_id,
      (v_line ->> 'variant_id')::uuid,
      (v_line ->> 'location_id')::uuid,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid,
      v_quantity
    );
  END LOOP;

  RETURN jsonb_build_object(
    'allocation_id', v_allocation_id,
    'allocation_number', v_allocation_number,
    'status', 'active'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_next_commitment_number_internal(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_reservation_log_internal(uuid, text, numeric, uuid, uuid, uuid, uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_reservation_add_line_internal(uuid, uuid, uuid, numeric, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_reservation_release_internal(uuid, numeric, text, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
