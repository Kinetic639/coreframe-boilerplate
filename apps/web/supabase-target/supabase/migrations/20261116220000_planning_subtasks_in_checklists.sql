-- =============================================================================
-- Planning: sub-tasks live in the card's checklist
--
-- A checklist item can stand for a sub-task (linked_task_id). The database
-- keeps the two in step, so every way of making or changing a sub-task shows
-- in the parent's checklist:
--   * a task gets a parent        -> an item for it in the parent's first
--                                    checklist (one is made when there is none)
--   * it loses its parent, moves  -> its item goes (or moves to the new parent)
--     or is deleted
--   * its title or status changes -> the item's title and tick follow
--   * the item is ticked          -> the task is completed / reopened
--   * the item is deleted         -> the task stays, no longer a sub-task
--
-- Existing sub-tasks get their items here (backfill at the end).
-- Idempotent.
-- =============================================================================

ALTER TABLE public.planning_task_checklist_items
  ADD COLUMN IF NOT EXISTS linked_task_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planning_task_checklist_items_linked_task_id_fkey'
  ) THEN
    ALTER TABLE public.planning_task_checklist_items
      ADD CONSTRAINT planning_task_checklist_items_linked_task_id_fkey
      FOREIGN KEY (linked_task_id) REFERENCES public.planning_tasks(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS planning_task_checklist_items_linked_task_uidx
  ON public.planning_task_checklist_items (linked_task_id)
  WHERE linked_task_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- A task -> its item in the parent's checklist. DEFINER: whoever may change
-- the sub-task keeps the parent's checklist right, as the parent's count did.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._planning_sync_subtask_item(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_task      public.planning_tasks%ROWTYPE;
  v_item      public.planning_task_checklist_items%ROWTYPE;
  v_parent    uuid;
  v_done      boolean;
  v_checklist uuid;
  v_position  integer;
BEGIN
  SELECT * INTO v_task FROM public.planning_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_parent := CASE WHEN v_task.deleted_at IS NULL THEN v_task.parent_task_id END;
  v_done := v_task.status IN ('completed', 'cancelled');

  SELECT * INTO v_item
  FROM public.planning_task_checklist_items
  WHERE linked_task_id = p_task_id;

  IF FOUND AND (v_parent IS NULL OR v_item.task_id <> v_parent) THEN
    -- No longer a sub-task here. The task's parent already moved on, so the
    -- delete below leaves the task alone (see _planning_checklist_item_unlink).
    DELETE FROM public.planning_task_checklist_items WHERE id = v_item.id;
  ELSIF FOUND THEN
    IF v_item.is_done IS DISTINCT FROM v_done
       OR v_item.title IS DISTINCT FROM left(v_task.title, 500) THEN
      UPDATE public.planning_task_checklist_items
      SET title = left(v_task.title, 500),
          is_done = v_done,
          done_at = CASE WHEN v_done THEN coalesce(done_at, now()) END,
          done_by = CASE WHEN v_done THEN done_by END
      WHERE id = v_item.id;
    END IF;
    RETURN;
  END IF;

  IF v_parent IS NULL THEN
    RETURN;
  END IF;

  SELECT c.id INTO v_checklist
  FROM public.planning_task_checklists c
  WHERE c.task_id = v_parent
  ORDER BY c.position, c.created_at
  LIMIT 1;

  IF v_checklist IS NULL THEN
    INSERT INTO public.planning_task_checklists (organization_id, task_id, title, position, created_by)
    SELECT p.organization_id, p.id, 'Lista kontrolna', 0, v_task.created_by
    FROM public.planning_tasks p
    WHERE p.id = v_parent
    RETURNING id INTO v_checklist;
  END IF;

  SELECT coalesce(max(position), -1) + 1 INTO v_position
  FROM public.planning_task_checklist_items
  WHERE checklist_id = v_checklist;

  INSERT INTO public.planning_task_checklist_items (
    organization_id, checklist_id, task_id, title, is_done, done_at,
    position, created_by, linked_task_id
  ) VALUES (
    v_task.organization_id, v_checklist, v_parent, left(v_task.title, 500), v_done,
    CASE WHEN v_done THEN now() END, v_position, v_task.created_by, p_task_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public._planning_sync_subtask_item(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._planning_task_subtask_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_task_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.parent_task_id IS NULL AND OLD.parent_task_id IS NULL THEN
    RETURN NULL;
  END IF;
  PERFORM public._planning_sync_subtask_item(NEW.id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._planning_task_subtask_item() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS planning_tasks_subtask_item ON public.planning_tasks;
CREATE TRIGGER planning_tasks_subtask_item
  AFTER INSERT OR UPDATE OF parent_task_id, status, deleted_at, title ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public._planning_task_subtask_item();

-- ---------------------------------------------------------------------------
-- An item -> its task. INVOKER: ticking a sub-task needs the right to edit
-- it, exactly as changing its status does.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._planning_checklist_item_tick()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.linked_task_id IS NULL OR NEW.is_done IS NOT DISTINCT FROM OLD.is_done THEN
    RETURN NULL;
  END IF;
  UPDATE public.planning_tasks
  SET status = CASE WHEN NEW.is_done THEN 'completed' ELSE 'open' END
  WHERE id = NEW.linked_task_id
    AND deleted_at IS NULL
    AND (status IN ('completed', 'cancelled')) IS DISTINCT FROM NEW.is_done;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS planning_task_checklist_items_tick ON public.planning_task_checklist_items;
CREATE TRIGGER planning_task_checklist_items_tick
  AFTER UPDATE OF is_done ON public.planning_task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public._planning_checklist_item_tick();

-- Deleting a sub-task's item (or its whole checklist) keeps the task and
-- makes it a task of its own. A task that already left this parent, or was
-- deleted, is not touched.
CREATE OR REPLACE FUNCTION public._planning_checklist_item_unlink()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.linked_task_id IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.planning_tasks
  SET parent_task_id = NULL
  WHERE id = OLD.linked_task_id
    AND parent_task_id = OLD.task_id
    AND deleted_at IS NULL;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS planning_task_checklist_items_unlink ON public.planning_task_checklist_items;
CREATE TRIGGER planning_task_checklist_items_unlink
  AFTER DELETE ON public.planning_task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public._planning_checklist_item_unlink();

-- ---------------------------------------------------------------------------
-- Backfill: every live sub-task gets its item.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT t.id
    FROM public.planning_tasks t
    WHERE t.parent_task_id IS NOT NULL
      AND t.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.planning_task_checklist_items i WHERE i.linked_task_id = t.id
      )
    ORDER BY t.created_at
  LOOP
    PERFORM public._planning_sync_subtask_item(v_id);
  END LOOP;
END;
$$;
