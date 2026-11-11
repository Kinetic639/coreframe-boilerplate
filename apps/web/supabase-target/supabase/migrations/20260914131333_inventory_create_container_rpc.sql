CREATE OR REPLACE FUNCTION public.inventory_create_container(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_code text,
  p_current_location_id uuid,
  p_type text DEFAULT 'container',
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_location record;
  v_container_id uuid;
BEGIN
  IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'Container code is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, can_store_inventory INTO v_location
  FROM warehouse_locations
  WHERE id = p_current_location_id
    AND organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_location.can_store_inventory THEN
    RAISE EXCEPTION 'Only stockable bins can hold a container' USING ERRCODE = '22023';
  END IF;

  INSERT INTO inventory_containers (
    organization_id, branch_id, code, type, status, current_location_id,
    reference_type, reference_id, created_by, updated_by
  ) VALUES (
    p_organization_id, p_branch_id, p_code, COALESCE(p_type, 'container'), 'empty', p_current_location_id,
    p_reference_type, p_reference_id, p_actor_user_id, p_actor_user_id
  )
  RETURNING id INTO v_container_id;

  RETURN jsonb_build_object('container_id', v_container_id, 'code', p_code, 'status', 'empty');
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_create_container(uuid,uuid,uuid,text,uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_container(uuid,uuid,uuid,text,uuid,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_container(uuid,uuid,uuid,text,uuid,text,text,text) TO authenticated;
