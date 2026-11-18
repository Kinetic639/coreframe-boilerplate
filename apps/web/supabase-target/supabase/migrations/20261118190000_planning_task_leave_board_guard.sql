-- =============================================================================
-- Planning: only someone who can edit a board may take a task off it.
--
-- The placement policy checks edit rights on the board a task lands on, but
-- for the board it leaves only view rights (the USING side). A person with
-- view-only access to a shared board could therefore move its cards to a board
-- of their own, or (as the author) to their inbox. This trigger closes that:
-- changing a task's board needs edit rights on the old board too.
--
-- Work done without a signed-in user (maintenance, ON DELETE actions) is not
-- affected.
-- =============================================================================

CREATE OR REPLACE FUNCTION public._planning_task_leave_board_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND OLD.board_id IS NOT NULL
    AND NEW.board_id IS DISTINCT FROM OLD.board_id
    AND NOT public.can_edit_planning_board(OLD.board_id) THEN
    RAISE EXCEPTION 'No edit access to the board this task is on' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_tasks_leave_board_guard ON public.planning_tasks;
CREATE TRIGGER planning_tasks_leave_board_guard
  BEFORE UPDATE OF board_id, column_id, is_inbox ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public._planning_task_leave_board_guard();
