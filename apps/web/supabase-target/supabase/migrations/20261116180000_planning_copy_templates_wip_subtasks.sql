-- =============================================================================
-- Planning boards, stage 6a: copying, templates, WIP limits, sub-tasks and
-- dependencies.
--
--   * planning_kanban_columns.wip_limit      soft limit of cards in a column
--   * planning_kanban_boards.is_template     a board offered as a template
--   * planning_tasks.is_template             a card offered as a template
--   * planning_tasks.parent_task_id          a task's parent (sub-tasks)
--   * planning_task_dependencies             "task is blocked by task"
--   * planning_copy_task / _column / _board  copies in one transaction
--
-- The copy functions run as the caller (SECURITY INVOKER): every row they
-- read or write goes through the tables' RLS, exactly as if the app wrote it.
-- Idempotent: safe to run again.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Columns: WIP limit
-- ---------------------------------------------------------------------------
ALTER TABLE public.planning_kanban_columns
  ADD COLUMN IF NOT EXISTS wip_limit integer;

ALTER TABLE public.planning_kanban_columns
  DROP CONSTRAINT IF EXISTS planning_kanban_columns_wip_limit_check;
ALTER TABLE public.planning_kanban_columns
  ADD CONSTRAINT planning_kanban_columns_wip_limit_check
  CHECK (wip_limit IS NULL OR wip_limit BETWEEN 1 AND 999);

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
ALTER TABLE public.planning_kanban_boards
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

ALTER TABLE public.planning_tasks
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Sub-tasks: a task may have a parent task of the same organization
-- ---------------------------------------------------------------------------
ALTER TABLE public.planning_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planning_tasks_parent_task_id_fkey'
  ) THEN
    ALTER TABLE public.planning_tasks
      ADD CONSTRAINT planning_tasks_parent_task_id_fkey
      FOREIGN KEY (parent_task_id) REFERENCES public.planning_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.planning_tasks
  DROP CONSTRAINT IF EXISTS planning_tasks_parent_not_self;
ALTER TABLE public.planning_tasks
  ADD CONSTRAINT planning_tasks_parent_not_self CHECK (parent_task_id IS NULL OR parent_task_id <> id);

CREATE INDEX IF NOT EXISTS planning_tasks_parent_idx
  ON public.planning_tasks (parent_task_id)
  WHERE parent_task_id IS NOT NULL;

-- The parent must be a live task of the same organization, and a task can
-- never end up under itself through a chain. Reads only (DEFINER so the walk
-- sees the whole chain whatever the caller may read).
CREATE OR REPLACE FUNCTION public._planning_task_parent_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.parent_task_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.parent_task_id IS NOT DISTINCT FROM OLD.parent_task_id THEN
    RETURN NEW;
  END IF;

  SELECT t.organization_id INTO v_org
  FROM public.planning_tasks t
  WHERE t.id = NEW.parent_task_id AND t.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent task not found' USING ERRCODE = '23503';
  END IF;
  IF v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Parent task belongs to another organization' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    WITH RECURSIVE up(id, depth) AS (
      SELECT NEW.parent_task_id, 1
      UNION ALL
      SELECT t.parent_task_id, up.depth + 1
      FROM public.planning_tasks t
      JOIN up ON t.id = up.id
      WHERE t.parent_task_id IS NOT NULL AND up.depth < 50
    )
    SELECT 1 FROM up WHERE up.id = NEW.id
  ) THEN
    RAISE EXCEPTION 'A task cannot be its own sub-task' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._planning_task_parent_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS planning_tasks_parent_guard ON public.planning_tasks;
CREATE TRIGGER planning_tasks_parent_guard
  BEFORE INSERT OR UPDATE OF parent_task_id ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public._planning_task_parent_guard();

-- A change to a sub-task shows on its parent's card (count of done ones):
-- touching the parent lets one Realtime subscription on tasks cover it.
CREATE OR REPLACE FUNCTION public._planning_touch_parent_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.parent_task_id IS NOT DISTINCT FROM OLD.parent_task_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NULL;
  END IF;
  UPDATE public.planning_tasks SET updated_at = now()
  WHERE deleted_at IS NULL
    AND id IN (NEW.parent_task_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.parent_task_id END);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._planning_touch_parent_task() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS planning_tasks_touch_parent ON public.planning_tasks;
CREATE TRIGGER planning_tasks_touch_parent
  AFTER INSERT OR UPDATE OF parent_task_id, status, deleted_at ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public._planning_touch_parent_task();

-- ---------------------------------------------------------------------------
-- Dependencies: task_id is blocked by depends_on_task_id
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_task_dependencies (
  task_id            uuid        NOT NULL REFERENCES public.planning_tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid        NOT NULL REFERENCES public.planning_tasks(id) ON DELETE CASCADE,
  organization_id    uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by         uuid        REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, depends_on_task_id),
  CONSTRAINT planning_task_dependencies_not_self CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS planning_task_dependencies_depends_on_idx
  ON public.planning_task_dependencies (depends_on_task_id);

-- Both tasks in the dependency's organization, and no cycle (A blocked by B
-- blocked by … A). DEFINER: the walk reads links the caller may not see.
CREATE OR REPLACE FUNCTION public._planning_task_dependency_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF (SELECT count(*) FROM public.planning_tasks t
      WHERE t.id IN (NEW.task_id, NEW.depends_on_task_id)
        AND t.organization_id = NEW.organization_id
        AND t.deleted_at IS NULL) <> 2 THEN
    RAISE EXCEPTION 'Both tasks must exist in this organization' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    WITH RECURSIVE chain(id, depth) AS (
      SELECT NEW.depends_on_task_id, 1
      UNION
      SELECT d.depends_on_task_id, chain.depth + 1
      FROM public.planning_task_dependencies d
      JOIN chain ON d.task_id = chain.id
      WHERE chain.depth < 100
    )
    SELECT 1 FROM chain WHERE chain.id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'This dependency would make a cycle' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._planning_task_dependency_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS planning_task_dependencies_guard ON public.planning_task_dependencies;
CREATE TRIGGER planning_task_dependencies_guard
  BEFORE INSERT ON public.planning_task_dependencies
  FOR EACH ROW EXECUTE FUNCTION public._planning_task_dependency_guard();

DROP TRIGGER IF EXISTS planning_task_dependencies_touch ON public.planning_task_dependencies;
CREATE TRIGGER planning_task_dependencies_touch
  AFTER INSERT OR DELETE ON public.planning_task_dependencies
  FOR EACH ROW EXECUTE FUNCTION public._planning_touch_task();

ALTER TABLE public.planning_task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_task_dependencies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_task_dependencies_select" ON public.planning_task_dependencies;
CREATE POLICY "planning_task_dependencies_select" ON public.planning_task_dependencies
  FOR SELECT TO authenticated
  USING (
    public.can_read_planning_task(planning_task_dependencies.task_id)
    OR public.can_read_planning_task(planning_task_dependencies.depends_on_task_id)
  );

DROP POLICY IF EXISTS "planning_task_dependencies_insert" ON public.planning_task_dependencies;
CREATE POLICY "planning_task_dependencies_insert" ON public.planning_task_dependencies
  FOR INSERT TO authenticated
  WITH CHECK (
    planning_task_dependencies.created_by = auth.uid()
    AND public.can_edit_planning_task(planning_task_dependencies.task_id)
    AND public.can_read_planning_task(planning_task_dependencies.depends_on_task_id)
  );

DROP POLICY IF EXISTS "planning_task_dependencies_delete" ON public.planning_task_dependencies;
CREATE POLICY "planning_task_dependencies_delete" ON public.planning_task_dependencies
  FOR DELETE TO authenticated
  USING (public.can_edit_planning_task(planning_task_dependencies.task_id));

GRANT SELECT, INSERT, DELETE ON public.planning_task_dependencies TO authenticated;

-- ---------------------------------------------------------------------------
-- Copying
-- ---------------------------------------------------------------------------

-- A copy of a task in a column. p_keep picks what comes along:
--   description, labels, checklists, assignee, dates, cover, priority.
-- Comments, attachments, watchers and history never do. On another board the
-- labels are matched by name and missing ones created when the caller may.
-- p_position NULL = the bottom of the column. Returns the new task's id.
CREATE OR REPLACE FUNCTION public.planning_copy_task(
  p_task_id     uuid,
  p_column_id   uuid,
  p_position    integer DEFAULT NULL,
  p_title       text    DEFAULT NULL,
  p_keep        text[]  DEFAULT ARRAY['description','labels','checklists','assignee','dates','cover','priority'],
  p_as_template boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_src    public.planning_tasks%ROWTYPE;
  v_board  uuid;
  v_new    uuid;
  v_pos    integer;
  v_label  record;
  v_target uuid;
  v_list   record;
  v_list_new uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_src FROM public.planning_tasks
  WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.board_id INTO v_board
  FROM public.planning_kanban_columns c
  WHERE c.id = p_column_id AND c.deleted_at IS NULL AND c.archived_at IS NULL
    AND c.organization_id = v_src.organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board column not found' USING ERRCODE = '23503';
  END IF;

  SELECT coalesce(max(t.board_position), -1) + 1 INTO v_pos
  FROM public.planning_tasks t
  WHERE t.column_id = p_column_id AND t.deleted_at IS NULL;

  INSERT INTO public.planning_tasks (
    organization_id, branch_id, board_id, column_id, board_position, is_inbox,
    title, description_plain, description_rich, status, priority, assigned_to,
    due_at, due_has_time, calendar_all_day, calendar_start_date, calendar_end_date,
    calendar_start_at, calendar_end_at, calendar_timezone,
    label, label_color, cover_color, is_template, created_by, updated_by
  ) VALUES (
    v_src.organization_id, v_src.branch_id, v_board, p_column_id, v_pos, false,
    left(coalesce(nullif(btrim(p_title), ''), v_src.title), 300),
    CASE WHEN 'description' = ANY (p_keep) THEN v_src.description_plain END,
    CASE WHEN 'description' = ANY (p_keep) THEN v_src.description_rich END,
    'open',
    CASE WHEN 'priority' = ANY (p_keep) THEN v_src.priority ELSE 'normal' END,
    CASE WHEN 'assignee' = ANY (p_keep) THEN v_src.assigned_to END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.due_at END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.due_has_time ELSE false END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_all_day END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_start_date END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_end_date END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_start_at END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_end_at END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_timezone END,
    CASE WHEN 'labels' = ANY (p_keep) AND v_src.board_id = v_board THEN v_src.label END,
    CASE WHEN 'labels' = ANY (p_keep) AND v_src.board_id = v_board THEN v_src.label_color END,
    CASE WHEN 'cover' = ANY (p_keep) THEN v_src.cover_color END,
    coalesce(p_as_template, false),
    v_uid, v_uid
  )
  RETURNING id INTO v_new;

  IF 'labels' = ANY (p_keep) THEN
    FOR v_label IN
      SELECT l.id, l.board_id, l.name, l.color, l.position
      FROM public.planning_task_labels tl
      JOIN public.planning_kanban_board_labels l ON l.id = tl.label_id
      WHERE tl.task_id = p_task_id
      ORDER BY l.position
    LOOP
      IF v_label.board_id = v_board THEN
        v_target := v_label.id;
      ELSE
        SELECT l.id INTO v_target
        FROM public.planning_kanban_board_labels l
        WHERE l.board_id = v_board AND lower(btrim(l.name)) = lower(btrim(v_label.name))
        ORDER BY l.position
        LIMIT 1;
        IF v_target IS NULL THEN
          BEGIN
            INSERT INTO public.planning_kanban_board_labels (organization_id, board_id, name, color, position, created_by)
            SELECT v_src.organization_id, v_board, v_label.name, v_label.color,
                   coalesce(max(l.position), -1) + 1, v_uid
            FROM public.planning_kanban_board_labels l WHERE l.board_id = v_board
            RETURNING id INTO v_target;
          EXCEPTION WHEN insufficient_privilege THEN
            -- May not add labels to that board: the copy goes without this one.
            v_target := NULL;
          END;
        END IF;
      END IF;
      IF v_target IS NOT NULL THEN
        INSERT INTO public.planning_task_labels (task_id, label_id, organization_id)
        VALUES (v_new, v_target, v_src.organization_id)
        ON CONFLICT DO NOTHING;
      END IF;
      v_target := NULL;
    END LOOP;
  END IF;

  IF 'checklists' = ANY (p_keep) THEN
    FOR v_list IN
      SELECT * FROM public.planning_task_checklists
      WHERE task_id = p_task_id ORDER BY position, created_at
    LOOP
      INSERT INTO public.planning_task_checklists (organization_id, task_id, title, position, created_by)
      VALUES (v_src.organization_id, v_new, v_list.title, v_list.position, v_uid)
      RETURNING id INTO v_list_new;

      INSERT INTO public.planning_task_checklist_items (
        organization_id, checklist_id, task_id, title, is_done, assigned_to, due_at, position, created_by
      )
      SELECT v_src.organization_id, v_list_new, v_new, i.title, false,
             CASE WHEN 'assignee' = ANY (p_keep) THEN i.assigned_to END,
             CASE WHEN 'dates' = ANY (p_keep) THEN i.due_at END,
             i.position, v_uid
      FROM public.planning_task_checklist_items i
      WHERE i.checklist_id = v_list.id
      ORDER BY i.position, i.created_at;
    END LOOP;
  END IF;

  IF p_position IS NOT NULL AND p_position < v_pos THEN
    PERFORM public.planning_move_task(v_new, v_board, p_column_id, p_position);
  END IF;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_copy_task(uuid, uuid, integer, text, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_copy_task(uuid, uuid, integer, text, text[], boolean) TO authenticated;

-- A copy of a column with its open cards, on the same board (right after the
-- original) or at the end of another board. Returns the new column's id.
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
  v_uid   uuid := auth.uid();
  v_src   public.planning_kanban_columns%ROWTYPE;
  v_board uuid;
  v_pos   integer;
  v_new   uuid;
  v_task  record;
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
    v_src.description, v_src.color, v_src.status_category, v_src.wip_limit, v_pos
  )
  RETURNING id INTO v_new;

  FOR v_task IN
    SELECT t.id, t.is_template FROM public.planning_tasks t
    WHERE t.column_id = p_column_id AND t.deleted_at IS NULL
    ORDER BY t.board_position, t.created_at
  LOOP
    PERFORM public.planning_copy_task(
      v_task.id, v_new, NULL, NULL,
      ARRAY['description','labels','checklists','assignee','dates','cover','priority'],
      v_task.is_template
    );
  END LOOP;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_copy_column(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_copy_column(uuid, uuid, text) TO authenticated;

-- A new board from another one (a copy, or a board made from a template):
-- its labels and open columns, and the cards when p_with_cards. The caller
-- owns it, it starts private and nobody else is added to it.
CREATE OR REPLACE FUNCTION public.planning_copy_board(
  p_board_id    uuid,
  p_title       text,
  p_with_cards  boolean DEFAULT true,
  p_as_template boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_src    public.planning_kanban_boards%ROWTYPE;
  v_new    uuid;
  v_column record;
  v_col_new uuid;
  v_task   record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_src FROM public.planning_kanban_boards
  WHERE id = p_board_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.planning_kanban_boards (
    organization_id, title, description, color, visibility, branch_id,
    is_template, created_by, updated_by
  ) VALUES (
    v_src.organization_id,
    left(coalesce(nullif(btrim(p_title), ''), v_src.title), 160),
    v_src.description, v_src.color, 'private', NULL,
    coalesce(p_as_template, false), v_uid, v_uid
  )
  RETURNING id INTO v_new;

  INSERT INTO public.planning_kanban_board_labels (organization_id, board_id, name, color, position, created_by)
  SELECT v_src.organization_id, v_new, l.name, l.color, l.position, v_uid
  FROM public.planning_kanban_board_labels l
  WHERE l.board_id = p_board_id
  ORDER BY l.position;

  FOR v_column IN
    SELECT * FROM public.planning_kanban_columns
    WHERE board_id = p_board_id AND deleted_at IS NULL AND archived_at IS NULL
    ORDER BY position, created_at
  LOOP
    INSERT INTO public.planning_kanban_columns (
      board_id, organization_id, title, description, color, status_category, wip_limit, position
    ) VALUES (
      v_new, v_src.organization_id, v_column.title, v_column.description, v_column.color,
      v_column.status_category, v_column.wip_limit, v_column.position
    )
    RETURNING id INTO v_col_new;

    IF coalesce(p_with_cards, true) THEN
      FOR v_task IN
        SELECT t.id, t.is_template FROM public.planning_tasks t
        WHERE t.column_id = v_column.id AND t.deleted_at IS NULL
        ORDER BY t.board_position, t.created_at
      LOOP
        PERFORM public.planning_copy_task(
          v_task.id, v_col_new, NULL, NULL,
          ARRAY['description','labels','checklists','assignee','dates','cover','priority'],
          v_task.is_template
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_copy_board(uuid, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_copy_board(uuid, text, boolean, boolean) TO authenticated;
