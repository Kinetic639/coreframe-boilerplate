-- Harden stock-audit RLS so audit sessions and lines cannot be hard-deleted.
--
-- The previous manage policies were FOR ALL, which also permitted DELETE for
-- users with warehouse.audits.manage. Audit/count records are inventory
-- history, so they must be retained; state changes should happen through
-- updates such as status='cancelled', never through hard deletes.

DROP POLICY IF EXISTS inventory_count_sessions_manage ON public.inventory_count_sessions;
DROP POLICY IF EXISTS inventory_count_sessions_insert ON public.inventory_count_sessions;
DROP POLICY IF EXISTS inventory_count_sessions_update ON public.inventory_count_sessions;
DROP POLICY IF EXISTS inventory_count_sessions_delete_deny ON public.inventory_count_sessions;

CREATE POLICY inventory_count_sessions_insert
  ON public.inventory_count_sessions FOR INSERT
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'));

CREATE POLICY inventory_count_sessions_update
  ON public.inventory_count_sessions FOR UPDATE
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'));

CREATE POLICY inventory_count_sessions_delete_deny
  ON public.inventory_count_sessions FOR DELETE
  USING (false);

DROP POLICY IF EXISTS inventory_count_lines_manage ON public.inventory_count_lines;
DROP POLICY IF EXISTS inventory_count_lines_insert ON public.inventory_count_lines;
DROP POLICY IF EXISTS inventory_count_lines_update ON public.inventory_count_lines;
DROP POLICY IF EXISTS inventory_count_lines_delete_deny ON public.inventory_count_lines;

CREATE POLICY inventory_count_lines_insert
  ON public.inventory_count_lines FOR INSERT
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'));

CREATE POLICY inventory_count_lines_update
  ON public.inventory_count_lines FOR UPDATE
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'));

CREATE POLICY inventory_count_lines_delete_deny
  ON public.inventory_count_lines FOR DELETE
  USING (false);
