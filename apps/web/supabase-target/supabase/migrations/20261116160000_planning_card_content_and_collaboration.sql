-- =============================================================================
-- Planning boards, stages 4 and 5: card content and collaboration
--
--  * Board labels: each board has its own set of labels (name + colour) and a
--    task can carry several of them. The free-text label of a task stays for
--    tasks outside a board (the inbox); on boards it is copied into the new
--    labels once, below.
--  * Checklists: several per task, items with an optional person and due date.
--  * Watchers: people who follow a task and are told about its comments and
--    status changes, like its author and assignee.
--  * Cover: a colour or an image attachment shown on top of the card.
--  * Due time: due_has_time tells a due date with an hour from a plain day
--    (a plain day is still stored at 12:00 UTC). A start date uses the
--    existing calendar fields (an all-day range from start to due).
--  * Mentions in a task's description notify the person mentioned.
--  * Realtime: board tasks and columns are published so open boards refresh.
--
-- Who may do what follows the task itself: the helper functions run as the
-- caller (SECURITY INVOKER), so "the task is visible" means the caller passes
-- the RLS of planning_tasks (permissions, branch, private inbox, board access).
-- Additive only: new tables, new columns, new or replaced functions/triggers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The caller can see the task (RLS of planning_tasks decides).
CREATE OR REPLACE FUNCTION public.can_read_planning_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.planning_tasks t
    WHERE t.id = p_task AND t.deleted_at IS NULL
  );
$$;

-- The caller can change the task: sees it, may update tasks (in its branch)
-- and, for a task on a board, may edit that board.
CREATE OR REPLACE FUNCTION public.can_edit_planning_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.planning_tasks t
    WHERE t.id = p_task
      AND t.deleted_at IS NULL
      AND CASE
            WHEN t.branch_id IS NULL
              THEN public.has_permission(t.organization_id, 'planning.tasks.update')
            ELSE public.has_branch_permission(t.organization_id, t.branch_id, 'planning.tasks.update')
          END
      AND (t.board_id IS NULL OR public.can_edit_planning_board(t.board_id))
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_planning_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_planning_task(uuid) TO authenticated;

-- A change to a task's labels, checklists or watchers touches the task, so
-- its updated_at moves and open boards (realtime) refresh it.
CREATE OR REPLACE FUNCTION public._planning_touch_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_task uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.task_id ELSE NEW.task_id END;
BEGIN
  UPDATE public.planning_tasks SET updated_at = now()
  WHERE id = v_task AND deleted_at IS NULL;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._planning_touch_task() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Board labels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_kanban_board_labels (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id        uuid        NOT NULL REFERENCES public.planning_kanban_boards(id) ON DELETE CASCADE,
  name            text        NOT NULL DEFAULT '' CHECK (char_length(name) <= 60),
  color           text        NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  position        integer     NOT NULL DEFAULT 0,
  created_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planning_kanban_board_labels_board_idx
  ON public.planning_kanban_board_labels (board_id, position);

ALTER TABLE public.planning_kanban_board_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_kanban_board_labels FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_kanban_board_labels_select" ON public.planning_kanban_board_labels;
CREATE POLICY "planning_kanban_board_labels_select" ON public.planning_kanban_board_labels
  FOR SELECT TO authenticated
  USING (
    public.has_permission(organization_id, 'planning.boards.read')
    AND public.can_view_planning_board(board_id)
  );

DROP POLICY IF EXISTS "planning_kanban_board_labels_insert" ON public.planning_kanban_board_labels;
CREATE POLICY "planning_kanban_board_labels_insert" ON public.planning_kanban_board_labels
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
    AND EXISTS (
      SELECT 1 FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_board_labels.board_id
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_board_labels.organization_id
    )
  );

DROP POLICY IF EXISTS "planning_kanban_board_labels_update" ON public.planning_kanban_board_labels;
CREATE POLICY "planning_kanban_board_labels_update" ON public.planning_kanban_board_labels
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
  )
  WITH CHECK (
    public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
  );

DROP POLICY IF EXISTS "planning_kanban_board_labels_delete" ON public.planning_kanban_board_labels;
CREATE POLICY "planning_kanban_board_labels_delete" ON public.planning_kanban_board_labels
  FOR DELETE TO authenticated
  USING (
    public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_kanban_board_labels TO authenticated;

-- A label on a task (a task carries labels of its own board only)
CREATE TABLE IF NOT EXISTS public.planning_task_labels (
  task_id         uuid        NOT NULL REFERENCES public.planning_tasks(id) ON DELETE CASCADE,
  label_id        uuid        NOT NULL REFERENCES public.planning_kanban_board_labels(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, label_id)
);

CREATE INDEX IF NOT EXISTS planning_task_labels_label_idx
  ON public.planning_task_labels (label_id);

ALTER TABLE public.planning_task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_task_labels FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_task_labels_select" ON public.planning_task_labels;
CREATE POLICY "planning_task_labels_select" ON public.planning_task_labels
  FOR SELECT TO authenticated
  USING (public.can_read_planning_task(task_id));

DROP POLICY IF EXISTS "planning_task_labels_insert" ON public.planning_task_labels;
CREATE POLICY "planning_task_labels_insert" ON public.planning_task_labels
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_planning_task(task_id)
    AND EXISTS (
      SELECT 1
      FROM public.planning_tasks t
      JOIN public.planning_kanban_board_labels l ON l.board_id = t.board_id
      WHERE t.id = planning_task_labels.task_id
        AND l.id = planning_task_labels.label_id
        AND t.organization_id = planning_task_labels.organization_id
    )
  );

DROP POLICY IF EXISTS "planning_task_labels_delete" ON public.planning_task_labels;
CREATE POLICY "planning_task_labels_delete" ON public.planning_task_labels
  FOR DELETE TO authenticated
  USING (public.can_edit_planning_task(task_id));

GRANT SELECT, INSERT, DELETE ON public.planning_task_labels TO authenticated;

DROP TRIGGER IF EXISTS planning_task_labels_touch ON public.planning_task_labels;
CREATE TRIGGER planning_task_labels_touch
  AFTER INSERT OR DELETE ON public.planning_task_labels
  FOR EACH ROW EXECUTE FUNCTION public._planning_touch_task();

-- The free-text labels already on board tasks become board labels, once.
DO $$
BEGIN
  INSERT INTO public.planning_kanban_board_labels (organization_id, board_id, name, color, position)
  SELECT DISTINCT ON (t.board_id, lower(btrim(t.label)))
    t.organization_id,
    t.board_id,
    left(btrim(t.label), 60),
    CASE WHEN t.label_color ~ '^#[0-9a-fA-F]{6}$' THEN t.label_color ELSE '#475569' END,
    0
  FROM public.planning_tasks t
  WHERE t.board_id IS NOT NULL
    AND t.deleted_at IS NULL
    AND nullif(btrim(coalesce(t.label, '')), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.planning_kanban_board_labels l
      WHERE l.board_id = t.board_id AND lower(l.name) = lower(left(btrim(t.label), 60))
    )
  ORDER BY t.board_id, lower(btrim(t.label)), t.updated_at DESC;

  INSERT INTO public.planning_task_labels (task_id, label_id, organization_id)
  SELECT t.id, l.id, t.organization_id
  FROM public.planning_tasks t
  JOIN public.planning_kanban_board_labels l
    ON l.board_id = t.board_id AND lower(l.name) = lower(left(btrim(t.label), 60))
  WHERE t.board_id IS NOT NULL
    AND nullif(btrim(coalesce(t.label, '')), '') IS NOT NULL
  ON CONFLICT DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- Checklists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_task_checklists (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id         uuid        NOT NULL REFERENCES public.planning_tasks(id) ON DELETE CASCADE,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  position        integer     NOT NULL DEFAULT 0,
  created_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planning_task_checklists_task_idx
  ON public.planning_task_checklists (task_id, position);

CREATE TABLE IF NOT EXISTS public.planning_task_checklist_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  checklist_id    uuid        NOT NULL REFERENCES public.planning_task_checklists(id) ON DELETE CASCADE,
  task_id         uuid        NOT NULL REFERENCES public.planning_tasks(id) ON DELETE CASCADE,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  is_done         boolean     NOT NULL DEFAULT false,
  done_at         timestamptz,
  done_by         uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  due_at          timestamptz,
  position        integer     NOT NULL DEFAULT 0,
  created_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planning_task_checklist_items_checklist_idx
  ON public.planning_task_checklist_items (checklist_id, position);
CREATE INDEX IF NOT EXISTS planning_task_checklist_items_task_idx
  ON public.planning_task_checklist_items (task_id);

ALTER TABLE public.planning_task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_task_checklists FORCE ROW LEVEL SECURITY;
ALTER TABLE public.planning_task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_task_checklist_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_task_checklists_select" ON public.planning_task_checklists;
CREATE POLICY "planning_task_checklists_select" ON public.planning_task_checklists
  FOR SELECT TO authenticated
  USING (public.can_read_planning_task(task_id));

DROP POLICY IF EXISTS "planning_task_checklists_insert" ON public.planning_task_checklists;
CREATE POLICY "planning_task_checklists_insert" ON public.planning_task_checklists
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_planning_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.planning_tasks t
      WHERE t.id = planning_task_checklists.task_id
        AND t.organization_id = planning_task_checklists.organization_id
    )
  );

DROP POLICY IF EXISTS "planning_task_checklists_update" ON public.planning_task_checklists;
CREATE POLICY "planning_task_checklists_update" ON public.planning_task_checklists
  FOR UPDATE TO authenticated
  USING (public.can_edit_planning_task(task_id))
  WITH CHECK (public.can_edit_planning_task(task_id));

DROP POLICY IF EXISTS "planning_task_checklists_delete" ON public.planning_task_checklists;
CREATE POLICY "planning_task_checklists_delete" ON public.planning_task_checklists
  FOR DELETE TO authenticated
  USING (public.can_edit_planning_task(task_id));

DROP POLICY IF EXISTS "planning_task_checklist_items_select" ON public.planning_task_checklist_items;
CREATE POLICY "planning_task_checklist_items_select" ON public.planning_task_checklist_items
  FOR SELECT TO authenticated
  USING (public.can_read_planning_task(task_id));

DROP POLICY IF EXISTS "planning_task_checklist_items_insert" ON public.planning_task_checklist_items;
CREATE POLICY "planning_task_checklist_items_insert" ON public.planning_task_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_planning_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.planning_task_checklists c
      WHERE c.id = planning_task_checklist_items.checklist_id
        AND c.task_id = planning_task_checklist_items.task_id
        AND c.organization_id = planning_task_checklist_items.organization_id
    )
  );

DROP POLICY IF EXISTS "planning_task_checklist_items_update" ON public.planning_task_checklist_items;
CREATE POLICY "planning_task_checklist_items_update" ON public.planning_task_checklist_items
  FOR UPDATE TO authenticated
  USING (public.can_edit_planning_task(task_id))
  WITH CHECK (
    public.can_edit_planning_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.planning_task_checklists c
      WHERE c.id = planning_task_checklist_items.checklist_id AND c.task_id = planning_task_checklist_items.task_id
    )
  );

DROP POLICY IF EXISTS "planning_task_checklist_items_delete" ON public.planning_task_checklist_items;
CREATE POLICY "planning_task_checklist_items_delete" ON public.planning_task_checklist_items
  FOR DELETE TO authenticated
  USING (public.can_edit_planning_task(task_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_task_checklists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_task_checklist_items TO authenticated;

DROP TRIGGER IF EXISTS planning_task_checklists_touch ON public.planning_task_checklists;
CREATE TRIGGER planning_task_checklists_touch
  AFTER INSERT OR DELETE ON public.planning_task_checklists
  FOR EACH ROW EXECUTE FUNCTION public._planning_touch_task();

DROP TRIGGER IF EXISTS planning_task_checklist_items_touch ON public.planning_task_checklist_items;
CREATE TRIGGER planning_task_checklist_items_touch
  AFTER INSERT OR DELETE OR UPDATE OF is_done ON public.planning_task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public._planning_touch_task();

DROP TRIGGER IF EXISTS planning_task_checklists_updated_at ON public.planning_task_checklists;
CREATE TRIGGER planning_task_checklists_updated_at
  BEFORE UPDATE ON public.planning_task_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS planning_task_checklist_items_updated_at ON public.planning_task_checklist_items;
CREATE TRIGGER planning_task_checklist_items_updated_at
  BEFORE UPDATE ON public.planning_task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Watchers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_task_watchers (
  task_id         uuid        NOT NULL REFERENCES public.planning_tasks(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS planning_task_watchers_user_idx
  ON public.planning_task_watchers (user_id);

ALTER TABLE public.planning_task_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_task_watchers FORCE ROW LEVEL SECURITY;

-- Everyone who sees the task sees who follows it; each person follows or
-- stops following only for themselves.
DROP POLICY IF EXISTS "planning_task_watchers_select" ON public.planning_task_watchers;
CREATE POLICY "planning_task_watchers_select" ON public.planning_task_watchers
  FOR SELECT TO authenticated
  USING (public.can_read_planning_task(task_id));

DROP POLICY IF EXISTS "planning_task_watchers_insert" ON public.planning_task_watchers;
CREATE POLICY "planning_task_watchers_insert" ON public.planning_task_watchers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_read_planning_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.planning_tasks t
      WHERE t.id = planning_task_watchers.task_id
        AND t.organization_id = planning_task_watchers.organization_id
    )
  );

DROP POLICY IF EXISTS "planning_task_watchers_delete" ON public.planning_task_watchers;
CREATE POLICY "planning_task_watchers_delete" ON public.planning_task_watchers
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.planning_task_watchers TO authenticated;

-- ---------------------------------------------------------------------------
-- Due time and cover
-- ---------------------------------------------------------------------------
ALTER TABLE public.planning_tasks
  ADD COLUMN IF NOT EXISTS due_has_time boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_color text,
  ADD COLUMN IF NOT EXISTS cover_attachment_id uuid REFERENCES public.app_attachments(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planning_tasks_cover_color_check'
  ) THEN
    ALTER TABLE public.planning_tasks
      ADD CONSTRAINT planning_tasks_cover_color_check
      CHECK (cover_color IS NULL OR cover_color ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Notifications: watchers hear about comments and status changes
-- (same bodies as before, plus the watchers in the planning branch)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notify_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_branch uuid;
  v_code   text;
  v_title  text;
  v_snippet text := nullif(left(btrim(coalesce(NEW.body_plain, '')), 200), '');
  r record;
BEGIN
  -- Internal notes are private to their author: nobody is notified
  IF NEW.visibility = 'internal' THEN
    RETURN NULL;
  END IF;

  IF NEW.target_type = 'helpdesk.ticket' THEN
    SELECT t.branch_id, t.ticket_number, t.title INTO v_branch, v_code, v_title
    FROM public.helpdesk_tickets t WHERE t.id = NEW.target_id AND t.deleted_at IS NULL;
    IF NOT FOUND THEN RETURN NULL; END IF;
    FOR r IN
      SELECT DISTINCT x.user_id FROM (
        -- Internal comments stay with the people handling the ticket
        SELECT t.created_by AS user_id FROM public.helpdesk_tickets t
          WHERE t.id = NEW.target_id AND NEW.visibility = 'default'
        UNION ALL SELECT t.requested_by FROM public.helpdesk_tickets t
          WHERE t.id = NEW.target_id AND NEW.visibility = 'default'
        UNION ALL SELECT a.user_id FROM public.helpdesk_ticket_assignees a
          WHERE a.ticket_id = NEW.target_id AND a.deleted_at IS NULL
      ) x WHERE x.user_id IS NOT NULL
    LOOP
      PERFORM public._notify(NEW.org_id, v_branch, r.user_id, NEW.created_by, 'comment',
        NEW.target_type, NEW.target_id, v_code, v_title, v_snippet,
        jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility),
        'comment:' || NEW.id::text);
    END LOOP;

  ELSIF NEW.target_type = 'planning.task' THEN
    SELECT t.branch_id, t.task_number, t.title INTO v_branch, v_code, v_title
    FROM public.planning_tasks t WHERE t.id = NEW.target_id AND t.deleted_at IS NULL;
    IF NOT FOUND THEN RETURN NULL; END IF;
    FOR r IN
      SELECT DISTINCT x.user_id FROM (
        SELECT t.assigned_to AS user_id FROM public.planning_tasks t WHERE t.id = NEW.target_id
        UNION ALL SELECT t.created_by FROM public.planning_tasks t WHERE t.id = NEW.target_id
        UNION ALL SELECT w.user_id FROM public.planning_task_watchers w WHERE w.task_id = NEW.target_id
      ) x WHERE x.user_id IS NOT NULL
    LOOP
      -- A watcher who lost access to the task is not told about it
      CONTINUE WHEN NOT public._user_can_read_comment_target(
        r.user_id, NEW.org_id, NEW.target_type, NEW.target_id, NEW.visibility);
      PERFORM public._notify(NEW.org_id, v_branch, r.user_id, NEW.created_by, 'comment',
        NEW.target_type, NEW.target_id, v_code, v_title, v_snippet,
        jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility),
        'comment:' || NEW.id::text);
    END LOOP;

  ELSIF NEW.target_type = 'workshop.repair_order' THEN
    SELECT o.branch_id, o.zl_number, coalesce(nullif(o.client_name, ''), o.vehicle_brand, '')
      INTO v_branch, v_code, v_title
    FROM public.repair_orders o WHERE o.id = NEW.target_id AND o.deleted_at IS NULL;
    IF NOT FOUND THEN RETURN NULL; END IF;
    -- The order's advisor (a contact linked to a user)
    FOR r IN
      SELECT c.linked_user_id AS user_id
      FROM public.repair_orders o
      JOIN public.crm_contacts c ON c.id = o.advisor_contact_id AND c.deleted_at IS NULL
      WHERE o.id = NEW.target_id AND c.linked_user_id IS NOT NULL
    LOOP
      PERFORM public._notify(NEW.org_id, v_branch, r.user_id, NEW.created_by, 'comment',
        NEW.target_type, NEW.target_id, v_code, v_title, v_snippet,
        jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility),
        'comment:' || NEW.id::text);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._notify_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor uuid := coalesce(auth.uid(), NEW.updated_by, NEW.created_by);
  r record;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    PERFORM public._notify(NEW.organization_id, NEW.branch_id, NEW.assigned_to, v_actor,
      'task.assigned', 'planning.task', NEW.id, NEW.task_number, NEW.title);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    FOR r IN
      SELECT DISTINCT x.user_id FROM (
        SELECT NEW.created_by AS user_id
        UNION ALL SELECT NEW.assigned_to
        UNION ALL SELECT w.user_id FROM public.planning_task_watchers w WHERE w.task_id = NEW.id
      ) x WHERE x.user_id IS NOT NULL
    LOOP
      CONTINUE WHEN r.user_id IS DISTINCT FROM NEW.created_by
        AND r.user_id IS DISTINCT FROM NEW.assigned_to
        AND NOT public._user_can_read_comment_target(
          r.user_id, NEW.organization_id, 'planning.task', NEW.id, 'default');
      PERFORM public._notify(NEW.organization_id, NEW.branch_id, r.user_id, v_actor,
        'task.status', 'planning.task', NEW.id, NEW.task_number, NEW.title, NULL,
        jsonb_build_object('status', NEW.status));
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

-- A person newly mentioned (@) in a task's description is notified once per
-- mention: only people who were not mentioned in the previous version.
CREATE OR REPLACE FUNCTION public._notify_task_description_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor uuid := coalesce(auth.uid(), NEW.updated_by, NEW.created_by);
  v_snippet text := nullif(left(btrim(coalesce(NEW.description_plain, '')), 200), '');
  r record;
BEGIN
  IF NEW.deleted_at IS NOT NULL
     OR NEW.description_rich IS NULL
     OR jsonb_typeof(NEW.description_rich) <> 'object' THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT DISTINCT (m.node -> 'attrs' ->> 'id')::uuid AS user_id
    FROM jsonb_path_query(NEW.description_rich, 'strict $.** ? (@.type == "mention")') AS m(node)
    WHERE m.node -> 'attrs' ->> 'type' = 'person'
      AND (m.node -> 'attrs' ->> 'id')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND NOT (
        TG_OP = 'UPDATE'
        AND OLD.description_rich IS NOT NULL
        AND jsonb_typeof(OLD.description_rich) = 'object'
        AND EXISTS (
          SELECT 1
          FROM jsonb_path_query(OLD.description_rich, 'strict $.** ? (@.type == "mention")') AS o(node)
          WHERE o.node -> 'attrs' ->> 'id' = m.node -> 'attrs' ->> 'id'
        )
      )
    LIMIT 50
  LOOP
    CONTINUE WHEN r.user_id IS NOT DISTINCT FROM v_actor;
    CONTINUE WHEN NOT public._user_can_read_comment_target(
      r.user_id, NEW.organization_id, 'planning.task', NEW.id, 'default');
    PERFORM public._notify(NEW.organization_id, NEW.branch_id, r.user_id, v_actor, 'mention',
      'planning.task', NEW.id, NEW.task_number, NEW.title, v_snippet,
      jsonb_build_object('in', 'description'),
      'task-description:' || NEW.id::text || ':' || r.user_id::text || ':'
        || to_char(now(), 'YYYYMMDDHH24MI'));
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._notify_task_description_mentions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS planning_tasks_description_mentions ON public.planning_tasks;
CREATE TRIGGER planning_tasks_description_mentions
  AFTER INSERT OR UPDATE OF description_rich ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public._notify_task_description_mentions();

-- ---------------------------------------------------------------------------
-- Realtime: open boards hear about their tasks and columns (RLS applies to
-- every subscriber, so nobody receives a task they could not read)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'planning_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.planning_tasks;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'planning_kanban_columns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.planning_kanban_columns;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Presence on a board: who has it open. A private Realtime channel
-- "planning-board:<board id>" is open to the people who can see the board.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_use_planning_board_topic(p_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR p_topic IS NULL
     OR p_topic !~ '^planning-board:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  RETURN public.can_view_planning_board(split_part(p_topic, ':', 2)::uuid);
END;
$function$;

REVOKE ALL ON FUNCTION public.can_use_planning_board_topic(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_planning_board_topic(text) TO authenticated;

DROP POLICY IF EXISTS "planning board presence: receive" ON realtime.messages;
CREATE POLICY "planning board presence: receive"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'presence'
    AND public.can_use_planning_board_topic((SELECT realtime.topic()))
  );

DROP POLICY IF EXISTS "planning board presence: send" ON realtime.messages;
CREATE POLICY "planning board presence: send"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'presence'
    AND public.can_use_planning_board_topic((SELECT realtime.topic()))
  );
