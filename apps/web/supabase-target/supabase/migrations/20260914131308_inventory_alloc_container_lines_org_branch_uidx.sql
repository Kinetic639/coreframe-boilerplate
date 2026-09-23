CREATE UNIQUE INDEX inventory_allocation_lines_org_branch_id_uidx ON public.inventory_allocation_lines (id, organization_id, branch_id);
CREATE UNIQUE INDEX inventory_container_lines_org_branch_id_uidx ON public.inventory_container_lines (id, organization_id, branch_id);
