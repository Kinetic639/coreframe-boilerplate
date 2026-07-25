-- ===========================================================================
-- Planning calendar unscheduled search indexes
-- ===========================================================================
--
-- The calendar sidebar can search capped unscheduled items by title. Trigram
-- indexes keep contains-style ILIKE search bounded for tenant-scoped active
-- unscheduled pools.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS helpdesk_tickets_calendar_unscheduled_title_trgm_idx
  ON public.helpdesk_tickets USING gin (title gin_trgm_ops)
  WHERE deleted_at IS NULL
    AND due_at IS NULL
    AND status NOT IN ('cancelled', 'closed', 'resolved');

CREATE INDEX IF NOT EXISTS planning_tasks_calendar_unscheduled_title_trgm_idx
  ON public.planning_tasks USING gin (title gin_trgm_ops)
  WHERE deleted_at IS NULL
    AND due_at IS NULL
    AND status NOT IN ('cancelled', 'completed');

CREATE INDEX IF NOT EXISTS planning_kanban_cards_calendar_unscheduled_title_trgm_idx
  ON public.planning_kanban_cards USING gin (title gin_trgm_ops)
  WHERE deleted_at IS NULL
    AND due_at IS NULL
    AND is_inbox = false;
