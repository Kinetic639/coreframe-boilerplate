-- =============================================================================
-- object_mentions: where an object is mentioned with "@"
-- =============================================================================
-- For the "Related" tab of a repair order (and any other object later): ticket
-- and task descriptions, comments and chat messages that mention the object.
-- SECURITY INVOKER: every source is read through the caller's own RLS, so the
-- list never shows a ticket, a task, a comment or a conversation the caller
-- could not open. Documents are pre-filtered by text (the object's id) before
-- the JSON path walk; chat uses the stored `mentions` list.
-- Additive only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.object_mentions(p_org uuid, p_type text, p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH needle AS (
    SELECT
      '$.** ? (@.type == "mention" && @.attrs.type == $t && @.attrs.id == $i)'::jsonpath AS path,
      jsonb_build_object('t', p_type, 'i', p_id::text) AS vars,
      -- Cheap text pre-filter before walking the document
      '%' || p_id::text || '%' AS txt
  ),
  tickets AS (
    SELECT jsonb_build_object(
             'source', 'ticket', 'id', t.id, 'code', t.ticket_number, 'title', t.title,
             'status', t.status, 'created_at', t.created_at) AS item, t.created_at
    FROM public.helpdesk_tickets t, needle n
    WHERE t.org_id = p_org AND t.deleted_at IS NULL
      AND t.description_rich IS NOT NULL
      AND t.description_rich::text LIKE n.txt
      AND jsonb_path_exists(t.description_rich, n.path, n.vars)
    ORDER BY t.created_at DESC LIMIT 50
  ),
  tasks AS (
    SELECT jsonb_build_object(
             'source', 'task', 'id', t.id, 'code', t.task_number, 'title', t.title,
             'status', t.status, 'created_at', t.created_at) AS item, t.created_at
    FROM public.planning_tasks t, needle n
    WHERE t.organization_id = p_org AND t.deleted_at IS NULL
      AND t.description_rich IS NOT NULL
      AND t.description_rich::text LIKE n.txt
      AND jsonb_path_exists(t.description_rich, n.path, n.vars)
    ORDER BY t.created_at DESC LIMIT 50
  ),
  comments AS (
    SELECT jsonb_build_object(
             'source', 'comment', 'id', c.id, 'target_type', c.target_type, 'target_id', c.target_id,
             'code', coalesce(ht.ticket_number, pt.task_number, ro.zl_number),
             'title', coalesce(ht.title, pt.title, nullif(ro.client_name, '')),
             'snippet', left(c.body_plain, 200), 'created_at', c.created_at,
             'author', nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
           ) AS item, c.created_at
    FROM public.app_comments c
    CROSS JOIN needle n
    LEFT JOIN public.helpdesk_tickets ht ON c.target_type = 'helpdesk.ticket' AND ht.id = c.target_id
    LEFT JOIN public.planning_tasks pt ON c.target_type = 'planning.task' AND pt.id = c.target_id
    LEFT JOIN public.repair_orders ro ON c.target_type = 'workshop.repair_order' AND ro.id = c.target_id
    LEFT JOIN public.users u ON u.id = c.created_by
    WHERE c.org_id = p_org AND c.deleted_at IS NULL AND c.kind = 'comment'
      AND c.body_rich IS NOT NULL
      AND c.body_rich::text LIKE n.txt
      AND jsonb_path_exists(c.body_rich, n.path, n.vars)
    ORDER BY c.created_at DESC LIMIT 50
  ),
  chats AS (
    SELECT jsonb_build_object(
             'source', 'chat', 'id', m.id, 'conversation_id', m.conversation_id,
             'conversation_kind', cv.kind, 'title', cv.name,
             'snippet', left(m.body_plain, 200), 'created_at', m.created_at,
             'author', nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
           ) AS item, m.created_at
    FROM public.chat_messages m
    JOIN public.chat_conversations cv ON cv.id = m.conversation_id AND cv.deleted_at IS NULL
    LEFT JOIN public.users u ON u.id = m.author_id
    WHERE m.organization_id = p_org AND m.deleted_at IS NULL AND m.kind = 'text'
      AND m.mentions @> jsonb_build_array(jsonb_build_object('type', p_type, 'id', p_id::text))
    ORDER BY m.created_at DESC LIMIT 50
  ),
  everything AS (
    SELECT item, created_at FROM tickets
    UNION ALL SELECT item, created_at FROM tasks
    UNION ALL SELECT item, created_at FROM comments
    UNION ALL SELECT item, created_at FROM chats
  )
  SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb) FROM everything;
$$;

REVOKE ALL ON FUNCTION public.object_mentions(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.object_mentions(uuid, text, uuid) TO authenticated;
