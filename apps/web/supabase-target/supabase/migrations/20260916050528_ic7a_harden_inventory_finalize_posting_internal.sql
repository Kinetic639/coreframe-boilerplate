-- ============================================================================
-- IC-7A EMERGENCY SECURITY PASS: harden inventory_finalize_posting_internal
-- ============================================================================
-- Same P0 as the companion inventory_create_draft migration: the public
-- 2-arg inventory_finalize_posting(uuid,uuid) -- a thin pass-through to
-- this internal function (IC-2's own frozen contract) -- performed ZERO
-- actor-identity/permission check, and this internal function is the
-- SINGLE shared choke point both the public wrapper AND inventory_
-- reverse_movement call into. Hardening here, once, correctly protects
-- both callers without duplicating the check in two places.
--
-- CALLER-GRAPH-DRIVEN DESIGN: same reasoning as inventory_create_draft --
-- real Next.js server actions (finalizePostingAction, quickReceiptAction,
-- quickBinMoveAction, createAndPostMovementAction) call the public 2-arg
-- inventory_finalize_posting DIRECTLY as `authenticated`, and inventory_
-- approve_count_session (NOT itself SECURITY DEFINER) calls it as the
-- real, non-elevated invoking role too. `authenticated` EXECUTE on the
-- PUBLIC wrapper is therefore kept. This internal function's own EXECUTE
-- was already revoked from every ordinary role in IC-2 (verified
-- unchanged below) -- it is reachable ONLY via the public wrapper or via
-- inventory_reverse_movement, both same-owner SECURITY DEFINER calls.
--
-- SAFE FOR THE REVERSAL PATH (verified by reading inventory_reverse_
-- movement's own body, unchanged): it already validates p_actor_user_id
-- = auth.uid() and has_branch_permission(..., 'warehouse.inventory.
-- operate') against the ORIGINAL movement's own org/branch BEFORE ever
-- calling this internal function, and it passes that SAME actor_user_id
-- through unchanged. The reversal movement it creates always shares the
-- ORIGINAL's own organization_id/branch_id (INSERT ... VALUES (...,
-- v_original.organization_id, v_original.branch_id, ...)), so the new
-- checks added here -- re-validated against the movement actually being
-- finalized -- pass trivially for this caller (redundant, not harmful).
--
-- Permission check placement: performed immediately after the header row
-- lock/not-found check (org/branch must be read from the row first) and
-- BEFORE the "already posted" short-circuit -- an unauthorized caller
-- must not be able to learn a movement's existence/status before being
-- rejected, matching the established P0002-style existence-non-leak
-- convention already used by inventory_reverse_movement.

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

  -- IC-7A: actor-identity + permission check, added this pass. Runs
  -- BEFORE any status-based branching so an unauthorized caller cannot
  -- distinguish "posted"/"draft"/"not found" from a permission denial.
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Not authorized to post inventory movements for this branch' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.inventory_finalize_posting(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_finalize_posting(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_finalize_posting(uuid, uuid) TO authenticated, service_role;
