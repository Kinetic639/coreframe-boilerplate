-- IC-7 CRITICAL FIX -- inventory_cancel_movement carried ZERO actor-identity
-- check and ZERO permission check, plus live anon EXECUTE, despite being
-- SECURITY DEFINER (bypasses RLS entirely). This meant ANY caller --
-- including a fully unauthenticated anon session -- could cancel ANY DRAFT
-- movement belonging to ANY organization/branch, just by supplying a
-- movement UUID. Reproduced live and confirmed before this fix (see
-- ic-7-review/security-evidence.md). Fixed to match the exact standing
-- convention every other canonical RPC uses (actor-identity 28000, then
-- permission 42501 -- surfaced as the SAME "not found or not accessible"
-- P0002 message as inventory_reverse_movement's own established
-- non-leakage pattern, so a caller cannot distinguish "movement exists in
-- another org, you lack permission" from "movement does not exist").
CREATE OR REPLACE FUNCTION public.inventory_cancel_movement(p_movement_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_header RECORD;
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

  IF v_header.status = 'cancelled' THEN
    RETURN jsonb_build_object('movement_id', v_header.id, 'status', 'cancelled');
  END IF;

  IF v_header.status != 'draft' THEN
    RAISE EXCEPTION 'Cannot cancel movement with status "%"', v_header.status;
  END IF;

  UPDATE inventory_movement_headers SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_actor_user_id,
    updated_at = now()
  WHERE id = p_movement_id;

  INSERT INTO inventory_movement_audit_log (
    organization_id, movement_id, action, old_status, new_status,
    entity_type, entity_id, actor_user_id,
    reason_text, transaction_id
  ) VALUES (
    v_header.organization_id, p_movement_id, 'cancelled', 'draft', 'cancelled',
    'header', p_movement_id, p_actor_user_id,
    p_reason, txid_current()::text
  );

  RETURN jsonb_build_object('movement_id', p_movement_id, 'status', 'cancelled');
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_cancel_movement(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_cancel_movement(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_cancel_movement(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_cancel_movement(uuid, uuid, text) TO service_role;
