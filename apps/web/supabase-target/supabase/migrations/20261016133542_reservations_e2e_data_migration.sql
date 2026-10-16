-- ============================================================================
-- Reservations & blocks, stage E2/E3 part E: data (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- 1. Existing repair-order reservations (all already in containers) get
--    their history: 'created' and 'allocated', marked as migrated.
-- 2. Parts lying in a receiving zone with a receipt link to a repair-order
--    line ("attributed" by the old model) become real reservations there:
--    a REZ document per line, the PZ line as source, a 'created' event.
--    Quantity = what the old receiving list showed for that line, capped by
--    what is available at the location.
-- ============================================================================

-- 1. History for existing reservations.
INSERT INTO public.inventory_reservation_events (
  organization_id, branch_id, reservation_id, reservation_line_id, event_type, quantity,
  location_id, repair_order_line_id, reason, actor_user_id, created_at)
SELECT rl.organization_id, rl.branch_id, rl.reservation_id, rl.id, 'created', rl.reserved_quantity,
       rl.location_id, rl.repair_order_line_id,
       'Migracja: rezerwacja ' || r.reservation_number || ' sprzed 16.10.2026', r.created_by, rl.created_at
FROM public.inventory_reservation_lines rl
JOIN public.inventory_reservations r ON r.id = rl.reservation_id
WHERE r.reference_type = 'repair_order_line' AND rl.reserved_quantity > 0
  AND NOT EXISTS (SELECT 1 FROM public.inventory_reservation_events e WHERE e.reservation_line_id = rl.id);

INSERT INTO public.inventory_reservation_events (
  organization_id, branch_id, reservation_id, reservation_line_id, event_type, quantity,
  location_id, repair_order_line_id, reason, actor_user_id, created_at)
SELECT rl.organization_id, rl.branch_id, rl.reservation_id, rl.id, 'allocated', a.qty,
       rl.location_id, rl.repair_order_line_id,
       'Migracja: ' || a.numbers, r.created_by, a.first_at
FROM public.inventory_reservation_lines rl
JOIN public.inventory_reservations r ON r.id = rl.reservation_id
JOIN (
  SELECT al.reservation_line_id, SUM(al.allocated_quantity) AS qty,
         string_agg(DISTINCT ia.allocation_number, ', ') AS numbers, min(al.created_at) AS first_at
  FROM public.inventory_allocation_lines al
  JOIN public.inventory_allocations ia ON ia.id = al.allocation_id
  WHERE al.reservation_line_id IS NOT NULL
  GROUP BY al.reservation_line_id
) a ON a.reservation_line_id = rl.id
WHERE r.reference_type = 'repair_order_line' AND a.qty > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_reservation_events e
    WHERE e.reservation_line_id = rl.id AND e.event_type = 'allocated');

-- 2. Receiving-zone "attributions" become reservations.
DO $migration$
DECLARE
  v_row record;
  v_qty numeric;
  v_available numeric;
  v_res_id uuid;
  v_number text;
BEGIN
  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_row IN
    WITH prz AS (
      SELECT id, organization_id, branch_id
      FROM public.warehouse_locations
      WHERE purpose = 'receiving' AND deleted_at IS NULL AND can_store_inventory = true
    ),
    attributed AS (
      SELECT prz.id AS location_id, prz.organization_id, prz.branch_id,
             sle.variant_id, rolml.repair_order_line_id,
             SUM(CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
                 * sle.quantity * (rolml.applied_quantity / iml.quantity)) AS qty
      FROM public.repair_order_line_movement_links rolml
      JOIN public.inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
      JOIN public.inventory_movement_headers h ON h.id = iml.movement_id
      JOIN LATERAL (
        SELECT iml.id AS ml_id
        UNION ALL
        SELECT rev.id FROM public.inventory_movement_lines rev
        WHERE h.reversal_movement_id IS NOT NULL
          AND rev.movement_id = h.reversal_movement_id AND rev.line_number = iml.line_number
      ) c ON true
      JOIN public.inventory_stock_ledger_entries sle
        ON sle.movement_line_id = c.ml_id AND sle.balance_field = 'on_hand'
      JOIN prz ON prz.id = sle.location_id
      GROUP BY 1, 2, 3, 4, 5
      HAVING SUM(CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
                 * sle.quantity * (rolml.applied_quantity / iml.quantity)) > 0
    )
    SELECT a.*, ro.zl_number,
      (SELECT l.inventory_movement_line_id
       FROM public.repair_order_line_movement_links l
       JOIN public.inventory_movement_lines ml ON ml.id = l.inventory_movement_line_id
       JOIN public.inventory_movement_headers mh ON mh.id = ml.movement_id
       WHERE l.repair_order_line_id = a.repair_order_line_id AND l.relation_type = 'receipt'
         AND mh.status = 'posted' AND ml.destination_location_id = a.location_id
         AND ml.variant_id = a.variant_id
       ORDER BY mh.posted_at DESC LIMIT 1) AS source_line_id,
      (SELECT mh.document_number
       FROM public.repair_order_line_movement_links l
       JOIN public.inventory_movement_lines ml ON ml.id = l.inventory_movement_line_id
       JOIN public.inventory_movement_headers mh ON mh.id = ml.movement_id
       WHERE l.repair_order_line_id = a.repair_order_line_id AND l.relation_type = 'receipt'
         AND mh.status = 'posted' AND ml.destination_location_id = a.location_id
         AND ml.variant_id = a.variant_id
       ORDER BY mh.posted_at DESC LIMIT 1) AS source_doc
    FROM attributed a
    JOIN public.repair_order_lines rol ON rol.id = a.repair_order_line_id
    JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_reservation_lines rl
      WHERE rl.repair_order_line_id = a.repair_order_line_id AND rl.location_id = a.location_id
        AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0)
    ORDER BY a.organization_id, a.repair_order_line_id
  LOOP
    SELECT COALESCE(available_quantity, 0) INTO v_available
    FROM public.inventory_balances
    WHERE organization_id = v_row.organization_id AND branch_id = v_row.branch_id
      AND location_id = v_row.location_id AND variant_id = v_row.variant_id
      AND lot_id IS NULL AND serial_id IS NULL;
    v_qty := LEAST(v_row.qty, COALESCE(v_available, 0));
    CONTINUE WHEN v_qty <= 0;

    v_number := public.inventory_next_commitment_number_internal(v_row.organization_id, 'reservation', NULL);
    INSERT INTO public.inventory_reservations (
      organization_id, branch_id, reservation_number, reference_type, reference_id, reference_number, notes)
    VALUES (
      v_row.organization_id, v_row.branch_id, v_number, 'repair_order_line', v_row.repair_order_line_id,
      v_row.zl_number, 'Migracja z ' || COALESCE(v_row.source_doc, 'PZ'))
    RETURNING id INTO v_res_id;

    PERFORM public.inventory_reservation_add_line_internal(
      v_res_id, v_row.variant_id, v_row.location_id, v_qty, v_row.repair_order_line_id,
      v_row.source_line_id, NULL, NULL,
      'Migracja: przypisanie z ' || COALESCE(v_row.source_doc, 'PZ') || ' zamienione na rezerwację');
  END LOOP;
END
$migration$;
