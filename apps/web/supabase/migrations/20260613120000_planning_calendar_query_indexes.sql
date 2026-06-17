-- ===========================================================================
-- Planning calendar query indexes
-- ===========================================================================
--
-- The unified planning calendar loads scheduled records by visible date range
-- and a small capped unscheduled pool. These partial indexes keep those paths
-- scoped to active tenant rows without bloating writes for archived records.

CREATE INDEX IF NOT EXISTS helpdesk_tickets_org_due_at_idx
  ON public.helpdesk_tickets (org_id, due_at)
  WHERE deleted_at IS NULL AND due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS helpdesk_tickets_org_unscheduled_updated_idx
  ON public.helpdesk_tickets (org_id, updated_at DESC)
  WHERE deleted_at IS NULL
    AND due_at IS NULL
    AND status NOT IN ('cancelled', 'closed', 'resolved');

CREATE INDEX IF NOT EXISTS planning_tasks_org_unscheduled_updated_idx
  ON public.planning_tasks (organization_id, updated_at DESC)
  WHERE deleted_at IS NULL
    AND due_at IS NULL
    AND status NOT IN ('cancelled', 'completed');
