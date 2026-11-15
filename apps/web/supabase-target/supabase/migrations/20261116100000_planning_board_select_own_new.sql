-- =============================================================================
-- Planning: creating a board failed with "new row violates row-level security
-- policy for table planning_kanban_boards".
--
-- The insert returns the new row (INSERT ... RETURNING), so the SELECT policy
-- is checked on it too. That policy asked can_view_planning_board(id), which
-- looks the board up in the table and cannot see a row the same statement is
-- still inserting, so it said no. The owner check now reads the row's own
-- created_by first; the helper is only asked about boards that already exist.
-- =============================================================================

DROP POLICY IF EXISTS "planning_kanban_boards_select" ON public.planning_kanban_boards;
CREATE POLICY "planning_kanban_boards_select" ON public.planning_kanban_boards
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.read')
    AND (created_by = auth.uid() OR public.can_view_planning_board(id))
  );

DROP POLICY IF EXISTS "planning_kanban_boards_update" ON public.planning_kanban_boards;
CREATE POLICY "planning_kanban_boards_update" ON public.planning_kanban_boards
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND (created_by = auth.uid() OR public.can_edit_planning_board(id))
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND (created_by = auth.uid() OR public.can_edit_planning_board(id))
  );
