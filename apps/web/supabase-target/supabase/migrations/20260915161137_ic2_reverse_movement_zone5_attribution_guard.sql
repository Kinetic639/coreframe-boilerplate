-- Live-proven finding (read-only Zone 5 compatibility check, per explicit
-- IC-2 scope): reversing a receive_repair_order_stock-created movement
-- caused inventory_stock_ledger_entries' own AFTER INSERT trigger
-- (repair_order_line_locations_ledger_sync ->
-- repair_order_location_attribution_sync()) to ACTIVELY CORRUPT
-- repair_order_line_locations -- it deleted then immediately re-inserted
-- the same quantity at the same location (since the reversal line's own
-- destination_location_id, copied from the original, equals the location
-- being zeroed out), leaving repair_order_line_locations claiming 10 units
-- physically present at a location where on_hand_quantity is now
-- genuinely 0. Live-reproduced before this fix.
--
-- Per explicit instruction, Zone 5 itself (the trigger, the table, any
-- Zone 5 RPC) is NOT modified. Instead, inventory_reverse_movement sets
-- the SAME `ambra.repair_order_attribution_authoritative` GUC that
-- receive_repair_order_stock/putaway_repair_order_stock already set around
-- their own ledger-producing calls -- an existing, established mechanism,
-- not new Zone 5 code. This makes the trigger take its own "authoritative
-- caller" branch, which does NOT attempt its own heuristic re-attribution
-- (avoiding the active corruption) but also does NOT itself update
-- repair_order_line_locations to reflect the reversal (since this RPC does
-- not write that table). The result is DISCLOSED, KNOWN STALENESS
-- (repair_order_line_locations may continue to show quantity at a location
-- IC-2 has reversed) rather than silent corruption -- staleness is an
-- explicit, already-planned IC-5 concern (architecture decision #7:
-- repair_order_line_locations must become a derived projection), not an
-- IC-2 one. IC-2 does not attempt to resolve it here.
CREATE OR REPLACE FUNCTION public.inventory_reverse_movement(
  p_movement_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_original RECORD;
  v_reason text;
  v_reversal_id uuid := gen_random_uuid();
  v_reversal_type_id uuid;
  v_line RECORD;
  v_line_number integer := 0;
  v_line_effects jsonb;
  v_orig_effect RECORD;
  v_inverse_direction text;
  v_explicit_effects jsonb := '{}'::jsonb;
  v_finalize_result jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  v_reason := NULLIF(TRIM(p_reason), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A non-blank reason is required to reverse a movement' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_original FROM inventory_movement_headers
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_original.organization_id, v_original.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Movement not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF v_original.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted movements can be reversed (status=%). Draft movements use cancellation, not reversal.', v_original.status
      USING ERRCODE = 'P0007';
  END IF;

  IF v_original.original_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'A reversal movement cannot itself be reversed' USING ERRCODE = 'P0005';
  END IF;

  IF v_original.reversal_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Movement has already been reversed (reversal_movement_id=%)', v_original.reversal_movement_id
      USING ERRCODE = 'P0006';
  END IF;

  SELECT id INTO v_reversal_type_id
  FROM inventory_movement_types
  WHERE organization_id = v_original.organization_id AND code = '900' AND deleted_at IS NULL;

  IF v_reversal_type_id IS NULL THEN
    RAISE EXCEPTION 'Reversal movement type not configured for this organization' USING ERRCODE = 'P0002';
  END IF;

  SET LOCAL ambra.inventory_movement_engine = 'on';
  -- See this migration's own header comment: prevents Zone 5's spatial-
  -- attribution trigger from actively corrupting repair_order_line_locations
  -- in response to this reversal's own compensating ledger entries.
  SET LOCAL ambra.repair_order_attribution_authoritative = 'on';

  INSERT INTO inventory_movement_headers (
    id, organization_id, branch_id, movement_type_id, movement_type_code,
    status, reference_type, reference_id, original_movement_id, created_by
  ) VALUES (
    v_reversal_id, v_original.organization_id, v_original.branch_id, v_reversal_type_id, '900',
    'draft', 'movement_reversal', v_original.id::text, v_original.id, p_actor_user_id
  );

  FOR v_line IN
    SELECT * FROM inventory_movement_lines
    WHERE movement_id = v_original.id AND deleted_at IS NULL
    ORDER BY line_number
  LOOP
    v_line_number := v_line_number + 1;

    INSERT INTO inventory_movement_lines (
      id, movement_id, organization_id, branch_id, line_number,
      variant_id, unit_id, quantity,
      source_location_id, destination_location_id,
      lot_id, serial_id, unit_cost, currency, note
    ) VALUES (
      gen_random_uuid(), v_reversal_id, v_original.organization_id, v_original.branch_id, v_line_number,
      v_line.variant_id, v_line.unit_id, v_line.quantity,
      v_line.source_location_id, v_line.destination_location_id,
      v_line.lot_id, v_line.serial_id, v_line.unit_cost, v_line.currency,
      'Reversal of ' || v_original.document_number || ' line ' || v_line.line_number
    );

    v_line_effects := '[]'::jsonb;
    FOR v_orig_effect IN
      SELECT * FROM inventory_movement_type_effects
      WHERE movement_type_id = v_original.movement_type_id
      ORDER BY effect_order
    LOOP
      v_inverse_direction := CASE v_orig_effect.direction
        WHEN 'increase' THEN 'decrease'
        WHEN 'decrease' THEN 'increase'
        ELSE v_orig_effect.direction
      END;
      v_line_effects := v_line_effects || jsonb_build_array(jsonb_build_object(
        'id', v_orig_effect.id,
        'target', v_orig_effect.target,
        'balance_field', v_orig_effect.balance_field,
        'direction', v_inverse_direction,
        'effect_order', v_orig_effect.effect_order,
        'is_required', v_orig_effect.is_required
      ));
    END LOOP;

    IF jsonb_array_length(v_line_effects) = 0 THEN
      RAISE EXCEPTION 'Original movement type has no effects to invert for line %', v_line.line_number USING ERRCODE = 'P0002';
    END IF;

    v_explicit_effects := v_explicit_effects || jsonb_build_object(v_line_number::text, v_line_effects);
  END LOOP;

  IF v_line_number = 0 THEN
    RAISE EXCEPTION 'Original movement has no lines to reverse' USING ERRCODE = 'P0002';
  END IF;

  v_finalize_result := public.inventory_finalize_posting(v_reversal_id, p_actor_user_id, v_explicit_effects);

  UPDATE inventory_movement_headers
  SET status = 'reversed',
      reversal_movement_id = v_reversal_id,
      reversed_by = p_actor_user_id,
      reversed_at = now(),
      updated_at = now()
  WHERE id = v_original.id;

  INSERT INTO inventory_movement_audit_log (
    organization_id, movement_id, action, old_status, new_status,
    entity_type, entity_id, actor_user_id, reason_text,
    changes, transaction_id
  ) VALUES (
    v_original.organization_id, v_original.id, 'reversed', 'posted', 'reversed',
    'header', v_original.id, p_actor_user_id, v_reason,
    jsonb_build_object('reversal_movement_id', v_reversal_id, 'reversal_document_number', v_finalize_result->>'document_number'),
    txid_current()::text
  );

  RETURN jsonb_build_object(
    'status', 'posted',
    'reversal_movement_id', v_reversal_id,
    'reversal_document_number', v_finalize_result->>'document_number',
    'original_movement_id', v_original.id,
    'original_document_number', v_original.document_number
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('28000', '22023', 'P0002', 'P0003', 'P0005', 'P0006', 'P0007') THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'Movement reversal failed unexpectedly' USING ERRCODE = 'P0001';
END;
$function$;
