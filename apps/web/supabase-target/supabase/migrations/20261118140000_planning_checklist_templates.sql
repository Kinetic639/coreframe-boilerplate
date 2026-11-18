-- =============================================================================
-- Planning: checklist templates.
--
-- A template is a named list of items (each with an optional person and an
-- optional due date counted in days from the moment it is added). Adding a
-- template to a task copies it into an ordinary checklist: later changes to
-- the template do not touch checklists already in tasks.
--
--   * Everyone who reads planning tasks sees the organization's templates.
--   * Whoever can edit tasks makes templates and changes their own ones;
--     planning.settings.manage changes all of them.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.planning_checklist_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  -- [{ "title": text, "assigned_to": uuid | null, "due_offset_days": int | null }]
  items           jsonb NOT NULL DEFAULT '[]'::jsonb
                  CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 200),
  created_by      uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planning_checklist_templates_org_idx
  ON public.planning_checklist_templates (organization_id, title);

CREATE OR REPLACE FUNCTION public.planning_checklist_templates_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.organization_id := OLD.organization_id;
  -- A user's own edit: kept author, stamped editor. A removed user's account
  -- (ON DELETE SET NULL, no signed-in user) clears the link as asked.
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_checklist_templates_touch ON public.planning_checklist_templates;
CREATE TRIGGER planning_checklist_templates_touch
  BEFORE UPDATE ON public.planning_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.planning_checklist_templates_touch();

ALTER TABLE public.planning_checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planning_checklist_templates_select ON public.planning_checklist_templates;
CREATE POLICY planning_checklist_templates_select ON public.planning_checklist_templates
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.tasks.read')
  );

DROP POLICY IF EXISTS planning_checklist_templates_insert ON public.planning_checklist_templates;
CREATE POLICY planning_checklist_templates_insert ON public.planning_checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.tasks.update')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS planning_checklist_templates_update ON public.planning_checklist_templates;
CREATE POLICY planning_checklist_templates_update ON public.planning_checklist_templates
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.tasks.update')
    AND (created_by = auth.uid()
         OR public.has_permission(organization_id, 'planning.settings.manage'))
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.tasks.update')
  );

DROP POLICY IF EXISTS planning_checklist_templates_delete ON public.planning_checklist_templates;
CREATE POLICY planning_checklist_templates_delete ON public.planning_checklist_templates
  FOR DELETE TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.tasks.update')
    AND (created_by = auth.uid()
         OR public.has_permission(organization_id, 'planning.settings.manage'))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_checklist_templates TO authenticated;

-- ---------------------------------------------------------------------------
-- Adding a template to a task: one checklist with the template's items.
-- Runs as the caller, so the checklist policies decide who may do it.
-- A person who has left the organization is not assigned.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planning_apply_checklist_template(
  p_task_id     uuid,
  p_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_task      public.planning_tasks%ROWTYPE;
  v_template  public.planning_checklist_templates%ROWTYPE;
  v_list      uuid;
  v_pos       integer;
  v_item      jsonb;
  v_index     integer := 0;
  v_assignee  uuid;
  v_offset    integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task FROM public.planning_tasks
  WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_template FROM public.planning_checklist_templates
  WHERE id = p_template_id AND organization_id = v_task.organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist template not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_pos FROM public.planning_task_checklists WHERE task_id = p_task_id;

  INSERT INTO public.planning_task_checklists (organization_id, task_id, title, position, created_by)
  VALUES (v_task.organization_id, p_task_id, left(v_template.title, 200), v_pos, v_uid)
  RETURNING id INTO v_list;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_template.items)
  LOOP
    CONTINUE WHEN coalesce(btrim(v_item->>'title'), '') = '';

    v_assignee := NULL;
    IF coalesce(v_item->>'assigned_to', '') ~* '^[0-9a-f-]{36}$' THEN
      SELECT m.user_id INTO v_assignee FROM public.organization_members m
      WHERE m.organization_id = v_task.organization_id
        AND m.user_id = (v_item->>'assigned_to')::uuid
        AND m.status = 'active' AND m.deleted_at IS NULL
      LIMIT 1;
    END IF;

    v_offset := NULL;
    IF coalesce(v_item->>'due_offset_days', '') ~ '^-?[0-9]{1,4}$' THEN
      v_offset := (v_item->>'due_offset_days')::integer;
    END IF;

    INSERT INTO public.planning_task_checklist_items (
      organization_id, checklist_id, task_id, title, assigned_to, due_at, position, created_by
    ) VALUES (
      v_task.organization_id, v_list, p_task_id,
      left(btrim(v_item->>'title'), 500),
      v_assignee,
      CASE WHEN v_offset IS NULL THEN NULL ELSE now() + make_interval(days => v_offset) END,
      v_index,
      v_uid
    );
    v_index := v_index + 1;
  END LOOP;

  RETURN v_list;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_apply_checklist_template(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_apply_checklist_template(uuid, uuid) TO authenticated;
