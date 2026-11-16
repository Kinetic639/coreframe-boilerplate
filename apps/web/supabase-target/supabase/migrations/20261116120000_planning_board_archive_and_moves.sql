-- =============================================================================
-- Planning boards: a real archive, and moves that run in one transaction.
--
--   1. Boards and columns get archived_at. Archiving hides a board or a column
--      and can be undone; deleted_at now only means "deleted for good".
--      Archiving a board or a column no longer touches its tasks: they keep
--      their place and come back with it. Only deleting for good takes the
--      tasks off the board (they stay in the task list).
--   2. planning_move_task: one call moves a task to a board column or to its
--      author's inbox and renumbers the destination, in one transaction and
--      with the destination rows locked, so two people moving cards at the
--      same time cannot leave two cards on the same position.
--   3. planning_reorder_board_columns: renumbers the columns in one statement.
--   4. planning_delete_board / planning_delete_board_column: delete an
--      archived board or column for good and take its tasks off the board.
--   5. The status trigger no longer moves a task into an archived column, and
--      the board guard treats archiving like deleting (owner or
--      planning.boards.delete).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. archived_at
-- ---------------------------------------------------------------------------

ALTER TABLE public.planning_kanban_boards
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.planning_kanban_columns
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS planning_kanban_boards_archived_idx
  ON public.planning_kanban_boards (organization_id, archived_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS planning_kanban_columns_archived_idx
  ON public.planning_kanban_columns (board_id, archived_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS planning_tasks_board_archived_idx
  ON public.planning_tasks (board_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL AND board_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5a. Board guard: archiving needs the same rights as deleting
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planning_kanban_boards_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service-role and maintenance writes have no user.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.visibility IS DISTINCT FROM OLD.visibility
      OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by)
    AND OLD.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the board owner can change who sees the board' USING ERRCODE = '42501';
  END IF;

  IF ((NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
      OR NEW.archived_at IS DISTINCT FROM OLD.archived_at)
    AND OLD.created_by <> auth.uid()
    AND NOT public.has_permission(OLD.organization_id, 'planning.boards.delete') THEN
    RAISE EXCEPTION 'Only the board owner can archive the board' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5b. Status trigger: same as before, but never into an archived column
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

  IF v_column_moved AND v_column_status IS NOT NULL THEN
    -- Dragged to (or created in) a status column: the status follows it.
    NEW.status := v_column_status;
  ELSIF TG_OP = 'UPDATE'
    AND NOT v_column_moved
    AND NEW.status IS DISTINCT FROM OLD.status
    AND v_column_status IS NOT NULL
    AND v_column_status <> NEW.status THEN
    -- Status changed elsewhere while in a status column: move to the first
    -- open column of that status, if the board has one. Otherwise, and always
    -- for a plain column, the task stays where it is.
    SELECT c.id INTO v_target_column
    FROM public.planning_kanban_columns c
    WHERE c.board_id = NEW.board_id
      AND c.status_category = NEW.status
      AND c.deleted_at IS NULL
      AND c.archived_at IS NULL
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

-- ---------------------------------------------------------------------------
-- 2. Move a task to a column (or the inbox) in one transaction
--
-- SECURITY INVOKER: the task and board policies apply exactly as they do to a
-- plain UPDATE. Returns where the task was and what it is now, so the caller
-- can log the move and show the new status.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planning_move_task(
  p_task_id   UUID,
  p_board_id  UUID,
  p_column_id UUID,
  p_position  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_task RECORD;
  v_ids  UUID[];
  v_pos  INTEGER;
  v_new  RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT t.id, t.organization_id, t.board_id, t.column_id, t.is_inbox, t.created_by, t.status
    INTO v_task
  FROM public.planning_tasks t
  WHERE t.id = p_task_id AND t.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_column_id IS NULL THEN
    -- To the inbox: private to the task's author.
    IF v_task.created_by <> v_uid THEN
      RAISE EXCEPTION 'Only the author can move a task to their inbox' USING ERRCODE = '42501';
    END IF;

    PERFORM 1 FROM public.planning_tasks t
    WHERE t.organization_id = v_task.organization_id
      AND t.created_by = v_uid
      AND t.is_inbox
      AND t.deleted_at IS NULL
    FOR UPDATE;

    IF NOT v_task.is_inbox THEN
      UPDATE public.planning_tasks
      SET board_id = NULL, column_id = NULL, is_inbox = true, updated_by = v_uid
      WHERE id = p_task_id;
    END IF;

    SELECT coalesce(array_agg(t.id ORDER BY t.board_position, t.updated_at DESC), '{}')
      INTO v_ids
    FROM public.planning_tasks t
    WHERE t.organization_id = v_task.organization_id
      AND t.created_by = v_uid
      AND t.is_inbox
      AND t.deleted_at IS NULL
      AND t.id <> p_task_id;
  ELSE
    -- To a column: it must be an open column of an open board.
    PERFORM 1
    FROM public.planning_kanban_columns c
    JOIN public.planning_kanban_boards b ON b.id = c.board_id
    WHERE c.id = p_column_id
      AND c.board_id = p_board_id
      AND c.organization_id = v_task.organization_id
      AND c.deleted_at IS NULL
      AND c.archived_at IS NULL
      AND b.deleted_at IS NULL
      AND b.archived_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Board column not found' USING ERRCODE = '23503';
    END IF;

    PERFORM 1 FROM public.planning_tasks t
    WHERE t.column_id = p_column_id AND t.deleted_at IS NULL
    FOR UPDATE;

    IF v_task.is_inbox
      OR v_task.board_id IS DISTINCT FROM p_board_id
      OR v_task.column_id IS DISTINCT FROM p_column_id THEN
      UPDATE public.planning_tasks
      SET board_id = p_board_id, column_id = p_column_id, is_inbox = false, updated_by = v_uid
      WHERE id = p_task_id;
    END IF;

    SELECT coalesce(array_agg(t.id ORDER BY t.board_position, t.created_at), '{}')
      INTO v_ids
    FROM public.planning_tasks t
    WHERE t.column_id = p_column_id
      AND t.deleted_at IS NULL
      AND t.id <> p_task_id;
  END IF;

  v_pos := greatest(0, least(coalesce(p_position, 0), coalesce(array_length(v_ids, 1), 0)));
  v_ids := v_ids[1:v_pos] || p_task_id || v_ids[v_pos + 1:];

  UPDATE public.planning_tasks t
  SET board_position = x.ord - 1
  FROM unnest(v_ids) WITH ORDINALITY AS x(id, ord)
  WHERE t.id = x.id
    AND t.board_position IS DISTINCT FROM (x.ord - 1)::INTEGER;

  SELECT t.board_id, t.column_id, t.is_inbox, t.status, t.board_position
    INTO v_new
  FROM public.planning_tasks t
  WHERE t.id = p_task_id;

  RETURN jsonb_build_object(
    'from_board_id', v_task.board_id,
    'from_column_id', v_task.column_id,
    'from_inbox', v_task.is_inbox,
    'from_status', v_task.status,
    'board_id', v_new.board_id,
    'column_id', v_new.column_id,
    'is_inbox', v_new.is_inbox,
    'status', v_new.status,
    'position', v_new.board_position
  );
END;
$$;

REVOKE ALL ON FUNCTION public.planning_move_task(UUID, UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_move_task(UUID, UUID, UUID, INTEGER) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Reorder a board's columns in one statement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planning_reorder_board_columns(
  p_board_id   UUID,
  p_column_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1 FROM public.planning_kanban_columns c
  WHERE c.board_id = p_board_id AND c.deleted_at IS NULL
  FOR UPDATE;

  UPDATE public.planning_kanban_columns c
  SET position = x.ord - 1
  FROM unnest(p_column_ids) WITH ORDINALITY AS x(id, ord)
  WHERE c.id = x.id
    AND c.board_id = p_board_id
    AND c.deleted_at IS NULL
    AND c.position IS DISTINCT FROM (x.ord - 1)::INTEGER;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_reorder_board_columns(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_reorder_board_columns(UUID, UUID[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Delete an archived board or column for good
--
-- SECURITY DEFINER because the tasks taken off the board may sit in branches
-- the caller cannot edit; the checks below are the same as for archiving.
-- Tasks are never deleted here: they leave the board and stay in the list.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planning_delete_board(p_board_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_board RECORD;
  v_now   TIMESTAMPTZ := now();
BEGIN
  SELECT b.id, b.organization_id, b.created_by, b.archived_at INTO v_board
  FROM public.planning_kanban_boards b
  WHERE b.id = p_board_id AND b.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_uid IS NULL OR NOT public.is_org_member(v_board.organization_id)
    OR public.planning_board_access(p_board_id) IS NULL THEN
    RAISE EXCEPTION 'Board not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_board.created_by <> v_uid
    AND NOT public.has_permission(v_board.organization_id, 'planning.boards.delete') THEN
    RAISE EXCEPTION 'Only the board owner can delete the board' USING ERRCODE = '42501';
  END IF;
  IF v_board.archived_at IS NULL THEN
    RAISE EXCEPTION 'Archive the board before deleting it' USING ERRCODE = '55000';
  END IF;

  UPDATE public.planning_tasks
  SET board_id = NULL, column_id = NULL, board_position = 0, updated_by = v_uid
  WHERE board_id = p_board_id;

  UPDATE public.planning_kanban_columns
  SET deleted_at = v_now
  WHERE board_id = p_board_id AND deleted_at IS NULL;

  UPDATE public.planning_kanban_boards
  SET deleted_at = v_now, updated_by = v_uid
  WHERE id = p_board_id;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_delete_board(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_delete_board(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.planning_delete_board_column(p_column_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_column RECORD;
BEGIN
  SELECT c.id, c.board_id, c.organization_id, c.archived_at INTO v_column
  FROM public.planning_kanban_columns c
  WHERE c.id = p_column_id AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_uid IS NULL OR NOT public.is_org_member(v_column.organization_id)
    OR NOT public.can_edit_planning_board(v_column.board_id) THEN
    RAISE EXCEPTION 'Board column not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_permission(v_column.organization_id, 'planning.boards.delete') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;
  IF v_column.archived_at IS NULL THEN
    RAISE EXCEPTION 'Archive the column before deleting it' USING ERRCODE = '55000';
  END IF;

  UPDATE public.planning_tasks
  SET board_id = NULL, column_id = NULL, board_position = 0, updated_by = v_uid
  WHERE column_id = p_column_id;

  UPDATE public.planning_kanban_columns
  SET deleted_at = now()
  WHERE id = p_column_id;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_delete_board_column(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_delete_board_column(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Boards archived before this migration
--
-- Until now "archive" set deleted_at on the board, its columns and all its
-- tasks at the same moment. Those boards become archived (not deleted), so
-- they can be restored, and their tasks come back with the board.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT b.id, b.deleted_at
    FROM public.planning_kanban_boards b
    WHERE b.deleted_at IS NOT NULL AND b.archived_at IS NULL
  LOOP
    UPDATE public.planning_kanban_columns
    SET archived_at = NULL, deleted_at = NULL
    WHERE board_id = r.id AND deleted_at = r.deleted_at;

    UPDATE public.planning_tasks
    SET deleted_at = NULL
    WHERE board_id = r.id AND deleted_at = r.deleted_at;

    UPDATE public.planning_kanban_boards
    SET archived_at = r.deleted_at, deleted_at = NULL
    WHERE id = r.id;
  END LOOP;
END;
$$;
