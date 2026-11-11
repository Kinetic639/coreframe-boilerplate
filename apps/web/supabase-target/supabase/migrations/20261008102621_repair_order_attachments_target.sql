-- Zone 3 / Phase 12: attachments (and comments) on a RepairOrder, target "workshop.repair_order".
-- Full-body copy of can_access_comment_target (same pattern as the ticket/task/kanban_card
-- migrations); the existing branches are unchanged, the new branch is added before the final
-- RETURN false. Access follows repair_orders RLS: read in the order's branch; moderation
-- (others' files, internal notes) with manage_all in that branch.

CREATE OR REPLACE FUNCTION public.can_access_comment_target(p_org_id uuid, p_target_type text, p_target_id uuid, p_action text, p_visibility text DEFAULT 'default'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_manager boolean := false;
  v_can_access boolean := false;
  v_branch_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL OR p_target_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_org_member(p_org_id) THEN
    RETURN false;
  END IF;

  IF p_target_type = 'helpdesk.ticket' THEN
    SELECT t.branch_id INTO v_branch_id
    FROM public.helpdesk_tickets t
    WHERE t.id = p_target_id AND t.org_id = p_org_id AND t.deleted_at IS NULL;

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    v_is_manager := public.has_branch_permission(p_org_id, v_branch_id, 'helpdesk.tickets.manage');

    SELECT EXISTS (
      SELECT 1
      FROM public.helpdesk_tickets t
      WHERE t.id = p_target_id
        AND t.org_id = p_org_id
        AND t.deleted_at IS NULL
        AND public.has_branch_permission(t.org_id, t.branch_id, 'helpdesk.tickets.read')
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

  IF p_target_type = 'workshop.repair_order' THEN
    SELECT r.branch_id INTO v_branch_id
    FROM public.repair_orders r
    WHERE r.id = p_target_id AND r.organization_id = p_org_id AND r.deleted_at IS NULL;

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    IF NOT public.has_branch_permission(p_org_id, v_branch_id, 'workshop.repair_orders.read') THEN
      RETURN false;
    END IF;

    v_is_manager := public.has_branch_permission(p_org_id, v_branch_id, 'workshop.repair_orders.manage_all');

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
$function$;
