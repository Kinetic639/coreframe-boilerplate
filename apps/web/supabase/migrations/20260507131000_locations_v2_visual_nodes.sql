-- Locations V2 Phase 1.2: visual nodes table (separate from inventory entities)

CREATE TABLE IF NOT EXISTS public.warehouse_location_visual_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES public.warehouse_layouts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

  location_id UUID NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT,
  view_type TEXT NOT NULL CHECK (view_type IN ('top_down', 'front', 'interior')),
  view_context_location_id UUID NULL REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
  visualization_type TEXT NOT NULL DEFAULT 'rectangle' CHECK (visualization_type IN ('rectangle','cabinet','rack','grid','drawer','bin','zone','custom')),
  visual_role TEXT NOT NULL DEFAULT 'primary' CHECK (visual_role IN ('primary','label','reference','aggregate')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'historical')),

  x_mm INTEGER NOT NULL DEFAULT 0,
  y_mm INTEGER NOT NULL DEFAULT 0,
  z_mm INTEGER NOT NULL DEFAULT 0,
  width_mm INTEGER NOT NULL CHECK (width_mm > 0),
  height_mm INTEGER NOT NULL CHECK (height_mm > 0),
  depth_mm INTEGER NOT NULL CHECK (depth_mm > 0),

  rotation_deg NUMERIC(8,2) NOT NULL DEFAULT 0,
  style JSONB,
  z_index INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- NOTE: uniqueness applies to active PRIMARY nodes only.
CREATE UNIQUE INDEX IF NOT EXISTS wlvn_primary_unique_idx
  ON public.warehouse_location_visual_nodes (
    location_id,
    view_type,
    COALESCE(layout_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(view_context_location_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL
    AND status = 'active'
    AND visual_role = 'primary';

CREATE INDEX IF NOT EXISTS wlvn_scope_active_idx
  ON public.warehouse_location_visual_nodes (layout_id, view_type, view_context_location_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.warehouse_location_visual_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_location_visual_nodes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wlvn_select_layout_read ON public.warehouse_location_visual_nodes;
CREATE POLICY wlvn_select_layout_read
  ON public.warehouse_location_visual_nodes FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.read')
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS wlvn_insert_layout_manage ON public.warehouse_location_visual_nodes;
CREATE POLICY wlvn_insert_layout_manage
  ON public.warehouse_location_visual_nodes FOR INSERT
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage'));

DROP POLICY IF EXISTS wlvn_update_layout_manage ON public.warehouse_location_visual_nodes;
CREATE POLICY wlvn_update_layout_manage
  ON public.warehouse_location_visual_nodes FOR UPDATE
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage'));

DROP POLICY IF EXISTS wlvn_delete_deny ON public.warehouse_location_visual_nodes;
CREATE POLICY wlvn_delete_deny
  ON public.warehouse_location_visual_nodes FOR DELETE
  USING (false);
