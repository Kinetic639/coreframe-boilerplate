-- Ambra Zapytania (apps/requests-portal), step 5a -- docs/REQUESTS_PORTAL_PLAN.md D3, D4, D8.
--
-- Help Desk permissions become branch-aware for tickets that carry a branch_id:
-- has_branch_permission(org, branch, slug) accepts an org-wide grant OR a grant for that
-- exact branch, and for branch_id IS NULL it is identical to has_permission. So every
-- user who has access today keeps it; a role granted on a branch now also counts for
-- that branch's tickets ("Obsługa zapytań" on CNP Poznań handles only CNP Poznań).
--
-- Additive only: ALTER POLICY / CREATE OR REPLACE, nothing dropped.

-- ---------------------------------------------------------------------------
-- 1. helpdesk_tickets (D3)
-- ---------------------------------------------------------------------------

ALTER POLICY "helpdesk_tickets_select" ON public.helpdesk_tickets
  USING (
    public.is_org_member(org_id)
    AND public.has_branch_permission(org_id, branch_id, 'helpdesk.tickets.read')
  );

ALTER POLICY "helpdesk_tickets_insert" ON public.helpdesk_tickets
  WITH CHECK (
    public.is_org_member(org_id)
    AND public.has_branch_permission(org_id, branch_id, 'helpdesk.tickets.create')
  );

ALTER POLICY "helpdesk_tickets_update" ON public.helpdesk_tickets
  USING (
    public.is_org_member(org_id)
    AND (
      public.has_branch_permission(org_id, branch_id, 'helpdesk.tickets.manage')
      OR created_by = auth.uid()
    )
  );

ALTER POLICY "helpdesk_tickets_delete" ON public.helpdesk_tickets
  USING (
    public.is_org_member(org_id)
    AND public.has_branch_permission(org_id, branch_id, 'helpdesk.tickets.manage')
  );

-- A requester who cannot manage the ticket may only close / withdraw it, reopen it
-- from "resolved" (a reply to an answered request), touch updated_at, and move its due
-- date (used by the planning calendar). A listed acceptor may record the acceptance
-- (helpdesk_accept_ticket). Everything else needs helpdesk.tickets.manage.
CREATE OR REPLACE FUNCTION public.helpdesk_tickets_requester_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_allowed text[] := ARRAY['status', 'closed_at', 'closed_by', 'updated_at', 'due_at', 'due_date'];
BEGIN
  -- Service role / SECURITY DEFINER internals run without a user.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_branch_permission(OLD.org_id, OLD.branch_id, 'helpdesk.tickets.manage') THEN
    RETURN NEW;
  END IF;

  IF NEW.accepted_by IS DISTINCT FROM OLD.accepted_by
     AND NEW.accepted_by = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.helpdesk_ticket_acceptors a
       WHERE a.ticket_id = OLD.id AND a.user_id = auth.uid()
     ) THEN
    v_allowed := v_allowed || ARRAY['accepted_by', 'accepted_at'];
  END IF;

  IF (to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed) THEN
    RAISE EXCEPTION 'Only helpdesk.tickets.manage may change this ticket'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (NEW.status IN ('closed', 'cancelled') AND OLD.status NOT IN ('closed', 'cancelled'))
    OR (OLD.status = 'resolved' AND NEW.status = 'open')
  ) THEN
    RAISE EXCEPTION 'Requester may only close, withdraw or reopen a resolved ticket'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.closed_by IS DISTINCT FROM OLD.closed_by AND NEW.closed_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'closed_by must be the acting user' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.helpdesk_tickets_requester_update_guard() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'helpdesk_tickets_requester_update_guard'
      AND tgrelid = 'public.helpdesk_tickets'::regclass
  ) THEN
    CREATE TRIGGER helpdesk_tickets_requester_update_guard
      BEFORE UPDATE ON public.helpdesk_tickets
      FOR EACH ROW EXECUTE FUNCTION public.helpdesk_tickets_requester_update_guard();
  END IF;
END;
$$;

-- helpdesk_create_ticket (both overloads): the create check follows the ticket's branch.
DO $$
DECLARE
  r record;
  v_def text;
  v_new text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'helpdesk_create_ticket'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := replace(
      v_def,
      'has_permission(p_org_id, ''helpdesk.tickets.create'')',
      'has_branch_permission(p_org_id, p_branch_id, ''helpdesk.tickets.create'')'
    );
    IF v_new = v_def AND position('has_branch_permission(p_org_id, p_branch_id' in v_def) = 0 THEN
      RAISE EXCEPTION 'helpdesk_create_ticket: create check not found in %', r.oid::regprocedure;
    END IF;
    EXECUTE v_new;
  END LOOP;
END;
$$;

-- helpdesk_accept_ticket: read and manage checks follow the ticket's branch.
DO $$
DECLARE
  v_oid oid := 'public.helpdesk_accept_ticket(uuid)'::regprocedure;
  v_def text := pg_get_functiondef('public.helpdesk_accept_ticket(uuid)'::regprocedure);
  v_new text;
BEGIN
  IF position('has_branch_permission' in v_def) > 0 THEN
    RETURN;
  END IF;
  v_new := replace(v_def, 'SELECT id, org_id, requires_acceptance', 'SELECT id, org_id, branch_id, requires_acceptance');
  v_new := replace(v_new, 'has_permission(v_ticket.org_id, ''helpdesk.tickets.read'')',
                          'has_branch_permission(v_ticket.org_id, v_ticket.branch_id, ''helpdesk.tickets.read'')');
  v_new := replace(v_new, 'has_permission(v_ticket.org_id, ''helpdesk.tickets.manage'')',
                          'has_branch_permission(v_ticket.org_id, v_ticket.branch_id, ''helpdesk.tickets.manage'')');
  IF (length(v_def) - length(replace(v_def, 'has_permission(v_ticket.org_id', ''))) / length('has_permission(v_ticket.org_id') <> 2
     OR position('has_permission(v_ticket.org_id' in v_new) > 0
     OR position('branch_id, requires_acceptance' in v_new) = 0 THEN
    RAISE EXCEPTION 'helpdesk_accept_ticket: unexpected definition of %', v_oid::regprocedure;
  END IF;
  EXECUTE v_new;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Child tables follow the ticket's branch
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.helpdesk_ticket_branch_permission(p_ticket_id uuid, p_permission_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.helpdesk_tickets t
    WHERE t.id = p_ticket_id
      AND public.is_org_member(t.org_id)
      AND public.has_branch_permission(t.org_id, t.branch_id, p_permission_slug)
  );
$$;

REVOKE ALL ON FUNCTION public.helpdesk_ticket_branch_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helpdesk_ticket_branch_permission(uuid, text) TO authenticated;

ALTER POLICY "helpdesk_ticket_references_select" ON public.helpdesk_ticket_references
  USING (public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.read'));
ALTER POLICY "helpdesk_ticket_references_insert" ON public.helpdesk_ticket_references
  WITH CHECK (public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.create'));
ALTER POLICY "helpdesk_ticket_references_delete" ON public.helpdesk_ticket_references
  USING (public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.manage'));

ALTER POLICY "helpdesk_ticket_assignees_select" ON public.helpdesk_ticket_assignees
  USING (public.is_org_member(org_id) AND public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.read'));
ALTER POLICY "helpdesk_ticket_assignees_insert" ON public.helpdesk_ticket_assignees
  WITH CHECK (
    public.is_org_member(org_id)
    AND (
      public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.create')
      OR public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.manage')
    )
  );
ALTER POLICY "helpdesk_ticket_assignees_update" ON public.helpdesk_ticket_assignees
  USING (public.is_org_member(org_id) AND public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.manage'));
ALTER POLICY "helpdesk_ticket_assignees_delete" ON public.helpdesk_ticket_assignees
  USING (public.is_org_member(org_id) AND public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.manage'));

ALTER POLICY "helpdesk_ticket_acceptors_select" ON public.helpdesk_ticket_acceptors
  USING (public.is_org_member(org_id) AND public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.read'));
ALTER POLICY "helpdesk_ticket_acceptors_insert" ON public.helpdesk_ticket_acceptors
  WITH CHECK (
    public.is_org_member(org_id)
    AND (
      public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.create')
      OR public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.manage')
    )
  );
ALTER POLICY "helpdesk_ticket_acceptors_delete" ON public.helpdesk_ticket_acceptors
  USING (public.is_org_member(org_id) AND public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.manage'));

ALTER POLICY "helpdesk_ticket_activity_insert" ON public.helpdesk_ticket_activity
  WITH CHECK (public.is_org_member(org_id) AND public.helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.read'));
ALTER POLICY "helpdesk_ticket_activity_select" ON public.helpdesk_ticket_activity
  USING (
    public.is_org_member(org_id)
    AND EXISTS (
      SELECT 1
      FROM public.helpdesk_tickets t
      WHERE t.id = helpdesk_ticket_activity.ticket_id
        AND public.has_branch_permission(t.org_id, t.branch_id, 'helpdesk.tickets.read')
        AND (
          t.created_by = auth.uid()
          OR public.has_branch_permission(t.org_id, t.branch_id, 'helpdesk.tickets.manage')
          OR EXISTS (
            SELECT 1 FROM public.helpdesk_ticket_assignees a
            WHERE a.ticket_id = t.id AND a.user_id = auth.uid() AND a.deleted_at IS NULL
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Comments and attachments on helpdesk.ticket (D4)
-- Who sees the thread is unchanged (requester, assignees, managers); a manager is now
-- whoever holds helpdesk.tickets.manage for the ticket's branch. Internal notes stay
-- manager-only. Other target types are untouched.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_comment_target(
  p_org_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_visibility text DEFAULT 'default'::text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

  RETURN false;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Repair-order lookup for advisors (D8)
-- "Doradca (portal)" has no workshop.repair_orders.read; this returns only the id, the
-- full DMS number and the branch of one order matching nr zlecenia + magazyn, and only
-- in branches where the caller may file help-desk tickets.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_find_repair_order(
  p_org_id uuid,
  p_order_number text,
  p_warehouse text
)
RETURNS TABLE (id uuid, zl_number text, branch_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT ro.id, ro.zl_number, ro.branch_id
  FROM public.repair_orders ro
  WHERE p_order_number ~ '^\d{3,8}$'
    AND p_warehouse ~ '^\d{4}$'
    AND public.is_org_member(p_org_id)
    AND ro.organization_id = p_org_id
    AND ro.deleted_at IS NULL
    AND ro.zl_number LIKE '%/' || p_order_number || '/%/' || p_warehouse || '/%'
    AND public.has_branch_permission(p_org_id, ro.branch_id, 'helpdesk.tickets.create')
  ORDER BY ro.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.portal_find_repair_order(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_find_repair_order(uuid, text, text) TO authenticated;
