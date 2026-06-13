-- ===========================================================================
-- Calendar-native due dates
-- ===========================================================================
--
-- due_at remains for existing detail screens and timestamp-aware workflows.
-- due_date is the calendar-native all-day value used by the unified planning
-- calendar, avoiding timezone shifts in range queries and drag/drop updates.

ALTER TABLE public.planning_tasks
  ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.planning_kanban_cards
  ADD COLUMN IF NOT EXISTS due_date DATE;

UPDATE public.planning_tasks
SET due_date = due_at::date
WHERE due_date IS NULL
  AND due_at IS NOT NULL;

UPDATE public.helpdesk_tickets
SET due_date = due_at::date
WHERE due_date IS NULL
  AND due_at IS NOT NULL;

UPDATE public.planning_kanban_cards
SET due_date = due_at::date
WHERE due_date IS NULL
  AND due_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_due_date_from_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.due_date IS NULL AND NEW.due_at IS NOT NULL THEN
      NEW.due_date := NEW.due_at::date;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.due_at IS NULL AND OLD.due_at IS NOT NULL AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date THEN
      NEW.due_date := NULL;
    ELSIF NEW.due_at IS DISTINCT FROM OLD.due_at
      AND NEW.due_at IS NOT NULL
      AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date THEN
      NEW.due_date := NEW.due_at::date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_tasks_sync_due_date ON public.planning_tasks;
CREATE TRIGGER planning_tasks_sync_due_date
  BEFORE INSERT OR UPDATE OF due_at, due_date ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_due_date_from_due_at();

DROP TRIGGER IF EXISTS helpdesk_tickets_sync_due_date ON public.helpdesk_tickets;
CREATE TRIGGER helpdesk_tickets_sync_due_date
  BEFORE INSERT OR UPDATE OF due_at, due_date ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.sync_due_date_from_due_at();

DROP TRIGGER IF EXISTS planning_kanban_cards_sync_due_date ON public.planning_kanban_cards;
CREATE TRIGGER planning_kanban_cards_sync_due_date
  BEFORE INSERT OR UPDATE OF due_at, due_date ON public.planning_kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.sync_due_date_from_due_at();

CREATE INDEX IF NOT EXISTS planning_tasks_org_due_date_idx
  ON public.planning_tasks (organization_id, due_date)
  WHERE deleted_at IS NULL AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS helpdesk_tickets_org_due_date_idx
  ON public.helpdesk_tickets (org_id, due_date)
  WHERE deleted_at IS NULL AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS planning_kanban_cards_due_date_idx
  ON public.planning_kanban_cards (board_id, due_date)
  WHERE deleted_at IS NULL AND due_date IS NOT NULL;
