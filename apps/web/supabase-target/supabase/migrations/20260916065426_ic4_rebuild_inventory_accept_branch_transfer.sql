CREATE OR REPLACE FUNCTION public.inventory_accept_branch_transfer(
  p_transfer_id uuid,
  p_destination_location_id uuid,
  p_actor_user_id uuid DEFAULT NULL::uuid,
  p_line_acceptances jsonb DEFAULT NULL::jsonb
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
  v_accepted numeric(18, 6);
  v_accept_entry jsonb;
  v_total_accepted numeric(18, 6) := 0;
  v_total_sent numeric(18, 6) := 0;
  v_final_status text;
  v_finalize_result jsonb;
  v_existing_discrepancy_count integer;
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
    public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent no-op on retry: the row lock above already serializes a
  -- genuine concurrent double-accept (the second caller blocks until the
  -- first commits, then observes the already-final status here).
  IF v_transfer.status IN ('accepted', 'partially_accepted') THEN
    RETURN jsonb_build_object(
      'transfer_id', v_transfer.id,
      'transfer_number', v_transfer.transfer_number,
      'status', v_transfer.status,
      'destination_movement_id', v_transfer.destination_movement_id,
      'already_processed', true
    );
  END IF;

  IF v_transfer.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Only in-transit transfers can be accepted (status=%)', v_transfer.status USING ERRCODE = 'P0007';
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

  SELECT id INTO v_type_id
  FROM public.inventory_movement_types
  WHERE organization_id = v_transfer.organization_id AND code = '312' AND deleted_at IS NULL;

  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Transfer-receipt movement type not configured for this organization' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  UPDATE public.inventory_branch_transfer_lines
  SET destination_location_id = p_destination_location_id
  WHERE transfer_id = v_transfer.id;

  v_header_id := gen_random_uuid();

  INSERT INTO public.inventory_movement_headers (
    id, organization_id, branch_id, movement_type_id, movement_type_code,
    status, reference_type, reference_id, idempotency_key, created_by
  ) VALUES (
    v_header_id, v_transfer.organization_id, v_transfer.destination_branch_id, v_type_id, '312',
    'draft', 'branch_transfer', v_transfer.id::text,
    'branch-transfer-accept-' || v_transfer.id::text, p_actor_user_id
  );

  FOR v_line IN
    SELECT * FROM public.inventory_branch_transfer_lines
    WHERE transfer_id = v_transfer.id
    ORDER BY created_at, id
  LOOP
    -- Per-line accepted quantity: explicit from p_line_acceptances (keyed
    -- by transfer_line_id) when provided, else defaults to the full sent
    -- quantity (ordinary full-accept case). Matched by the line's own
    -- primary key, never by SKU/variant, per this project's established
    -- ordinal/id-based correlation contract.
    v_accept_entry := NULL;
    IF p_line_acceptances IS NOT NULL THEN
      SELECT e INTO v_accept_entry
      FROM jsonb_array_elements(p_line_acceptances) e
      WHERE (e ->> 'transfer_line_id')::uuid = v_line.id;
    END IF;

    IF v_accept_entry IS NOT NULL THEN
      v_accepted := (v_accept_entry ->> 'accepted_quantity')::numeric;
    ELSE
      v_accepted := v_line.sent_quantity;
    END IF;

    IF v_accepted IS NULL OR v_accepted < 0 THEN
      RAISE EXCEPTION 'Accepted quantity must be zero or positive for line %', v_line.id USING ERRCODE = '22023';
    END IF;
    IF v_accepted > v_line.sent_quantity THEN
      RAISE EXCEPTION 'Accepted quantity (%) cannot exceed sent quantity (%) for line %',
        v_accepted, v_line.sent_quantity, v_line.id USING ERRCODE = '22023';
    END IF;

    UPDATE public.inventory_branch_transfer_lines
    SET accepted_quantity = v_accepted
    WHERE id = v_line.id;

    v_total_sent := v_total_sent + v_line.sent_quantity;
    v_total_accepted := v_total_accepted + v_accepted;

    IF v_accepted > 0 THEN
      v_line_number := v_line_number + 1;
      INSERT INTO public.inventory_movement_lines (
        movement_id, organization_id, branch_id, line_number,
        variant_id, unit_id, quantity, destination_location_id,
        lot_id, serial_id, note
      ) VALUES (
        v_header_id, v_transfer.organization_id, v_transfer.destination_branch_id, v_line_number,
        v_line.variant_id, v_line.unit_id, v_accepted, p_destination_location_id,
        v_line.lot_id, v_line.serial_id,
        'Received from source branch (transfer ' || v_transfer.transfer_number || ')'
      );
    END IF;

    IF v_line.sent_quantity - v_accepted > 0 THEN
      SELECT count(*) INTO v_existing_discrepancy_count
      FROM public.inventory_branch_transfer_discrepancies
      WHERE transfer_line_id = v_line.id;

      IF v_existing_discrepancy_count = 0 THEN
        INSERT INTO public.inventory_branch_transfer_discrepancies (
          organization_id, transfer_id, transfer_line_id, variant_id,
          sent_quantity, accepted_quantity, missing_quantity,
          destination_movement_id, created_by
        ) VALUES (
          v_transfer.organization_id, v_transfer.id, v_line.id, v_line.variant_id,
          v_line.sent_quantity, v_accepted, v_line.sent_quantity - v_accepted,
          v_header_id, p_actor_user_id
        );
      END IF;
    END IF;
  END LOOP;

  IF v_line_number > 0 THEN
    v_finalize_result := public.inventory_finalize_posting_internal(v_header_id, p_actor_user_id, NULL);
  ELSE
    -- Nothing accepted at all (100% missing) -- no movement to post;
    -- destination_movement_id stays NULL, header row is left as an
    -- unposted draft carrying zero lines (harmless, never posted).
    v_header_id := NULL;
  END IF;

  v_final_status := CASE WHEN v_total_accepted >= v_total_sent THEN 'accepted' ELSE 'partially_accepted' END;

  UPDATE public.inventory_branch_transfers
  SET status = v_final_status,
      destination_movement_id = v_header_id,
      accepted_by = p_actor_user_id,
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', v_final_status,
    'destination_movement_id', v_header_id,
    'destination_document_number', COALESCE(v_finalize_result ->> 'document_number', NULL),
    'total_sent', v_total_sent,
    'total_accepted', v_total_accepted
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('28000', '22023', 'P0002', 'P0003', 'P0007') THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'Branch transfer accept failed unexpectedly: %', SQLERRM USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_accept_branch_transfer(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_accept_branch_transfer(uuid, uuid, uuid, jsonb) TO authenticated, service_role;
