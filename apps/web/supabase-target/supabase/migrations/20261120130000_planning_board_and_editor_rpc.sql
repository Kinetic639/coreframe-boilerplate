-- =============================================================================
-- Kanban board and task editor in one request each.
--
-- Opening a board (KanbanBoardsService.getBoard) took 8 PostgREST requests:
-- the board, its columns, the cards, the members, the user's stars, labels,
-- custom fields and planning_card_extras. Opening a task in the editor
-- (getTaskEditor) took 7: the task, then its extras, board, columns, the
-- user's board roles, labels and custom fields. The task list fetches the
-- editor when the pointer rests on a row, so these were the largest share of
-- one user's requests on 20.11 (about 30%).
--
-- Both functions return the same rows in the same shape as those PostgREST
-- selects (embedded users, labels, checklist items, watchers, members(count)),
-- so the TypeScript mappers stay as they are. They are SECURITY INVOKER: every
-- read, embedded ones included, goes through the caller's RLS exactly as the
-- separate requests did, so they cannot return anything the user could not
-- read before. Writes are not touched.
-- =============================================================================

-- A planning_tasks row as TASK_CARD_FIELDS selects it (kanban-boards.service.ts):
-- every column plus field_values, creator, assignee, task_labels,
-- checklist_items and watchers.
CREATE OR REPLACE FUNCTION public.planning_card_json(t public.planning_tasks)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT to_jsonb(t) || jsonb_build_object(
    'field_values', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('field_id', v.field_id, 'value', v.value))
      FROM public.planning_task_custom_field_values v
      WHERE v.task_id = t.id
    ), '[]'::jsonb),
    'creator', (
      SELECT jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name, 'email', u.email)
      FROM public.users u WHERE u.id = t.created_by
    ),
    'assignee', (
      SELECT jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name, 'email', u.email)
      FROM public.users u WHERE u.id = t.assigned_to
    ),
    'task_labels', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'label', (
          SELECT jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color, 'position', l.position)
          FROM public.planning_kanban_board_labels l WHERE l.id = tl.label_id
        )
      ))
      FROM public.planning_task_labels tl
      WHERE tl.task_id = t.id
    ), '[]'::jsonb),
    'checklist_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('is_done', ci.is_done))
      FROM public.planning_task_checklist_items ci
      WHERE ci.task_id = t.id
    ), '[]'::jsonb),
    'watchers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('user_id', w.user_id))
      FROM public.planning_task_watchers w
      WHERE w.task_id = t.id
    ), '[]'::jsonb)
  );
$$;

-- Card extras rows as an object keyed by task id.
CREATE OR REPLACE FUNCTION public.planning_card_extras_json(
  p_org_id uuid,
  p_board_id uuid DEFAULT NULL,
  p_task_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
  FROM public.planning_card_extras(p_org_id, p_board_id, p_task_ids) e;
$$;

-- -----------------------------------------------------------------------------
-- A board as getBoard() loads it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.planning_board_view(p_org_id uuid, p_board_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jsonb_build_object(
    'board', (
      SELECT to_jsonb(b) || jsonb_build_object(
        'creator', (
          SELECT jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name, 'email', u.email)
          FROM public.users u WHERE u.id = b.created_by
        ),
        'shares', jsonb_build_array(jsonb_build_object('count', (
          SELECT count(*) FROM public.planning_kanban_board_members m WHERE m.board_id = b.id
        )))
      )
      FROM public.planning_kanban_boards b
      WHERE b.organization_id = p_org_id AND b.id = p_board_id AND b.deleted_at IS NULL
    ),
    'columns', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.position ASC)
      FROM public.planning_kanban_columns c
      WHERE c.organization_id = p_org_id AND c.board_id = p_board_id
        AND c.deleted_at IS NULL AND c.archived_at IS NULL
    ), '[]'::jsonb),
    'cards', COALESCE((
      SELECT jsonb_agg(public.planning_card_json(t) ORDER BY t.board_position ASC, t.created_at ASC)
      FROM public.planning_tasks t
      WHERE t.organization_id = p_org_id AND t.board_id = p_board_id
        AND t.column_id IS NOT NULL AND t.deleted_at IS NULL
    ), '[]'::jsonb),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'created_at', m.created_at,
        'user', (
          SELECT jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name, 'email', u.email)
          FROM public.users u WHERE u.id = m.user_id
        )
      ) ORDER BY m.created_at ASC)
      FROM public.planning_kanban_board_members m
      WHERE m.organization_id = p_org_id AND m.board_id = p_board_id
    ), '[]'::jsonb),
    'starred', EXISTS (
      SELECT 1 FROM public.planning_kanban_board_stars s
      WHERE s.organization_id = p_org_id AND s.board_id = p_board_id
        AND s.user_id = (SELECT auth.uid())
    ),
    'labels', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color, 'position', l.position)
        ORDER BY l.position ASC, l.created_at ASC
      )
      FROM public.planning_kanban_board_labels l
      WHERE l.organization_id = p_org_id AND l.board_id = p_board_id
    ), '[]'::jsonb),
    'custom_fields', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', f.id, 'board_id', f.board_id, 'name', f.name, 'field_type', f.field_type,
          'options', f.options, 'show_on_card', f.show_on_card, 'position', f.position
        )
        ORDER BY f.position ASC, f.created_at ASC
      )
      FROM public.planning_board_custom_fields f
      WHERE f.organization_id = p_org_id AND f.board_id = p_board_id
    ), '[]'::jsonb),
    'extras', public.planning_card_extras_json(p_org_id, p_board_id, NULL)
  );
$$;

-- -----------------------------------------------------------------------------
-- A task as getTaskEditor() loads it, by id or by number (PT-000042).
-- Returns NULL when the task is not found (or not readable).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.planning_task_editor(p_org_id uuid, p_ref text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_task public.planning_tasks;
  v_board_id uuid;
BEGIN
  IF p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_task FROM public.planning_tasks t
    WHERE t.organization_id = p_org_id AND t.id = p_ref::uuid;
  ELSE
    SELECT * INTO v_task FROM public.planning_tasks t
    WHERE t.organization_id = p_org_id AND t.task_number = upper(p_ref);
  END IF;

  IF v_task.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_board_id := v_task.board_id;

  RETURN jsonb_build_object(
    'card', public.planning_card_json(v_task),
    'extras', public.planning_card_extras_json(p_org_id, NULL, ARRAY[v_task.id]),
    'board', CASE WHEN v_board_id IS NULL THEN NULL ELSE (
      SELECT jsonb_build_object(
        'id', b.id, 'title', b.title, 'color', b.color,
        'archived_at', b.archived_at, 'created_by', b.created_by
      )
      FROM public.planning_kanban_boards b
      WHERE b.organization_id = p_org_id AND b.id = v_board_id AND b.deleted_at IS NULL
    ) END,
    'my_role', CASE WHEN v_board_id IS NULL THEN NULL ELSE (
      SELECT m.role FROM public.planning_kanban_board_members m
      WHERE m.organization_id = p_org_id AND m.board_id = v_board_id
        AND m.user_id = (SELECT auth.uid())
    ) END,
    'columns', CASE WHEN v_board_id IS NULL THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.position ASC)
      FROM public.planning_kanban_columns c
      WHERE c.organization_id = p_org_id AND c.board_id = v_board_id
        AND c.deleted_at IS NULL AND c.archived_at IS NULL
    ), '[]'::jsonb) END,
    'labels', CASE WHEN v_board_id IS NULL THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color, 'position', l.position)
        ORDER BY l.position ASC, l.created_at ASC
      )
      FROM public.planning_kanban_board_labels l
      WHERE l.organization_id = p_org_id AND l.board_id = v_board_id
    ), '[]'::jsonb) END,
    'custom_fields', CASE WHEN v_board_id IS NULL THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', f.id, 'board_id', f.board_id, 'name', f.name, 'field_type', f.field_type,
          'options', f.options, 'show_on_card', f.show_on_card, 'position', f.position
        )
        ORDER BY f.position ASC, f.created_at ASC
      )
      FROM public.planning_board_custom_fields f
      WHERE f.organization_id = p_org_id AND f.board_id = v_board_id
    ), '[]'::jsonb) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.planning_card_json(public.planning_tasks) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.planning_card_extras_json(uuid, uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.planning_board_view(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.planning_task_editor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_card_json(public.planning_tasks) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planning_card_extras_json(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planning_board_view(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planning_task_editor(uuid, text) TO authenticated;
