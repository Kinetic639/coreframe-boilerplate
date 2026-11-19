-- =============================================================================
-- Planning: what a card shows besides its row, in one call.
--
-- A board load asked four tables one by one per card set (comments, files,
-- subtasks, dependencies), and only after the cards had come back. This
-- function returns all of it in one round trip, and for a whole board it can
-- run together with the board's other reads.
--
-- SECURITY INVOKER: every table is read under the caller's RLS, exactly as
-- the separate queries were, so counts include only what the caller may see.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.planning_card_extras(
  p_org_id uuid,
  p_board_id uuid DEFAULT NULL,
  p_task_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  task_id uuid,
  comment_count integer,
  attachment_count integer,
  has_cover_image boolean,
  subtask_total integer,
  subtask_done integer,
  blocked_by_open integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    t.id,
    (SELECT count(*) FROM public.app_comments c
      WHERE c.org_id = t.organization_id AND c.target_type = 'planning.task'
        AND c.target_id = t.id AND c.deleted_at IS NULL)::int,
    (SELECT count(*) FROM public.app_attachments a
      WHERE a.org_id = t.organization_id AND a.target_type = 'planning.task'
        AND a.target_id = t.id AND a.deleted_at IS NULL)::int,
    (t.cover_attachment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.app_attachments a
      WHERE a.id = t.cover_attachment_id AND a.org_id = t.organization_id
        AND a.target_type = 'planning.task' AND a.target_id = t.id
        AND a.deleted_at IS NULL AND a.content_type LIKE 'image/%')),
    (SELECT count(*) FROM public.planning_tasks s
      WHERE s.parent_task_id = t.id AND s.organization_id = t.organization_id
        AND s.deleted_at IS NULL)::int,
    (SELECT count(*) FROM public.planning_tasks s
      WHERE s.parent_task_id = t.id AND s.organization_id = t.organization_id
        AND s.deleted_at IS NULL AND s.status IN ('completed', 'cancelled'))::int,
    (SELECT count(*) FROM public.planning_task_dependencies d
      JOIN public.planning_tasks b ON b.id = d.depends_on_task_id
      WHERE d.task_id = t.id AND d.organization_id = t.organization_id
        AND b.deleted_at IS NULL AND b.status NOT IN ('completed', 'cancelled'))::int
  FROM public.planning_tasks t
  WHERE t.organization_id = p_org_id
    AND (
      (p_board_id IS NOT NULL AND t.board_id = p_board_id
        AND t.column_id IS NOT NULL AND t.deleted_at IS NULL)
      OR (p_task_ids IS NOT NULL AND t.id = ANY (p_task_ids))
    );
$$;

REVOKE ALL ON FUNCTION public.planning_card_extras(uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_card_extras(uuid, uuid, uuid[]) TO authenticated, service_role;
