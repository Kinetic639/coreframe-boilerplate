-- Calendar scheduling fields for planning tasks and kanban cards.
--
-- due_date remains the deadline/all-day due marker. The calendar_* fields
-- represent an optional scheduled block. Items with no calendar_* fields remain
-- deadline-only or unscheduled.

ALTER TABLE public.planning_tasks
  ADD COLUMN IF NOT EXISTS calendar_all_day BOOLEAN,
  ADD COLUMN IF NOT EXISTS calendar_start_date DATE,
  ADD COLUMN IF NOT EXISTS calendar_end_date DATE,
  ADD COLUMN IF NOT EXISTS calendar_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendar_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendar_timezone TEXT;

ALTER TABLE public.planning_kanban_cards
  ADD COLUMN IF NOT EXISTS calendar_all_day BOOLEAN,
  ADD COLUMN IF NOT EXISTS calendar_start_date DATE,
  ADD COLUMN IF NOT EXISTS calendar_end_date DATE,
  ADD COLUMN IF NOT EXISTS calendar_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendar_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendar_timezone TEXT;

DO $$
BEGIN
  ALTER TABLE public.planning_tasks
    ADD CONSTRAINT planning_tasks_calendar_schedule_shape CHECK (
      (
        calendar_all_day IS NULL
        AND calendar_start_date IS NULL
        AND calendar_end_date IS NULL
        AND calendar_start_at IS NULL
        AND calendar_end_at IS NULL
        AND calendar_timezone IS NULL
      )
      OR
      (
        calendar_all_day = true
        AND calendar_start_date IS NOT NULL
        AND calendar_end_date IS NOT NULL
        AND calendar_start_at IS NULL
        AND calendar_end_at IS NULL
        AND calendar_end_date >= calendar_start_date
        AND calendar_timezone IS NOT NULL
      )
      OR
      (
        calendar_all_day = false
        AND calendar_start_date IS NULL
        AND calendar_end_date IS NULL
        AND calendar_start_at IS NOT NULL
        AND calendar_end_at IS NOT NULL
        AND calendar_end_at > calendar_start_at
        AND calendar_timezone IS NOT NULL
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.planning_kanban_cards
    ADD CONSTRAINT planning_kanban_cards_calendar_schedule_shape CHECK (
      (
        calendar_all_day IS NULL
        AND calendar_start_date IS NULL
        AND calendar_end_date IS NULL
        AND calendar_start_at IS NULL
        AND calendar_end_at IS NULL
        AND calendar_timezone IS NULL
      )
      OR
      (
        calendar_all_day = true
        AND calendar_start_date IS NOT NULL
        AND calendar_end_date IS NOT NULL
        AND calendar_start_at IS NULL
        AND calendar_end_at IS NULL
        AND calendar_end_date >= calendar_start_date
        AND calendar_timezone IS NOT NULL
      )
      OR
      (
        calendar_all_day = false
        AND calendar_start_date IS NULL
        AND calendar_end_date IS NULL
        AND calendar_start_at IS NOT NULL
        AND calendar_end_at IS NOT NULL
        AND calendar_end_at > calendar_start_at
        AND calendar_timezone IS NOT NULL
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS planning_tasks_calendar_all_day_range_idx
  ON public.planning_tasks (organization_id, calendar_start_date, calendar_end_date)
  WHERE deleted_at IS NULL AND calendar_all_day = true;

CREATE INDEX IF NOT EXISTS planning_tasks_calendar_timed_range_idx
  ON public.planning_tasks (organization_id, calendar_start_at, calendar_end_at)
  WHERE deleted_at IS NULL AND calendar_all_day = false;

CREATE INDEX IF NOT EXISTS planning_kanban_cards_calendar_all_day_range_idx
  ON public.planning_kanban_cards (board_id, calendar_start_date, calendar_end_date)
  WHERE deleted_at IS NULL AND calendar_all_day = true;

CREATE INDEX IF NOT EXISTS planning_kanban_cards_calendar_timed_range_idx
  ON public.planning_kanban_cards (board_id, calendar_start_at, calendar_end_at)
  WHERE deleted_at IS NULL AND calendar_all_day = false;
