CREATE TABLE public.inventory_allocation_container_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  allocation_line_id uuid NOT NULL,
  container_line_id uuid NOT NULL,
  quantity numeric(18,6) NOT NULL CHECK (quantity > 0),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT inventory_allocation_container_links_branch_org_fk
    FOREIGN KEY (branch_id, organization_id) REFERENCES public.branches(id, organization_id),
  CONSTRAINT inventory_allocation_container_links_alloc_fk
    FOREIGN KEY (allocation_line_id, organization_id, branch_id)
    REFERENCES public.inventory_allocation_lines(id, organization_id, branch_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_allocation_container_links_container_fk
    FOREIGN KEY (container_line_id, organization_id, branch_id)
    REFERENCES public.inventory_container_lines(id, organization_id, branch_id) ON DELETE RESTRICT
);

CREATE INDEX inventory_allocation_container_links_alloc_idx
  ON public.inventory_allocation_container_links (organization_id, branch_id, allocation_line_id)
  WHERE deleted_at IS NULL;

CREATE INDEX inventory_allocation_container_links_container_idx
  ON public.inventory_allocation_container_links (organization_id, branch_id, container_line_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.inventory_allocation_container_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_allocation_container_links FORCE ROW LEVEL SECURITY;

CREATE POLICY inventory_allocation_container_links_select ON public.inventory_allocation_container_links
  FOR SELECT USING (deleted_at IS NULL AND has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));

CREATE POLICY inventory_allocation_container_links_insert_deny ON public.inventory_allocation_container_links
  FOR INSERT WITH CHECK (false);
