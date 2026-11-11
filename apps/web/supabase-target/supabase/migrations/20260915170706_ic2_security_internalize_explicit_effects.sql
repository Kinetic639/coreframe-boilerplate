-- ============================================================================
-- IC-2 SECURITY-BOUNDARY CORRECTION (P0, external review)
-- ============================================================================
-- CONFIRMED LIVE, before any code change: `inventory_finalize_posting(uuid,
-- uuid, jsonb)` had zero caller-identity or permission checks (no auth.uid()
-- verification, no has_branch_permission call, p_actor_user_id used only to
-- stamp the audit log) and `anon` held live EXECUTE on it (a pre-existing
-- default-privilege behavior, unrelated to IC-2). A safe, transaction-scoped
-- attack probe (ROLLBACK, no real data touched) proved an ordinary
-- `authenticated` caller could call the function DIRECTLY on an existing,
-- legitimately-created draft 101 receipt (quantity=10) with a crafted
-- `p_explicit_effects` payload supplying TWO real effect ids (borrowed from
-- two different movement types' own catalog rows) instead of 101's own
-- single catalog effect -- the movement posted with on_hand=20 (double the
-- drafted quantity), fully bypassing the type-catalog's own effect
-- definition. This is a genuine, live-confirmed P0.
--
-- FIX: split the function. `inventory_finalize_posting(uuid, uuid)` is
-- restored as the PUBLIC/CANONICAL 2-argument contract (catalog-defined
-- effects only, no explicit-effects capability at all). The actual
-- implementation moves to `inventory_finalize_posting_internal(uuid, uuid,
-- jsonb)`, which has ALL EXECUTE revoked from PUBLIC/anon/authenticated/
-- service_role -- it is reachable ONLY via a direct function call from
-- another SECURITY DEFINER function owned by `postgres` (privilege checks
-- for calls made from inside a SECURITY DEFINER function's body are
-- performed as the function's OWNER, not the original invoking role --
-- standard, well-established Postgres semantics, not a workaround).
-- `inventory_reverse_movement` (already SECURITY DEFINER, owner postgres)
-- is updated to call the internal function directly.
--
-- DEFENSE IN DEPTH inside the internal function (narrow, does not create a
-- second reversal engine): when p_explicit_effects is supplied, the
-- movement's own REAL type_code (read from the row itself, never trusted
-- from the caller) must be exactly '900' (the system reversal type) --
-- categorically prevents the exact attack proven above (which targeted a
-- '101' movement) even if some future internal caller misused the
-- parameter. Each supplied effect's own `target`/`direction` is validated
-- against its exact allowed domain ({source,destination} /
-- {increase,decrease}) and rejected explicitly rather than silently
-- defaulting via the pre-existing CASE/IF fallthrough.
--
-- The broader, pre-existing default-privilege/EXECUTE-audit problem
-- (anon on inventory_finalize_posting(uuid,uuid) itself, and on other
-- Inventory Core functions generally) remains IC-7's own scope -- NOT
-- solved here. What IS closed here, unconditionally, is the NEW
-- explicit-effects capability IC-2 itself introduced.

CREATE OR REPLACE FUNCTION public.inventory_finalize_posting_internal(p_movement_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_explicit_effects jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_header RECORD;
  v_mvt_type RECORD;
  v_settings RECORD;
  v_seq RECORD;
  v_doc_number text;
  v_line RECORD;
  v_effect RECORD;
  v_location_id uuid;
  v_balance inventory_balances%ROWTYPE;
  v_current_qty numeric;
  v_new_qty numeric;
  v_now timestamptz := now();
  v_year integer := extract(year from v_now)::integer;
BEGIN
  SET LOCAL ambra.inventory_movement_engine = 'on';

  SELECT * INTO v_header FROM inventory_movement_headers
  WHERE id = p_movement_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found';
  END IF;

  -- Defense in depth: explicit effects may ONLY ever apply to the system
  -- reversal type. The movement's own real type_code is read from the
  -- locked row itself, never trusted from any caller-supplied value.
  IF p_explicit_effects IS NOT NULL AND v_header.movement_type_code <> '900' THEN
    RAISE EXCEPTION 'Explicit effects are only permitted for system reversal movements (type 900)' USING ERRCODE = '42501';
  END IF;

  IF v_header.status = 'posted' THEN
    RETURN jsonb_build_object(
      'movement_id', v_header.id,
      'document_number', v_header.document_number,
      'status', 'posted'
    );
  END IF;

  IF v_header.status != 'draft' THEN
    RAISE EXCEPTION 'Cannot post movement with status "%"', v_header.status;
  END IF;

  SELECT mt.*, dt.code AS doc_type_code, dt.numbering_template, dt.id AS dt_id
  INTO v_mvt_type
  FROM inventory_movement_types mt
  JOIN inventory_document_types dt ON dt.id = mt.document_type_id
  WHERE mt.id = v_header.movement_type_id;

  SELECT * INTO v_settings FROM inventory_settings
  WHERE organization_id = v_header.organization_id FOR UPDATE;

  INSERT INTO inventory_document_sequences (organization_id, document_type_id, year)
  VALUES (v_header.organization_id, v_mvt_type.dt_id, v_year)
  ON CONFLICT DO NOTHING;

  SELECT * INTO v_seq FROM inventory_document_sequences
  WHERE organization_id = v_header.organization_id
    AND document_type_id = v_mvt_type.dt_id
    AND branch_id IS NULL
    AND series IS NULL
    AND year = v_year
  FOR UPDATE;

  v_doc_number := v_mvt_type.doc_type_code || '/' || v_year::text || '/' || lpad(v_seq.next_number::text, 6, '0');

  UPDATE inventory_document_sequences
  SET next_number = next_number + 1
  WHERE id = v_seq.id;

  -- Freeze line snapshots using subqueries instead of JOIN on target table
  UPDATE inventory_movement_lines SET
    snapshot_product_name = (
      SELECT p.name FROM inventory_variants v
      JOIN inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
      WHERE v.id = inventory_movement_lines.variant_id AND v.organization_id = inventory_movement_lines.organization_id
    ),
    snapshot_sku = (
      SELECT v.sku FROM inventory_variants v
      WHERE v.id = inventory_movement_lines.variant_id AND v.organization_id = inventory_movement_lines.organization_id
    ),
    snapshot_unit_code = (
      SELECT u.code FROM inventory_units u
      WHERE u.id = inventory_movement_lines.unit_id AND u.organization_id = inventory_movement_lines.organization_id
    ),
    snapshot_source_location_name = (
      SELECT wl.name FROM warehouse_locations wl
      WHERE wl.id = inventory_movement_lines.source_location_id
    ),
    snapshot_destination_location_name = (
      SELECT wl.name FROM warehouse_locations wl
      WHERE wl.id = inventory_movement_lines.destination_location_id
    )
  WHERE movement_id = p_movement_id AND deleted_at IS NULL;

  -- Apply effects per line
  FOR v_line IN
    SELECT * FROM inventory_movement_lines
    WHERE movement_id = p_movement_id AND deleted_at IS NULL
    ORDER BY line_number
  LOOP
    FOR v_effect IN
      SELECT id, target, balance_field, direction, effect_order, is_required
      FROM inventory_movement_type_effects
      WHERE movement_type_id = v_header.movement_type_id AND p_explicit_effects IS NULL
      UNION ALL
      SELECT
        (e->>'id')::uuid,
        (e->>'target')::text,
        (e->>'balance_field')::text,
        (e->>'direction')::text,
        (e->>'effect_order')::integer,
        COALESCE((e->>'is_required')::boolean, true)
      FROM jsonb_array_elements(COALESCE(p_explicit_effects -> v_line.line_number::text, '[]'::jsonb)) e
      WHERE p_explicit_effects IS NOT NULL
      ORDER BY effect_order
    LOOP
      -- Defense in depth: reject any effect whose target/direction is not
      -- exactly one of the supported domain values, rather than silently
      -- defaulting via the fallthrough branches below.
      IF v_effect.target NOT IN ('source', 'destination') THEN
        RAISE EXCEPTION 'Invalid effect target "%" for line %', v_effect.target, v_line.line_number;
      END IF;
      IF v_effect.direction NOT IN ('increase', 'decrease') THEN
        RAISE EXCEPTION 'Invalid effect direction "%" for line %', v_effect.direction, v_line.line_number;
      END IF;

      IF v_effect.target = 'source' THEN
        v_location_id := v_line.source_location_id;
      ELSE
        v_location_id := v_line.destination_location_id;
      END IF;

      IF v_location_id IS NULL AND v_effect.is_required THEN
        RAISE EXCEPTION 'Line %: % location required for effect but is NULL',
          v_line.line_number, v_effect.target;
      END IF;

      IF v_location_id IS NULL THEN
        CONTINUE;
      END IF;

      v_balance := inventory_get_or_create_balance_for_update(
        v_header.organization_id, v_header.branch_id, v_location_id, v_line.variant_id, p_movement_id,
        NULL::uuid, NULL::uuid
      );

      IF v_effect.balance_field = 'on_hand' THEN
        v_current_qty := v_balance.on_hand_quantity;
      ELSE
        RAISE EXCEPTION 'v1 only supports on_hand balance field, got %', v_effect.balance_field;
      END IF;

      IF v_effect.direction = 'increase' THEN
        v_new_qty := v_current_qty + v_line.quantity;
      ELSE
        v_new_qty := v_current_qty - v_line.quantity;
      END IF;

      IF v_effect.balance_field = 'on_hand' AND v_effect.direction = 'decrease' THEN
        IF v_new_qty < (v_balance.reserved_quantity + v_balance.allocated_quantity) THEN
          RAISE EXCEPTION 'Movement would strand committed stock: variant % has % reserved + % allocated = % committed at this location, but only % would remain on hand (line %)',
            v_line.variant_id, v_balance.reserved_quantity, v_balance.allocated_quantity,
            (v_balance.reserved_quantity + v_balance.allocated_quantity), v_new_qty, v_line.line_number
            USING ERRCODE = 'P0003';
        END IF;
      END IF;

      IF v_new_qty < 0 AND v_settings.negative_stock_policy = 'block' THEN
        RAISE EXCEPTION 'Insufficient stock: % has % on hand, need % for line %',
          v_line.variant_id, v_current_qty, v_line.quantity, v_line.line_number;
      END IF;

      UPDATE inventory_balances
      SET on_hand_quantity = v_new_qty,
          last_movement_id = p_movement_id,
          last_movement_at = v_now,
          updated_at = v_now
      WHERE id = v_balance.id;

      INSERT INTO inventory_stock_ledger_entries (
        organization_id, branch_id, location_id, variant_id,
        movement_id, movement_line_id, movement_type_code,
        document_number, document_type_code,
        effect_id, balance_field, direction,
        quantity, balance_after,
        unit_cost, currency, posted_at
      ) VALUES (
        v_header.organization_id, v_header.branch_id, v_location_id, v_line.variant_id,
        p_movement_id, v_line.id, v_header.movement_type_code,
        v_doc_number, v_mvt_type.doc_type_code,
        v_effect.id, v_effect.balance_field, v_effect.direction,
        v_line.quantity, v_new_qty,
        v_line.unit_cost, v_line.currency, v_now
      );
    END LOOP;
  END LOOP;

  UPDATE inventory_movement_headers SET
    status = 'posted',
    document_number = v_doc_number,
    document_type_code = v_mvt_type.doc_type_code,
    posted_at = v_now,
    posted_by = p_actor_user_id,
    updated_at = v_now
  WHERE id = p_movement_id;

  INSERT INTO inventory_movement_audit_log (
    organization_id, movement_id, action, old_status, new_status,
    entity_type, entity_id, actor_user_id,
    changes, transaction_id
  ) VALUES (
    v_header.organization_id, p_movement_id, 'posted', 'draft', 'posted',
    'header', p_movement_id, p_actor_user_id,
    jsonb_build_object('document_number', v_doc_number),
    txid_current()::text
  );

  RETURN jsonb_build_object(
    'movement_id', p_movement_id,
    'document_number', v_doc_number,
    'status', 'posted'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_finalize_posting_internal(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_finalize_posting_internal(uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.inventory_finalize_posting_internal(uuid, uuid, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.inventory_finalize_posting_internal(uuid, uuid, jsonb) FROM service_role;

CREATE OR REPLACE FUNCTION public.inventory_finalize_posting(p_movement_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.inventory_finalize_posting_internal(p_movement_id, p_actor_user_id, NULL::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_finalize_posting(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_finalize_posting(uuid, uuid) TO anon, authenticated, service_role;

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

  v_finalize_result := public.inventory_finalize_posting_internal(v_reversal_id, p_actor_user_id, v_explicit_effects);

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

REVOKE ALL ON FUNCTION public.inventory_reverse_movement(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_reverse_movement(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_reverse_movement(uuid, uuid, text) TO authenticated, service_role;
