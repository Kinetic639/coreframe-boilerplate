-- =============================================================================
-- Planning: the same read rules, checked once per query instead of per row.
--
-- The read policies of tasks, boards and their child tables called
-- is_org_member, has_permission, has_branch_permission and
-- can_view_planning_board for every row. Those are SECURITY DEFINER functions,
-- so Postgres cannot inline them: each row paid for several lookups. Measured
-- on a 26-card board: 85 ms with RLS, 4 ms without.
--
-- Here each rule becomes a small set ("my organizations", "organizations
-- where I hold this permission", "boards I can see"), computed once per query
-- (Postgres runs `x = ANY (ARRAY(SELECT f()))` as an InitPlan) and compared
-- per row. Who sees what does not change:
--   * planning_my_board_ids() is planning_board_access() IS NOT NULL written
--     as a set: same organization check, owner, member, organization
--     visibility, branch visibility with planning.boards.read.
--   * has_branch_permission(org, branch, p) is "org-wide grant OR a grant for
--     that exact org and branch", the two sets below.
--   * Child tables (labels, checklists, watchers, ...) used
--     can_read_planning_task(id), a SQL function whose body is an EXISTS on
--     planning_tasks under its RLS. The body is now written into the policy,
--     so the planner can join it instead of calling a function per row.
-- Write rules (WITH CHECK, UPDATE/DELETE policies) are not touched.
--
-- Checked before writing: for every user, the old functions and the new sets
-- give the same boards (view and edit) and the same tasks.
-- =============================================================================

-- Organizations where I am an active member (is_org_member).
CREATE OR REPLACE FUNCTION public.planning_my_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = auth.uid()
    AND om.status = 'active'
    AND om.deleted_at IS NULL;
$$;

-- Organizations where I hold a permission org-wide (has_permission).
CREATE OR REPLACE FUNCTION public.planning_my_permission_org_ids(p_permission text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT p.organization_id
  FROM public.user_effective_permissions p
  WHERE p.user_id = auth.uid()
    AND p.permission_slug_exact = p_permission
    AND p.branch_id IS NULL;
$$;

-- "<org>:<branch>" pairs where I hold a permission for one branch
-- (the branch half of has_branch_permission).
CREATE OR REPLACE FUNCTION public.planning_my_permission_branch_keys(p_permission text)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT p.organization_id::text || ':' || p.branch_id::text
  FROM public.user_effective_permissions p
  WHERE p.user_id = auth.uid()
    AND p.permission_slug_exact = p_permission
    AND p.branch_id IS NOT NULL;
$$;

-- Boards I can see (can_view_planning_board, i.e. planning_board_access IS NOT NULL).
CREATE OR REPLACE FUNCTION public.planning_my_board_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT b.id
  FROM public.planning_kanban_boards b
  WHERE auth.uid() IS NOT NULL
    AND b.organization_id IN (SELECT public.planning_my_org_ids())
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.planning_kanban_board_members m
        WHERE m.board_id = b.id AND m.user_id = auth.uid()
      )
      OR b.visibility = 'organization'
      OR (
        b.visibility = 'branch'
        AND b.branch_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.user_effective_permissions p
          WHERE p.user_id = auth.uid()
            AND p.organization_id = b.organization_id
            AND p.permission_slug_exact = 'planning.boards.read'
            AND (p.branch_id IS NULL OR p.branch_id = b.branch_id)
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.planning_my_org_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.planning_my_permission_org_ids(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.planning_my_permission_branch_keys(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.planning_my_board_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_my_org_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.planning_my_permission_org_ids(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.planning_my_permission_branch_keys(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.planning_my_board_ids() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

-- was: is_org_member(organization_id) AND CASE WHEN branch_id IS NULL
--   THEN has_permission(organization_id, 'planning.tasks.read')
--   ELSE has_branch_permission(organization_id, branch_id, 'planning.tasks.read') END
ALTER POLICY planning_tasks_select ON public.planning_tasks
  USING (
    organization_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND (
      organization_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('planning.tasks.read')))
      OR (
        branch_id IS NOT NULL
        AND (organization_id::text || ':' || branch_id::text)
          = ANY (ARRAY(SELECT public.planning_my_permission_branch_keys('planning.tasks.read')))
      )
    )
  );

-- was: ((NOT is_inbox) OR (created_by = auth.uid()))
--   AND ((board_id IS NULL) OR can_view_planning_board(board_id))
-- (WITH CHECK, which needs edit rights on the board, stays as it is.)
ALTER POLICY planning_tasks_placement_visibility ON public.planning_tasks
  USING (
    ((NOT is_inbox) OR created_by = (SELECT auth.uid()))
    AND (board_id IS NULL OR board_id = ANY (ARRAY(SELECT public.planning_my_board_ids())))
  );

-- ---------------------------------------------------------------------------
-- Boards and what hangs on them
-- ---------------------------------------------------------------------------

-- was: is_org_member(organization_id) AND has_permission(organization_id, 'planning.boards.read')
--   AND ((created_by = auth.uid()) OR can_view_planning_board(id))
ALTER POLICY planning_kanban_boards_select ON public.planning_kanban_boards
  USING (
    organization_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND organization_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('planning.boards.read')))
    AND (created_by = (SELECT auth.uid()) OR id = ANY (ARRAY(SELECT public.planning_my_board_ids())))
  );

-- was: EXISTS (board in the same organization) AND has_permission(organization_id,
--   'planning.boards.read') AND can_view_planning_board(board_id)
ALTER POLICY planning_kanban_columns_select ON public.planning_kanban_columns
  USING (
    EXISTS (
      SELECT 1 FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_columns.board_id
        AND b.organization_id = planning_kanban_columns.organization_id
    )
    AND organization_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('planning.boards.read')))
    AND board_id = ANY (ARRAY(SELECT public.planning_my_board_ids()))
  );

-- was: the same as columns, on the legacy cards table
ALTER POLICY planning_kanban_cards_select ON public.planning_kanban_cards
  USING (
    EXISTS (
      SELECT 1 FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_cards.board_id
        AND b.organization_id = planning_kanban_cards.organization_id
    )
    AND organization_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('planning.boards.read')))
    AND board_id = ANY (ARRAY(SELECT public.planning_my_board_ids()))
  );

-- was: has_permission(organization_id, 'planning.boards.read') AND can_view_planning_board(board_id)
ALTER POLICY planning_kanban_board_labels_select ON public.planning_kanban_board_labels
  USING (
    organization_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('planning.boards.read')))
    AND board_id = ANY (ARRAY(SELECT public.planning_my_board_ids()))
  );

-- was: has_permission(organization_id, 'planning.boards.read') AND can_view_planning_board(board_id)
ALTER POLICY planning_kanban_board_members_select ON public.planning_kanban_board_members
  USING (
    organization_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('planning.boards.read')))
    AND board_id = ANY (ARRAY(SELECT public.planning_my_board_ids()))
  );

-- was: can_view_planning_board(board_id)
ALTER POLICY planning_board_custom_fields_select ON public.planning_board_custom_fields
  USING (board_id = ANY (ARRAY(SELECT public.planning_my_board_ids())));

-- ---------------------------------------------------------------------------
-- Task child tables: can_read_planning_task(x) written out
-- (its body: EXISTS a live task with that id, under planning_tasks RLS)
-- ---------------------------------------------------------------------------

ALTER POLICY planning_task_checklist_items_select ON public.planning_task_checklist_items
  USING (EXISTS (
    SELECT 1 FROM public.planning_tasks t
    WHERE t.id = planning_task_checklist_items.task_id AND t.deleted_at IS NULL
  ));

ALTER POLICY planning_task_checklists_select ON public.planning_task_checklists
  USING (EXISTS (
    SELECT 1 FROM public.planning_tasks t
    WHERE t.id = planning_task_checklists.task_id AND t.deleted_at IS NULL
  ));

ALTER POLICY planning_task_custom_field_values_select ON public.planning_task_custom_field_values
  USING (EXISTS (
    SELECT 1 FROM public.planning_tasks t
    WHERE t.id = planning_task_custom_field_values.task_id AND t.deleted_at IS NULL
  ));

ALTER POLICY planning_task_labels_select ON public.planning_task_labels
  USING (EXISTS (
    SELECT 1 FROM public.planning_tasks t
    WHERE t.id = planning_task_labels.task_id AND t.deleted_at IS NULL
  ));

ALTER POLICY planning_task_watchers_select ON public.planning_task_watchers
  USING (EXISTS (
    SELECT 1 FROM public.planning_tasks t
    WHERE t.id = planning_task_watchers.task_id AND t.deleted_at IS NULL
  ));

-- was: can_read_planning_task(task_id) OR can_read_planning_task(depends_on_task_id)
ALTER POLICY planning_task_dependencies_select ON public.planning_task_dependencies
  USING (EXISTS (
    SELECT 1 FROM public.planning_tasks t
    WHERE t.id IN (planning_task_dependencies.task_id, planning_task_dependencies.depends_on_task_id)
      AND t.deleted_at IS NULL
  ));
