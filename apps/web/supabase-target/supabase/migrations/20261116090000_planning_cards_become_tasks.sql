-- =============================================================================
-- Planning: board cards become tasks (phase 2 of merging Tasks and Boards).
--
-- After phase 1 a task can sit on a board column or in its author's inbox.
-- This migration moves every live kanban card over, so boards show tasks
-- from now on:
--
--   1. Tasks get the card's label (text + colour).
--   2. Each live card becomes a task WITH THE SAME ID, so links, calendar
--      items and comments keep pointing at the same thing. The task keeps the
--      card's title, description, dates, label, author, column and order. Its
--      status comes from the column's status category (open when the column
--      has none). An inbox card becomes an inbox task of its author.
--   3. The card's history is copied to the task's activity, and its comments
--      are moved to the task.
--   4. The moved cards are archived, so nothing reads them twice. The cards
--      table stays until the old code is gone (phase 4).
--
-- Safe to run again: a card that already has its task is skipped.
-- Cards on an archived board or in an archived column are left as they are.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Label on tasks
-- ---------------------------------------------------------------------------

ALTER TABLE public.planning_tasks
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS label_color TEXT;

ALTER TABLE public.planning_tasks
  DROP CONSTRAINT IF EXISTS planning_tasks_label_check;
ALTER TABLE public.planning_tasks
  ADD CONSTRAINT planning_tasks_label_check
  CHECK (
    (label IS NULL OR char_length(label) <= 80)
    AND (label_color IS NULL OR char_length(label_color) <= 32)
  );

-- ---------------------------------------------------------------------------
-- 2-4. Move the cards
-- ---------------------------------------------------------------------------

DO $migrate$
DECLARE
  v_card_ids UUID[];
BEGIN
  CREATE TEMP TABLE _cards_to_move ON COMMIT DROP AS
  SELECT
    c.*,
    col.status_category AS column_status
  FROM public.planning_kanban_cards c
  LEFT JOIN public.planning_kanban_boards b
    ON b.id = c.board_id
  LEFT JOIN public.planning_kanban_columns col
    ON col.id = c.column_id
  WHERE c.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.planning_tasks t WHERE t.id = c.id)
    AND (
      c.is_inbox
      OR (
        b.id IS NOT NULL AND b.deleted_at IS NULL
        AND b.organization_id = c.organization_id
        AND col.id IS NOT NULL AND col.deleted_at IS NULL
        AND col.board_id = c.board_id
      )
    );

  SELECT coalesce(array_agg(id), '{}') INTO v_card_ids FROM _cards_to_move;

  IF cardinality(v_card_ids) = 0 THEN
    RAISE NOTICE 'No kanban cards to move';
    RETURN;
  END IF;

  -- Oldest first, so the new task numbers follow the order cards were made.
  INSERT INTO public.planning_tasks (
    id, organization_id, title, description_plain, description_rich,
    status, priority, created_by, updated_by, created_at, updated_at,
    due_at, due_date,
    calendar_all_day, calendar_start_date, calendar_end_date,
    calendar_start_at, calendar_end_at, calendar_timezone,
    label, label_color,
    board_id, column_id, board_position, is_inbox,
    started_at, completed_at, cancelled_at
  )
  SELECT
    m.id,
    m.organization_id,
    left(m.title, 500),
    m.description,
    m.description_rich,
    coalesce(CASE WHEN m.is_inbox THEN NULL ELSE m.column_status END, 'open'),
    'normal',
    m.created_by,
    m.updated_by,
    m.created_at,
    m.updated_at,
    m.due_at,
    m.due_date,
    m.calendar_all_day, m.calendar_start_date, m.calendar_end_date,
    m.calendar_start_at, m.calendar_end_at, m.calendar_timezone,
    left(m.label, 80),
    left(m.label_color, 32),
    CASE WHEN m.is_inbox THEN NULL ELSE m.board_id END,
    CASE WHEN m.is_inbox THEN NULL ELSE m.column_id END,
    m.position,
    m.is_inbox,
    -- The status dates take the card's last change, not the time of this
    -- migration (the board trigger only fills them when they are empty).
    CASE WHEN NOT m.is_inbox AND m.column_status = 'in_progress' THEN m.updated_at END,
    CASE WHEN NOT m.is_inbox AND m.column_status = 'completed' THEN m.updated_at END,
    CASE WHEN NOT m.is_inbox AND m.column_status = 'cancelled' THEN m.updated_at END
  FROM _cards_to_move m
  ORDER BY m.created_at, m.id;

  INSERT INTO public.planning_task_activity (
    organization_id, task_id, activity_type, actor_id, message, metadata, created_at
  )
  SELECT a.organization_id, a.card_id, a.activity_type, a.actor_id, a.message,
         coalesce(a.metadata, '{}'::jsonb), a.created_at
  FROM public.planning_kanban_card_activity a
  WHERE a.card_id = ANY (v_card_ids);

  -- Re-pointing a comment is not an edit: keep its updated_at and add no
  -- "comment.updated" event.
  ALTER TABLE public.app_comments DISABLE TRIGGER app_comments_audit_events;
  ALTER TABLE public.app_comments DISABLE TRIGGER app_comments_updated_at;
  UPDATE public.app_comments
  SET target_type = 'planning.task'
  WHERE target_type = 'planning.kanban_card'
    AND target_id = ANY (v_card_ids);
  ALTER TABLE public.app_comments ENABLE TRIGGER app_comments_audit_events;
  ALTER TABLE public.app_comments ENABLE TRIGGER app_comments_updated_at;

  UPDATE public.app_comment_events
  SET target_type = 'planning.task'
  WHERE target_type = 'planning.kanban_card'
    AND target_id = ANY (v_card_ids);

  UPDATE public.app_attachments
  SET target_type = 'planning.task'
  WHERE target_type = 'planning.kanban_card'
    AND target_id = ANY (v_card_ids);

  UPDATE public.planning_kanban_cards
  SET deleted_at = now()
  WHERE id = ANY (v_card_ids);

  RAISE NOTICE 'Moved % kanban cards to tasks', cardinality(v_card_ids);
END
$migrate$;
