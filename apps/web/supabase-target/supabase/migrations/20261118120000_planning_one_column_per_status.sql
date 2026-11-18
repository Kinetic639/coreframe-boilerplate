-- =============================================================================
-- Planning: a status column is named after its status, and a board has at
-- most one column per status.
--
-- Until now a column had a free name and an optional status of its own, so a
-- column called "Open" could carry the "completed" status, and two columns
-- could share one status (a task whose status changed then always went to the
-- first of them). From now on:
--
--   1. A column is either a status column (its name is the status's name; the
--      app shows it translated) or a plain group with a name of its own.
--   2. A board has at most one active (not archived, not deleted) column per
--      status, enforced by a unique index.
--   3. Restoring an archived status column whose status has meanwhile got
--      another column keeps it as a plain group (its name stays).
--   4. Copying a column onto a board that already has a column for its status
--      makes the copy a plain group.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Existing data: later duplicates of a status become plain groups, and
--    status columns take the status's name.
-- ---------------------------------------------------------------------------

UPDATE public.planning_kanban_columns c
SET status_category = NULL
WHERE c.status_category IS NOT NULL
  AND c.archived_at IS NULL
  AND c.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.planning_kanban_columns o
    WHERE o.board_id = c.board_id
      AND o.status_category = c.status_category
      AND o.archived_at IS NULL
      AND o.deleted_at IS NULL
      AND (o.position, o.id) < (c.position, c.id)
  );

UPDATE public.planning_kanban_columns
SET title = CASE status_category
  WHEN 'open' THEN 'Otwarte'
  WHEN 'in_progress' THEN 'W realizacji'
  WHEN 'completed' THEN 'Zakończone'
  WHEN 'cancelled' THEN 'Anulowane'
END
WHERE status_category IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 1. One active column per status on a board
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS planning_kanban_columns_one_per_status
  ON public.planning_kanban_columns (board_id, status_category)
  WHERE status_category IS NOT NULL AND archived_at IS NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Restoring a column whose status is taken keeps it as a plain group
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planning_kanban_column_restore_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL
     AND NEW.archived_at IS NULL
     AND NEW.status_category IS NOT NULL
     AND NEW.deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM public.planning_kanban_columns o
       WHERE o.board_id = NEW.board_id
         AND o.id <> NEW.id
         AND o.status_category = NEW.status_category
         AND o.archived_at IS NULL
         AND o.deleted_at IS NULL
     ) THEN
    NEW.status_category := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_kanban_column_restore_status ON public.planning_kanban_columns;
CREATE TRIGGER planning_kanban_column_restore_status
  BEFORE UPDATE OF archived_at ON public.planning_kanban_columns
  FOR EACH ROW EXECUTE FUNCTION public.planning_kanban_column_restore_status();

-- ---------------------------------------------------------------------------
-- 3. Copying a column: the copy keeps its status only where it is free
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planning_copy_column(
  p_column_id uuid,
  p_board_id  uuid DEFAULT NULL,
  p_title     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_src    public.planning_kanban_columns%ROWTYPE;
  v_board  uuid;
  v_pos    integer;
  v_new    uuid;
  v_task   record;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_src FROM public.planning_kanban_columns
  WHERE id = p_column_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board column not found' USING ERRCODE = 'P0002';
  END IF;

  v_board := coalesce(p_board_id, v_src.board_id);
  PERFORM 1 FROM public.planning_kanban_boards b
  WHERE b.id = v_board AND b.organization_id = v_src.organization_id
    AND b.deleted_at IS NULL AND b.archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found' USING ERRCODE = '23503';
  END IF;

  v_status := v_src.status_category;
  IF v_status IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.planning_kanban_columns o
    WHERE o.board_id = v_board AND o.status_category = v_status
      AND o.archived_at IS NULL AND o.deleted_at IS NULL
  ) THEN
    v_status := NULL;
  END IF;

  IF v_board = v_src.board_id THEN
    v_pos := v_src.position + 1;
    UPDATE public.planning_kanban_columns
    SET position = position + 1
    WHERE board_id = v_board AND deleted_at IS NULL AND position >= v_pos;
  ELSE
    SELECT coalesce(max(c.position), -1) + 1 INTO v_pos
    FROM public.planning_kanban_columns c
    WHERE c.board_id = v_board AND c.deleted_at IS NULL;
  END IF;

  INSERT INTO public.planning_kanban_columns (
    board_id, organization_id, title, description, color, status_category, wip_limit, position
  ) VALUES (
    v_board, v_src.organization_id,
    left(coalesce(nullif(btrim(p_title), ''), v_src.title), 120),
    v_src.description, v_src.color, v_status, v_src.wip_limit, v_pos
  )
  RETURNING id INTO v_new;

  FOR v_task IN
    SELECT t.id, t.is_template FROM public.planning_tasks t
    WHERE t.column_id = p_column_id AND t.deleted_at IS NULL
    ORDER BY t.board_position, t.created_at
  LOOP
    PERFORM public.planning_copy_task(
      v_task.id, v_new, NULL, NULL,
      ARRAY['description','labels','checklists','assignee','dates','cover','priority','fields'],
      v_task.is_template
    );
  END LOOP;

  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.planning_copy_column(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_copy_column(uuid, uuid, text) TO authenticated;
