-- =============================================================================
-- Planning: a task is the one record a board shows (phase 1 of merging
-- Tasks and Boards).
--
-- Until now a board held its own cards (planning_kanban_cards) with no status,
-- assignee, number, branch or QR code, while tasks (planning_tasks) had all of
-- that but no board. This migration lets a task sit on a board, so a board can
-- become a view of tasks. Kanban cards stay untouched here; they move over in
-- phase 2.
--
--   1. Every board column gets a status category (open / in_progress /
--      completed / cancelled), so a column always means one task status.
--   2. A task can be placed on a board (board_id, column_id, board_position)
--      or kept in its author's private inbox (is_inbox).
--   3. A trigger keeps the column and the status in step both ways: dragging a
--      task to another column sets its status, and changing the status from
--      the list moves it to the first column of that status on its board.
--   4. Two rules are added on top of the existing task policies (RESTRICTIVE,
--      so the existing policies are kept as they are): an inbox task is seen
--      only by its author, and a task on a private board only by the people
--      who can see that board.
--   5. Comments on a task follow the same two rules.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Status category per board column
-- ---------------------------------------------------------------------------

ALTER TABLE public.planning_kanban_columns
  ADD COLUMN IF NOT EXISTS status_category TEXT NOT NULL DEFAULT 'open';

ALTER TABLE public.planning_kanban_columns
  DROP CONSTRAINT IF EXISTS planning_kanban_columns_status_category_check;
ALTER TABLE public.planning_kanban_columns
  ADD CONSTRAINT planning_kanban_columns_status_category_check
  CHECK (status_category IN ('open', 'in_progress', 'completed', 'cancelled'));

-- Best guess for existing columns from their names; everything else stays open.
UPDATE public.planning_kanban_columns
SET status_category = CASE
  WHEN title ~* '(done|complete|finish|zrobion|gotow|zako[nń]czon|wykonan|naprawion|zamkni[eę]t)' THEN 'completed'
  WHEN title ~* '(cancel|anulow|odrzucon)' THEN 'cancelled'
  WHEN title ~* '(progress|doing|review|w toku|w trakcie|w realizacji|realizowan)' THEN 'in_progress'
  ELSE 'open'
END
WHERE status_category = 'open';

-- ---------------------------------------------------------------------------
-- 2. Where a task sits: a board column or its author's inbox
-- ---------------------------------------------------------------------------

ALTER TABLE public.planning_tasks
  ADD COLUMN IF NOT EXISTS board_id UUID
    REFERENCES public.planning_kanban_boards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS column_id UUID
    REFERENCES public.planning_kanban_columns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS board_position INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_inbox BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.planning_tasks
  DROP CONSTRAINT IF EXISTS planning_tasks_board_placement_check;
ALTER TABLE public.planning_tasks
  ADD CONSTRAINT planning_tasks_board_placement_check
  CHECK (
    (column_id IS NULL OR board_id IS NOT NULL)
    AND NOT (is_inbox AND board_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS planning_tasks_board_column_position_idx
  ON public.planning_tasks (board_id, column_id, board_position)
  WHERE deleted_at IS NULL AND board_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS planning_tasks_inbox_idx
  ON public.planning_tasks (organization_id, created_by, updated_at DESC)
  WHERE deleted_at IS NULL AND is_inbox;

CREATE INDEX IF NOT EXISTS planning_tasks_column_idx
  ON public.planning_tasks (column_id)
  WHERE column_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Keep column and status in step
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planning_tasks_board_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_column_board  UUID;
  v_column_org    UUID;
  v_column_status TEXT;
  v_board_org     UUID;
  v_target_column UUID;
  v_column_moved  BOOLEAN;
BEGIN
  -- The column decides the board.
  IF NEW.column_id IS NOT NULL THEN
    SELECT c.board_id, c.organization_id, c.status_category
      INTO v_column_board, v_column_org, v_column_status
    FROM public.planning_kanban_columns c
    WHERE c.id = NEW.column_id AND c.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Board column not found' USING ERRCODE = '23503';
    END IF;
    IF v_column_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Board column belongs to another organization' USING ERRCODE = '23514';
    END IF;
    IF NEW.board_id IS NULL THEN
      NEW.board_id := v_column_board;
    ELSIF NEW.board_id <> v_column_board THEN
      RAISE EXCEPTION 'Board column belongs to another board' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.board_id IS NOT NULL THEN
    SELECT b.organization_id INTO v_board_org
    FROM public.planning_kanban_boards b
    WHERE b.id = NEW.board_id AND b.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Board not found' USING ERRCODE = '23503';
    END IF;
    IF v_board_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Board belongs to another organization' USING ERRCODE = '23514';
    END IF;

    -- Placing a task on a board takes it out of the inbox.
    NEW.is_inbox := false;
  END IF;

  v_column_moved := NEW.column_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.column_id IS DISTINCT FROM OLD.column_id);

  IF v_column_moved THEN
    -- Dragged to (or created in) a column: the status follows the column.
    NEW.status := v_column_status;
  ELSIF TG_OP = 'UPDATE'
    AND NEW.status IS DISTINCT FROM OLD.status
    AND NEW.column_id IS NOT NULL
    AND v_column_status IS DISTINCT FROM NEW.status THEN
    -- Status changed elsewhere: move to the first column of that status, if
    -- the board has one. Otherwise the task stays where it is.
    SELECT c.id INTO v_target_column
    FROM public.planning_kanban_columns c
    WHERE c.board_id = NEW.board_id
      AND c.status_category = NEW.status
      AND c.deleted_at IS NULL
    ORDER BY c.position, c.created_at
    LIMIT 1;

    IF v_target_column IS NOT NULL THEN
      NEW.column_id := v_target_column;
      SELECT coalesce(max(t.board_position), -1) + 1 INTO NEW.board_position
      FROM public.planning_tasks t
      WHERE t.column_id = v_target_column AND t.deleted_at IS NULL AND t.id <> NEW.id;
    END IF;
  END IF;

  -- Stamp the status dates the same way the task service does, so a drag
  -- between columns leaves the same trail as a status change.
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'in_progress' THEN
      NEW.started_at := coalesce(NEW.started_at, now());
      NEW.completed_at := NULL;
      NEW.cancelled_at := NULL;
    ELSIF NEW.status = 'completed' THEN
      NEW.completed_at := coalesce(NEW.completed_at, now());
      NEW.cancelled_at := NULL;
    ELSIF NEW.status = 'cancelled' THEN
      NEW.cancelled_at := coalesce(NEW.cancelled_at, now());
      NEW.completed_at := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.completed_at := NULL;
      NEW.cancelled_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_tasks_board_sync ON public.planning_tasks;
CREATE TRIGGER planning_tasks_board_sync
  BEFORE INSERT OR UPDATE OF board_id, column_id, status, is_inbox ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public.planning_tasks_board_sync();

-- ---------------------------------------------------------------------------
-- 4. Inbox is private; a private board's tasks are private to that board
-- ---------------------------------------------------------------------------

-- Whether the current user can see a board. Ignores deleted_at on purpose, so
-- tasks left on a deleted board stay visible in lists to the same people.
CREATE OR REPLACE FUNCTION public.can_view_planning_board(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.planning_kanban_boards b
    WHERE b.id = p_board_id
      AND public.is_org_member(b.organization_id)
      AND (b.visibility = 'public' OR b.created_by = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_planning_board(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_planning_board(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "planning_tasks_placement_visibility" ON public.planning_tasks;
CREATE POLICY "planning_tasks_placement_visibility" ON public.planning_tasks
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    (NOT is_inbox OR created_by = auth.uid())
    AND (board_id IS NULL OR public.can_view_planning_board(board_id))
  )
  WITH CHECK (
    (NOT is_inbox OR created_by = auth.uid())
    AND (board_id IS NULL OR public.can_view_planning_board(board_id))
  );

-- ---------------------------------------------------------------------------
-- 5. Comments on a task follow the same rules
--    (same function as before; only the planning.task branch gains the two
--    placement checks)
-- ---------------------------------------------------------------------------

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
        AND (NOT t.is_inbox OR t.created_by = auth.uid())
        AND (t.board_id IS NULL OR public.can_view_planning_board(t.board_id))
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

  IF p_target_type = 'chat.conversation' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = p_target_id AND c.organization_id = p_org_id AND c.deleted_at IS NULL
    ) OR NOT public.is_chat_member(p_target_id) THEN
      RETURN false;
    END IF;

    IF p_visibility = 'internal' OR p_action = 'moderate' THEN
      RETURN false;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  RETURN false;
END;
$function$;
