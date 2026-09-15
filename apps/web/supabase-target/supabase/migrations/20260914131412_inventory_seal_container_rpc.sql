CREATE OR REPLACE FUNCTION public.inventory_seal_container(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_container_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_container record;
BEGIN
  IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  SELECT id, status INTO v_container
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
    RAISE EXCEPTION 'Container cannot be sealed from its current status (%)', v_container.status USING ERRCODE = '55000';
  END IF;

  UPDATE inventory_containers SET status = 'sealed', updated_at = now(), updated_by = p_actor_user_id WHERE id = v_container.id;

  RETURN jsonb_build_object('container_id', v_container.id, 'status', 'sealed');
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_seal_container(uuid,uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_seal_container(uuid,uuid,uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_seal_container(uuid,uuid,uuid,uuid) TO authenticated;
