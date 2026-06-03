-- ===========================================================================
-- Planning Tasks V2: task_number, cancelled status, activity table
-- ===========================================================================

-- 1. Add missing columns to planning_tasks
ALTER TABLE public.planning_tasks
  ADD COLUMN IF NOT EXISTS task_number TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ;

-- 2. Drop old status constraint and add cancelled
ALTER TABLE public.planning_tasks DROP CONSTRAINT IF EXISTS planning_tasks_status_check;
ALTER TABLE public.planning_tasks ADD CONSTRAINT planning_tasks_status_check
  CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'));

-- 3. Sequence for task numbers
CREATE SEQUENCE IF NOT EXISTS public.planning_task_number_seq;

-- 4. Trigger function
CREATE OR REPLACE FUNCTION public.generate_planning_task_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.task_number IS NULL THEN
    NEW.task_number := 'PT-' || LPAD(nextval('public.planning_task_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Attach trigger
DROP TRIGGER IF EXISTS planning_tasks_task_number ON public.planning_tasks;
CREATE TRIGGER planning_tasks_task_number
  BEFORE INSERT ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public.generate_planning_task_number();

-- 6. Backfill existing rows
UPDATE public.planning_tasks
SET task_number = 'PT-' || LPAD(nextval('public.planning_task_number_seq')::TEXT, 6, '0')
WHERE task_number IS NULL;

-- 7. Now enforce NOT NULL + unique
ALTER TABLE public.planning_tasks ALTER COLUMN task_number SET NOT NULL;
ALTER TABLE public.planning_tasks DROP CONSTRAINT IF EXISTS planning_tasks_task_number_unique;
ALTER TABLE public.planning_tasks ADD CONSTRAINT planning_tasks_task_number_unique UNIQUE (task_number);

CREATE INDEX IF NOT EXISTS planning_tasks_task_number_idx ON public.planning_tasks (task_number);

-- 8. planning_task_activity table
CREATE TABLE IF NOT EXISTS public.planning_task_activity (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        REFERENCES public.branches(id) ON DELETE SET NULL,
  task_id         UUID        NOT NULL REFERENCES public.planning_tasks(id) ON DELETE CASCADE,
  activity_type   TEXT        NOT NULL,
  actor_id        UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  message         TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planning_task_activity_task_idx ON public.planning_task_activity (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS planning_task_activity_org_idx  ON public.planning_task_activity (organization_id, created_at DESC);

-- 9. RLS for activity table
ALTER TABLE public.planning_task_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_task_activity_select" ON public.planning_task_activity;
DROP POLICY IF EXISTS "planning_task_activity_insert" ON public.planning_task_activity;
DROP POLICY IF EXISTS "planning_task_activity_update" ON public.planning_task_activity;
DROP POLICY IF EXISTS "planning_task_activity_delete" ON public.planning_task_activity;

CREATE POLICY "planning_task_activity_select" ON public.planning_task_activity
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id) AND has_permission(organization_id, 'planning.tasks.read'));

CREATE POLICY "planning_task_activity_insert" ON public.planning_task_activity
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'planning.tasks.read'));

CREATE POLICY "planning_task_activity_update" ON public.planning_task_activity
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "planning_task_activity_delete" ON public.planning_task_activity
  FOR DELETE TO authenticated USING (false);
