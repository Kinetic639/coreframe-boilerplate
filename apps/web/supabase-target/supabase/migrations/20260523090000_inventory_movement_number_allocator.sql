-- Keep generated movement numbers ahead of existing movement headers.
-- This prevents duplicate movement_number failures when counters drift behind data.

CREATE OR REPLACE FUNCTION public.inventory_allocate_movement_number(
  p_organization_id uuid,
  p_actor_user_id uuid default null
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_existing_next bigint;
  v_next bigint;
  v_movement_number text;
BEGIN
  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory settings unavailable';
  END IF;

  SELECT coalesce(
    max(substring(h.movement_number from length(v_settings.movement_number_prefix) + 2)::bigint),
    0
  ) + 1
  INTO v_existing_next
  FROM public.inventory_movement_headers h
  WHERE h.organization_id = p_organization_id
    AND h.movement_number LIKE v_settings.movement_number_prefix || '-%'
    AND substring(h.movement_number from length(v_settings.movement_number_prefix) + 2) ~ '^[0-9]+$';

  v_next := greatest(v_settings.movement_number_next, v_existing_next);
  v_movement_number := v_settings.movement_number_prefix || '-' || lpad(v_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET movement_number_next = v_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  RETURN v_movement_number;
END;
$$;

UPDATE public.inventory_settings s
SET movement_number_next = greatest(
      s.movement_number_next,
      coalesce(next_numbers.next_value, 1)
    )
FROM (
  SELECT
    s_inner.id,
    coalesce(
      max(
        substring(h.movement_number from length(s_inner.movement_number_prefix) + 2)::bigint
      ),
      0
    ) + 1 AS next_value
  FROM public.inventory_settings s_inner
  LEFT JOIN public.inventory_movement_headers h
    ON h.organization_id = s_inner.organization_id
   AND h.movement_number LIKE s_inner.movement_number_prefix || '-%'
   AND substring(h.movement_number from length(s_inner.movement_number_prefix) + 2) ~ '^[0-9]+$'
  WHERE s_inner.deleted_at IS NULL
  GROUP BY s_inner.id
) next_numbers
WHERE next_numbers.id = s.id
  AND s.deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.inventory_accept_branch_transfer(
  p_transfer_id uuid,
  p_destination_location_id uuid,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
  v_reservation_line public.inventory_reservation_lines%ROWTYPE;
  v_remaining numeric(18, 6);
  v_balance public.inventory_balances%ROWTYPE;
  v_line record;
  v_line_number integer := 0;
  v_movement_number text;
  v_source_movement_id uuid;
  v_destination_movement_id uuid;
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

    SELECT id INTO v_source_movement_id
    FROM public.inventory_movement_headers
    WHERE organization_id = v_transfer.organization_id
      AND idempotency_key = 'branch-transfer-send-' || v_transfer.id::text
    FOR UPDATE;

    IF v_source_movement_id IS NULL THEN
      v_movement_number := public.inventory_allocate_movement_number(
        v_transfer.organization_id,
        p_actor_user_id
      );

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
        'issue',
        'posted',
        'Cross-branch transfer ' || v_transfer.transfer_number,
        'branch_transfer',
        v_transfer.id::text,
        'branch-transfer-send-' || v_transfer.id::text,
        p_actor_user_id,
        p_actor_user_id,
        now()
      )
      RETURNING id INTO v_source_movement_id;

      v_line_number := 0;
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
          source_location_id,
          lot_id,
          serial_id,
          unit_id,
          quantity,
          note
        )
        VALUES (
          v_transfer.organization_id,
          v_transfer.source_branch_id,
          v_source_movement_id,
          v_line_number,
          v_line.variant_id,
          v_line.source_location_id,
          v_line.lot_id,
          v_line.serial_id,
          v_line.unit_id,
          v_line.quantity,
          'Sent to destination branch'
        );

        v_balance := public.inventory_get_or_create_balance_for_update(
          v_transfer.organization_id,
          v_transfer.source_branch_id,
          v_line.source_location_id,
          v_line.variant_id,
          v_source_movement_id,
          v_line.lot_id,
          v_line.serial_id
        );

        IF v_balance.on_hand_quantity < v_line.quantity THEN
          RAISE EXCEPTION 'Insufficient source stock to complete branch transfer';
        END IF;

        UPDATE public.inventory_balances
        SET on_hand_quantity = on_hand_quantity - v_line.quantity,
            last_movement_id = v_source_movement_id,
            last_movement_at = now()
        WHERE id = v_balance.id;
      END LOOP;
    END IF;
  ELSE
    v_source_movement_id := v_transfer.source_movement_id;
  END IF;

  SELECT id INTO v_destination_movement_id
  FROM public.inventory_movement_headers
  WHERE organization_id = v_transfer.organization_id
    AND idempotency_key = 'branch-transfer-accept-' || v_transfer.id::text
  FOR UPDATE;

  IF v_destination_movement_id IS NULL THEN
    v_movement_number := public.inventory_allocate_movement_number(
      v_transfer.organization_id,
      p_actor_user_id
    );

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
      v_transfer.destination_branch_id,
      v_movement_number,
      'receipt',
      'posted',
      'Accepted branch transfer ' || v_transfer.transfer_number,
      'branch_transfer',
      v_transfer.id::text,
      'branch-transfer-accept-' || v_transfer.id::text,
      p_actor_user_id,
      p_actor_user_id,
      now()
    )
    RETURNING id INTO v_destination_movement_id;

    v_line_number := 0;
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
        lot_id,
        serial_id,
        unit_id,
        quantity,
        note
      )
      VALUES (
        v_transfer.organization_id,
        v_transfer.destination_branch_id,
        v_destination_movement_id,
        v_line_number,
        v_line.variant_id,
        p_destination_location_id,
        v_line.lot_id,
        v_line.serial_id,
        v_line.unit_id,
        v_line.quantity,
        'Received from source branch'
      );

      v_balance := public.inventory_get_or_create_balance_for_update(
        v_transfer.organization_id,
        v_transfer.destination_branch_id,
        p_destination_location_id,
        v_line.variant_id,
        v_destination_movement_id,
        v_line.lot_id,
        v_line.serial_id
      );

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity + v_line.quantity,
          last_movement_id = v_destination_movement_id,
          last_movement_at = now()
      WHERE id = v_balance.id;
    END LOOP;
  END IF;

  UPDATE public.inventory_branch_transfers
  SET status = 'accepted',
      source_movement_id = coalesce(v_source_movement_id, source_movement_id),
      destination_movement_id = v_destination_movement_id,
      accepted_by = p_actor_user_id,
      accepted_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'accepted',
    'reservation_id', v_transfer.reservation_id,
    'source_movement_id', coalesce(v_source_movement_id, v_transfer.source_movement_id),
    'destination_movement_id', v_destination_movement_id
  );
END;
$$;
