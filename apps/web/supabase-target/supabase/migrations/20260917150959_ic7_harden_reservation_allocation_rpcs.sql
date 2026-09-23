-- IC-7 -- inventory_create_reservation/inventory_release_reservation/
-- inventory_create_allocation/inventory_release_allocation were all
-- SECURITY INVOKER (the implicit Postgres default -- no SECURITY DEFINER
-- clause), out of compliance with this project's own standing convention
-- for every canonical RPC (architecture.md §9: "SECURITY DEFINER, owner
-- postgres..."). None had an actor-identity check -- p_actor_user_id was
-- accepted and used only to stamp created_by/cancelled_by, never
-- validated against auth.uid(). This was independently discovered while
-- adding RESTRICTIVE raw-write-deny policies to their own backing tables
-- in this same phase: since these RPCs are SECURITY INVOKER, they run AS
-- the calling authenticated role and are themselves subject to RLS --
-- the new RESTRICTIVE policies correctly blocked ordinary raw client
-- writes but ALSO blocked these RPCs' own legitimate INSERT/UPDATE calls,
-- since RLS cannot distinguish "called from inside this trusted function"
-- from "called directly by a client" without an unforgeable signal.
-- SECURITY DEFINER is that signal (the function then runs as its owner,
-- postgres, which has rolbypassrls=true) -- converting these 4 functions
-- to SECURITY DEFINER, matching every other canonical RPC in this
-- project, is therefore required for the reservation/allocation RLS fix
-- to work at all, not merely a hardening nicety.
--
-- inventory_release_reservation/inventory_release_allocation ALSO had a
-- cross-org existence-leak: "not found" and "found but no permission"
-- raised two DIFFERERENT error messages, letting a caller distinguish
-- "this id belongs to another org" from "this id does not exist at all".
-- Fixed to the same single P0002 "not found or not accessible" message
-- inventory_reverse_movement/inventory_cancel_movement/inventory_save_
-- draft already use.
--
-- Every line of actual business logic (settings/numbering, balance
-- locking, reservation/allocation line math, hard-reservation/allocation
-- invariant checks) is BYTE-FOR-BYTE UNCHANGED -- only the actor-identity
-- check, SECURITY DEFINER, the P0002 message unification, and the
-- explicit grant hardening were added.
CREATE OR REPLACE FUNCTION public.inventory_create_reservation(p_organization_id uuid, p_branch_id uuid, p_lines jsonb, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_reference_number text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_reservation_id uuid;
  v_reservation_number text;
  v_line jsonb;
  v_product_id uuid;
  v_balance public.inventory_balances%ROWTYPE;
  v_quantity numeric(18, 6);
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

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  v_reservation_number :=
    v_settings.reservation_number_prefix || '-' || lpad(v_settings.reservation_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET reservation_number_next = reservation_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

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
      RAISE EXCEPTION 'Reservation variant is not active';
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

    IF v_balance.available_quantity < v_quantity THEN
      RAISE EXCEPTION 'Insufficient available stock to reserve';
    END IF;

    INSERT INTO public.inventory_reservation_lines (
      organization_id, branch_id, reservation_id, product_id, variant_id, location_id,
      lot_id, serial_id, reserved_quantity
    )
    VALUES (
      p_organization_id, p_branch_id, v_reservation_id, v_product_id,
      (v_line ->> 'variant_id')::uuid,
      (v_line ->> 'location_id')::uuid,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid,
      v_quantity
    );

    UPDATE public.inventory_balances
    SET reserved_quantity = reserved_quantity + v_quantity
    WHERE id = v_balance.id;
  END LOOP;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation_id,
    'reservation_number', v_reservation_number,
    'status', 'active'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_create_reservation(uuid,uuid,jsonb,text,uuid,text,timestamp with time zone,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_reservation(uuid,uuid,jsonb,text,uuid,text,timestamp with time zone,text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_reservation(uuid,uuid,jsonb,text,uuid,text,timestamp with time zone,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_create_reservation(uuid,uuid,jsonb,text,uuid,text,timestamp with time zone,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.inventory_release_reservation(p_reservation_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_cancel boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
  v_line public.inventory_reservation_lines%ROWTYPE;
  v_remaining numeric(18, 6);
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_reservation
  FROM public.inventory_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_reservation.organization_id, v_reservation.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Reservation not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_line IN
    SELECT *
    FROM public.inventory_reservation_lines
    WHERE reservation_id = v_reservation.id
    FOR UPDATE
  LOOP
    v_remaining := v_line.reserved_quantity - v_line.released_quantity - v_line.fulfilled_quantity;
    IF v_remaining > 0 THEN
      v_balance := public.inventory_get_or_create_balance_for_update(
        v_line.organization_id,
        v_line.branch_id,
        v_line.location_id,
        v_line.variant_id,
        null,
        v_line.lot_id,
        v_line.serial_id
      );

      UPDATE public.inventory_balances
      SET reserved_quantity = greatest(0, reserved_quantity - v_remaining)
      WHERE id = v_balance.id;

      UPDATE public.inventory_reservation_lines
      SET released_quantity = released_quantity + v_remaining
      WHERE id = v_line.id;
    END IF;
  END LOOP;

  IF p_cancel THEN
    UPDATE public.inventory_reservations
    SET status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_actor_user_id
    WHERE id = v_reservation.id;
  END IF;

  RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', CASE WHEN p_cancel THEN 'cancelled' ELSE v_reservation.status END);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_release_reservation(uuid,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_release_reservation(uuid,uuid,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_release_reservation(uuid,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_release_reservation(uuid,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.inventory_create_allocation(p_organization_id uuid, p_branch_id uuid, p_lines jsonb, p_reservation_id uuid DEFAULT NULL::uuid, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_reference_number text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
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

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  v_allocation_number :=
    v_settings.allocation_number_prefix || '-' || lpad(v_settings.allocation_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET allocation_number_next = allocation_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

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

REVOKE ALL ON FUNCTION public.inventory_create_allocation(uuid,uuid,jsonb,uuid,text,uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_allocation(uuid,uuid,jsonb,uuid,text,uuid,text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_allocation(uuid,uuid,jsonb,uuid,text,uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_create_allocation(uuid,uuid,jsonb,uuid,text,uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.inventory_release_allocation(p_allocation_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allocation public.inventory_allocations%ROWTYPE;
  v_line public.inventory_allocation_lines%ROWTYPE;
  v_remaining numeric(18, 6);
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_allocation
  FROM public.inventory_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_allocation.organization_id, v_allocation.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Allocation not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_line IN
    SELECT *
    FROM public.inventory_allocation_lines
    WHERE allocation_id = v_allocation.id
    FOR UPDATE
  LOOP
    v_remaining := v_line.allocated_quantity - v_line.fulfilled_quantity;
    IF v_remaining > 0 THEN
      v_balance := public.inventory_get_or_create_balance_for_update(
        v_line.organization_id,
        v_line.branch_id,
        v_line.location_id,
        v_line.variant_id,
        null,
        v_line.lot_id,
        v_line.serial_id
      );

      UPDATE public.inventory_balances
      SET allocated_quantity = greatest(0, allocated_quantity - v_remaining)
      WHERE id = v_balance.id;
    END IF;
  END LOOP;

  UPDATE public.inventory_allocations
  SET status = 'released'
  WHERE id = v_allocation.id;

  RETURN jsonb_build_object('allocation_id', v_allocation.id, 'status', 'released');
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_release_allocation(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_release_allocation(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_release_allocation(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_release_allocation(uuid,uuid) TO service_role;
