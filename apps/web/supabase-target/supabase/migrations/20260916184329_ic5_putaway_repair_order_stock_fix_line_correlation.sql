-- IC-5 self-caught correction, before any pgTAP ran: the prior migration
-- correlated each putaway line to its own posted movement_line via a
-- field-value match (source/destination/variant/quantity), which is
-- unsafe -- two DIFFERENT RepairOrderLines putting away the SAME
-- quantity of the SAME variant to the SAME shelf in one call would
-- collide (LIMIT 1 arbitrarily picks one for both). Fixed to use this
-- project's own established ordinal-correlation contract instead:
-- inventory_movement_lines are fetched ONCE, ordered by line_number, and
-- indexed by the input array's own position -- never by field value,
-- never by SKU.
CREATE OR REPLACE FUNCTION public.putaway_repair_order_stock(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_lines jsonb, p_destination_location_id uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving_location_id uuid;
  v_line                   jsonb;
  v_line_index             integer := 0;
  v_rol_id                 uuid;
  v_ro_id                  uuid;
  v_line_variant_id        uuid;
  v_qty                    numeric;
  v_available_qty          numeric;
  v_engine_lines           jsonb := '[]'::jsonb;
  v_engine_result          jsonb;
  v_movement_id            uuid;
  v_movement_line_ids      uuid[];
  v_movement_line_id       uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Not authorized to putaway stock for this branch' USING ERRCODE = '42501';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;
  IF p_destination_location_id IS NULL THEN
    RAISE EXCEPTION 'A destination location is required' USING ERRCODE = '22023';
  END IF;

  v_receiving_location_id := public.resolve_branch_receiving_location(p_organization_id, p_branch_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id AND organization_id = p_organization_id
      AND branch_id = p_branch_id AND deleted_at IS NULL AND can_store_inventory = true
  ) THEN
    RAISE EXCEPTION 'Destination location % is not a valid stockable location for this branch', p_destination_location_id USING ERRCODE = '22023';
  END IF;
  IF p_destination_location_id = v_receiving_location_id THEN
    RAISE EXCEPTION 'Destination cannot be the receiving location itself' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_index := v_line_index + 1;
    v_rol_id := (v_line->>'repair_order_line_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_line_variant_id := (v_line->>'variant_id')::uuid;

    IF v_rol_id IS NULL THEN
      RAISE EXCEPTION 'Line % is missing repair_order_line_id -- putaway always names an exact line, never inferred' , v_line_index USING ERRCODE = '22023';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line % quantity must be positive', v_line_index USING ERRCODE = '22023';
    END IF;

    SELECT rol.repair_order_id INTO v_ro_id
    FROM public.repair_order_lines rol
    JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
    WHERE rol.id = v_rol_id AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id;

    IF v_ro_id IS NULL THEN
      RAISE EXCEPTION 'repair_order_line_id % (line %) does not belong to this organization/branch', v_rol_id, v_line_index USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.repair_order_lines WHERE id = v_rol_id AND variant_id IS NOT NULL AND variant_id IS DISTINCT FROM v_line_variant_id
    ) THEN
      RAISE EXCEPTION 'Line % variant does not match the RepairOrderLine''s own variant', v_line_index USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.repair_order_location_attribution_uncertain
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND location_id = v_receiving_location_id AND variant_id = v_line_variant_id
    ) THEN
      RAISE EXCEPTION 'Line %: the receiving location''s attribution for this variant is UNKNOWN (a prior generic movement made it ambiguous) -- putaway is not permitted until it is reconciled', v_line_index
        USING ERRCODE = '55000';
    END IF;

    SELECT quantity INTO v_available_qty
    FROM public.repair_order_line_locations
    WHERE repair_order_line_id = v_rol_id AND location_id = v_receiving_location_id;

    IF v_available_qty IS NULL OR v_available_qty < v_qty THEN
      RAISE EXCEPTION 'Line % requests % but only % is currently attributed to this RepairOrderLine at the receiving location', v_line_index, v_qty, coalesce(v_available_qty, 0) USING ERRCODE = '22023';
    END IF;

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_line_variant_id,
      'unit_id', v_line->>'unit_id',
      'quantity', v_qty,
      'source_location_id', v_receiving_location_id,
      'destination_location_id', p_destination_location_id,
      'note', NULL
    ));
  END LOOP;

  PERFORM set_config('ambra.repair_order_attribution_authoritative', 'on', true);

  v_engine_result := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '801', v_engine_lines,
    NULL, NULL, NULL, NULL, NULL, p_idempotency_key, p_actor_user_id
  );
  v_movement_id := (v_engine_result->>'movement_id')::uuid;

  -- Ordinal correlation, established project-wide contract: fetch every
  -- posted line for this movement ONCE, ordered by line_number, and
  -- index into it by input-array position -- never by field value.
  SELECT array_agg(id ORDER BY line_number) INTO v_movement_line_ids
  FROM public.inventory_movement_lines
  WHERE movement_id = v_movement_id;

  v_line_index := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_index := v_line_index + 1;
    v_rol_id := (v_line->>'repair_order_line_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_line_variant_id := (v_line->>'variant_id')::uuid;
    v_movement_line_id := v_movement_line_ids[v_line_index];
    SELECT repair_order_id INTO v_ro_id FROM public.repair_order_lines WHERE id = v_rol_id;

    IF EXISTS (
      SELECT 1 FROM public.repair_order_location_attribution_uncertain
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND location_id = v_receiving_location_id AND variant_id = v_line_variant_id
      FOR UPDATE
    ) THEN
      RAISE EXCEPTION 'Line %: the receiving location''s attribution for this variant is UNKNOWN (a prior generic movement made it ambiguous) -- putaway is not permitted until it is reconciled', v_line_index
        USING ERRCODE = '55000';
    END IF;

    SELECT quantity INTO v_available_qty
    FROM public.repair_order_line_locations
    WHERE repair_order_line_id = v_rol_id AND location_id = v_receiving_location_id
    FOR UPDATE;

    IF v_available_qty IS NULL OR v_available_qty < v_qty THEN
      RAISE EXCEPTION 'Line % requests % but only % is currently attributed to this RepairOrderLine at the receiving location', v_line_index, v_qty, coalesce(v_available_qty, 0) USING ERRCODE = '22023';
    END IF;

    UPDATE public.repair_order_line_locations
      SET quantity = quantity - v_qty
      WHERE repair_order_line_id = v_rol_id AND location_id = v_receiving_location_id;

    INSERT INTO public.repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES (p_organization_id, p_branch_id, v_ro_id, v_rol_id, v_line_variant_id, p_destination_location_id, v_qty)
    ON CONFLICT (repair_order_line_id, location_id)
    DO UPDATE SET quantity = public.repair_order_line_locations.quantity + EXCLUDED.quantity;

    IF v_movement_line_id IS NOT NULL THEN
      INSERT INTO public.repair_order_line_movement_links
        (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
      VALUES (v_rol_id, v_movement_line_id, v_qty, 'relocation')
      ON CONFLICT (repair_order_line_id, inventory_movement_line_id, relation_type) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_engine_result || jsonb_build_object('source_location_id', v_receiving_location_id, 'destination_location_id', p_destination_location_id);
END;
$function$;
