CREATE OR REPLACE FUNCTION public.inventory_send_branch_transfer(
  p_transfer_id uuid,
  p_actor_user_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
  v_type_id uuid;
  v_header_id uuid;
  v_line record;
  v_line_number integer := 0;
  v_res_line public.inventory_reservation_lines%ROWTYPE;
  v_remaining numeric(18, 6);
  v_balance public.inventory_balances%ROWTYPE;
  v_finalize_result jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_transfer
  FROM public.inventory_branch_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_branch_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF v_transfer.status <> 'prepared' THEN
    RAISE EXCEPTION 'Only prepared transfers can be sent (status=%)', v_transfer.status USING ERRCODE = 'P0007';
  END IF;

  IF v_transfer.reservation_id IS NULL THEN
    RAISE EXCEPTION 'Transfer has no reservation to consume' USING ERRCODE = 'P0002';
  END IF;

  SELECT id INTO v_type_id
  FROM public.inventory_movement_types
  WHERE organization_id = v_transfer.organization_id AND code = '311' AND deleted_at IS NULL;

  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Transfer-issue movement type not configured for this organization' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  -- Consume the reservation EXACTLY ONCE: decrement reserved_quantity and
  -- record fulfilled_quantity BEFORE posting the physical decrease, so
  -- the IC-1 commitment invariant (on_hand >= reserved+allocated) is
  -- evaluated against the POST-consumption reserved value -- this is
  -- what allows the decrease down to exactly the committed boundary
  -- without spuriously tripping P0003 against its own reservation.
  FOR v_res_line IN
    SELECT * FROM public.inventory_reservation_lines
    WHERE reservation_id = v_transfer.reservation_id
    FOR UPDATE
  LOOP
    v_remaining := v_res_line.reserved_quantity - v_res_line.released_quantity - v_res_line.fulfilled_quantity;
    IF v_remaining > 0 THEN
      v_balance := public.inventory_get_or_create_balance_for_update(
        v_res_line.organization_id, v_res_line.branch_id, v_res_line.location_id,
        v_res_line.variant_id, NULL, v_res_line.lot_id, v_res_line.serial_id
      );

      UPDATE public.inventory_balances
      SET reserved_quantity = greatest(0, reserved_quantity - v_remaining)
      WHERE id = v_balance.id;

      UPDATE public.inventory_reservation_lines
      SET fulfilled_quantity = fulfilled_quantity + v_remaining
      WHERE id = v_res_line.id;
    END IF;
  END LOOP;

  UPDATE public.inventory_reservations
  SET status = 'fulfilled', updated_at = now()
  WHERE id = v_transfer.reservation_id;

  -- Build the source-issue movement directly (same pattern as
  -- inventory_reverse_movement) since 311 is allows_manual_entry=false --
  -- inventory_create_draft's own guard rejects it unconditionally,
  -- regardless of caller, so this orchestration RPC posts through the
  -- lower internal primitive instead, exactly like reversal does for 900.
  v_header_id := gen_random_uuid();

  INSERT INTO public.inventory_movement_headers (
    id, organization_id, branch_id, movement_type_id, movement_type_code,
    status, reference_type, reference_id, idempotency_key, created_by
  ) VALUES (
    v_header_id, v_transfer.organization_id, v_transfer.source_branch_id, v_type_id, '311',
    'draft', 'branch_transfer', v_transfer.id::text,
    'branch-transfer-send-' || v_transfer.id::text, p_actor_user_id
  );

  FOR v_line IN
    SELECT * FROM public.inventory_branch_transfer_lines
    WHERE transfer_id = v_transfer.id
    ORDER BY created_at, id
  LOOP
    v_line_number := v_line_number + 1;

    INSERT INTO public.inventory_movement_lines (
      movement_id, organization_id, branch_id, line_number,
      variant_id, unit_id, quantity, source_location_id,
      lot_id, serial_id, note
    ) VALUES (
      v_header_id, v_transfer.organization_id, v_transfer.source_branch_id, v_line_number,
      v_line.variant_id, v_line.unit_id, v_line.quantity, v_line.source_location_id,
      v_line.lot_id, v_line.serial_id,
      'Sent to destination branch (transfer ' || v_transfer.transfer_number || ')'
    );

    UPDATE public.inventory_branch_transfer_lines
    SET sent_quantity = v_line.quantity
    WHERE id = v_line.id;
  END LOOP;

  IF v_line_number = 0 THEN
    RAISE EXCEPTION 'Transfer has no lines to send' USING ERRCODE = 'P0002';
  END IF;

  -- p_explicit_effects = NULL: uses 311's own type-catalog effect
  -- (source on_hand decrease). IC-2's frozen contract restricts explicit
  -- effects to movement type 900 only -- this call does not use them.
  v_finalize_result := public.inventory_finalize_posting_internal(v_header_id, p_actor_user_id, NULL);

  UPDATE public.inventory_branch_transfers
  SET status = 'in_transit',
      source_movement_id = v_header_id,
      sent_by = p_actor_user_id,
      sent_at = now(),
      updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'in_transit',
    'source_movement_id', v_header_id,
    'source_document_number', v_finalize_result ->> 'document_number'
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('28000', 'P0002', 'P0003', 'P0007') THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'Branch transfer send failed unexpectedly: %', SQLERRM USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_send_branch_transfer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_send_branch_transfer(uuid, uuid) TO authenticated, service_role;
