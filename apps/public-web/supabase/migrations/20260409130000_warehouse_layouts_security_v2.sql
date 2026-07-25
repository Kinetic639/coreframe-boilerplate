-- =============================================================================
-- Migration: warehouse_layouts security hardening v2
-- =============================================================================
-- Fixes applied in this migration:
--
--   1. Restore least-privilege UPDATE RLS: revert wll_update_manage to
--      warehouse.layouts.manage only — warehouse.layouts.publish must NOT
--      grant generic table-level UPDATE power.
--
--   2. publish_warehouse_layout()  → SECURITY DEFINER (was INVOKER)
--      unpublish_warehouse_layout() → SECURITY DEFINER (was INVOKER)
--      Both functions keep explicit has_branch_permission checks and tight
--      org/branch scoping on all UPDATEs. SECURITY DEFINER is required because
--      the table UPDATE policy is now restricted to manage-only; publish-only
--      users must go through these functions which perform their own gating.
--
--   3. batch_save_warehouse_layout_shapes(): add cross-layout ID guard.
--      A supplied shape ID that already belongs to a different layout is
--      rejected before any mutation.
--
--   4. soft_delete_warehouse_layout(): new RPC that atomically soft-deletes
--      a layout and all its shapes in one transaction.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Restore manage-only UPDATE policy on warehouse_layouts
-- ---------------------------------------------------------------------------
-- The previous migration (20260409120000) widened this to manage OR publish
-- to allow SECURITY INVOKER publish/unpublish RPCs to execute table UPDATEs.
-- Now that publish/unpublish are SECURITY DEFINER they bypass table RLS, so
-- the table policy can safely be tightened back to manage only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS wll_update_manage ON public.warehouse_layouts;
CREATE POLICY wll_update_manage
  ON public.warehouse_layouts FOR UPDATE
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

-- ---------------------------------------------------------------------------
-- PART 2: publish_warehouse_layout() — SECURITY DEFINER
-- ---------------------------------------------------------------------------
-- Same logic as the original SECURITY INVOKER version, but runs as the
-- function owner (bypassing table RLS). Security is preserved by:
--   a) Explicit has_branch_permission check before any mutation.
--   b) All UPDATEs are scoped to the resolved v_org_id / v_branch_id and
--      the specific layout IDs — no cross-tenant writes are possible.
--   c) The initial SELECT is scoped to p_layout_id + deleted_at IS NULL;
--      even if a caller can supply an arbitrary UUID, has_branch_permission
--      will reject attempts to publish layouts for orgs/branches they lack
--      access to.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_warehouse_layout(
  p_layout_id UUID,
  p_user_id   UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id      UUID;
  v_branch_id   UUID;
  v_root_loc_id UUID;
  v_sentinel    UUID := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  -- 1. Fetch the target layout (no RLS here — SECURITY DEFINER bypasses it;
  --    permission is checked explicitly in step 2).
  SELECT organization_id, branch_id, root_location_id
    INTO v_org_id, v_branch_id, v_root_loc_id
    FROM public.warehouse_layouts
   WHERE id = p_layout_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'layout_not_found: Layout % not found', p_layout_id;
  END IF;

  -- 2. Explicit publish permission check (separate from manage).
  IF NOT public.has_branch_permission(v_org_id, v_branch_id, 'warehouse.layouts.publish') THEN
    RAISE EXCEPTION 'insufficient_permission: warehouse.layouts.publish required';
  END IF;

  -- 3. Unpublish any currently published layout for the same (org, branch, scope).
  UPDATE public.warehouse_layouts
     SET status     = 'draft',
         updated_at = now(),
         updated_by = p_user_id
   WHERE organization_id = v_org_id
     AND branch_id       = v_branch_id
     AND COALESCE(root_location_id, v_sentinel) = COALESCE(v_root_loc_id, v_sentinel)
     AND status          = 'published'
     AND deleted_at      IS NULL
     AND id              != p_layout_id;

  -- 4. Publish the target layout.
  UPDATE public.warehouse_layouts
     SET status       = 'published',
         published_at = now(),
         updated_at   = now(),
         updated_by   = p_user_id
   WHERE id         = p_layout_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'layout_not_found: Layout % not found on publish step', p_layout_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.publish_warehouse_layout IS
  'Atomically unpublishes the current scope layout and publishes the target. '
  'Requires warehouse.layouts.publish permission (checked explicitly). '
  'SECURITY DEFINER — bypasses table RLS; all writes are scoped to the resolved org/branch.';

-- ---------------------------------------------------------------------------
-- PART 3: unpublish_warehouse_layout() — SECURITY DEFINER
-- ---------------------------------------------------------------------------
-- Same rationale as publish above.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unpublish_warehouse_layout(
  p_layout_id UUID,
  p_user_id   UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    UUID;
  v_branch_id UUID;
BEGIN
  -- 1. Fetch layout (no RLS here — SECURITY DEFINER; check permissions next).
  SELECT organization_id, branch_id
    INTO v_org_id, v_branch_id
    FROM public.warehouse_layouts
   WHERE id = p_layout_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'layout_not_found: Layout % not found', p_layout_id;
  END IF;

  -- 2. Explicit publish permission check (same gate as publish).
  IF NOT public.has_branch_permission(v_org_id, v_branch_id, 'warehouse.layouts.publish') THEN
    RAISE EXCEPTION 'insufficient_permission: warehouse.layouts.publish required';
  END IF;

  -- 3. Revert to draft.
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
  'Reverts a published layout to draft. Requires warehouse.layouts.publish (same gate as publish). '
  'SECURITY DEFINER — bypasses table RLS; write is scoped to the resolved org/layout.';

-- ---------------------------------------------------------------------------
-- PART 4: batch_save_warehouse_layout_shapes() — add cross-layout ID guard
-- ---------------------------------------------------------------------------
-- Replaces the previous version. The only addition is step 2a: reject any
-- shape ID that already exists on a DIFFERENT layout (same or other org).
-- Soft-deleted shapes from another layout also block ID reuse — the ID is
-- still "owned" by that layout until hard-deleted.
-- "Restore soft-deleted shape on the SAME layout" semantics are preserved
-- because those IDs pass the layout_id = p_layout_id check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.batch_save_warehouse_layout_shapes(
  p_layout_id UUID,
  p_org_id    UUID,
  p_branch_id UUID,
  p_user_id   UUID,
  p_shapes    JSONB
)
RETURNS SETOF public.warehouse_layout_shapes
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- 1. Verify layout exists and belongs to the specified org+branch.
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_layouts
     WHERE id              = p_layout_id
       AND organization_id = p_org_id
       AND branch_id       = p_branch_id
       AND deleted_at      IS NULL
  ) THEN
    RAISE EXCEPTION 'layout_not_found: Layout % not found or does not belong to this branch', p_layout_id;
  END IF;

  -- 2a. Cross-layout ID guard: reject shape IDs that already belong to a
  --     different layout. This catches both active and soft-deleted shapes
  --     (the ID is still claimed by that layout regardless of deleted_at).
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_shapes) AS elem
     WHERE elem->>'id' IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.warehouse_layout_shapes wls
          WHERE wls.id        = (elem->>'id')::UUID
            AND wls.layout_id != p_layout_id
       )
  ) THEN
    RAISE EXCEPTION 'cross_layout_id: One or more shape IDs belong to a different layout';
  END IF;

  -- 2b. Validate every location_id in the input belongs to the same org+branch.
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
    NULL
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
  'Atomically replaces the active shape state for a layout. Validates cross-layout shape ID '
  'reuse (rejected) and cross-branch location_ids (rejected). SECURITY INVOKER.';

-- ---------------------------------------------------------------------------
-- PART 5: soft_delete_warehouse_layout() RPC
-- ---------------------------------------------------------------------------
-- Atomically soft-deletes a layout and all its shapes in one transaction,
-- eliminating the partial-delete risk of the two-step TypeScript approach
-- (shapes deleted, layout delete fails → layout active with no shapes).
--
-- SECURITY INVOKER: the calling user must hold warehouse.layouts.manage
-- (enforced by the UPDATE RLS policy on warehouse_layouts) and must be able
-- to UPDATE warehouse_layout_shapes (same manage gate via their RLS policy).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_warehouse_layout(
  p_org_id    UUID,
  p_layout_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- 1. Soft-delete all shapes for this layout.
  UPDATE public.warehouse_layout_shapes
     SET deleted_at = NOW()
   WHERE layout_id      = p_layout_id
     AND organization_id = p_org_id
     AND deleted_at      IS NULL;

  -- 2. Soft-delete the layout itself.
  UPDATE public.warehouse_layouts
     SET deleted_at = NOW()
   WHERE id              = p_layout_id
     AND organization_id = p_org_id
     AND deleted_at      IS NULL;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_warehouse_layout IS
  'Atomically soft-deletes a layout and all its shapes in one transaction. '
  'SECURITY INVOKER — RLS policies on both tables still apply.';
