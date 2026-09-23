-- IC-7 CRITICAL FIX -- inventory_save_draft carried the same class of gap
-- as inventory_cancel_movement (ZERO actor-identity check, ZERO
-- permission check, live anon EXECUTE, SECURITY DEFINER bypasses RLS) --
-- any unauthenticated caller could rewrite any DRAFT movement's own
-- counterparty/reference/note/lines in any organization. Fixed to match
-- the exact same standing convention (actor-identity 28000, then
-- permission 42501 surfaced as the SAME "not found or not accessible"
-- P0002 non-leakage message inventory_reverse_movement/inventory_cancel_
-- movement already use).
CREATE OR REPLACE FUNCTION public.inventory_save_draft(p_movement_id uuid, p_document_date date DEFAULT NULL::date, p_operation_date date DEFAULT NULL::date, p_counterparty_name text DEFAULT NULL::text, p_external_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_lines jsonb DEFAULT '[]'::jsonb, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_header RECORD;
  v_line RECORD;
  v_line_number integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SET LOCAL ambra.inventory_movement_engine = 'on';

  SELECT * INTO v_header FROM inventory_movement_headers
  WHERE id = p_movement_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Movement not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF v_header.status != 'draft' THEN
    RAISE EXCEPTION 'Can only edit draft movements (current status: %)', v_header.status;
  END IF;

  UPDATE inventory_movement_headers SET
    document_date = COALESCE(p_document_date, document_date),
    operation_date = COALESCE(p_operation_date, operation_date),
    counterparty_name = p_counterparty_name,
    external_reference = p_external_reference,
    note = p_note,
    updated_at = now()
  WHERE id = p_movement_id;

  UPDATE inventory_movement_lines SET deleted_at = now()
  WHERE movement_id = p_movement_id AND deleted_at IS NULL;

  IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines)
      AS x(variant_id uuid, unit_id uuid, quantity numeric,
           source_location_id uuid, destination_location_id uuid, note text)
    LOOP
      v_line_number := v_line_number + 1;

      IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
        RAISE EXCEPTION 'Line % quantity must be positive', v_line_number;
      END IF;

      INSERT INTO inventory_movement_lines (
        organization_id, branch_id, movement_id, line_number,
        variant_id, unit_id, quantity,
        source_location_id, destination_location_id, note
      ) VALUES (
        v_header.organization_id, v_header.branch_id, p_movement_id, v_line_number,
        v_line.variant_id, v_line.unit_id, v_line.quantity,
        v_line.source_location_id, v_line.destination_location_id, v_line.note
      );
    END LOOP;
  END IF;

  INSERT INTO inventory_movement_audit_log (
    organization_id, movement_id, action, old_status, new_status,
    entity_type, entity_id, actor_user_id, transaction_id
  ) VALUES (
    v_header.organization_id, p_movement_id, 'draft_updated', 'draft', 'draft',
    'header', p_movement_id, p_actor_user_id, txid_current()::text
  );

  RETURN jsonb_build_object('movement_id', p_movement_id, 'status', 'draft');
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_save_draft(uuid,date,date,text,text,text,jsonb,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_save_draft(uuid,date,date,text,text,text,jsonb,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_save_draft(uuid,date,date,text,text,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_save_draft(uuid,date,date,text,text,text,jsonb,uuid) TO service_role;

-- IC-7 -- inventory_reconcile_balances is a read-only diagnostic (no
-- writes at all) but carried live anon EXECUTE with zero actor/permission
-- check -- any unauthenticated caller could read ANY organization's
-- stock-vs-ledger drift diagnostic for ANY branch, a real cross-tenant
-- information-disclosure gap. Converted from LANGUAGE sql to LANGUAGE
-- plpgsql (pure sql functions cannot branch/raise) solely to add the
-- standard actor-identity + permission check; the underlying diagnostic
-- query itself is byte-for-byte unchanged.
CREATE OR REPLACE FUNCTION public.inventory_reconcile_balances(p_organization_id uuid, p_branch_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(location_id uuid, variant_id uuid, balance_on_hand numeric, ledger_on_hand numeric, drift numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.read') THEN
    RAISE EXCEPTION 'Not authorized to read inventory diagnostics for this branch' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    b.location_id,
    b.variant_id,
    b.on_hand_quantity AS balance_on_hand,
    COALESCE(l.net, 0) AS ledger_on_hand,
    b.on_hand_quantity - COALESCE(l.net, 0) AS drift
  FROM inventory_balances b
  LEFT JOIN (
    SELECT
      sle.location_id,
      sle.variant_id,
      SUM(CASE WHEN sle.direction = 'increase' THEN sle.quantity ELSE -sle.quantity END) AS net
    FROM inventory_stock_ledger_entries sle
    WHERE sle.organization_id = p_organization_id
      AND sle.branch_id = p_branch_id
      AND sle.balance_field = 'on_hand'
    GROUP BY sle.location_id, sle.variant_id
  ) l ON b.location_id = l.location_id AND b.variant_id = l.variant_id
  WHERE b.organization_id = p_organization_id
    AND b.branch_id = p_branch_id
    AND b.on_hand_quantity != COALESCE(l.net, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_reconcile_balances(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_reconcile_balances(uuid,uuid) FROM anon;
DROP FUNCTION public.inventory_reconcile_balances(uuid,uuid);

REVOKE ALL ON FUNCTION public.inventory_reconcile_balances(uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_reconcile_balances(uuid,uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_reconcile_balances(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_reconcile_balances(uuid,uuid,uuid) TO service_role;
