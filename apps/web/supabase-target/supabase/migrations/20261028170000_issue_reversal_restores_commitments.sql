-- ============================================================================
-- Storno of an RW 261 for a repair order puts the parts back under the order
-- ============================================================================
-- repair_order_issue_parts uses up a reservation (fulfilled_quantity) or an
-- allocation in a container (allocation fulfilled_quantity, container line
-- removed) and writes an 'issued' event per line. Reversing the RW only gave
-- the on_hand back: the parts came back as free stock, the repair order
-- showed "brak" and the ZW line lost its W.
--
-- Now, after the reversal is posted, every 'issued' event of the RW is
-- undone where it was taken from:
-- * an allocation: fulfilled_quantity back, balance allocated back, and the
--   container line back in the same container (when that container is
--   still active / empty at the same location) -> event 'allocated';
-- * a reservation: fulfilled_quantity back, balance reserved back -> event
--   'created'.
-- Both events carry the KOR document and the reason. The ZW line status
-- (internal_order_line_status) follows from the same lines. The repair
-- order's own "issued" counts only posted RW documents, so it drops back.
-- RW documents already reversed without this get the same treatment once.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_restore_issue_commitments_internal(
  p_original_id uuid,
  p_reversal_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_doc text;
  v_rev_doc text;
  v_ev record;
  v_alloc record;
  v_allocated numeric;
  v_alloc_fulfilled numeric;
  v_direct numeric;
  v_res_take numeric;
  v_left numeric;
  v_take numeric;
  v_balance public.inventory_balances%ROWTYPE;
  v_container_id uuid;
  v_cline uuid;
  v_reason text;
  v_n integer := 0;
BEGIN
  SELECT document_number INTO v_doc FROM public.inventory_movement_headers WHERE id = p_original_id;
  SELECT document_number INTO v_rev_doc FROM public.inventory_movement_headers WHERE id = p_reversal_id;
  v_reason := 'Storno ' || COALESCE(v_doc, '') || ' (' || COALESCE(v_rev_doc, '') || ')'
    || COALESCE(': ' || NULLIF(trim(p_reason), ''), '');

  FOR v_ev IN
    SELECT e.reservation_line_id, e.quantity, ml.organization_id, ml.branch_id,
           ml.source_location_id AS location_id, ml.variant_id, ml.unit_id, ml.lot_id, ml.serial_id,
           ml.container_id, rev.id AS reversal_line_id, rl.reservation_id
    FROM public.inventory_reservation_events e
    JOIN public.inventory_movement_lines ml ON ml.id = e.movement_line_id
    JOIN public.inventory_movement_lines rev
      ON rev.movement_id = p_reversal_id AND rev.line_number = ml.line_number
    JOIN public.inventory_reservation_lines rl ON rl.id = e.reservation_line_id
    WHERE e.movement_id = p_original_id AND e.event_type = 'issued'
    ORDER BY ml.line_number, e.created_at
  LOOP
    PERFORM 1 FROM public.inventory_reservation_lines WHERE id = v_ev.reservation_line_id FOR UPDATE;

    SELECT COALESCE(SUM(al.allocated_quantity), 0),
           COALESCE(SUM(al.fulfilled_quantity) FILTER (WHERE al.location_id = v_ev.location_id), 0)
      INTO v_allocated, v_alloc_fulfilled
    FROM public.inventory_allocation_lines al
    WHERE al.reservation_line_id = v_ev.reservation_line_id;

    -- What the reservation line fulfilled itself (issued straight from it),
    -- as opposed to what it handed over to allocations.
    SELECT GREATEST(0, rl.fulfilled_quantity - v_allocated) INTO v_direct
    FROM public.inventory_reservation_lines rl WHERE rl.id = v_ev.reservation_line_id;

    -- A line issued from a container came from an allocation; otherwise
    -- from the reservation, and from an allocation only for what the
    -- reservation cannot have given.
    IF v_ev.container_id IS NOT NULL THEN
      v_res_take := LEAST(v_direct, GREATEST(0, v_ev.quantity - v_alloc_fulfilled));
    ELSE
      v_res_take := LEAST(v_direct, v_ev.quantity);
    END IF;
    v_left := v_ev.quantity - v_res_take;

    v_balance := public.inventory_get_or_create_balance_for_update(
      v_ev.organization_id, v_ev.branch_id, v_ev.location_id, v_ev.variant_id, NULL,
      v_ev.lot_id, v_ev.serial_id);

    IF v_left > 0 THEN
      SELECT c.id INTO v_container_id
      FROM public.inventory_containers c
      WHERE c.id = v_ev.container_id AND c.deleted_at IS NULL
        AND c.status IN ('active', 'empty')
        AND c.current_location_id IS NOT DISTINCT FROM v_ev.location_id;

      FOR v_alloc IN
        SELECT al.id, al.fulfilled_quantity
        FROM public.inventory_allocation_lines al
        WHERE al.reservation_line_id = v_ev.reservation_line_id
          AND al.location_id = v_ev.location_id AND al.fulfilled_quantity > 0
        ORDER BY al.created_at DESC
        FOR UPDATE
      LOOP
        EXIT WHEN v_left <= 0;
        v_take := LEAST(v_left, v_alloc.fulfilled_quantity);

        UPDATE public.inventory_allocation_lines
        SET fulfilled_quantity = fulfilled_quantity - v_take
        WHERE id = v_alloc.id;
        UPDATE public.inventory_balances
        SET allocated_quantity = allocated_quantity + v_take
        WHERE id = v_balance.id;

        IF v_container_id IS NOT NULL THEN
          UPDATE public.inventory_containers
          SET status = 'active', updated_at = now(), updated_by = p_actor_user_id
          WHERE id = v_container_id AND status = 'empty';
          INSERT INTO public.inventory_container_lines (
            organization_id, branch_id, container_id, variant_id, unit_id, lot_id, serial_id, quantity)
          VALUES (v_ev.organization_id, v_ev.branch_id, v_container_id, v_ev.variant_id, v_ev.unit_id,
                  v_ev.lot_id, v_ev.serial_id, v_take)
          RETURNING id INTO v_cline;
          INSERT INTO public.inventory_allocation_container_links (
            organization_id, branch_id, allocation_line_id, container_line_id, quantity, created_by)
          VALUES (v_ev.organization_id, v_ev.branch_id, v_alloc.id, v_cline, v_take, p_actor_user_id);
        END IF;

        PERFORM public.inventory_reservation_log_internal(
          v_ev.reservation_line_id, 'allocated', v_take, v_ev.location_id, NULL,
          p_reversal_id, v_ev.reversal_line_id, v_reason, p_actor_user_id, NULL);
        v_left := v_left - v_take;
      END LOOP;

      -- Nothing left in an allocation to take back: the rest goes back to
      -- the reservation, as far as the reservation fulfilled it.
      v_res_take := v_res_take + LEAST(v_left, GREATEST(0, v_direct - v_res_take));
    END IF;

    IF v_res_take > 0 THEN
      UPDATE public.inventory_reservation_lines
      SET fulfilled_quantity = fulfilled_quantity - v_res_take
      WHERE id = v_ev.reservation_line_id;
      UPDATE public.inventory_balances
      SET reserved_quantity = reserved_quantity + v_res_take
      WHERE id = v_balance.id;
      PERFORM public.inventory_reservation_log_internal(
        v_ev.reservation_line_id, 'created', v_res_take, v_ev.location_id, NULL,
        p_reversal_id, v_ev.reversal_line_id, v_reason, p_actor_user_id, NULL);
    END IF;

    UPDATE public.inventory_reservations SET status = 'active'
    WHERE id = v_ev.reservation_id AND status = 'fulfilled';
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_restore_issue_commitments_internal(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- The reversal restores them right after it is posted (on_hand is back by
-- then, so the reserved / allocated quantities fit).
DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.inventory_reverse_movement(uuid,uuid,text)'::regprocedure);
  IF position('inventory_restore_issue_commitments_internal' IN v_def) > 0 THEN
    RETURN;
  END IF;
  v_new := replace(v_def,
    $a$  v_finalize_result := public.inventory_finalize_posting_internal(v_reversal_id, p_actor_user_id, v_explicit_effects);
$a$,
    $b$  v_finalize_result := public.inventory_finalize_posting_internal(v_reversal_id, p_actor_user_id, v_explicit_effects);

  IF v_original.movement_type_code = '261' THEN
    PERFORM public.inventory_restore_issue_commitments_internal(
      v_original.id, v_reversal_id, p_actor_user_id, v_reason);
  END IF;
$b$);
  IF v_new = v_def THEN
    RAISE EXCEPTION 'reverse patch did not apply';
  END IF;
  EXECUTE v_new;
END
$do$;

-- RW documents reversed before this: restore once (only those whose KOR
-- has no reservation event yet).
DO $do$
DECLARE
  v_h record;
BEGIN
  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);
  FOR v_h IN
    SELECT o.id AS original_id, o.reversal_movement_id, rv.created_by, a.reason_text
    FROM public.inventory_movement_headers o
    JOIN public.inventory_movement_headers rv ON rv.id = o.reversal_movement_id
    LEFT JOIN LATERAL (
      SELECT l.reason_text FROM public.inventory_movement_audit_log l
      WHERE l.movement_id = o.id AND l.action = 'reversed'
      ORDER BY l.created_at DESC LIMIT 1
    ) a ON true
    WHERE o.movement_type_code = '261' AND o.status = 'reversed'
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_reservation_events e WHERE e.movement_id = o.reversal_movement_id)
    ORDER BY rv.created_at
  LOOP
    PERFORM public.inventory_restore_issue_commitments_internal(
      v_h.original_id, v_h.reversal_movement_id, v_h.created_by, v_h.reason_text);
  END LOOP;
END
$do$;
