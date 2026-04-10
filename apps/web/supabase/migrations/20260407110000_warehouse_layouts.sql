-- =============================================================================
-- Migration: warehouse_layouts + warehouse_layout_shapes
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Warehouse V2 Phase 2 — Visual Layout Manager
-- =============================================================================
-- Scope:
--   1. Permission rows (warehouse.layouts.read, .manage, .publish)
--   2. Role-permission seeding
--      - org_owner  → covered by existing warehouse.* wildcard (no new rows needed)
--      - org_member → warehouse.layouts.read (can view published maps)
--   3. warehouse_layouts table — named map documents, one per visual scope
--   4. warehouse_layout_shapes table — individual canvas elements (flat, v1)
--   5. Indexes
--   6. updated_at triggers
--   7. RLS policies (branch-aware, consistent with warehouse_locations)
--   8. publish_warehouse_layout() RPC — atomic unpublish-other + publish-this
--
-- Design decisions (v1):
--   - Shapes are FLAT per layout (no parent_shape_id). Nesting is explicitly
--     deferred to a later phase. This is intentional to keep the editor simple.
--   - x, y, width, height, rotation are explicit numeric columns (not JSONB)
--     for easier validation, indexing, and future constraint additions.
--   - style is JSONB — it is a flexible display bag (fill, stroke, opacity, etc.)
--     that does not need to be queried/indexed by individual fields.
--   - organization_id + branch_id are denormalized onto shapes so that
--     branch-aware RLS can run without a JOIN to the parent layout row.
--   - One published layout per (org, branch, root_location_id) scope is
--     enforced by a partial unique index using COALESCE with a sentinel UUID
--     to handle the NULL = "whole branch" case correctly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Permission rows
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('warehouse.layouts.read',    'Warehouse Layouts Read',    'warehouse', 'layouts.read'),
  ('warehouse.layouts.manage',  'Warehouse Layouts Manage',  'warehouse', 'layouts.manage'),
  ('warehouse.layouts.publish', 'Warehouse Layouts Publish', 'warehouse', 'layouts.publish')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 2: Role-permission seeding
-- ---------------------------------------------------------------------------
-- org_owner already has warehouse.* wildcard → compiler auto-expands to
-- warehouse.layouts.read, warehouse.layouts.manage, warehouse.layouts.publish.
-- Do NOT add granular grants for org_owner — would cause Postgres error 21000
-- (ON CONFLICT DO UPDATE hitting the same permission_slug_exact row twice).
--
-- org_member gets warehouse.layouts.read only:
--   can view published maps, cannot edit or publish.
DO $$
DECLARE
  v_member_id UUID;
  v_perm_id   UUID;
BEGIN
  SELECT id INTO v_member_id FROM public.roles WHERE name = 'org_member' AND is_basic = true LIMIT 1;

  SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.layouts.read';
  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES (v_member_id, v_perm_id) ON CONFLICT DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- PART 3: warehouse_layouts table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouse_layouts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        UUID        NOT NULL REFERENCES public.branches(id)      ON DELETE CASCADE,

  -- root_location_id scopes the layout to a specific sub-area (floor, room, zone).
  -- NULL means "whole branch" — a top-level layout for the entire branch warehouse.
  -- Multiple layouts can reference the same root_location_id, but only one
  -- may be published at a time per (org, branch, root_location_id) scope
  -- (enforced by wll_one_published_per_scope_idx below).
  root_location_id UUID        NULL REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,

  name             TEXT        NOT NULL,
  description      TEXT        NULL,

  status           TEXT        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published')),

  -- Canvas dimensions in meters. Editors use these to set the stage size.
  canvas_width_m   FLOAT       NOT NULL DEFAULT 50 CHECK (canvas_width_m  > 0),
  canvas_height_m  FLOAT       NOT NULL DEFAULT 30 CHECK (canvas_height_m > 0),

  published_at     TIMESTAMPTZ NULL,
  created_by       UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by       UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ NULL,

  CONSTRAINT wll_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE  public.warehouse_layouts IS 'Named visual map documents for a branch. Separate from operational warehouse_locations hierarchy.';
COMMENT ON COLUMN public.warehouse_layouts.root_location_id IS 'Scopes this layout to a sub-area. NULL = whole-branch layout. One published layout allowed per (org, branch, root_location_id) scope.';
COMMENT ON COLUMN public.warehouse_layouts.status           IS 'draft = work in progress; published = the canonical map shown to all users for this scope.';

-- ---------------------------------------------------------------------------
-- PART 4: warehouse_layout_shapes table
-- ---------------------------------------------------------------------------
-- V1 DESIGN NOTE: shapes are intentionally FLAT (no parent_shape_id).
-- Hierarchical shape nesting (e.g. rooms containing racks) is deferred to v2.
-- If nesting is added later, a parent_shape_id FK will be introduced here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouse_layout_shapes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id       UUID        NOT NULL REFERENCES public.warehouse_layouts(id) ON DELETE CASCADE,

  -- Denormalized for branch-aware RLS (avoids JOIN to parent layout in policies).
  -- Must always equal the parent layout's organization_id and branch_id.
  -- Enforced at the application layer (service) and by FK constraints below.
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id)      ON DELETE CASCADE,

  shape_type      TEXT        NOT NULL
                  CHECK (shape_type IN (
                    'location',   -- links to a warehouse_locations row (location_id required)
                    'wall',       -- structural wall segment
                    'door',       -- opening / doorway
                    'aisle',      -- walkway / navigation corridor
                    'zone',       -- named area (staging, receiving, dispatch)
                    'obstacle',   -- column, pillar, fixed equipment
                    'label'       -- free text annotation
                  )),

  -- Populated only when shape_type = 'location'.
  -- SET NULL on location delete so the shape becomes an orphaned placeholder
  -- (rather than cascade-deleting the visual history with the location).
  location_id     UUID        NULL REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,

  -- Display label. For location shapes this falls back to the linked location's name.
  -- For structural shapes (wall, door, aisle) this is typically NULL.
  label           TEXT        NULL,

  -- Geometry — explicit numeric columns (not JSONB) for validation + future indexing.
  -- All values are in meters, relative to the layout canvas origin (top-left = 0,0).
  x               FLOAT       NOT NULL DEFAULT 0,
  y               FLOAT       NOT NULL DEFAULT 0,
  width           FLOAT       NOT NULL DEFAULT 1 CHECK (width  > 0),
  height          FLOAT       NOT NULL DEFAULT 1 CHECK (height > 0),
  rotation        FLOAT       NOT NULL DEFAULT 0,  -- degrees, clockwise

  -- Flexible display properties (fill, stroke, opacity, cornerRadius, fontSize, etc.)
  -- JSONB is appropriate here: these fields are never individually queried/indexed.
  style           JSONB       NULL,

  z_index         INTEGER     NOT NULL DEFAULT 0,
  sort_order      INTEGER     NOT NULL DEFAULT 0,

  created_by      UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ NULL,

  -- A location may appear at most once per layout (ignoring soft-deleted shapes).
  -- Non-location shapes (wall, door, etc.) are exempt — location_id IS NULL for them.
  CONSTRAINT wls_location_id_when_location_type CHECK (
    (shape_type = 'location' AND location_id IS NOT NULL) OR
    (shape_type != 'location' AND location_id IS NULL)
  )
);

COMMENT ON TABLE  public.warehouse_layout_shapes IS 'Individual canvas elements on a warehouse layout. V1: flat (no nesting). shape_type=location links to operational warehouse_locations.';
COMMENT ON COLUMN public.warehouse_layout_shapes.x         IS 'Horizontal position in meters from layout canvas origin (top-left).';
COMMENT ON COLUMN public.warehouse_layout_shapes.y         IS 'Vertical position in meters from layout canvas origin (top-left).';
COMMENT ON COLUMN public.warehouse_layout_shapes.rotation  IS 'Clockwise rotation in degrees.';
COMMENT ON COLUMN public.warehouse_layout_shapes.style     IS 'Display bag: { fill, fillOpacity, stroke, strokeWidth, cornerRadius, fontSize, fontWeight, textColor }.';
COMMENT ON COLUMN public.warehouse_layout_shapes.location_id IS 'Populated only for shape_type=location. SET NULL (not CASCADE) on location delete to preserve layout visual history.';

-- ---------------------------------------------------------------------------
-- PART 5: Indexes
-- ---------------------------------------------------------------------------

-- warehouse_layouts

CREATE INDEX IF NOT EXISTS wll_org_branch_active_idx
  ON public.warehouse_layouts (organization_id, branch_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wll_branch_root_active_idx
  ON public.warehouse_layouts (branch_id, root_location_id)
  WHERE deleted_at IS NULL;

-- One published layout per (org, branch, root_location_id) scope.
-- COALESCE maps NULL root_location_id to a sentinel UUID so that two
-- "whole-branch" layouts cannot both be published simultaneously.
-- (PostgreSQL NULL != NULL in unique indexes without NULLS NOT DISTINCT,
--  which would falsely allow duplicate whole-branch published layouts.)
CREATE UNIQUE INDEX IF NOT EXISTS wll_one_published_per_scope_idx
  ON public.warehouse_layouts (
    organization_id,
    branch_id,
    COALESCE(root_location_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status = 'published' AND deleted_at IS NULL;

-- warehouse_layout_shapes

CREATE INDEX IF NOT EXISTS wls_layout_active_idx
  ON public.warehouse_layout_shapes (layout_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wls_org_branch_active_idx
  ON public.warehouse_layout_shapes (organization_id, branch_id)
  WHERE deleted_at IS NULL;

-- Fast "find all layouts this location appears on"
CREATE INDEX IF NOT EXISTS wls_location_id_idx
  ON public.warehouse_layout_shapes (location_id)
  WHERE location_id IS NOT NULL AND deleted_at IS NULL;

-- One location shape per layout (active shapes only)
CREATE UNIQUE INDEX IF NOT EXISTS wls_location_unique_per_layout_idx
  ON public.warehouse_layout_shapes (layout_id, location_id)
  WHERE location_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- PART 6: updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS warehouse_layouts_updated_at ON public.warehouse_layouts;
    CREATE TRIGGER warehouse_layouts_updated_at
      BEFORE UPDATE ON public.warehouse_layouts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    DROP TRIGGER IF EXISTS warehouse_layout_shapes_updated_at ON public.warehouse_layout_shapes;
    CREATE TRIGGER warehouse_layout_shapes_updated_at
      BEFORE UPDATE ON public.warehouse_layout_shapes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PART 7: Row Level Security
-- ---------------------------------------------------------------------------

-- ── warehouse_layouts ────────────────────────────────────────────────────────
ALTER TABLE public.warehouse_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_layouts FORCE ROW LEVEL SECURITY;

-- SELECT: requires warehouse.layouts.read for this branch (or org-wide)
DROP POLICY IF EXISTS wll_select_layouts_read ON public.warehouse_layouts;
CREATE POLICY wll_select_layouts_read
  ON public.warehouse_layouts FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.read')
    AND deleted_at IS NULL
  );

-- INSERT: requires warehouse.layouts.manage
DROP POLICY IF EXISTS wll_insert_manage ON public.warehouse_layouts;
CREATE POLICY wll_insert_manage
  ON public.warehouse_layouts FOR INSERT
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

-- UPDATE: USING + WITH CHECK both require warehouse.layouts.manage
-- (publish uses an RPC that checks warehouse.layouts.publish separately)
DROP POLICY IF EXISTS wll_update_manage ON public.warehouse_layouts;
CREATE POLICY wll_update_manage
  ON public.warehouse_layouts FOR UPDATE
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

-- DELETE: blocked — all deletes must go through soft-delete (UPDATE deleted_at)
DROP POLICY IF EXISTS wll_delete_deny ON public.warehouse_layouts;
CREATE POLICY wll_delete_deny
  ON public.warehouse_layouts FOR DELETE
  USING (false);

-- ── warehouse_layout_shapes ──────────────────────────────────────────────────
ALTER TABLE public.warehouse_layout_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_layout_shapes FORCE ROW LEVEL SECURITY;

-- SELECT: requires warehouse.layouts.read for this branch (uses denormalized branch_id)
DROP POLICY IF EXISTS wls_select_layouts_read ON public.warehouse_layout_shapes;
CREATE POLICY wls_select_layouts_read
  ON public.warehouse_layout_shapes FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.read')
    AND deleted_at IS NULL
  );

-- INSERT: requires warehouse.layouts.manage
DROP POLICY IF EXISTS wls_insert_manage ON public.warehouse_layout_shapes;
CREATE POLICY wls_insert_manage
  ON public.warehouse_layout_shapes FOR INSERT
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

-- UPDATE: requires warehouse.layouts.manage
DROP POLICY IF EXISTS wls_update_manage ON public.warehouse_layout_shapes;
CREATE POLICY wls_update_manage
  ON public.warehouse_layout_shapes FOR UPDATE
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

-- DELETE: blocked — soft-delete only
DROP POLICY IF EXISTS wls_delete_deny ON public.warehouse_layout_shapes;
CREATE POLICY wls_delete_deny
  ON public.warehouse_layout_shapes FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- PART 8: publish_warehouse_layout() RPC
-- ---------------------------------------------------------------------------
-- Atomically unpublishes any currently published layout for the same scope,
-- then publishes the target layout. Runs a single permission check inside
-- the function (warehouse.layouts.publish) so the caller does not need to
-- hold warehouse.layouts.manage — publish is a deliberately separate gate.
--
-- SECURITY INVOKER: runs as the calling user, so all table-level RLS policies
-- still apply. The function's own permission check is additive.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_warehouse_layout(
  p_layout_id UUID,
  p_user_id   UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_org_id      UUID;
  v_branch_id   UUID;
  v_root_loc_id UUID;
  -- Sentinel UUID used as the COALESCE target for NULL root_location_id.
  -- Matches the value used in wll_one_published_per_scope_idx.
  v_sentinel    UUID := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  -- 1. Fetch the target layout (RLS SELECT policy applies — caller must be able to read it)
  SELECT organization_id, branch_id, root_location_id
    INTO v_org_id, v_branch_id, v_root_loc_id
    FROM public.warehouse_layouts
   WHERE id = p_layout_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'layout_not_found: Layout % not found or access denied', p_layout_id;
  END IF;

  -- 2. Explicit publish permission check (separate from manage)
  IF NOT public.has_branch_permission(v_org_id, v_branch_id, 'warehouse.layouts.publish') THEN
    RAISE EXCEPTION 'insufficient_permission: warehouse.layouts.publish required';
  END IF;

  -- 3. Unpublish any currently published layout for the same (org, branch, scope).
  --    Done before publishing the target to avoid hitting the unique index.
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

  -- 4. Publish the target layout
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
  'Atomically unpublishes any currently published layout for the same scope, then publishes the target. Requires warehouse.layouts.publish permission. SECURITY INVOKER — RLS policies still apply.';
