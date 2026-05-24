-- Cross-branch transfers reserve source stock while the shipment is in transit.
-- Older transfers without reservation_id keep the previous issue/return behavior.

ALTER TABLE public.inventory_branch_transfers
  ADD COLUMN IF NOT EXISTS reservation_id uuid null references public.inventory_reservations(id) on delete restrict;

CREATE INDEX IF NOT EXISTS inventory_branch_transfers_reservation_idx
  ON public.inventory_branch_transfers (organization_id, reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.inventory_create_branch_transfer(
  p_organization_id uuid,
  p_source_branch_id uuid,
  p_destination_branch_id uuid,
  p_lines jsonb,
  p_notes text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_transfer_id uuid;
  v_transfer_number text;
  v_line jsonb;
  v_reservation_lines jsonb;
  v_reservation jsonb;
  v_reservation_id uuid;
BEGIN
  IF p_source_branch_id = p_destination_branch_id THEN
    RAISE EXCEPTION 'Cross-branch transfer requires different source and destination branches';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_source_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission for source branch';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one transfer line is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_source_branch_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_destination_branch_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Transfer branches must belong to the organization';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  v_transfer_number :=
    v_settings.branch_transfer_number_prefix || '-' || lpad(v_settings.branch_transfer_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET branch_transfer_number_next = branch_transfer_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  INSERT INTO public.inventory_branch_transfers (
    organization_id,
    transfer_number,
    source_branch_id,
    destination_branch_id,
    status,
    notes,
    sent_by,
    sent_at
  )
  VALUES (
    p_organization_id,
    v_transfer_number,
    p_source_branch_id,
    p_destination_branch_id,
    'in_transit',
    p_notes,
    p_actor_user_id,
    now()
  )
  RETURNING id INTO v_transfer_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    IF (v_line ->> 'quantity')::numeric <= 0 THEN
      RAISE EXCEPTION 'Transfer quantity must be positive';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.warehouse_locations
      WHERE id = (v_line ->> 'source_location_id')::uuid
        AND organization_id = p_organization_id
        AND branch_id = p_source_branch_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Source location must belong to the source branch';
    END IF;

    INSERT INTO public.inventory_branch_transfer_lines (
      organization_id,
      transfer_id,
      variant_id,
      source_location_id,
      lot_id,
      serial_id,
      unit_id,
      quantity
    )
    VALUES (
      p_organization_id,
      v_transfer_id,
      (v_line ->> 'variant_id')::uuid,
      (v_line ->> 'source_location_id')::uuid,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid,
      (v_line ->> 'unit_id')::uuid,
      (v_line ->> 'quantity')::numeric
    );
  END LOOP;

  SELECT jsonb_agg(jsonb_build_object(
    'variant_id', variant_id,
    'location_id', source_location_id,
    'lot_id', lot_id,
    'serial_id', serial_id,
    'quantity', quantity
  ))
  INTO v_reservation_lines
  FROM public.inventory_branch_transfer_lines
  WHERE transfer_id = v_transfer_id;

  v_reservation := public.inventory_create_reservation(
    p_organization_id,
    p_source_branch_id,
    v_reservation_lines,
    'branch_transfer',
    v_transfer_id,
    v_transfer_number,
    null,
    p_notes,
    p_actor_user_id
  );
  v_reservation_id := (v_reservation ->> 'reservation_id')::uuid;

  UPDATE public.inventory_branch_transfers
  SET reservation_id = v_reservation_id
  WHERE id = v_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'transfer_number', v_transfer_number,
    'status', 'in_transit',
    'reservation_id', v_reservation_id,
    'source_movement_id', null
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_accept_branch_transfer(
  p_transfer_id uuid,
  p_destination_location_id uuid,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
  v_reservation_line public.inventory_reservation_lines%ROWTYPE;
  v_remaining numeric(18, 6);
  v_balance public.inventory_balances%ROWTYPE;
  v_issue_lines jsonb;
  v_receipt_lines jsonb;
  v_source_movement jsonb;
  v_receipt_movement jsonb;
  v_source_movement_id uuid;
BEGIN
  SELECT * INTO v_transfer
  FROM public.inventory_branch_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch transfer not found';
  END IF;

  IF v_transfer.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Only in-transit branch transfers can be accepted';
  END IF;

  IF NOT public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission for destination branch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id
      AND organization_id = v_transfer.organization_id
      AND branch_id = v_transfer.destination_branch_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination location must belong to the destination branch';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  UPDATE public.inventory_branch_transfer_lines
  SET destination_location_id = p_destination_location_id
  WHERE transfer_id = v_transfer.id;

  IF v_transfer.reservation_id IS NOT NULL THEN
    FOR v_reservation_line IN
      SELECT *
      FROM public.inventory_reservation_lines
      WHERE reservation_id = v_transfer.reservation_id
      FOR UPDATE
    LOOP
      v_remaining :=
        v_reservation_line.reserved_quantity
        - v_reservation_line.released_quantity
        - v_reservation_line.fulfilled_quantity;

      IF v_remaining > 0 THEN
        v_balance := public.inventory_get_or_create_balance_for_update(
          v_reservation_line.organization_id,
          v_reservation_line.branch_id,
          v_reservation_line.location_id,
          v_reservation_line.variant_id,
          null,
          v_reservation_line.lot_id,
          v_reservation_line.serial_id
        );

        UPDATE public.inventory_balances
        SET reserved_quantity = greatest(0, reserved_quantity - v_remaining)
        WHERE id = v_balance.id;

        UPDATE public.inventory_reservation_lines
        SET fulfilled_quantity = fulfilled_quantity + v_remaining
        WHERE id = v_reservation_line.id;
      END IF;
    END LOOP;

    UPDATE public.inventory_reservations
    SET status = 'fulfilled',
        updated_at = now()
    WHERE id = v_transfer.reservation_id;

    SELECT jsonb_agg(jsonb_build_object(
      'variant_id', variant_id,
      'source_location_id', source_location_id,
      'lot_id', lot_id,
      'serial_id', serial_id,
      'unit_id', unit_id,
      'quantity', quantity
    ))
    INTO v_issue_lines
    FROM public.inventory_branch_transfer_lines
    WHERE transfer_id = v_transfer.id;

    v_source_movement := public.inventory_create_draft_movement(
      v_transfer.organization_id,
      v_transfer.source_branch_id,
      'issue',
      v_issue_lines,
      null,
      null,
      'Cross-branch transfer ' || v_transfer.transfer_number,
      'branch_transfer',
      v_transfer.id::text,
      'branch-transfer-send-' || v_transfer.id::text,
      p_actor_user_id
    );

    v_source_movement := public.inventory_post_movement(
      (v_source_movement ->> 'movement_id')::uuid,
      p_actor_user_id
    );
    v_source_movement_id := (v_source_movement ->> 'movement_id')::uuid;
  ELSE
    v_source_movement_id := v_transfer.source_movement_id;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'variant_id', variant_id,
    'destination_location_id', p_destination_location_id,
    'lot_id', lot_id,
    'serial_id', serial_id,
    'unit_id', unit_id,
    'quantity', quantity
  ))
  INTO v_receipt_lines
  FROM public.inventory_branch_transfer_lines
  WHERE transfer_id = v_transfer.id;

  v_receipt_movement := public.inventory_create_draft_movement(
    v_transfer.organization_id,
    v_transfer.destination_branch_id,
    'receipt',
    v_receipt_lines,
    null,
    null,
    'Accepted branch transfer ' || v_transfer.transfer_number,
    'branch_transfer',
    v_transfer.id::text,
    'branch-transfer-accept-' || v_transfer.id::text,
    p_actor_user_id
  );

  v_receipt_movement := public.inventory_post_movement(
    (v_receipt_movement ->> 'movement_id')::uuid,
    p_actor_user_id
  );

  UPDATE public.inventory_branch_transfers
  SET status = 'accepted',
      source_movement_id = coalesce(v_source_movement_id, source_movement_id),
      destination_movement_id = (v_receipt_movement ->> 'movement_id')::uuid,
      accepted_by = p_actor_user_id,
      accepted_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'accepted',
    'reservation_id', v_transfer.reservation_id,
    'source_movement_id', coalesce(v_source_movement_id, v_transfer.source_movement_id),
    'destination_movement_id', v_receipt_movement ->> 'movement_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_decline_branch_transfer(
  p_transfer_id uuid,
  p_decline_reason text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
  v_settings public.inventory_settings%ROWTYPE;
  v_movement_id uuid;
  v_movement_number text;
  v_line record;
  v_line_number integer := 0;
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  SELECT * INTO v_transfer
  FROM public.inventory_branch_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch transfer not found';
  END IF;

  IF v_transfer.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Only in-transit branch transfers can be declined';
  END IF;

  IF NOT public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission for destination branch';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  IF v_transfer.reservation_id IS NOT NULL THEN
    PERFORM public.inventory_release_reservation(v_transfer.reservation_id, p_actor_user_id, true);
  ELSIF v_transfer.source_movement_id IS NOT NULL THEN
    SELECT * INTO v_settings
    FROM public.inventory_settings
    WHERE organization_id = v_transfer.organization_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory settings unavailable';
    END IF;

    SELECT id INTO v_movement_id
    FROM public.inventory_movement_headers
    WHERE organization_id = v_transfer.organization_id
      AND idempotency_key = 'branch-transfer-decline-' || v_transfer.id::text
    FOR UPDATE;

    IF v_movement_id IS NULL THEN
      v_movement_number :=
        v_settings.movement_number_prefix || '-' || lpad(v_settings.movement_number_next::text, 6, '0');

      UPDATE public.inventory_settings
      SET movement_number_next = movement_number_next + 1,
          updated_by = p_actor_user_id
      WHERE id = v_settings.id;

      INSERT INTO public.inventory_movement_headers (
        organization_id,
        branch_id,
        movement_number,
        movement_kind,
        status,
        note,
        reference_type,
        reference_id,
        idempotency_key,
        created_by,
        posted_by,
        posted_at
      )
      VALUES (
        v_transfer.organization_id,
        v_transfer.source_branch_id,
        v_movement_number,
        'receipt',
        'posted',
        'Declined branch transfer return ' || v_transfer.transfer_number,
        'branch_transfer_decline',
        v_transfer.id::text,
        'branch-transfer-decline-' || v_transfer.id::text,
        p_actor_user_id,
        p_actor_user_id,
        now()
      )
      RETURNING id INTO v_movement_id;

      FOR v_line IN
        SELECT *
        FROM public.inventory_branch_transfer_lines
        WHERE transfer_id = v_transfer.id
        ORDER BY created_at, id
      LOOP
        v_line_number := v_line_number + 1;

        INSERT INTO public.inventory_movement_lines (
          organization_id,
          branch_id,
          movement_id,
          line_number,
          variant_id,
          destination_location_id,
          unit_id,
          quantity,
          note
        )
        VALUES (
          v_transfer.organization_id,
          v_transfer.source_branch_id,
          v_movement_id,
          v_line_number,
          v_line.variant_id,
          v_line.source_location_id,
          v_line.unit_id,
          v_line.quantity,
          'Returned after destination branch declined transfer'
        );

        v_balance := public.inventory_get_or_create_balance_for_update(
          v_transfer.organization_id,
          v_transfer.source_branch_id,
          v_line.source_location_id,
          v_line.variant_id,
          v_movement_id
        );

        UPDATE public.inventory_balances
        SET on_hand_quantity = on_hand_quantity + v_line.quantity,
            last_movement_id = v_movement_id,
            last_movement_at = now()
        WHERE id = v_balance.id;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.inventory_branch_transfers
  SET status = 'declined',
      return_movement_id = v_movement_id,
      decline_reason = p_decline_reason,
      declined_by = p_actor_user_id,
      declined_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'declined',
    'reservation_id', v_transfer.reservation_id,
    'return_movement_id', v_movement_id
  );
END;
$$;
