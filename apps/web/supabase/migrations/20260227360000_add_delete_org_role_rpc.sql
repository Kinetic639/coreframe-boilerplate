-- SECURITY DEFINER function for role deletion.
-- Bypasses the RLS UPDATE WITH CHECK (which has unresolvable behavior for
-- soft-delete via PostgREST) and handles the full cleanup atomically:
--   1. Validates caller is an org member with members.manage
--   2. Soft-deletes all user_role_assignments for the role
--   3. Soft-deletes all role_permissions for the role
--   4. Soft-deletes the role itself
CREATE OR REPLACE FUNCTION public.delete_org_role(p_role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Resolve the role and ensure it's a deletable org role
  SELECT organization_id INTO v_org_id
  FROM public.roles
  WHERE id = p_role_id
    AND is_basic = false
    AND organization_id IS NOT NULL
    AND deleted_at IS NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Role not found or cannot be deleted'
      USING ERRCODE = 'P0002';
  END IF;

  -- Verify caller is an active org member
  IF NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = '42501';
  END IF;

  -- Verify caller has members.manage permission
  IF NOT public.has_permission(v_org_id, 'members.manage') THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Soft-delete all role assignments (unassign all members)
  UPDATE public.user_role_assignments
  SET deleted_at = NOW()
  WHERE role_id = p_role_id
    AND deleted_at IS NULL;

  -- 2. Soft-delete all role permissions
  UPDATE public.role_permissions
  SET deleted_at = NOW()
  WHERE role_id = p_role_id
    AND deleted_at IS NULL;

  -- 3. Soft-delete the role itself
  UPDATE public.roles
  SET deleted_at = NOW()
  WHERE id = p_role_id;
END;
$$;

-- Grant execute to authenticated users (auth check is inside the function)
GRANT EXECUTE ON FUNCTION public.delete_org_role(uuid) TO authenticated;
