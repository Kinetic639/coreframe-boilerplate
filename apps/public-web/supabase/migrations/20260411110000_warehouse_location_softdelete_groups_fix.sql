-- =============================================================================
-- Migration: warehouse_location soft-delete group compatibility fix
-- =============================================================================
-- Problem:
--   The location-group hardening trigger now enforces that a location's group_id
--   must belong to the same parent_id. The existing soft_delete_warehouse_location()
--   RPC reparents direct children to root, which can violate that invariant when
--   grouped children exist.
--
-- Fix:
--   Before reparenting direct children, atomically:
--     1. find all active groups attached to the location being deleted
--     2. clear group_id from all active member locations in the same org
--     3. soft-delete those groups
--   Then proceed with the existing child reparent + level cascade + location
--   soft-delete flow.
--
-- Result:
--   Deleting a location with attached location-groups remains atomic and stays
--   compatible with the new group-parent invariant trigger.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_warehouse_location(
  p_org_id      uuid,
  p_location_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_group_ids uuid[];
BEGIN
  -- 0. Resolve any active groups attached to the location being deleted.
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_group_ids
    FROM public.warehouse_location_groups
   WHERE parent_location_id = p_location_id
     AND organization_id    = p_org_id
     AND deleted_at         IS NULL;

  -- 0a. Clear group membership from all active member locations first so later
  --     child reparenting does not violate the group-parent invariant trigger.
  IF COALESCE(array_length(v_group_ids, 1), 0) > 0 THEN
    UPDATE public.warehouse_locations
       SET group_id   = NULL,
           updated_at = now()
     WHERE organization_id = p_org_id
       AND deleted_at      IS NULL
       AND group_id        = ANY(v_group_ids);

    -- 0b. Soft-delete the groups attached to this parent location.
    UPDATE public.warehouse_location_groups
       SET deleted_at = now()
     WHERE organization_id = p_org_id
       AND deleted_at      IS NULL
       AND id              = ANY(v_group_ids);
  END IF;

  -- 1. Promote each direct child to root and cascade its subtree levels.
  FOR v_child_id IN
    SELECT id
    FROM public.warehouse_locations
    WHERE parent_id       = p_location_id
      AND organization_id = p_org_id
      AND deleted_at      IS NULL
  LOOP
    UPDATE public.warehouse_locations
       SET parent_id = NULL,
           level     = 0
     WHERE id              = v_child_id
       AND organization_id = p_org_id;

    PERFORM public.cascade_warehouse_location_levels(p_org_id, v_child_id, 0);
  END LOOP;

  -- 2. Soft-delete the location itself.
  UPDATE public.warehouse_locations
     SET deleted_at = now()
   WHERE id              = p_location_id
     AND organization_id = p_org_id
     AND deleted_at      IS NULL;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_warehouse_location IS
  'Atomically soft-deletes a warehouse location, clears and soft-deletes any attached location groups, reparents direct children to root, and cascades descendant levels.';
