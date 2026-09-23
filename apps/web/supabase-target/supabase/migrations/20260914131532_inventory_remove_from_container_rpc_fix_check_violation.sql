CREATE OR REPLACE FUNCTION public.inventory_remove_from_container(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_container_id uuid,
  p_link_id uuid,
  p_quantity numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_container record;
  v_link record;
  v_line record;
  v_new_link_qty numeric;
  v_new_line_qty numeric;
  v_total_active numeric;
  v_final_status text;
BEGIN
  IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT id, organization_id, branch_id, status
  INTO v_container
  FROM inventory_containers
  WHERE id = p_container_id
    AND organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Container not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_container.status NOT IN ('active', 'empty') THEN
    RAISE EXCEPTION 'Container is not open for removing stock (status: %)', v_container.status USING ERRCODE = '55000';
  END IF;

  SELECT l.id, l.organization_id, l.branch_id, l.quantity, l.container_line_id
  INTO v_link
  FROM inventory_allocation_container_links l
  JOIN inventory_container_lines cl ON cl.id = l.container_line_id
  WHERE l.id = p_link_id
    AND l.organization_id = p_organization_id
    AND l.branch_id = p_branch_id
    AND l.deleted_at IS NULL
    AND cl.container_id = v_container.id
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation-container link not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_quantity > v_link.quantity THEN
    RAISE EXCEPTION 'Cannot remove more than the currently linked quantity (linked %, requested %)', v_link.quantity, p_quantity USING ERRCODE = '22023';
  END IF;

  SELECT id, quantity INTO v_line
  FROM inventory_container_lines
  WHERE id = v_link.container_line_id
  FOR UPDATE;

  v_new_link_qty := v_link.quantity - p_quantity;
  v_new_line_qty := v_line.quantity - p_quantity;

  IF v_new_link_qty <= 0 THEN
    -- Full removal: soft-delete only. `quantity` keeps its own CHECK
    -- (quantity > 0) satisfied by NOT zeroing it out -- the column
    -- preserves the last active placed amount as history (the smallest
    -- model consistent with this table's own soft-delete convention,
    -- matching every other Zone 3 link/line table's own pattern of never
    -- overwriting a still-CHECK-constrained numeric column to zero on
    -- close-out).
    UPDATE inventory_allocation_container_links
    SET deleted_at = now()
    WHERE id = v_link.id;
  ELSE
    UPDATE inventory_allocation_container_links
    SET quantity = v_new_link_qty
    WHERE id = v_link.id;
  END IF;

  IF v_new_line_qty <= 0 THEN
    UPDATE inventory_container_lines
    SET deleted_at = now(), updated_at = now()
    WHERE id = v_line.id;
  ELSE
    UPDATE inventory_container_lines
    SET quantity = v_new_line_qty, updated_at = now()
    WHERE id = v_line.id;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_total_active
  FROM inventory_container_lines
  WHERE container_id = v_container.id
    AND deleted_at IS NULL;

  v_final_status := v_container.status;
  IF v_total_active = 0 AND v_container.status <> 'archived' THEN
    v_final_status := 'empty';
    UPDATE inventory_containers SET status = 'empty', updated_at = now(), updated_by = p_actor_user_id WHERE id = v_container.id;
  END IF;

  RETURN jsonb_build_object(
    'link_id', v_link.id,
    'remaining_link_quantity', GREATEST(v_new_link_qty, 0),
    'container_line_id', v_line.id,
    'remaining_container_line_quantity', GREATEST(v_new_line_qty, 0),
    'container_status', v_final_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_remove_from_container(uuid,uuid,uuid,uuid,uuid,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_remove_from_container(uuid,uuid,uuid,uuid,uuid,numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_remove_from_container(uuid,uuid,uuid,uuid,uuid,numeric) TO authenticated;
