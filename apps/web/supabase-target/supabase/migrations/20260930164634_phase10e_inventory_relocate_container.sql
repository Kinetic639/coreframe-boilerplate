-- Phase 10E -- whole-container relocation (container-as-movement-carrier).
--
-- One atomic operation moves a container and everything in it to another
-- location of the same branch:
--   1. the commitment (allocated_quantity) held by the container's contents
--      is released at the source balance and the allocation lines follow the
--      stock -- in place when the whole outstanding allocation is in this
--      container, otherwise the moved part is split off onto a new
--      allocation line at the destination and this container's links are
--      re-pointed to it;
--   2. the stock itself moves through a real 801 bin-to-bin movement, each
--      line tagged with container_id (set on the draft, before posting);
--   3. the commitment is re-applied at the destination balance;
--   4. inventory_containers.current_location_id is updated.
-- Step 1 is required because the engine rejects (P0003) any on_hand
-- decrease that would strand reserved+allocated stock, and container
-- contents are allocated stock by construction (Phase 10C).
--
-- inventory_create_draft / inventory_finalize_posting are reused unchanged.
-- An empty container only has its pointer updated (no movement).
-- Retrying after success fails with "already at this location" (22023), so
-- no idempotency key is needed.

CREATE OR REPLACE FUNCTION public.inventory_relocate_container(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_container_id uuid,
  p_destination_location_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_container record;
  v_source_location_id uuid;
  v_cline record;
  v_link_sum numeric;
  v_engine_lines jsonb := '[]'::jsonb;
  v_line_count integer := 0;
  v_alloc record;
  v_other_linked numeric;
  v_outstanding numeric;
  v_balance public.inventory_balances%ROWTYPE;
  v_new_alloc_line_id uuid;
  v_commitments jsonb := '[]'::jsonb;
  v_commitment jsonb;
  v_draft jsonb;
  v_movement_id uuid;
  v_posted jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_destination_location_id IS NULL THEN
    RAISE EXCEPTION 'A destination location is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, code, status, current_location_id
  INTO v_container
  FROM public.inventory_containers
  WHERE id = p_container_id
    AND organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Container not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_container.status NOT IN ('active', 'empty', 'sealed') THEN
    RAISE EXCEPTION 'Container cannot be relocated (status: %)', v_container.status USING ERRCODE = '55000';
  END IF;

  v_source_location_id := v_container.current_location_id;

  IF p_destination_location_id = v_source_location_id THEN
    RAISE EXCEPTION 'Container is already at this location' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id
      AND organization_id = p_organization_id
      AND branch_id = p_branch_id
      AND can_store_inventory = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination is not a valid stockable location in this branch' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  -- Contents -> 801 lines. A line that is placed through allocation links
  -- must be fully covered by them; anything else is an inconsistent state
  -- we refuse to move rather than guess at.
  FOR v_cline IN
    SELECT id, variant_id, unit_id, quantity
    FROM public.inventory_container_lines
    WHERE container_id = v_container.id
      AND organization_id = p_organization_id
      AND branch_id = p_branch_id
      AND deleted_at IS NULL
    ORDER BY id
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_link_sum
    FROM public.inventory_allocation_container_links
    WHERE container_line_id = v_cline.id AND deleted_at IS NULL;

    IF v_link_sum > 0 AND v_link_sum <> v_cline.quantity THEN
      RAISE EXCEPTION 'Container contents do not match their allocations' USING ERRCODE = '22023';
    END IF;

    v_line_count := v_line_count + 1;
    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_cline.variant_id,
      'unit_id', v_cline.unit_id,
      'quantity', v_cline.quantity,
      'source_location_id', v_source_location_id,
      'destination_location_id', p_destination_location_id,
      'note', NULL
    ));
  END LOOP;

  IF v_line_count = 0 THEN
    UPDATE public.inventory_containers
    SET current_location_id = p_destination_location_id, updated_at = now(), updated_by = p_actor_user_id
    WHERE id = v_container.id;

    RETURN jsonb_build_object(
      'container_id', v_container.id,
      'movement_id', NULL,
      'document_number', NULL,
      'source_location_id', v_source_location_id,
      'destination_location_id', p_destination_location_id,
      'line_count', 0
    );
  END IF;

  -- 1. Move the commitment off the source. Lock allocation lines in id
  --    order first (same row lock add/remove take).
  PERFORM 1
  FROM public.inventory_allocation_lines al
  WHERE al.id IN (
    SELECT l.allocation_line_id
    FROM public.inventory_allocation_container_links l
    JOIN public.inventory_container_lines cl ON cl.id = l.container_line_id
    WHERE cl.container_id = v_container.id AND cl.deleted_at IS NULL AND l.deleted_at IS NULL
  )
  ORDER BY al.id
  FOR UPDATE;

  FOR v_alloc IN
    SELECT al.id, al.allocation_id, al.reservation_line_id, al.product_id, al.variant_id,
           al.location_id, al.lot_id, al.serial_id, al.allocated_quantity, al.fulfilled_quantity,
           SUM(l.quantity) AS moved
    FROM public.inventory_allocation_container_links l
    JOIN public.inventory_container_lines cl ON cl.id = l.container_line_id
    JOIN public.inventory_allocation_lines al ON al.id = l.allocation_line_id
    WHERE cl.container_id = v_container.id AND cl.deleted_at IS NULL AND l.deleted_at IS NULL
    GROUP BY al.id
    ORDER BY al.id
  LOOP
    IF v_alloc.location_id IS DISTINCT FROM v_source_location_id THEN
      RAISE EXCEPTION 'Allocation location does not match the container''s own current location' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(SUM(l.quantity), 0) INTO v_other_linked
    FROM public.inventory_allocation_container_links l
    JOIN public.inventory_container_lines cl ON cl.id = l.container_line_id
    WHERE l.allocation_line_id = v_alloc.id AND l.deleted_at IS NULL
      AND cl.container_id <> v_container.id AND cl.deleted_at IS NULL;

    v_outstanding := v_alloc.allocated_quantity - v_alloc.fulfilled_quantity;
    IF v_alloc.moved + v_other_linked > v_outstanding THEN
      RAISE EXCEPTION 'Container contents do not match their allocations' USING ERRCODE = '22023';
    END IF;

    v_balance := public.inventory_get_or_create_balance_for_update(
      p_organization_id, p_branch_id, v_source_location_id, v_alloc.variant_id, NULL,
      v_alloc.lot_id, v_alloc.serial_id
    );
    IF v_balance.allocated_quantity < v_alloc.moved THEN
      RAISE EXCEPTION 'Container contents do not match their allocations' USING ERRCODE = '22023';
    END IF;

    UPDATE public.inventory_balances
    SET allocated_quantity = allocated_quantity - v_alloc.moved
    WHERE id = v_balance.id;

    IF v_alloc.moved = v_outstanding THEN
      UPDATE public.inventory_allocation_lines
      SET location_id = p_destination_location_id
      WHERE id = v_alloc.id;
    ELSE
      UPDATE public.inventory_allocation_lines
      SET allocated_quantity = allocated_quantity - v_alloc.moved
      WHERE id = v_alloc.id;

      INSERT INTO public.inventory_allocation_lines (
        organization_id, branch_id, allocation_id, reservation_line_id, product_id, variant_id,
        location_id, lot_id, serial_id, allocated_quantity
      ) VALUES (
        p_organization_id, p_branch_id, v_alloc.allocation_id, v_alloc.reservation_line_id,
        v_alloc.product_id, v_alloc.variant_id, p_destination_location_id,
        v_alloc.lot_id, v_alloc.serial_id, v_alloc.moved
      )
      RETURNING id INTO v_new_alloc_line_id;

      UPDATE public.inventory_allocation_container_links l
      SET allocation_line_id = v_new_alloc_line_id
      FROM public.inventory_container_lines cl
      WHERE cl.id = l.container_line_id
        AND cl.container_id = v_container.id
        AND l.allocation_line_id = v_alloc.id
        AND l.deleted_at IS NULL;
    END IF;

    v_commitments := v_commitments || jsonb_build_array(jsonb_build_object(
      'variant_id', v_alloc.variant_id,
      'lot_id', v_alloc.lot_id,
      'serial_id', v_alloc.serial_id,
      'quantity', v_alloc.moved
    ));
  END LOOP;

  -- 2. The physical move: a real 801, each line tagged with the container.
  v_draft := public.inventory_create_draft(
    p_organization_id, p_branch_id, '801', v_engine_lines,
    NULL, NULL, NULL, v_container.code, NULLIF(trim(p_note), ''), NULL, p_actor_user_id
  );
  v_movement_id := (v_draft ->> 'movement_id')::uuid;

  UPDATE public.inventory_movement_lines
  SET container_id = v_container.id
  WHERE movement_id = v_movement_id;

  v_posted := public.inventory_finalize_posting(v_movement_id, p_actor_user_id);

  -- 3. Re-apply the commitment at the destination.
  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);
  FOR v_commitment IN SELECT * FROM jsonb_array_elements(v_commitments)
  LOOP
    v_balance := public.inventory_get_or_create_balance_for_update(
      p_organization_id, p_branch_id, p_destination_location_id,
      (v_commitment ->> 'variant_id')::uuid, NULL,
      NULLIF(v_commitment ->> 'lot_id', '')::uuid,
      NULLIF(v_commitment ->> 'serial_id', '')::uuid
    );
    UPDATE public.inventory_balances
    SET allocated_quantity = allocated_quantity + (v_commitment ->> 'quantity')::numeric
    WHERE id = v_balance.id;
  END LOOP;

  -- 4. The pointer.
  UPDATE public.inventory_containers
  SET current_location_id = p_destination_location_id, updated_at = now(), updated_by = p_actor_user_id
  WHERE id = v_container.id;

  RETURN jsonb_build_object(
    'container_id', v_container.id,
    'movement_id', v_movement_id,
    'document_number', v_posted ->> 'document_number',
    'source_location_id', v_source_location_id,
    'destination_location_id', p_destination_location_id,
    'line_count', v_line_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_relocate_container(uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_relocate_container(uuid, uuid, uuid, uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_relocate_container(uuid, uuid, uuid, uuid, uuid, text) TO authenticated;
