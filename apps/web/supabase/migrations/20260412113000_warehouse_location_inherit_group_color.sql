-- =============================================================================
-- Migration: warehouse location inherit-group-color support
-- =============================================================================
-- Adds a persisted flag on warehouse_locations that lets a location inherit the
-- color of its assigned display group.
--
-- Rules:
--   - default is false
--   - cannot be true when group_id is null
--   - when a group membership is cleared by soft-delete helpers, the flag is
--     also cleared to keep rows consistent
-- =============================================================================

ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS inherit_group_color BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.warehouse_locations.inherit_group_color IS
  'When true, the location inherits the color of its assigned warehouse_location_group for UI rendering.';

ALTER TABLE public.warehouse_locations
  DROP CONSTRAINT IF EXISTS warehouse_locations_inherit_group_color_requires_group;

ALTER TABLE public.warehouse_locations
  ADD CONSTRAINT warehouse_locations_inherit_group_color_requires_group
  CHECK (group_id IS NOT NULL OR inherit_group_color = false);

CREATE OR REPLACE FUNCTION public.soft_delete_warehouse_location_group(
  p_org_id   uuid,
  p_group_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.warehouse_locations
     SET group_id             = NULL,
         inherit_group_color  = false,
         updated_at           = now()
   WHERE group_id        = p_group_id
     AND organization_id = p_org_id
     AND deleted_at      IS NULL;

  UPDATE public.warehouse_location_groups
     SET deleted_at = now()
   WHERE id              = p_group_id
     AND organization_id = p_org_id
     AND deleted_at      IS NULL;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_warehouse_location_group IS
  'Atomically clears member locations, resets inherit_group_color, and soft-deletes a warehouse location group.';

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
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_group_ids
    FROM public.warehouse_location_groups
   WHERE parent_location_id = p_location_id
     AND organization_id    = p_org_id
     AND deleted_at         IS NULL;

  IF COALESCE(array_length(v_group_ids, 1), 0) > 0 THEN
    UPDATE public.warehouse_locations
       SET group_id            = NULL,
           inherit_group_color = false,
           updated_at          = now()
     WHERE organization_id = p_org_id
       AND deleted_at      IS NULL
       AND group_id        = ANY(v_group_ids);

    UPDATE public.warehouse_location_groups
       SET deleted_at = now()
     WHERE organization_id = p_org_id
       AND deleted_at      IS NULL
       AND id              = ANY(v_group_ids);
  END IF;

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

  UPDATE public.warehouse_locations
     SET deleted_at = now()
   WHERE id              = p_location_id
     AND organization_id = p_org_id
     AND deleted_at      IS NULL;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_warehouse_location IS
  'Atomically soft-deletes a warehouse location, clears and soft-deletes any attached location groups, resets inherit_group_color for their members, reparents direct children to root, and cascades descendant levels.';
