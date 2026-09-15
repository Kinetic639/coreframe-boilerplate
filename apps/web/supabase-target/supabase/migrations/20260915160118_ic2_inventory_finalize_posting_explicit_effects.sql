-- IC-2 (Movement Reversal): `inventory_finalize_posting` gains ONE new,
-- optional, trailing parameter: `p_explicit_effects jsonb DEFAULT NULL`.
-- When NULL (the default -- every existing caller, unchanged), behavior is
-- byte-identical to before: effects come from `inventory_movement_type_
-- effects`, keyed by movement type. When NOT NULL (used only by
-- `inventory_reverse_movement`), effects for each line come from the
-- caller-supplied JSON instead, keyed per line_number as an array of
-- {id, target, balance_field, direction, effect_order, is_required}
-- objects -- everything else (locking, the IC-1 hard invariant, ledger
-- insert, audit log, document numbering) is the exact same, shared code
-- path. This is NOT a second posting engine -- it is the same one,
-- narrowly extended. The `id` field lets the ledger's own NOT NULL
-- `effect_id` FK (to `inventory_movement_type_effects`) correctly
-- reference the ORIGINAL effect a reversal's own compensating entry
-- undoes, since the new '900' reversal movement type deliberately carries
-- no effect rows of its own.
CREATE OR REPLACE FUNCTION public.inventory_finalize_posting(p_movement_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_explicit_effects jsonb DEFAULT NULL::jsonb)
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
    -- IC-2: when p_explicit_effects is supplied (reversal path only), use
    -- the caller-computed per-line inverse effects instead of the
    -- type-catalog lookup. Exactly one branch below is non-empty for any
    -- given call -- every existing caller passes NULL and is completely
    -- unaffected (byte-identical to pre-IC-2 behavior).
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

      -- IC-1 hard invariant -- unconditional; never gated by
      -- negative_stock_policy (product-owner FINAL decision, IC-1
      -- finalization pass: on_hand_quantity >= 0 ALWAYS, negative_stock_
      -- policy='allow'/'allow_with_approval' are superseded for on-hand
      -- behavior). This check applies identically whether this effect came
      -- from the type catalog or from an IC-2 explicit reversal effect --
      -- a reversal can NEVER bypass this invariant.
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
