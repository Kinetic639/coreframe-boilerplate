-- ===========================================================================
-- Planning Module Migration
-- ===========================================================================

-- Part 1: Permission rows
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('planning.*',              'Planning Wildcard',            'planning', '*'),
  ('planning.read',           'Planning Read',                'planning', 'read'),
  ('planning.tasks.read',     'Planning Tasks Read',          'planning', 'read'),
  ('planning.tasks.create',   'Planning Tasks Create',        'planning', 'create'),
  ('planning.tasks.update',   'Planning Tasks Update',        'planning', 'update'),
  ('planning.tasks.delete',   'Planning Tasks Delete',        'planning', 'delete'),
  ('planning.tasks.assign',   'Planning Tasks Assign',        'planning', 'assign'),
  ('module.planning.access',  'Planning Module Access',       'module',   'access')
ON CONFLICT (slug) DO NOTHING;

-- Part 2: Role-permission seeding
DO $$
DECLARE
  v_owner_id  UUID;
  v_member_id UUID;
  v_perm_id   UUID;
BEGIN
  SELECT id INTO v_owner_id  FROM public.roles WHERE name = 'org_owner'  AND is_basic = true LIMIT 1;
  SELECT id INTO v_member_id FROM public.roles WHERE name = 'org_member' AND is_basic = true LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'planning.*';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_owner_id, v_perm_id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_member_id IS NOT NULL THEN
    FOREACH v_perm_id IN ARRAY ARRAY(
      SELECT id FROM public.permissions
      WHERE slug IN ('planning.read','planning.tasks.read','planning.tasks.create','planning.tasks.update','module.planning.access')
    ) LOOP
      INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_member_id, v_perm_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

-- Part 3: Subscription plan updates
UPDATE public.subscription_plans
SET enabled_modules = array_append(enabled_modules, 'planning'), updated_at = now()
WHERE name IN ('professional', 'enterprise') AND NOT ('planning' = ANY(enabled_modules));

-- Part 4: planning_tasks table
CREATE TABLE IF NOT EXISTS public.planning_tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id)  ON DELETE CASCADE,
  branch_id       UUID        REFERENCES public.branches(id)                ON DELETE SET NULL,
  title           TEXT        NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 500),
  description_plain TEXT,
  description_rich  JSONB,
  status          TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'completed')),
  priority        TEXT        NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to     UUID        REFERENCES public.users(id)  ON DELETE SET NULL,
  created_by      UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by      UUID        REFERENCES public.users(id)  ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER planning_tasks_updated_at
  BEFORE UPDATE ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS planning_tasks_org_idx          ON public.planning_tasks (organization_id)                WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS planning_tasks_org_status_idx   ON public.planning_tasks (organization_id, status)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS planning_tasks_org_assigned_idx ON public.planning_tasks (organization_id, assigned_to)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS planning_tasks_org_created_idx  ON public.planning_tasks (organization_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS planning_tasks_branch_idx       ON public.planning_tasks (branch_id)                       WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

-- Part 5: planning_task_comments table
CREATE TABLE IF NOT EXISTS public.planning_task_comments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID        NOT NULL REFERENCES public.planning_tasks(id)  ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id)   ON DELETE CASCADE,
  body            TEXT        NOT NULL CHECK (char_length(body) > 0),
  body_rich       JSONB,
  created_by      UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER planning_task_comments_updated_at
  BEFORE UPDATE ON public.planning_task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS planning_task_comments_task_idx ON public.planning_task_comments (task_id) WHERE deleted_at IS NULL;

-- Part 6: RLS
ALTER TABLE public.planning_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planning_tasks_select" ON public.planning_tasks FOR SELECT TO authenticated
  USING (is_org_member(organization_id) AND has_permission(organization_id, 'planning.tasks.read'));

CREATE POLICY "planning_tasks_insert" ON public.planning_tasks FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'planning.tasks.create'));

CREATE POLICY "planning_tasks_update" ON public.planning_tasks FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND ((deleted_at IS NULL AND has_permission(organization_id, 'planning.tasks.update')) OR has_permission(organization_id, 'planning.tasks.delete')))
  WITH CHECK (is_org_member(organization_id) AND ((deleted_at IS NULL AND has_permission(organization_id, 'planning.tasks.update')) OR has_permission(organization_id, 'planning.tasks.delete')));

CREATE POLICY "planning_tasks_delete" ON public.planning_tasks FOR DELETE TO authenticated USING (false);

CREATE POLICY "planning_task_comments_select" ON public.planning_task_comments FOR SELECT TO authenticated
  USING (is_org_member(organization_id) AND has_permission(organization_id, 'planning.tasks.read'));

CREATE POLICY "planning_task_comments_insert" ON public.planning_task_comments FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'planning.tasks.create'));

CREATE POLICY "planning_task_comments_update" ON public.planning_task_comments FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND has_permission(organization_id, 'planning.tasks.update'))
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'planning.tasks.update'));

CREATE POLICY "planning_task_comments_delete" ON public.planning_task_comments FOR DELETE TO authenticated USING (false);
