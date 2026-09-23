ALTER TABLE public.inventory_branch_transfers
  DROP CONSTRAINT IF EXISTS inventory_branch_transfers_cancelled_by_fkey;
ALTER TABLE public.inventory_branch_transfers
  ADD CONSTRAINT inventory_branch_transfers_cancelled_by_fkey
    FOREIGN KEY (cancelled_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.inventory_cancel_branch_transfer(
  p_transfer_id uuid,
  p_actor_user_id uuid,
  p_reason text DEFAULT NULL::text
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
    public.has_branch_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  -- IC-4: cancel is the SOURCE's own pre-shipment decision (distinct from
  -- decline, which is the destination's). Pre-shipment only, same as
  -- decline -- once shipped there is no automatic undo here either.
  IF v_transfer.status <> 'prepared' THEN
    RAISE EXCEPTION 'Only prepared (pre-shipment) transfers can be cancelled (status=%)', v_transfer.status
      USING ERRCODE = 'P0007';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  IF v_transfer.reservation_id IS NOT NULL THEN
    PERFORM public.inventory_release_reservation(v_transfer.reservation_id, p_actor_user_id, true);
  END IF;

  UPDATE public.inventory_branch_transfers
  SET status = 'cancelled',
      cancel_reason = p_reason,
      cancelled_by = p_actor_user_id,
      cancelled_at = now(),
      updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'cancelled',
    'reservation_id', v_transfer.reservation_id
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('28000', 'P0002', 'P0007') THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'Branch transfer cancel failed unexpectedly: %', SQLERRM USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_cancel_branch_transfer(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_cancel_branch_transfer(uuid, uuid, text) TO authenticated, service_role;
