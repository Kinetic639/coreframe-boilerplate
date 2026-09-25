-- Enforce planning task scope at the database boundary.
-- NULL branch_id means organization-wide and requires an organization-wide grant.
-- A non-NULL branch_id requires an effective grant for that exact branch (or an
-- organization-wide grant, as defined by has_branch_permission).

DROP POLICY IF EXISTS "planning_tasks_select" ON public.planning_tasks;
DROP POLICY IF EXISTS "planning_tasks_insert" ON public.planning_tasks;
DROP POLICY IF EXISTS "planning_tasks_update" ON public.planning_tasks;

CREATE POLICY "planning_tasks_select"
  ON public.planning_tasks
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND CASE
      WHEN branch_id IS NULL THEN public.has_permission(organization_id, 'planning.tasks.read')
      ELSE public.has_branch_permission(organization_id, branch_id, 'planning.tasks.read')
    END
  );

CREATE POLICY "planning_tasks_insert"
  ON public.planning_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND CASE
      WHEN branch_id IS NULL THEN public.has_permission(organization_id, 'planning.tasks.create')
      ELSE public.has_branch_permission(organization_id, branch_id, 'planning.tasks.create')
    END
  );

CREATE POLICY "planning_tasks_update"
  ON public.planning_tasks
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND CASE
      WHEN branch_id IS NULL THEN
        ((deleted_at IS NULL AND public.has_permission(organization_id, 'planning.tasks.update'))
          OR public.has_permission(organization_id, 'planning.tasks.delete'))
      ELSE
        ((deleted_at IS NULL AND public.has_branch_permission(organization_id, branch_id, 'planning.tasks.update'))
          OR public.has_branch_permission(organization_id, branch_id, 'planning.tasks.delete'))
    END
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND CASE
      WHEN branch_id IS NULL THEN
        ((deleted_at IS NULL AND public.has_permission(organization_id, 'planning.tasks.update'))
          OR public.has_permission(organization_id, 'planning.tasks.delete'))
      ELSE
        ((deleted_at IS NULL AND public.has_branch_permission(organization_id, branch_id, 'planning.tasks.update'))
          OR public.has_branch_permission(organization_id, branch_id, 'planning.tasks.delete'))
    END
  );
