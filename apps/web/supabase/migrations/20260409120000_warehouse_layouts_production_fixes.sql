-- =============================================================================
-- Migration: warehouse_layouts production fixes
-- =============================================================================
-- Fixes:
--   1. RLS UPDATE policy: allow manage OR publish (so publish RPC works for
--      users who hold warehouse.layouts.publish but not warehouse.layouts.manage)
--   2. unpublish_warehouse_layout() RPC — mirrors publish semantics, uses publish gate
--   3. batch_save_warehouse_layout_shapes() RPC — atomic replace-active-shapes,
--      validates cross-branch location_ids, eliminates partial-update risk
--   4. create_warehouse_layout_with_root() RPC — atomic root location + layout
--      creation; eliminates orphan-location risk on layout create failure
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Widen UPDATE policy to allow manage OR publish
-- ---------------------------------------------------------------------------
-- Previously wll_update_manage required warehouse.layouts.manage for all UPDATEs.
-- publish_warehouse_layout() and unpublish_warehouse_layout() are SECURITY INVOKER,
-- so their internal UPDATEs are also subject to RLS.  Users who hold only publish
-- (not manage) were silently blocked.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS wll_update_manage ON public.warehouse_layouts;
CREATE POLICY wll_update_manage
  ON public.warehouse_layouts FOR UPDATE
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.publish')
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.publish')
  );

-- ---------------------------------------------------------------------------
-- PART 2: unpublish_warehouse_layout() RPC
-- ---------------------------------------------------------------------------
-- Mirrors publish_warehouse_layout() semantics:
--   - SECURITY INVOKER (RLS policies still apply)
--   - Requires warehouse.layouts.publish (same gate as publish, NOT manage)
--   - Reverts a layout to draft status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unpublish_warehouse_layout(
  p_layout_id UUID,
  p_user_id   UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_org_id    UUID;
  v_branch_id UUID;
BEGIN
  -- 1. Fetch layout (SELECT RLS applies — caller must be able to read it)
  SELECT organization_id, branch_id
    INTO v_org_id, v_branch_id
    FROM public.warehouse_layouts
   WHERE id = p_layout_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'layout_not_found: Layout % not found or access denied', p_layout_id;
  END IF;

  -- 2. Explicit publish permission check (same gate as publish — NOT manage)
  IF NOT public.has_branch_permission(v_org_id, v_branch_id, 'warehouse.layouts.publish') THEN
    RAISE EXCEPTION 'insufficient_permission: warehouse.layouts.publish required';
  END IF;

  -- 3. Revert to draft
  UPDATE public.warehouse_layouts
     SET status     = 'draft',
         updated_at = now(),
         updated_by = p_user_id
   WHERE id         = p_layout_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'layout_not_found: Layout % not found on unpublish step', p_layout_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.unpublish_warehouse_layout IS
  'Reverts a published layout to draft. Requires warehouse.layouts.publish (same gate as publish). SECURITY INVOKER — RLS policies still apply.';

-- ---------------------------------------------------------------------------
-- PART 3: batch_save_warehouse_layout_shapes() RPC
-- ---------------------------------------------------------------------------
-- Atomically replaces the active shape state for a layout inside a single
-- DB transaction, eliminating the partial-update risk from the previous
-- two-round-trip TypeScript implementation.
--
-- Semantics:
--   - Shapes in DB but NOT in p_shapes → soft-deleted
--   - Shapes in p_shapes → upserted (insert new, update existing, restore soft-deleted)
--   - All location_ids in p_shapes are validated against the same org+branch
--
-- SECURITY INVOKER: the calling user must have warehouse.layouts.manage (enforced
-- by the INSERT/UPDATE RLS policies on warehouse_layout_shapes) and must be able
-- to SELECT the layout (SELECT RLS policy).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.batch_save_warehouse_layout_shapes(
  p_layout_id UUID,
  p_org_id    UUID,
  p_branch_id UUID,
  p_user_id   UUID,
  p_shapes    JSONB   -- array of shape objects
)
RETURNS SETOF public.warehouse_layout_shapes
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- 1. Verify layout exists and belongs to the specified org+branch.
  --    (SELECT RLS policy also applies — caller must be able to read it.)
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_layouts
     WHERE id              = p_layout_id
       AND organization_id = p_org_id
       AND branch_id       = p_branch_id
       AND deleted_at      IS NULL
  ) THEN
    RAISE EXCEPTION 'layout_not_found: Layout % not found or does not belong to this branch', p_layout_id;
  END IF;

  -- 2. Validate every location_id in the input belongs to the same org+branch.
  --    Fail fast before any mutation so the error is diagnostic.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_shapes) AS elem
     WHERE elem->>'location_id' IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.warehouse_locations wl
          WHERE wl.id              = (elem->>'location_id')::UUID
            AND wl.organization_id = p_org_id
            AND wl.branch_id       = p_branch_id
            AND wl.deleted_at      IS NULL
       )
  ) THEN
    RAISE EXCEPTION 'invalid_location_id: One or more location_ids do not belong to org % branch %',
      p_org_id, p_branch_id;
  END IF;

  -- 3. Soft-delete shapes that are active in the DB but absent from the input.
  UPDATE public.warehouse_layout_shapes
     SET deleted_at = now()
   WHERE layout_id      = p_layout_id
     AND organization_id = p_org_id
     AND deleted_at      IS NULL
     AND id NOT IN (
       SELECT (elem->>'id')::UUID
         FROM jsonb_array_elements(p_shapes) AS elem
        WHERE elem->>'id' IS NOT NULL
     );

  -- 4. Upsert all shapes from the input list.
  --    ON CONFLICT (id) restores any previously soft-deleted shape if re-added.
  INSERT INTO public.warehouse_layout_shapes (
    id,
    layout_id,
    organization_id,
    branch_id,
    shape_type,
    location_id,
    label,
    x, y, width, height, rotation,
    style,
    z_index,
    sort_order,
    created_by,
    deleted_at
  )
  SELECT
    (elem->>'id')::UUID,
    p_layout_id,
    p_org_id,
    p_branch_id,
    elem->>'shape_type',
    CASE WHEN elem->>'location_id' IS NOT NULL
         THEN (elem->>'location_id')::UUID
         ELSE NULL END,
    elem->>'label',
    (elem->>'x')::FLOAT,
    (elem->>'y')::FLOAT,
    (elem->>'width')::FLOAT,
    (elem->>'height')::FLOAT,
    (elem->>'rotation')::FLOAT,
    CASE WHEN elem->'style' IS NULL OR jsonb_typeof(elem->'style') = 'null'
         THEN NULL
         ELSE elem->'style'
    END,
    COALESCE((elem->>'z_index')::INTEGER,    0),
    COALESCE((elem->>'sort_order')::INTEGER, 0),
    p_user_id,
    NULL  -- restore soft-deleted shapes
  FROM jsonb_array_elements(p_shapes) AS elem
  ON CONFLICT (id) DO UPDATE SET
    shape_type    = EXCLUDED.shape_type,
    location_id   = EXCLUDED.location_id,
    label         = EXCLUDED.label,
    x             = EXCLUDED.x,
    y             = EXCLUDED.y,
    width         = EXCLUDED.width,
    height        = EXCLUDED.height,
    rotation      = EXCLUDED.rotation,
    style         = EXCLUDED.style,
    z_index       = EXCLUDED.z_index,
    sort_order    = EXCLUDED.sort_order,
    deleted_at    = NULL,
    updated_at    = now();

  -- 5. Return the fresh active shape list for this layout.
  RETURN QUERY
    SELECT *
      FROM public.warehouse_layout_shapes
     WHERE layout_id      = p_layout_id
       AND organization_id = p_org_id
       AND deleted_at      IS NULL
     ORDER BY z_index ASC, sort_order ASC;
END;
$$;

COMMENT ON FUNCTION public.batch_save_warehouse_layout_shapes IS
  'Atomically replaces the active shape state for a layout. Soft-deletes removed shapes and upserts new/updated ones in a single transaction. Validates cross-branch location_ids. SECURITY INVOKER.';

-- ---------------------------------------------------------------------------
-- PART 4: create_warehouse_layout_with_root() RPC
-- ---------------------------------------------------------------------------
-- Atomically creates a root warehouse_location and a linked warehouse_layout
-- in one transaction.  Eliminates the orphan-location risk present when the
-- two-step TypeScript implementation fails between the two INSERTs.
--
-- Returns: TABLE(layout_id UUID, root_location_id UUID)
-- The caller fetches the full layout row after the RPC succeeds.
--
-- SECURITY INVOKER: the calling user must have:
--   - warehouse.locations.manage (INSERT on warehouse_locations)
--   - warehouse.layouts.manage   (INSERT on warehouse_layouts)
-- Both are enforced by their respective table INSERT RLS policies.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_warehouse_layout_with_root(
  p_org_id            UUID,
  p_branch_id         UUID,
  p_user_id           UUID,
  p_layout_name       TEXT,
  p_layout_description TEXT,
  p_root_loc_code     TEXT,
  p_canvas_width_m    FLOAT,
  p_canvas_height_m   FLOAT
)
RETURNS TABLE (layout_id UUID, root_location_id UUID)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_root_location_id UUID;
  v_layout_id        UUID;
BEGIN
  -- 1. Create the root warehouse_location.
  --    Uses the layout name as the location name so both refer to the same
  --    physical space (consistent with the existing TypeScript behavior).
  INSERT INTO public.warehouse_locations (
    organization_id,
    branch_id,
    name,
    code,
    color,
    parent_id,
    level,
    sort_order,
    created_by,
    updated_by
  ) VALUES (
    p_org_id,
    p_branch_id,
    p_layout_name,
    p_root_loc_code,
    '#10b981',
    NULL,
    0,
    0,
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_root_location_id;

  -- 2. Create the layout linked to the root location.
  --    If this INSERT fails (e.g. unique constraint), the location INSERT above
  --    is rolled back automatically by the transaction.
  INSERT INTO public.warehouse_layouts (
    organization_id,
    branch_id,
    root_location_id,
    name,
    description,
    status,
    canvas_width_m,
    canvas_height_m,
    created_by,
    updated_by
  ) VALUES (
    p_org_id,
    p_branch_id,
    v_root_location_id,
    p_layout_name,
    p_layout_description,
    'draft',
    p_canvas_width_m,
    p_canvas_height_m,
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_layout_id;

  RETURN QUERY SELECT v_layout_id, v_root_location_id;
END;
$$;

COMMENT ON FUNCTION public.create_warehouse_layout_with_root IS
  'Atomically creates a root warehouse_location and a linked warehouse_layout. On failure both are rolled back — no orphan location is left. SECURITY INVOKER.';
