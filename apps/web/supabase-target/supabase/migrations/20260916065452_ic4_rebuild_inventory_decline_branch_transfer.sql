CREATE OR REPLACE FUNCTION public.inventory_decline_branch_transfer(
  p_transfer_id uuid,
  p_decline_reason text DEFAULT NULL::text,
  p_actor_user_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_transfer
  FROM public.inventory_branch_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  -- IC-4: decline is PRE-SHIPMENT ONLY. Once goods have physically left
  -- the source branch (source_movement_id set / status='in_transit' or
  -- later), there is no ordinary "decline" that magically restores stock
  -- -- a genuine post-shipment discrepancy is represented by partial
  -- accept, never by an automatic reverse/return movement here.
  IF v_transfer.status <> 'prepared' THEN
    RAISE EXCEPTION 'Only prepared (pre-shipment) transfers can be declined (status=%). Once shipped, use partial acceptance to record any discrepancy.', v_transfer.status
      USING ERRCODE = 'P0007';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  IF v_transfer.reservation_id IS NOT NULL THEN
    PERFORM public.inventory_release_reservation(v_transfer.reservation_id, p_actor_user_id, true);
  END IF;

  UPDATE public.inventory_branch_transfers
  SET status = 'declined',
      decline_reason = p_decline_reason,
      declined_by = p_actor_user_id,
      declined_at = now(),
      updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'declined',
    'reservation_id', v_transfer.reservation_id
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('28000', 'P0002', 'P0007') THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'Branch transfer decline failed unexpectedly: %', SQLERRM USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_decline_branch_transfer(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_decline_branch_transfer(uuid, text, uuid) TO authenticated, service_role;
