-- =============================================================================
-- Migration: warehouse_location_groups hardening
-- =============================================================================
-- Fixes applied:
--
--   1. FORCE ROW LEVEL SECURITY on warehouse_location_groups to match the rest
--      of the warehouse tables.
--
--   2. Add trigger-backed DB invariants:
--      - warehouse_locations.group_id must reference an active group from the
--        same org + branch, and the group's parent_location_id must match the
--        location's parent_id.
--      - warehouse_location_groups.parent_location_id must reference an active
--        location from the same org + branch.
--
--   3. Add atomic RPCs for group soft-delete and batch reorder.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: FORCE RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.warehouse_location_groups FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- PART 2: Invariant trigger helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_warehouse_location_group_parent_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_parent_org_id    uuid;
  v_parent_branch_id uuid;
BEGIN
  IF NEW.parent_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id, branch_id
    INTO v_parent_org_id, v_parent_branch_id
    FROM public.warehouse_locations
   WHERE id = NEW.parent_location_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_parent_location: Parent location % not found', NEW.parent_location_id;
  END IF;

  IF v_parent_org_id != NEW.organization_id OR v_parent_branch_id != NEW.branch_id THEN
    RAISE EXCEPTION
      'parent_location_scope_mismatch: Parent location % does not belong to org % branch %',
      NEW.parent_location_id,
      NEW.organization_id,
      NEW.branch_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_warehouse_location_group_parent_scope IS
  'Enforces that warehouse_location_groups.parent_location_id points to an active parent location in the same org and branch.';

DROP TRIGGER IF EXISTS warehouse_location_groups_validate_parent_scope
  ON public.warehouse_location_groups;

CREATE TRIGGER warehouse_location_groups_validate_parent_scope
  BEFORE INSERT OR UPDATE OF parent_location_id, organization_id, branch_id
  ON public.warehouse_location_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_warehouse_location_group_parent_scope();

CREATE OR REPLACE FUNCTION public.validate_warehouse_location_group_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_group_org_id           uuid;
  v_group_branch_id        uuid;
  v_group_parent_location  uuid;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id, branch_id, parent_location_id
    INTO v_group_org_id, v_group_branch_id, v_group_parent_location
    FROM public.warehouse_location_groups
   WHERE id = NEW.group_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_group_id: Location group % not found', NEW.group_id;
  END IF;

  IF v_group_org_id != NEW.organization_id OR v_group_branch_id != NEW.branch_id THEN
    RAISE EXCEPTION
      'group_scope_mismatch: Location group % does not belong to org % branch %',
      NEW.group_id,
      NEW.organization_id,
      NEW.branch_id;
  END IF;

  IF v_group_parent_location IS DISTINCT FROM NEW.parent_id THEN
    RAISE EXCEPTION
      'group_parent_mismatch: Location group % belongs to a different parent location',
      NEW.group_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_warehouse_location_group_membership IS
  'Enforces that warehouse_locations.group_id points to an active group in the same org and branch, and under the same parent location.';

DROP TRIGGER IF EXISTS warehouse_locations_validate_group_membership
  ON public.warehouse_locations;

CREATE TRIGGER warehouse_locations_validate_group_membership
  BEFORE INSERT OR UPDATE OF group_id, parent_id, organization_id, branch_id
  ON public.warehouse_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_warehouse_location_group_membership();

-- ---------------------------------------------------------------------------
-- PART 3: Atomic RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reorder_warehouse_location_groups(
  p_org_id    uuid,
  p_branch_id uuid,
  p_items     jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_expected_count int;
  v_matched_count  int;
BEGIN
  v_expected_count := COALESCE(jsonb_array_length(p_items), 0);

  IF v_expected_count = 0 THEN
    RETURN;
  END IF;

  SELECT count(*)
    INTO v_matched_count
    FROM jsonb_to_recordset(p_items) AS i(id uuid, sort_order integer)
    JOIN public.warehouse_location_groups g
      ON g.id              = i.id
     AND g.organization_id = p_org_id
     AND g.branch_id       = p_branch_id
     AND g.deleted_at      IS NULL;

  IF v_matched_count != v_expected_count THEN
    RAISE EXCEPTION
      'group_not_found: One or more groups do not belong to org % branch %',
      p_org_id,
      p_branch_id;
  END IF;

  UPDATE public.warehouse_location_groups AS g
     SET sort_order = i.sort_order,
         updated_at = now()
    FROM jsonb_to_recordset(p_items) AS i(id uuid, sort_order integer)
   WHERE g.id              = i.id
     AND g.organization_id = p_org_id
     AND g.branch_id       = p_branch_id
     AND g.deleted_at      IS NULL;
END;
$$;

COMMENT ON FUNCTION public.reorder_warehouse_location_groups IS
  'Atomically reorders warehouse location groups for one org + branch.';

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
     SET group_id   = NULL,
         updated_at = now()
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
  'Atomically clears member locations and soft-deletes a warehouse location group.';
