-- Keep Kanban card activity append-only, while allowing users who can comment
-- on a board card to have their comment action recorded in the activity log.

DROP POLICY IF EXISTS "planning_kanban_card_activity_insert" ON public.planning_kanban_card_activity;
CREATE POLICY "planning_kanban_card_activity_insert" ON public.planning_kanban_card_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.read')
  );

DROP POLICY IF EXISTS "planning_kanban_card_activity_update" ON public.planning_kanban_card_activity;
CREATE POLICY "planning_kanban_card_activity_update" ON public.planning_kanban_card_activity
  FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "planning_kanban_card_activity_delete" ON public.planning_kanban_card_activity;
CREATE POLICY "planning_kanban_card_activity_delete" ON public.planning_kanban_card_activity
  FOR DELETE TO authenticated USING (false);
