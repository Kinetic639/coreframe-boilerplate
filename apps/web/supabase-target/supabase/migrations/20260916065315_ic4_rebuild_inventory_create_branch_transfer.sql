CREATE OR REPLACE FUNCTION public.inventory_create_branch_transfer(
  p_organization_id uuid,
  p_source_branch_id uuid,
  p_destination_branch_id uuid,
  p_lines jsonb,
  p_notes text DEFAULT NULL::text,
  p_actor_user_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_transfer_id uuid;
  v_transfer_number text;
  v_line jsonb;
  v_reservation_lines jsonb;
  v_reservation jsonb;
  v_reservation_id uuid;
BEGIN
  -- IC-4: actor-identity check, added this pass -- this RPC previously
  -- accepted p_actor_user_id unchecked (spoofable), matching the exact
  -- class of gap IC-7A closed on the generic movement engine. Every
  -- rebuilt branch-transfer RPC gets the same IC-7A-grade check.
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF p_source_branch_id = p_destination_branch_id THEN
    RAISE EXCEPTION 'Cross-branch transfer requires different source and destination branches';
  END IF;

  IF NOT (
    public.has_branch_permission(p_organization_id, p_source_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(p_organization_id, p_source_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission for source branch' USING ERRCODE = '42501';
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

  -- IC-4: status is now 'prepared' (reserved, NOT yet physically shipped).
  -- sent_by/sent_at are no longer set here -- they belong to SEND.
  INSERT INTO public.inventory_branch_transfers (
    organization_id,
    transfer_number,
    source_branch_id,
    destination_branch_id,
    status,
    notes
  )
  VALUES (
    p_organization_id,
    v_transfer_number,
    p_source_branch_id,
    p_destination_branch_id,
    'prepared',
    p_notes
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
    'status', 'prepared',
    'reservation_id', v_reservation_id,
    'source_movement_id', null
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_create_branch_transfer(uuid, uuid, uuid, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_branch_transfer(uuid, uuid, uuid, jsonb, text, uuid) TO authenticated, service_role;
