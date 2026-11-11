-- ============================================================================
-- IC-3: RECEIVING CONSOLIDATION — canonical physical receiving primitive
-- ============================================================================
-- Live-verified before writing this: `receive_repair_order_stock` (working,
-- zero TS/UI callers today) posts through `inventory_create_and_finalize`
-- correctly. `inventory_receive_purchase_order` (also zero TS/UI callers,
-- confirmed via repo-wide grep) is DEAD/BROKEN -- it calls `inventory_
-- create_draft_movement`/`inventory_post_movement`, neither of which EXISTS
-- in this database (confirmed via pg_proc) -- so it fails 42883 on every
-- real invocation today. Neither wrapper's refactor carries any live-data
-- migration risk (0 rows in inventory_purchase_orders; both audit-confirmed
-- to have zero UI callers).
--
-- SEPARATE, PRE-EXISTING, SEVERE finding recorded for IC-7 (NOT fixed here,
-- per explicit IC-3 scope): `inventory_create_and_finalize`, `inventory_
-- create_draft`, and the public `inventory_finalize_posting` all carry live
-- `anon` EXECUTE and perform ZERO actor-identity or permission check of
-- their own. Live-proven via a safe, transaction-scoped, rolled-back probe:
-- a fully unauthenticated `anon` role (no JWT claims, no auth.uid(), no
-- session) can call `inventory_create_and_finalize` directly and post a
-- real, immutable movement to ANY organization/branch it can name a UUID
-- for. This is a full authentication bypass -- strictly worse than the IC-2
-- explicit-effects P0, which at minimum required a valid authenticated
-- session. This primitive does NOT fix that gap (it is pre-existing,
-- predates IC-1, and fixing it would mean auditing every legitimate current
-- caller of these three functions -- an IC-7-sized undertaking). What THIS
-- migration does do, per explicit instruction ("any NEW function created by
-- IC-3 must be correctly secured now"): give this new primitive its OWN
-- actor-identity + permission checks BEFORE it ever calls down into the
-- unguarded engine layer, exactly matching the established pattern already
-- proven in `receive_repair_order_stock`/`inventory_reverse_movement`.
--
-- DESIGN: domain-agnostic. Knows nothing about RepairOrders, Matcher
-- provenance, or Purchase Orders. Accepts pre-resolved per-line destination
-- locations (the underlying engine's own `inventory_movement_lines` shape)
-- rather than a single top-level destination, because the two real wrappers
-- resolve destination differently (RepairOrder: one branch receiving
-- location for every line; PO: per-line override falling back to the PO's
-- own delivery location) -- that resolution POLICY belongs in the wrapper,
-- per the brief's own §13. Delegates ALL physical effects through the
-- existing `inventory_create_and_finalize` -> `inventory_finalize_posting`
-- (public, catalog-effects-only, frozen IC-2 contract) path -- no direct
-- balance/ledger writes, no second posting engine, movement type is the
-- existing canonical 101 receipt (live-confirmed single destination-
-- increase effect, catalog-only, no explicit-effects involvement at all).
--
-- LOT/SERIAL: `inventory_movement_lines`/`inventory_balances` carry lot_id/
-- serial_id columns, but `inventory_create_draft`'s own `jsonb_to_recordset`
-- extraction does not read them from `p_lines`, and `inventory_finalize_
-- posting_internal` hardcodes NULL::uuid for both when resolving the
-- balance row (`inventory_get_or_create_balance_for_update(..., NULL::uuid,
-- NULL::uuid)`) regardless of what a movement line carries. This is a
-- pre-existing "v1: on_hand only, lot/serial-blind" engine limitation
-- (already self-documented as v1 elsewhere in this engine) -- NOT something
-- this primitive invents partial support for. `p_lines` therefore
-- deliberately omits lot_id/serial_id/currency (any caller-supplied value
-- would be silently dropped by the lower layer regardless), matching what
-- the engine actually does today, honestly.
--
-- REFERENCE METADATA: `inventory_movement_headers.reference_type`/
-- `reference_id` are NOT threaded through by this primitive. Neither real
-- wrapper's current behavior sets them on a receiving movement (`receive_
-- repair_order_stock` never has; the broken PO function's intended contract
-- for them is unverifiable, since the functions it called never existed).
-- Deliberately deferred rather than invented -- can be added later via a
-- narrow, additive extension if a genuine need arises.
--
-- IDEMPOTENCY: `inventory_movement_headers_org_idempotency_uidx` (a partial
-- UNIQUE index on (organization_id, idempotency_key) WHERE idempotency_key
-- IS NOT NULL, pre-existing) already makes double-posting impossible even
-- under genuine concurrent retries with the same key -- but `inventory_
-- create_draft` does not catch the resulting `23505`, so the LOSING
-- concurrent caller would otherwise see a raw, unhandled constraint
-- violation. This primitive catches exactly that (identified via `GET
-- STACKED DIAGNOSTICS ... CONSTRAINT_NAME`, not fragile message-text
-- matching) and returns the WINNING caller's now-committed, already-posted
-- movement gracefully instead -- a genuine idempotency behavior, not merely
-- a sequential-retry short-circuit.

CREATE OR REPLACE FUNCTION public.inventory_receive_stock(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_lines jsonb,
  p_operation_date date DEFAULT NULL::date,
  p_document_date date DEFAULT NULL::date,
  p_external_reference text DEFAULT NULL::text,
  p_note text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_engine_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_line_index integer := 0;
  v_engine_result jsonb;
  v_movement_id uuid;
  v_existing_header_id uuid;
  v_lines_out jsonb;
  v_constraint text;
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

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_index := v_line_index + 1;

    IF NULLIF(v_line->>'destination_location_id', '') IS NULL THEN
      RAISE EXCEPTION 'Line %: destination_location_id is required for a physical receipt', v_line_index USING ERRCODE = '22023';
    END IF;

    IF NULLIF(v_line->>'quantity', '') IS NULL OR (v_line->>'quantity')::numeric <= 0 THEN
      RAISE EXCEPTION 'Line %: quantity must be positive', v_line_index USING ERRCODE = '22023';
    END IF;

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_line->>'variant_id',
      'unit_id', v_line->>'unit_id',
      'quantity', (v_line->>'quantity')::numeric,
      'source_location_id', NULL,
      'destination_location_id', v_line->>'destination_location_id',
      'unit_cost', v_line->>'unit_cost',
      'note', v_line->>'note'
    ));
  END LOOP;

  BEGIN
    v_engine_result := public.inventory_create_and_finalize(
      p_organization_id, p_branch_id, '101', v_engine_lines,
      p_operation_date, p_document_date, NULL, p_external_reference, p_note,
      p_idempotency_key, p_actor_user_id
    );
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'inventory_movement_headers_org_idempotency_uidx' THEN
      RAISE;
    END IF;

    SELECT id INTO v_existing_header_id
    FROM public.inventory_movement_headers
    WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key;

    IF v_existing_header_id IS NULL THEN
      RAISE;
    END IF;

    v_engine_result := public.inventory_finalize_posting(v_existing_header_id, p_actor_user_id);
  END;

  v_movement_id := (v_engine_result->>'movement_id')::uuid;

  SELECT jsonb_agg(jsonb_build_object(
    'line_number', line_number,
    'movement_line_id', id,
    'variant_id', variant_id,
    'quantity', quantity,
    'destination_location_id', destination_location_id
  ) ORDER BY line_number)
  INTO v_lines_out
  FROM public.inventory_movement_lines
  WHERE movement_id = v_movement_id AND deleted_at IS NULL;

  RETURN v_engine_result || jsonb_build_object('lines', v_lines_out);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_receive_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_receive_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_receive_stock(uuid, uuid, uuid, jsonb, date, date, text, text, text) TO authenticated, service_role;
