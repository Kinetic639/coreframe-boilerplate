-- =============================================================================
-- Planning boards: favourites (the star on a board)
--
-- Each person stars the boards they use most. A star is private to its
-- owner: nobody else sees or changes it. It can only be put on a board the
-- person can see, and it goes away with the board (ON DELETE CASCADE).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.planning_kanban_board_stars (
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  board_id        UUID        NOT NULL REFERENCES public.planning_kanban_boards(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, board_id)
);

CREATE INDEX IF NOT EXISTS planning_kanban_board_stars_org_user_idx
  ON public.planning_kanban_board_stars (organization_id, user_id);

ALTER TABLE public.planning_kanban_board_stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_kanban_board_stars FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_kanban_board_stars_select" ON public.planning_kanban_board_stars;
CREATE POLICY "planning_kanban_board_stars_select" ON public.planning_kanban_board_stars
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "planning_kanban_board_stars_insert" ON public.planning_kanban_board_stars;
CREATE POLICY "planning_kanban_board_stars_insert" ON public.planning_kanban_board_stars
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_permission(organization_id, 'planning.boards.read')
    AND public.can_view_planning_board(board_id)
    AND EXISTS (
      SELECT 1
      FROM public.planning_kanban_boards b
      WHERE b.id = board_id
        AND b.organization_id = planning_kanban_board_stars.organization_id
    )
  );

DROP POLICY IF EXISTS "planning_kanban_board_stars_delete" ON public.planning_kanban_board_stars;
CREATE POLICY "planning_kanban_board_stars_delete" ON public.planning_kanban_board_stars
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.planning_kanban_board_stars TO authenticated;
