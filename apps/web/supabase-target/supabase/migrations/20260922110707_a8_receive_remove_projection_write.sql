-- INVENTORY CORE A8 -- REPAIR ORDER PROJECTION SIMPLIFICATION (3 of 7)
--
-- receive_repair_order_stock: removes the direct repair_order_line_
-- locations INSERT ... ON CONFLICT DO UPDATE write (its sole purpose was
-- maintaining the now-removed incremental projection) and the now-
-- pointless set_config('ambra.repair_order_attribution_authoritative', ...)
-- call (its only reader, the projection trigger, is removed later in this
-- migration set). attach_repair_order_line_movement's own canonical link
-- write is now the sole persisted attribution effect of a receipt.
--
-- Physical movement path (inventory_receive_stock call), provenance
-- resolution, actor/permission checks, and all receiving semantics are
-- otherwise byte-identical to the pre-A8 body.

CREATE OR REPLACE FUNCTION public.receive_repair_order_stock(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_lines jsonb, p_operation_date date DEFAULT NULL::date, p_document_date date DEFAULT NULL::date, p_external_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving_location_id uuid;
  v_engine_lines           jsonb := '[]'::jsonb;
  v_line                    jsonb;
  v_line_index              integer := 0;
  v_source_line_id          uuid;
  v_resolved_rol_id         uuid;
  v_resolved_ro_id          uuid;
  v_resolved_variant_id     uuid;
  v_candidate_count         integer;
  v_attribution             jsonb := '[]'::jsonb;  -- parallel array: repair_order_line_id or null, per input line order
  v_engine_result           jsonb;
  v_movement_id             uuid;
  v_engine_line             jsonb;
  v_movement_line_id        uuid;
  v_i                       integer;
  v_qty                     numeric;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Not authorized to receive stock for this branch' USING ERRCODE = '42501';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  v_receiving_location_id := public.resolve_branch_receiving_location(p_organization_id, p_branch_id);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_index := v_line_index + 1;
    v_source_line_id := NULLIF(v_line->>'source_line_id', '')::uuid;
    v_resolved_rol_id := NULL;
    v_resolved_ro_id := NULL;
    v_resolved_variant_id := NULL;

    IF v_source_line_id IS NOT NULL THEN
      SELECT count(*), min(rol.id::text)::uuid, min(rol.repair_order_id::text)::uuid, min(rol.variant_id::text)::uuid
        INTO v_candidate_count, v_resolved_rol_id, v_resolved_ro_id, v_resolved_variant_id
      FROM public.workshop_source_document_lines wsdl
      JOIN public.repair_order_line_source_links rols ON rols.workshop_source_document_line_id = wsdl.id
      JOIN public.repair_order_lines rol ON rol.id = rols.repair_order_line_id
      WHERE wsdl.wdd_matcher_line_id = v_source_line_id;

      IF v_candidate_count = 0 THEN
        RAISE EXCEPTION 'source_line_id % (line %) did not resolve to any RepairOrderLine -- broken provenance must never be silently received as unattributed', v_source_line_id, v_line_index
          USING ERRCODE = 'P0002';
      ELSIF v_candidate_count > 1 THEN
        RAISE EXCEPTION 'source_line_id % (line %) resolved ambiguously to % RepairOrderLine candidates -- ambiguous provenance must never be silently resolved by picking one', v_source_line_id, v_line_index, v_candidate_count
          USING ERRCODE = '55000';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.repair_orders ro
        WHERE ro.id = v_resolved_ro_id
          AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id
      ) THEN
        RAISE EXCEPTION 'Resolved RepairOrder for line % does not belong to the target organization/branch', v_line_index USING ERRCODE = '42501';
      END IF;

      IF v_resolved_variant_id IS NOT NULL AND v_resolved_variant_id IS DISTINCT FROM (v_line->>'variant_id')::uuid THEN
        RAISE EXCEPTION 'Resolved RepairOrderLine variant for line % does not match the received variant', v_line_index USING ERRCODE = '22023';
      END IF;
    END IF;

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_line->>'variant_id',
      'unit_id', v_line->>'unit_id',
      'quantity', (v_line->>'quantity')::numeric,
      'destination_location_id', v_receiving_location_id,
      'note', v_line->>'note'
    ));
    v_attribution := v_attribution || jsonb_build_array(v_resolved_rol_id);
  END LOOP;

  v_engine_result := public.inventory_receive_stock(
    p_actor_user_id, p_organization_id, p_branch_id, v_engine_lines,
    p_operation_date, p_document_date, p_external_reference, p_note, p_idempotency_key
  );

  v_movement_id := (v_engine_result->>'movement_id')::uuid;

  FOR v_i IN 1..coalesce(jsonb_array_length(v_engine_result->'lines'), 0)
  LOOP
    v_resolved_rol_id := NULLIF(v_attribution->>(v_i - 1), 'null')::uuid;
    CONTINUE WHEN v_resolved_rol_id IS NULL;

    v_engine_line := (v_engine_result->'lines')->(v_i - 1);
    v_movement_line_id := (v_engine_line->>'movement_line_id')::uuid;
    v_qty := (v_engine_line->>'quantity')::numeric;

    -- A8: the incremental repair_order_line_locations write (formerly
    -- here) has been removed -- attach_repair_order_line_movement's own
    -- canonical link write is now the sole persisted attribution effect
    -- of a receipt; physical location state is computed live on read.
    PERFORM public.attach_repair_order_line_movement(
      p_actor_user_id, v_resolved_rol_id, v_movement_line_id, v_qty, 'receipt'
    );
  END LOOP;

  RETURN v_engine_result || jsonb_build_object('receiving_location_id', v_receiving_location_id);
END;
$function$;
