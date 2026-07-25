-- ===========================================================================
-- Planning tasks hardening
-- ===========================================================================
--
-- Fixes drift found during the planning/tasks audit:
-- - task-number trigger function had no fixed search_path
-- - existing compiled permission snapshots did not include newly added planning
--   permissions until users were recompiled
-- - planning task tables should force RLS and have FK/helper indexes for common
--   joins, deletes, and audit lookups.

CREATE OR REPLACE FUNCTION public.generate_planning_task_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.task_number IS NULL THEN
    NEW.task_number := 'PT-' || LPAD(nextval('public.planning_task_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.planning_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.planning_task_activity FORCE ROW LEVEL SECURITY;
ALTER TABLE public.planning_settings FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS planning_tasks_org_due_at_idx
  ON public.planning_tasks (organization_id, due_at)
  WHERE deleted_at IS NULL AND due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS planning_tasks_org_updated_by_idx
  ON public.planning_tasks (organization_id, updated_by)
  WHERE deleted_at IS NULL AND updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS planning_task_activity_actor_idx
  ON public.planning_task_activity (actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS planning_task_activity_branch_idx
  ON public.planning_task_activity (branch_id, created_at DESC)
  WHERE branch_id IS NOT NULL;

DO $$
DECLARE
  membership RECORD;
BEGIN
  FOR membership IN
    SELECT DISTINCT user_id, organization_id
    FROM public.organization_members
    WHERE status = 'active'
      AND deleted_at IS NULL
  LOOP
    PERFORM public.compile_user_permissions(membership.user_id, membership.organization_id);
  END LOOP;
END;
$$;
