-- =============================================================================
-- Planning boards, stage 6b: custom fields and recurring tasks.
--
--   * planning_board_custom_fields         a board's own fields (text, number,
--                                          date, select, checkbox)
--   * planning_task_custom_field_values    a task's value for a field
--   * planning_tasks.recurrence            "repeat every …" rule of a task
--   * _planning_next_occurrence            the next day a rule gives
--   * planning_tasks_recurrence trigger    completing a repeating task makes
--                                          the next one (the rule moves to it)
--   * planning_copy_task / planning_copy_board now take custom fields along
--
-- Idempotent: safe to run again.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Custom fields: definitions on a board
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_board_custom_fields (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id        uuid        NOT NULL REFERENCES public.planning_kanban_boards(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  field_type      text        NOT NULL,
  -- Choices of a select field: [{"id": "...", "name": "...", "color": "#rrggbb"}]
  options         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  show_on_card    boolean     NOT NULL DEFAULT false,
  position        integer     NOT NULL DEFAULT 0,
  created_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_board_custom_fields_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT planning_board_custom_fields_type_check
    CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox')),
  CONSTRAINT planning_board_custom_fields_options_check
    CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) <= 50)
);

CREATE INDEX IF NOT EXISTS planning_board_custom_fields_board_idx
  ON public.planning_board_custom_fields (board_id, position);

DROP TRIGGER IF EXISTS planning_board_custom_fields_updated_at ON public.planning_board_custom_fields;
CREATE TRIGGER planning_board_custom_fields_updated_at
  BEFORE UPDATE ON public.planning_board_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The field's organization is its board's.
CREATE OR REPLACE FUNCTION public._planning_custom_field_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.planning_kanban_boards b
    WHERE b.id = NEW.board_id AND b.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Board not found in this organization' USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.board_id <> OLD.board_id THEN
    RAISE EXCEPTION 'A field stays on its board' USING ERRCODE = '23514';
  END IF;
  NEW.name := btrim(NEW.name);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._planning_custom_field_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS planning_board_custom_fields_guard ON public.planning_board_custom_fields;
CREATE TRIGGER planning_board_custom_fields_guard
  BEFORE INSERT OR UPDATE ON public.planning_board_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public._planning_custom_field_guard();

ALTER TABLE public.planning_board_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_board_custom_fields FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_board_custom_fields_select" ON public.planning_board_custom_fields;
CREATE POLICY "planning_board_custom_fields_select" ON public.planning_board_custom_fields
  FOR SELECT TO authenticated
  USING (public.can_view_planning_board(planning_board_custom_fields.board_id));

DROP POLICY IF EXISTS "planning_board_custom_fields_insert" ON public.planning_board_custom_fields;
CREATE POLICY "planning_board_custom_fields_insert" ON public.planning_board_custom_fields
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_planning_board(planning_board_custom_fields.board_id));

DROP POLICY IF EXISTS "planning_board_custom_fields_update" ON public.planning_board_custom_fields;
CREATE POLICY "planning_board_custom_fields_update" ON public.planning_board_custom_fields
  FOR UPDATE TO authenticated
  USING (public.can_edit_planning_board(planning_board_custom_fields.board_id))
  WITH CHECK (public.can_edit_planning_board(planning_board_custom_fields.board_id));

DROP POLICY IF EXISTS "planning_board_custom_fields_delete" ON public.planning_board_custom_fields;
CREATE POLICY "planning_board_custom_fields_delete" ON public.planning_board_custom_fields
  FOR DELETE TO authenticated
  USING (public.can_edit_planning_board(planning_board_custom_fields.board_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_board_custom_fields TO authenticated;

-- ---------------------------------------------------------------------------
-- Custom fields: a task's values
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_task_custom_field_values (
  task_id         uuid        NOT NULL REFERENCES public.planning_tasks(id) ON DELETE CASCADE,
  field_id        uuid        NOT NULL REFERENCES public.planning_board_custom_fields(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value           jsonb       NOT NULL,
  updated_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, field_id)
);

CREATE INDEX IF NOT EXISTS planning_task_custom_field_values_field_idx
  ON public.planning_task_custom_field_values (field_id);

-- The field belongs to the task's board, and the value fits the field:
-- text (≤ 2000 characters), number, date ("YYYY-MM-DD"), select (one of the
-- field's option ids) or checkbox (true/false). DEFINER: reads the field
-- and task whatever the caller may see (RLS still decides the write).
CREATE OR REPLACE FUNCTION public._planning_custom_value_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_field public.planning_board_custom_fields%ROWTYPE;
  v_board uuid;
  v_ok    boolean;
BEGIN
  SELECT * INTO v_field FROM public.planning_board_custom_fields WHERE id = NEW.field_id;
  SELECT t.board_id INTO v_board FROM public.planning_tasks t
  WHERE t.id = NEW.task_id AND t.organization_id = NEW.organization_id AND t.deleted_at IS NULL;
  IF v_field.id IS NULL OR v_board IS NULL OR v_field.board_id <> v_board
     OR v_field.organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'This field is not on the task''s board' USING ERRCODE = '23514';
  END IF;

  v_ok := CASE v_field.field_type
    WHEN 'text' THEN jsonb_typeof(NEW.value) = 'string' AND char_length(NEW.value #>> '{}') <= 2000
    WHEN 'number' THEN jsonb_typeof(NEW.value) = 'number'
    WHEN 'date' THEN jsonb_typeof(NEW.value) = 'string'
                     AND (NEW.value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
    WHEN 'checkbox' THEN jsonb_typeof(NEW.value) = 'boolean'
    WHEN 'select' THEN jsonb_typeof(NEW.value) = 'string'
                       AND EXISTS (
                         SELECT 1 FROM jsonb_array_elements(v_field.options) o
                         WHERE o ->> 'id' = NEW.value #>> '{}'
                       )
    ELSE false
  END;
  IF NOT coalesce(v_ok, false) THEN
    RAISE EXCEPTION 'The value does not fit the field "%"', v_field.name USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._planning_custom_value_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS planning_task_custom_field_values_guard ON public.planning_task_custom_field_values;
CREATE TRIGGER planning_task_custom_field_values_guard
  BEFORE INSERT OR UPDATE ON public.planning_task_custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public._planning_custom_value_guard();

-- A value change shows on open boards (Realtime watches planning_tasks).
DROP TRIGGER IF EXISTS planning_task_custom_field_values_touch ON public.planning_task_custom_field_values;
CREATE TRIGGER planning_task_custom_field_values_touch
  AFTER INSERT OR UPDATE OR DELETE ON public.planning_task_custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public._planning_touch_task();

ALTER TABLE public.planning_task_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_task_custom_field_values FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_task_custom_field_values_select" ON public.planning_task_custom_field_values;
CREATE POLICY "planning_task_custom_field_values_select" ON public.planning_task_custom_field_values
  FOR SELECT TO authenticated
  USING (public.can_read_planning_task(planning_task_custom_field_values.task_id));

DROP POLICY IF EXISTS "planning_task_custom_field_values_insert" ON public.planning_task_custom_field_values;
CREATE POLICY "planning_task_custom_field_values_insert" ON public.planning_task_custom_field_values
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_planning_task(planning_task_custom_field_values.task_id));

DROP POLICY IF EXISTS "planning_task_custom_field_values_update" ON public.planning_task_custom_field_values;
CREATE POLICY "planning_task_custom_field_values_update" ON public.planning_task_custom_field_values
  FOR UPDATE TO authenticated
  USING (public.can_edit_planning_task(planning_task_custom_field_values.task_id))
  WITH CHECK (public.can_edit_planning_task(planning_task_custom_field_values.task_id));

DROP POLICY IF EXISTS "planning_task_custom_field_values_delete" ON public.planning_task_custom_field_values;
CREATE POLICY "planning_task_custom_field_values_delete" ON public.planning_task_custom_field_values
  FOR DELETE TO authenticated
  USING (public.can_edit_planning_task(planning_task_custom_field_values.task_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_task_custom_field_values TO authenticated;

-- ---------------------------------------------------------------------------
-- Recurring tasks
--
-- planning_tasks.recurrence is a rule:
--   {"freq": "daily" | "weekly" | "monthly" | "yearly",
--    "interval": 1..365,             every N days / weeks / months / years
--    "weekdays": [1..7],             weekly only: ISO days (1 = Monday)
--    "monthday": 1..31,              monthly: the day (clamped to the month)
--    "until": "YYYY-MM-DD"}          no copies after this day
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._planning_recurrence_is_valid(p_rule jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_day jsonb;
BEGIN
  IF p_rule IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(p_rule) <> 'object'
     OR coalesce(p_rule ->> 'freq', '') NOT IN ('daily', 'weekly', 'monthly', 'yearly') THEN
    RETURN false;
  END IF;
  IF p_rule ? 'interval' AND NOT (
    jsonb_typeof(p_rule -> 'interval') = 'number'
    AND (p_rule ->> 'interval') ~ '^\d+$'
    AND (p_rule ->> 'interval')::int BETWEEN 1 AND 365
  ) THEN
    RETURN false;
  END IF;
  IF p_rule ? 'weekdays' THEN
    IF jsonb_typeof(p_rule -> 'weekdays') <> 'array' THEN
      RETURN false;
    END IF;
    FOR v_day IN SELECT * FROM jsonb_array_elements(p_rule -> 'weekdays') LOOP
      IF jsonb_typeof(v_day) <> 'number' OR (v_day #>> '{}') !~ '^[1-7]$' THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;
  IF p_rule ? 'monthday' AND NOT (
    jsonb_typeof(p_rule -> 'monthday') = 'number'
    AND (p_rule ->> 'monthday') ~ '^\d+$'
    AND (p_rule ->> 'monthday')::int BETWEEN 1 AND 31
  ) THEN
    RETURN false;
  END IF;
  IF p_rule ? 'until' AND NOT (
    jsonb_typeof(p_rule -> 'until') = 'string' AND (p_rule ->> 'until') ~ '^\d{4}-\d{2}-\d{2}$'
  ) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

ALTER TABLE public.planning_tasks
  ADD COLUMN IF NOT EXISTS recurrence jsonb;

ALTER TABLE public.planning_tasks
  DROP CONSTRAINT IF EXISTS planning_tasks_recurrence_check;
ALTER TABLE public.planning_tasks
  ADD CONSTRAINT planning_tasks_recurrence_check
  CHECK (public._planning_recurrence_is_valid(recurrence));

-- The first day after p_from that the rule gives.
CREATE OR REPLACE FUNCTION public._planning_next_occurrence(p_rule jsonb, p_from date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_interval int := greatest(coalesce((p_rule ->> 'interval')::int, 1), 1);
  v_days     int[];
  v_week     date;
  v_day      date;
  v_month    date;
  v_monthday int;
  v_last     int;
BEGIN
  CASE p_rule ->> 'freq'
    WHEN 'daily' THEN
      RETURN p_from + v_interval;
    WHEN 'weekly' THEN
      SELECT coalesce(array_agg(DISTINCT d::int ORDER BY d::int), '{}')
      INTO v_days
      FROM jsonb_array_elements_text(coalesce(p_rule -> 'weekdays', '[]'::jsonb)) d;
      IF cardinality(v_days) = 0 THEN
        RETURN p_from + 7 * v_interval;
      END IF;
      -- Later days of the same week first, then the first day of the week
      -- N weeks on.
      v_week := p_from - (extract(isodow FROM p_from)::int - 1);
      FOR v_day IN SELECT generate_series(p_from + 1, v_week + 6, interval '1 day')::date LOOP
        IF extract(isodow FROM v_day)::int = ANY (v_days) THEN
          RETURN v_day;
        END IF;
      END LOOP;
      RETURN v_week + 7 * v_interval + (v_days[1] - 1);
    WHEN 'monthly' THEN
      v_monthday := coalesce((p_rule ->> 'monthday')::int, extract(day FROM p_from)::int);
      v_month := (date_trunc('month', p_from) + make_interval(months => v_interval))::date;
      v_last := extract(day FROM (v_month + interval '1 month' - interval '1 day'))::int;
      RETURN v_month + (least(v_monthday, v_last) - 1);
    WHEN 'yearly' THEN
      RETURN (p_from + make_interval(years => v_interval))::date;
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

-- When a repeating task is completed (by its status or by a move into a
-- "completed" column), the next one is made: a copy with the dates moved to
-- the rule's next day (never in the past), back in the list it came from.
-- The rule moves to the copy, so completing the old one again does nothing.
-- If the copy can't be made (the person may not add tasks there), the task
-- is completed anyway and keeps its rule.
CREATE OR REPLACE FUNCTION public._planning_task_recurrence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid     uuid := coalesce(auth.uid(), NEW.updated_by, NEW.created_by);
  v_anchor  date;
  v_next    date;
  v_today   date := (now() AT TIME ZONE coalesce(NEW.calendar_timezone, 'UTC'))::date;
  v_shift   int;
  v_until   date := (NEW.recurrence ->> 'until')::date;
  v_column  uuid;
  v_new     uuid;
  v_guard   int := 0;
BEGIN
  IF NEW.recurrence IS NULL OR NEW.status <> 'completed'
     OR OLD.status IS NOT DISTINCT FROM 'completed'
     OR NEW.deleted_at IS NOT NULL OR NEW.is_template THEN
    RETURN NEW;
  END IF;

  v_anchor := coalesce(OLD.due_date, OLD.due_at::date, OLD.calendar_start_date, v_today);
  v_next := public._planning_next_occurrence(NEW.recurrence, v_anchor);
  -- A late completion does not make an overdue copy.
  WHILE v_next IS NOT NULL AND v_next <= v_today AND v_guard < 2000 LOOP
    v_next := public._planning_next_occurrence(NEW.recurrence, v_next);
    v_guard := v_guard + 1;
  END LOOP;
  IF v_next IS NULL OR (v_until IS NOT NULL AND v_next > v_until) THEN
    -- The series is over.
    NEW.recurrence := NULL;
    RETURN NEW;
  END IF;
  v_shift := v_next - v_anchor;

  BEGIN
    IF OLD.column_id IS NOT NULL AND NOT OLD.is_inbox THEN
      -- Back to the list it was in; a list that completes its cards (or one
      -- that's gone) sends it to the board's first list that does not.
      SELECT c.id INTO v_column FROM public.planning_kanban_columns c
      WHERE c.id = OLD.column_id AND c.deleted_at IS NULL AND c.archived_at IS NULL
        AND coalesce(c.status_category, 'open') NOT IN ('completed', 'cancelled');
      IF v_column IS NULL THEN
        SELECT c.id INTO v_column FROM public.planning_kanban_columns c
        WHERE c.board_id = OLD.board_id AND c.deleted_at IS NULL AND c.archived_at IS NULL
          AND coalesce(c.status_category, 'open') NOT IN ('completed', 'cancelled')
        ORDER BY c.position, c.created_at
        LIMIT 1;
      END IF;
    END IF;

    IF v_column IS NOT NULL THEN
      v_new := public.planning_copy_task(
        NEW.id, v_column, NULL, NULL,
        ARRAY['description','labels','checklists','assignee','dates','cover','priority','fields'],
        false
      );
    ELSE
      INSERT INTO public.planning_tasks (
        organization_id, branch_id, is_inbox, title, description_plain, description_rich,
        status, priority, assigned_to, due_at, due_has_time, calendar_all_day,
        calendar_start_date, calendar_end_date, calendar_start_at, calendar_end_at,
        calendar_timezone, label, label_color, created_by, updated_by
      ) VALUES (
        OLD.organization_id, OLD.branch_id, OLD.is_inbox AND OLD.board_id IS NULL, OLD.title,
        OLD.description_plain, OLD.description_rich, 'open', OLD.priority, OLD.assigned_to,
        OLD.due_at, OLD.due_has_time, OLD.calendar_all_day, OLD.calendar_start_date,
        OLD.calendar_end_date, OLD.calendar_start_at, OLD.calendar_end_at, OLD.calendar_timezone,
        OLD.label, OLD.label_color, v_uid, v_uid
      )
      RETURNING id INTO v_new;
    END IF;

    UPDATE public.planning_tasks t SET
      due_at = CASE
        WHEN OLD.due_at IS NULL THEN (v_next::timestamp + interval '12 hours') AT TIME ZONE 'UTC'
        ELSE OLD.due_at + make_interval(days => v_shift)
      END,
      due_has_time = CASE WHEN OLD.due_at IS NULL THEN false ELSE OLD.due_has_time END,
      due_date = CASE WHEN OLD.due_date IS NULL AND OLD.due_at IS NULL THEN v_next
                      ELSE coalesce(OLD.due_date, OLD.due_at::date) + v_shift END,
      calendar_start_date = OLD.calendar_start_date + v_shift,
      calendar_end_date = OLD.calendar_end_date + v_shift,
      calendar_start_at = OLD.calendar_start_at + make_interval(days => v_shift),
      calendar_end_at = OLD.calendar_end_at + make_interval(days => v_shift),
      calendar_all_day = OLD.calendar_all_day,
      calendar_timezone = OLD.calendar_timezone,
      parent_task_id = OLD.parent_task_id,
      recurrence = NEW.recurrence
    WHERE t.id = v_new;

    BEGIN
      INSERT INTO public.planning_task_activity (organization_id, task_id, actor_id, activity_type, metadata)
      VALUES (
        OLD.organization_id, v_new, v_uid, 'recurred_from',
        jsonb_strip_nulls(jsonb_build_object('from_task', OLD.task_number, 'board_id', OLD.board_id))
      );
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;

    NEW.recurrence := NULL;
  EXCEPTION WHEN insufficient_privilege THEN
    -- No copy: the task is still completed and keeps its rule.
    NULL;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._planning_task_recurrence() FROM PUBLIC, anon, authenticated;

-- Named to run after planning_tasks_board_sync (BEFORE triggers run in name
-- order), which may have just set the status from the column.
DROP TRIGGER IF EXISTS planning_tasks_recurrence ON public.planning_tasks;
CREATE TRIGGER planning_tasks_recurrence
  BEFORE UPDATE ON public.planning_tasks
  FOR EACH ROW
  WHEN (NEW.recurrence IS NOT NULL)
  EXECUTE FUNCTION public._planning_task_recurrence();

-- ---------------------------------------------------------------------------
-- Copies take custom fields along ('fields' in p_keep). On another board a
-- value goes to the field of the same name and type there (a select by the
-- choice's name); fields that board lacks are left out.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._planning_copy_field_values(
  p_from uuid,
  p_to   uuid,
  p_board uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_row    record;
  v_target public.planning_board_custom_fields%ROWTYPE;
  v_value  jsonb;
  v_name   text;
BEGIN
  FOR v_row IN
    SELECT v.value, v.organization_id, f.*
    FROM public.planning_task_custom_field_values v
    JOIN public.planning_board_custom_fields f ON f.id = v.field_id
    WHERE v.task_id = p_from
  LOOP
    v_target := NULL;
    IF v_row.board_id = p_board THEN
      SELECT * INTO v_target FROM public.planning_board_custom_fields WHERE id = v_row.id;
    ELSE
      SELECT * INTO v_target FROM public.planning_board_custom_fields f
      WHERE f.board_id = p_board AND f.field_type = v_row.field_type
        AND lower(f.name) = lower(v_row.name)
      ORDER BY f.position LIMIT 1;
    END IF;
    CONTINUE WHEN v_target.id IS NULL;

    v_value := v_row.value;
    IF v_row.field_type = 'select' AND v_target.id <> v_row.id THEN
      SELECT o ->> 'name' INTO v_name FROM jsonb_array_elements(v_row.options) o
      WHERE o ->> 'id' = v_row.value #>> '{}' LIMIT 1;
      SELECT to_jsonb(o ->> 'id') INTO v_value FROM jsonb_array_elements(v_target.options) o
      WHERE lower(o ->> 'name') = lower(v_name) LIMIT 1;
      CONTINUE WHEN v_value IS NULL;
    END IF;

    INSERT INTO public.planning_task_custom_field_values (task_id, field_id, organization_id, value)
    VALUES (p_to, v_target.id, v_row.organization_id, v_value)
    ON CONFLICT (task_id, field_id) DO NOTHING;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._planning_copy_field_values(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._planning_copy_field_values(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.planning_copy_task(
  p_task_id     uuid,
  p_column_id   uuid,
  p_position    integer DEFAULT NULL,
  p_title       text    DEFAULT NULL,
  p_keep        text[]  DEFAULT ARRAY['description','labels','checklists','assignee','dates','cover','priority','fields'],
  p_as_template boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_src    public.planning_tasks%ROWTYPE;
  v_board  uuid;
  v_new    uuid;
  v_pos    integer;
  v_label  record;
  v_target uuid;
  v_list   record;
  v_list_new uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_src FROM public.planning_tasks
  WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.board_id INTO v_board
  FROM public.planning_kanban_columns c
  WHERE c.id = p_column_id AND c.deleted_at IS NULL AND c.archived_at IS NULL
    AND c.organization_id = v_src.organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board column not found' USING ERRCODE = '23503';
  END IF;

  SELECT coalesce(max(t.board_position), -1) + 1 INTO v_pos
  FROM public.planning_tasks t
  WHERE t.column_id = p_column_id AND t.deleted_at IS NULL;

  INSERT INTO public.planning_tasks (
    organization_id, branch_id, board_id, column_id, board_position, is_inbox,
    title, description_plain, description_rich, status, priority, assigned_to,
    due_at, due_has_time, calendar_all_day, calendar_start_date, calendar_end_date,
    calendar_start_at, calendar_end_at, calendar_timezone,
    label, label_color, cover_color, is_template, created_by, updated_by
  ) VALUES (
    v_src.organization_id, v_src.branch_id, v_board, p_column_id, v_pos, false,
    left(coalesce(nullif(btrim(p_title), ''), v_src.title), 300),
    CASE WHEN 'description' = ANY (p_keep) THEN v_src.description_plain END,
    CASE WHEN 'description' = ANY (p_keep) THEN v_src.description_rich END,
    'open',
    CASE WHEN 'priority' = ANY (p_keep) THEN v_src.priority ELSE 'normal' END,
    CASE WHEN 'assignee' = ANY (p_keep) THEN v_src.assigned_to END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.due_at END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.due_has_time ELSE false END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_all_day END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_start_date END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_end_date END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_start_at END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_end_at END,
    CASE WHEN 'dates' = ANY (p_keep) THEN v_src.calendar_timezone END,
    CASE WHEN 'labels' = ANY (p_keep) AND v_src.board_id = v_board THEN v_src.label END,
    CASE WHEN 'labels' = ANY (p_keep) AND v_src.board_id = v_board THEN v_src.label_color END,
    CASE WHEN 'cover' = ANY (p_keep) THEN v_src.cover_color END,
    coalesce(p_as_template, false),
    v_uid, v_uid
  )
  RETURNING id INTO v_new;

  IF 'labels' = ANY (p_keep) THEN
    FOR v_label IN
      SELECT l.id, l.board_id, l.name, l.color, l.position
      FROM public.planning_task_labels tl
      JOIN public.planning_kanban_board_labels l ON l.id = tl.label_id
      WHERE tl.task_id = p_task_id
      ORDER BY l.position
    LOOP
      IF v_label.board_id = v_board THEN
        v_target := v_label.id;
      ELSE
        SELECT l.id INTO v_target
        FROM public.planning_kanban_board_labels l
        WHERE l.board_id = v_board AND lower(btrim(l.name)) = lower(btrim(v_label.name))
        ORDER BY l.position
        LIMIT 1;
        IF v_target IS NULL THEN
          BEGIN
            INSERT INTO public.planning_kanban_board_labels (organization_id, board_id, name, color, position, created_by)
            SELECT v_src.organization_id, v_board, v_label.name, v_label.color,
                   coalesce(max(l.position), -1) + 1, v_uid
            FROM public.planning_kanban_board_labels l WHERE l.board_id = v_board
            RETURNING id INTO v_target;
          EXCEPTION WHEN insufficient_privilege THEN
            -- May not add labels to that board: the copy goes without this one.
            v_target := NULL;
          END;
        END IF;
      END IF;
      IF v_target IS NOT NULL THEN
        INSERT INTO public.planning_task_labels (task_id, label_id, organization_id)
        VALUES (v_new, v_target, v_src.organization_id)
        ON CONFLICT DO NOTHING;
      END IF;
      v_target := NULL;
    END LOOP;
  END IF;

  IF 'checklists' = ANY (p_keep) THEN
    FOR v_list IN
      SELECT * FROM public.planning_task_checklists
      WHERE task_id = p_task_id ORDER BY position, created_at
    LOOP
      INSERT INTO public.planning_task_checklists (organization_id, task_id, title, position, created_by)
      VALUES (v_src.organization_id, v_new, v_list.title, v_list.position, v_uid)
      RETURNING id INTO v_list_new;

      INSERT INTO public.planning_task_checklist_items (
        organization_id, checklist_id, task_id, title, is_done, assigned_to, due_at, position, created_by
      )
      SELECT v_src.organization_id, v_list_new, v_new, i.title, false,
             CASE WHEN 'assignee' = ANY (p_keep) THEN i.assigned_to END,
             CASE WHEN 'dates' = ANY (p_keep) THEN i.due_at END,
             i.position, v_uid
      FROM public.planning_task_checklist_items i
      WHERE i.checklist_id = v_list.id
      ORDER BY i.position, i.created_at;
    END LOOP;
  END IF;

  IF 'fields' = ANY (p_keep) THEN
    PERFORM public._planning_copy_field_values(p_task_id, v_new, v_board);
  END IF;

  IF p_position IS NOT NULL AND p_position < v_pos THEN
    PERFORM public.planning_move_task(v_new, v_board, p_column_id, p_position);
  END IF;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_copy_task(uuid, uuid, integer, text, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_copy_task(uuid, uuid, integer, text, text[], boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.planning_copy_column(
  p_column_id uuid,
  p_board_id  uuid DEFAULT NULL,
  p_title     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_src   public.planning_kanban_columns%ROWTYPE;
  v_board uuid;
  v_pos   integer;
  v_new   uuid;
  v_task  record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_src FROM public.planning_kanban_columns
  WHERE id = p_column_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board column not found' USING ERRCODE = 'P0002';
  END IF;

  v_board := coalesce(p_board_id, v_src.board_id);
  PERFORM 1 FROM public.planning_kanban_boards b
  WHERE b.id = v_board AND b.organization_id = v_src.organization_id
    AND b.deleted_at IS NULL AND b.archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found' USING ERRCODE = '23503';
  END IF;

  IF v_board = v_src.board_id THEN
    v_pos := v_src.position + 1;
    UPDATE public.planning_kanban_columns
    SET position = position + 1
    WHERE board_id = v_board AND deleted_at IS NULL AND position >= v_pos;
  ELSE
    SELECT coalesce(max(c.position), -1) + 1 INTO v_pos
    FROM public.planning_kanban_columns c
    WHERE c.board_id = v_board AND c.deleted_at IS NULL;
  END IF;

  INSERT INTO public.planning_kanban_columns (
    board_id, organization_id, title, description, color, status_category, wip_limit, position
  ) VALUES (
    v_board, v_src.organization_id,
    left(coalesce(nullif(btrim(p_title), ''), v_src.title), 120),
    v_src.description, v_src.color, v_src.status_category, v_src.wip_limit, v_pos
  )
  RETURNING id INTO v_new;

  FOR v_task IN
    SELECT t.id, t.is_template FROM public.planning_tasks t
    WHERE t.column_id = p_column_id AND t.deleted_at IS NULL
    ORDER BY t.board_position, t.created_at
  LOOP
    PERFORM public.planning_copy_task(
      v_task.id, v_new, NULL, NULL,
      ARRAY['description','labels','checklists','assignee','dates','cover','priority','fields'],
      v_task.is_template
    );
  END LOOP;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_copy_column(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_copy_column(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.planning_copy_board(
  p_board_id    uuid,
  p_title       text,
  p_with_cards  boolean DEFAULT true,
  p_as_template boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_src    public.planning_kanban_boards%ROWTYPE;
  v_new    uuid;
  v_column record;
  v_col_new uuid;
  v_task   record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_src FROM public.planning_kanban_boards
  WHERE id = p_board_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.planning_kanban_boards (
    organization_id, title, description, color, visibility, branch_id,
    is_template, created_by, updated_by
  ) VALUES (
    v_src.organization_id,
    left(coalesce(nullif(btrim(p_title), ''), v_src.title), 160),
    v_src.description, v_src.color, 'private', NULL,
    coalesce(p_as_template, false), v_uid, v_uid
  )
  RETURNING id INTO v_new;

  INSERT INTO public.planning_kanban_board_labels (organization_id, board_id, name, color, position, created_by)
  SELECT v_src.organization_id, v_new, l.name, l.color, l.position, v_uid
  FROM public.planning_kanban_board_labels l
  WHERE l.board_id = p_board_id
  ORDER BY l.position;

  -- Fields before cards, so the cards' values find them (by name).
  INSERT INTO public.planning_board_custom_fields (
    organization_id, board_id, name, field_type, options, show_on_card, position, created_by
  )
  SELECT v_src.organization_id, v_new, f.name, f.field_type, f.options, f.show_on_card, f.position, v_uid
  FROM public.planning_board_custom_fields f
  WHERE f.board_id = p_board_id
  ORDER BY f.position, f.created_at;

  FOR v_column IN
    SELECT * FROM public.planning_kanban_columns
    WHERE board_id = p_board_id AND deleted_at IS NULL AND archived_at IS NULL
    ORDER BY position, created_at
  LOOP
    INSERT INTO public.planning_kanban_columns (
      board_id, organization_id, title, description, color, status_category, wip_limit, position
    ) VALUES (
      v_new, v_src.organization_id, v_column.title, v_column.description, v_column.color,
      v_column.status_category, v_column.wip_limit, v_column.position
    )
    RETURNING id INTO v_col_new;

    IF coalesce(p_with_cards, true) THEN
      FOR v_task IN
        SELECT t.id, t.is_template FROM public.planning_tasks t
        WHERE t.column_id = v_column.id AND t.deleted_at IS NULL
        ORDER BY t.board_position, t.created_at
      LOOP
        PERFORM public.planning_copy_task(
          v_task.id, v_col_new, NULL, NULL,
          ARRAY['description','labels','checklists','assignee','dates','cover','priority','fields'],
          v_task.is_template
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.planning_copy_board(uuid, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_copy_board(uuid, text, boolean, boolean) TO authenticated;
