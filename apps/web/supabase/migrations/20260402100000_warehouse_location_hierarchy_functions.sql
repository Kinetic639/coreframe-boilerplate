-- ─────────────────────────────────────────────────────────────────────────────
-- Warehouse location hierarchy functions
--
-- Provides atomic, transaction-safe operations for hierarchy mutations on
-- warehouse_locations. The TypeScript service layer calls these via RPC so that
-- multi-step operations (level cascade, soft-delete with child reparenting) are
-- guaranteed atomic — a mid-operation failure rolls back the entire unit.
--
-- Functions:
--   cascade_warehouse_location_levels   — recursive CTE level update for a subtree
--   reparent_warehouse_location         — atomic reparent + cascade in one call
--   soft_delete_warehouse_location      — atomic child reparent + soft-delete
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── cascade_warehouse_location_levels ───────────────────────────────────────
--
-- Updates the `level` field for every active descendant of p_parent_id using a
-- single recursive CTE — the entire subtree is updated in one SQL statement.
--
-- Parameters:
--   p_org_id      — scope guard: only touches rows with this organization_id
--   p_parent_id   — the node whose children start the cascade (the node itself
--                   is NOT updated here; update the node before calling this)
--   p_parent_level — the already-applied level of p_parent_id

CREATE OR REPLACE FUNCTION cascade_warehouse_location_levels(
  p_org_id      uuid,
  p_parent_id   uuid,
  p_parent_level int
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH RECURSIVE subtree AS (
    -- Direct children of the reparented/updated node
    SELECT
      id,
      (p_parent_level + 1) AS new_level
    FROM warehouse_locations
    WHERE parent_id       = p_parent_id
      AND organization_id = p_org_id
      AND deleted_at      IS NULL

    UNION ALL

    -- Grandchildren and deeper
    SELECT
      wl.id,
      (s.new_level + 1)
    FROM warehouse_locations wl
    JOIN subtree s ON wl.parent_id = s.id
    WHERE wl.organization_id = p_org_id
      AND wl.deleted_at      IS NULL
  )
  UPDATE warehouse_locations
  SET    level = subtree.new_level
  FROM   subtree
  WHERE  warehouse_locations.id              = subtree.id
    AND  warehouse_locations.organization_id = p_org_id;
$$;


-- ─── reparent_warehouse_location ─────────────────────────────────────────────
--
-- Atomically moves a location to a new parent and cascades level values to all
-- descendants. Runs inside the caller's transaction (PL/pgSQL BEGIN is implicit).
--
-- The cycle check and branch-cross check remain in the TypeScript service layer
-- (they require multiple reads and are guarded by the application before this
-- function is ever called).
--
-- Parameters:
--   p_org_id        — scope guard
--   p_location_id   — the node being reparented
--   p_new_parent_id — NULL for root, otherwise new parent UUID
--   p_new_level     — pre-computed level (= new parent's level + 1, or 0 for root)

CREATE OR REPLACE FUNCTION reparent_warehouse_location(
  p_org_id        uuid,
  p_location_id   uuid,
  p_new_parent_id uuid,   -- NULL = promote to root
  p_new_level     int
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- 1. Update the node's own parent_id and level.
  UPDATE warehouse_locations
  SET    parent_id = p_new_parent_id,
         level     = p_new_level
  WHERE  id              = p_location_id
    AND  organization_id = p_org_id
    AND  deleted_at      IS NULL;

  -- 2. Cascade the new level down through all active descendants (single CTE).
  PERFORM cascade_warehouse_location_levels(p_org_id, p_location_id, p_new_level);
END;
$$;


-- ─── soft_delete_warehouse_location ──────────────────────────────────────────
--
-- Atomically soft-deletes a warehouse location and reparents its direct
-- children to the tree root (parent_id = NULL, level = 0), then cascades
-- corrected levels to all grandchildren.
--
-- All three steps (reparent, cascade, soft-delete) execute in one DB call,
-- eliminating the partial-update risk present in a multi-round-trip TypeScript
-- implementation.
--
-- Note: the ON DELETE SET NULL FK on parent_id fires only for hard DELETEs.
-- Soft-delete UPDATEs do NOT trigger it, so children are explicitly reparented
-- here.
--
-- Parameters:
--   p_org_id       — scope guard
--   p_location_id  — the location to soft-delete

CREATE OR REPLACE FUNCTION soft_delete_warehouse_location(
  p_org_id      uuid,
  p_location_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  -- 1. For each direct child: reparent to root and cascade its subtree levels.
  --    Capture child ids before reparenting so we can cascade from each.
  FOR v_child_id IN
    SELECT id
    FROM   warehouse_locations
    WHERE  parent_id       = p_location_id
      AND  organization_id = p_org_id
      AND  deleted_at      IS NULL
  LOOP
    -- Promote child to root
    UPDATE warehouse_locations
    SET    parent_id = NULL,
           level     = 0
    WHERE  id              = v_child_id
      AND  organization_id = p_org_id;

    -- Cascade levels for child's subtree (grandchildren → level 1, etc.)
    PERFORM cascade_warehouse_location_levels(p_org_id, v_child_id, 0);
  END LOOP;

  -- 2. Soft-delete the location itself.
  UPDATE warehouse_locations
  SET    deleted_at = NOW()
  WHERE  id              = p_location_id
    AND  organization_id = p_org_id
    AND  deleted_at      IS NULL;
END;
$$;
