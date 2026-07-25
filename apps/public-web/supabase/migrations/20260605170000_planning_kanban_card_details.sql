-- ===========================================================================
-- Planning Kanban card details
-- ===========================================================================

ALTER TABLE public.planning_kanban_cards
  ADD COLUMN IF NOT EXISTS description_rich JSONB;

CREATE TABLE IF NOT EXISTS public.planning_kanban_card_activity (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id        UUID        NOT NULL REFERENCES public.planning_kanban_boards(id) ON DELETE CASCADE,
  card_id         UUID        NOT NULL REFERENCES public.planning_kanban_cards(id) ON DELETE CASCADE,
  actor_id        UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  activity_type   TEXT        NOT NULL,
  message         TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planning_kanban_card_activity_card_idx
  ON public.planning_kanban_card_activity (card_id, created_at DESC);

CREATE INDEX IF NOT EXISTS planning_kanban_card_activity_org_idx
  ON public.planning_kanban_card_activity (organization_id, created_at DESC);

ALTER TABLE public.planning_kanban_card_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_kanban_card_activity_select" ON public.planning_kanban_card_activity;
CREATE POLICY "planning_kanban_card_activity_select" ON public.planning_kanban_card_activity
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.read')
  );

DROP POLICY IF EXISTS "planning_kanban_card_activity_insert" ON public.planning_kanban_card_activity;
CREATE POLICY "planning_kanban_card_activity_insert" ON public.planning_kanban_card_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.update')
  );

CREATE OR REPLACE FUNCTION public.can_access_comment_target(
  p_org_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_visibility text DEFAULT 'default'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_manager boolean := false;
  v_can_access boolean := false;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL OR p_target_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_org_member(p_org_id) THEN
    RETURN false;
  END IF;

  IF p_target_type = 'helpdesk.ticket' THEN
    v_is_manager := public.has_permission(p_org_id, 'helpdesk.tickets.manage');

    SELECT EXISTS (
      SELECT 1
      FROM public.helpdesk_tickets t
      WHERE t.id = p_target_id
        AND t.org_id = p_org_id
        AND t.deleted_at IS NULL
        AND public.has_permission(t.org_id, 'helpdesk.tickets.read')
        AND (
          t.created_by = auth.uid()
          OR v_is_manager
          OR EXISTS (
            SELECT 1
            FROM public.helpdesk_ticket_assignees a
            WHERE a.ticket_id = t.id
              AND a.user_id = auth.uid()
              AND a.deleted_at IS NULL
          )
        )
    )
    INTO v_can_access;

    IF NOT v_can_access THEN
      RETURN false;
    END IF;

    IF p_visibility = 'internal' AND NOT v_is_manager THEN
      RETURN false;
    END IF;

    IF p_action = 'moderate' THEN
      RETURN v_is_manager;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  IF p_target_type = 'planning.task' THEN
    v_is_manager := public.has_permission(p_org_id, 'planning.tasks.update');

    SELECT EXISTS (
      SELECT 1
      FROM public.planning_tasks t
      WHERE t.id = p_target_id
        AND t.organization_id = p_org_id
        AND t.deleted_at IS NULL
        AND public.has_permission(t.organization_id, 'planning.tasks.read')
    )
    INTO v_can_access;

    IF NOT v_can_access THEN
      RETURN false;
    END IF;

    IF p_visibility = 'internal' AND NOT v_is_manager THEN
      RETURN false;
    END IF;

    IF p_action = 'moderate' THEN
      RETURN v_is_manager;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  IF p_target_type = 'planning.kanban_card' THEN
    v_is_manager := public.has_permission(p_org_id, 'planning.boards.update');

    SELECT EXISTS (
      SELECT 1
      FROM public.planning_kanban_cards c
      JOIN public.planning_kanban_boards b ON b.id = c.board_id
      WHERE c.id = p_target_id
        AND c.organization_id = p_org_id
        AND b.organization_id = p_org_id
        AND c.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND public.has_permission(c.organization_id, 'planning.boards.read')
    )
    INTO v_can_access;

    IF NOT v_can_access THEN
      RETURN false;
    END IF;

    IF p_visibility = 'internal' AND NOT v_is_manager THEN
      RETURN false;
    END IF;

    IF p_action = 'moderate' THEN
      RETURN v_is_manager;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_comment_target(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_comment_target(uuid, text, uuid, text, text) TO authenticated;
