-- Locations V2 Phase 1.3: split nodes for front/interior structural editors

CREATE TABLE IF NOT EXISTS public.warehouse_layout_split_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES public.warehouse_layouts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  view_context_location_id UUID NULL REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,

  parent_node_id UUID NULL REFERENCES public.warehouse_layout_split_nodes(id) ON DELETE CASCADE,
  node_kind TEXT NOT NULL CHECK (node_kind IN ('container', 'cell')),
  split_direction TEXT NULL CHECK (split_direction IN ('horizontal', 'vertical')),
  size_mode TEXT NOT NULL DEFAULT 'equal' CHECK (size_mode IN ('equal', 'ratio', 'fixed', 'auto')),
  size_value NUMERIC(10,3) NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  linked_location_id UUID NULL REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,

  calc_x_mm INTEGER,
  calc_y_mm INTEGER,
  calc_width_mm INTEGER,
  calc_height_mm INTEGER,
  calc_depth_mm INTEGER,
  cache_valid BOOLEAN NOT NULL DEFAULT false,

  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS wlsn_scope_active_idx
  ON public.warehouse_layout_split_nodes (layout_id, view_context_location_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.warehouse_layout_split_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_layout_split_nodes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wlsn_select_layout_read ON public.warehouse_layout_split_nodes;
CREATE POLICY wlsn_select_layout_read
  ON public.warehouse_layout_split_nodes FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.read')
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS wlsn_insert_layout_manage ON public.warehouse_layout_split_nodes;
CREATE POLICY wlsn_insert_layout_manage
  ON public.warehouse_layout_split_nodes FOR INSERT
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage'));

DROP POLICY IF EXISTS wlsn_update_layout_manage ON public.warehouse_layout_split_nodes;
CREATE POLICY wlsn_update_layout_manage
  ON public.warehouse_layout_split_nodes FOR UPDATE
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage'));

DROP POLICY IF EXISTS wlsn_delete_deny ON public.warehouse_layout_split_nodes;
CREATE POLICY wlsn_delete_deny
  ON public.warehouse_layout_split_nodes FOR DELETE
  USING (false);
