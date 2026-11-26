-- =============================================================================
-- Help desk tickets: the list, a ticket card and the handler saves in one
-- request each.
--
-- Before: a list page took 2-3 PostgREST requests one after another (the
-- "assigned to" filter, the tickets, their assignees), a ticket card about 9
-- in three waves (the ticket, then assignees, comments with their target
-- check and count, activity and acceptors) plus two more for the QR code and
-- the branch permission, and a status change or "take" five round trips
-- (branch, permission, read, write, activity entry).
--
-- Reads are SECURITY INVOKER: every row, embedded ones included, goes
-- through the caller's RLS exactly as the separate requests did, so they
-- cannot return anything the user could not read before. The writes are
-- SECURITY INVOKER too: the table policies and the requester update guard
-- still apply, and each save, its activity entry and (for "take") the
-- assignee row commit together.
--
-- The app calls these first and falls back to the separate requests when
-- they are missing or fail, so it works before this migration is applied.
-- =============================================================================

-- A user as the ticket selects embed it.
CREATE OR REPLACE FUNCTION public.helpdesk_user_json(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jsonb_build_object(
    'id', u.id,
    'first_name', u.first_name,
    'last_name', u.last_name,
    'email', u.email,
    'avatar_url', u.avatar_url,
    'avatar_path', u.avatar_path
  )
  FROM public.users u
  WHERE u.id = p_user_id;
$$;

-- A ticket as a list row: its own fields, type, creator, acceptor, assignees
-- and how many comments and files it has.
CREATE OR REPLACE FUNCTION public.helpdesk_ticket_row_json(t public.helpdesk_tickets)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jsonb_build_object(
    'id', t.id,
    'org_id', t.org_id,
    'ticket_number', t.ticket_number,
    'title', t.title,
    'status', t.status,
    'priority', t.priority,
    'ticket_type_id', t.ticket_type_id,
    'created_by', t.created_by,
    'assigned_to', t.assigned_to,
    'branch_id', t.branch_id,
    'closed_at', t.closed_at,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'requires_acceptance', t.requires_acceptance,
    'accepted_by', t.accepted_by,
    'accepted_at', t.accepted_at,
    'ticket_type', (
      SELECT jsonb_build_object('id', ty.id, 'name', ty.name, 'color', ty.color, 'icon', ty.icon)
      FROM public.helpdesk_ticket_types ty WHERE ty.id = t.ticket_type_id
    ),
    'creator', public.helpdesk_user_json(t.created_by),
    'acceptor', CASE WHEN t.accepted_by IS NULL THEN NULL ELSE public.helpdesk_user_json(t.accepted_by) END,
    'assignees', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', a.user_id,
        'role', a.role,
        'status', a.status,
        'user', public.helpdesk_user_json(a.user_id)
      ) ORDER BY a.assigned_at, a.user_id)
      FROM public.helpdesk_ticket_assignees a
      WHERE a.ticket_id = t.id AND a.deleted_at IS NULL
    ), '[]'::jsonb),
    'comment_count', (
      SELECT count(*) FROM public.app_comments c
      WHERE c.org_id = t.org_id AND c.target_type = 'helpdesk.ticket'
        AND c.target_id = t.id AND c.deleted_at IS NULL
    ),
    'attachment_count', (
      SELECT count(*) FROM public.app_attachments f
      WHERE f.org_id = t.org_id AND f.target_type = 'helpdesk.ticket'
        AND f.target_id = t.id AND f.deleted_at IS NULL
    )
  );
$$;

-- One page of the tickets list with the number of matching tickets.
-- Same filters and sorts as HelpdeskTicketsService.listForDataView.
CREATE OR REPLACE FUNCTION public.helpdesk_ticket_list(
  p_org_id uuid,
  p_search text DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_priority text[] DEFAULT NULL,
  p_type_ids uuid[] DEFAULT NULL,
  p_branch_ids uuid[] DEFAULT NULL,
  p_created_by uuid[] DEFAULT NULL,
  p_assigned_to uuid[] DEFAULT NULL,
  p_unassigned boolean DEFAULT false,
  p_created_from timestamptz DEFAULT NULL,
  p_created_to timestamptz DEFAULT NULL,
  p_sort text DEFAULT 'created_at',
  p_desc boolean DEFAULT true,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH params AS (
    SELECT
      CASE WHEN COALESCE(btrim(p_search), '') = '' THEN NULL ELSE
        '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      END AS pattern,
      CASE WHEN p_sort IN ('created_at', 'updated_at', 'ticket_number', 'title', 'status', 'priority')
        THEN p_sort ELSE 'created_at' END AS sort,
      LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200) AS lim,
      GREATEST(COALESCE(p_offset, 0), 0) AS off
  ),
  matching AS (
    SELECT t.*, count(*) OVER () AS total
    FROM public.helpdesk_tickets t, params
    WHERE t.org_id = p_org_id
      AND t.deleted_at IS NULL
      AND (p_status IS NULL OR t.status = ANY (p_status))
      AND (p_priority IS NULL OR t.priority = ANY (p_priority))
      AND (p_type_ids IS NULL OR t.ticket_type_id = ANY (p_type_ids))
      AND (p_branch_ids IS NULL OR t.branch_id = ANY (p_branch_ids))
      AND (p_created_by IS NULL OR t.created_by = ANY (p_created_by))
      AND (NOT COALESCE(p_unassigned, false) OR t.assigned_to IS NULL)
      AND (p_created_from IS NULL OR t.created_at >= p_created_from)
      AND (p_created_to IS NULL OR t.created_at <= p_created_to)
      AND (p_assigned_to IS NULL OR EXISTS (
        SELECT 1 FROM public.helpdesk_ticket_assignees a
        WHERE a.ticket_id = t.id AND a.org_id = p_org_id
          AND a.user_id = ANY (p_assigned_to) AND a.deleted_at IS NULL
      ))
      AND (params.pattern IS NULL
        OR t.title ILIKE params.pattern
        OR t.ticket_number ILIKE params.pattern)
  ),
  ordered AS (
    SELECT m.id, m.total, row_number() OVER (
      ORDER BY
        CASE WHEN p.sort = 'created_at' AND NOT p_desc THEN m.created_at END ASC,
        CASE WHEN p.sort = 'created_at' AND p_desc THEN m.created_at END DESC,
        CASE WHEN p.sort = 'updated_at' AND NOT p_desc THEN m.updated_at END ASC,
        CASE WHEN p.sort = 'updated_at' AND p_desc THEN m.updated_at END DESC,
        CASE WHEN p.sort = 'ticket_number' AND NOT p_desc THEN m.ticket_number END ASC,
        CASE WHEN p.sort = 'ticket_number' AND p_desc THEN m.ticket_number END DESC,
        CASE WHEN p.sort = 'title' AND NOT p_desc THEN m.title END ASC,
        CASE WHEN p.sort = 'title' AND p_desc THEN m.title END DESC,
        CASE WHEN p.sort = 'status' AND NOT p_desc THEN m.status END ASC,
        CASE WHEN p.sort = 'status' AND p_desc THEN m.status END DESC,
        CASE WHEN p.sort = 'priority' AND NOT p_desc THEN m.priority END ASC,
        CASE WHEN p.sort = 'priority' AND p_desc THEN m.priority END DESC,
        m.id
    ) AS ord
    FROM matching m, params p
  ),
  page AS (
    SELECT o.id, o.ord
    FROM ordered o, params p
    WHERE o.ord > p.off AND o.ord <= p.off + p.lim
  )
  SELECT jsonb_build_object(
    'total', COALESCE((SELECT max(total) FROM matching), 0),
    'rows', COALESCE((
      SELECT jsonb_agg(public.helpdesk_ticket_row_json(t) ORDER BY pg.ord)
      FROM page pg
      JOIN public.helpdesk_tickets t ON t.id = pg.id
    ), '[]'::jsonb)
  );
$$;

-- A ticket card by its number: the ticket with its list fields, description,
-- acceptors, activity, the first page of comments (one more than asked, so
-- the app knows there are more) with their count, the QR code linked to it,
-- and whether the caller may handle tickets of its branch. NULL when the
-- caller cannot see the ticket.
CREATE OR REPLACE FUNCTION public.helpdesk_ticket_view(
  p_org_id uuid,
  p_ticket_number text,
  p_comment_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jsonb_build_object(
    'ticket', public.helpdesk_ticket_row_json(t) || jsonb_build_object(
      'description', t.description,
      'description_plain', t.description_plain,
      'description_rich', t.description_rich,
      'closed_by', t.closed_by,
      'resolved_at', t.resolved_at,
      'due_at', t.due_at
    ),
    'acceptors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('user_id', a.user_id, 'user', public.helpdesk_user_json(a.user_id))
        ORDER BY a.user_id)
      FROM public.helpdesk_ticket_acceptors a
      WHERE a.ticket_id = t.id
    ), '[]'::jsonb),
    'activity', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
      FROM (
        SELECT act.id, act.ticket_id, act.org_id, act.actor_id, act.event_type, act.payload,
               act.created_at,
               (SELECT jsonb_build_object('id', u.id, 'first_name', u.first_name,
                                          'last_name', u.last_name, 'email', u.email)
                FROM public.users u WHERE u.id = act.actor_id) AS actor
        FROM public.helpdesk_ticket_activity act
        WHERE act.ticket_id = t.id AND act.org_id = t.org_id
        ORDER BY act.created_at DESC
        LIMIT 50
      ) x
    ), '[]'::jsonb),
    'comments', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at, c.id)
      FROM (
        SELECT c.id, c.org_id, c.target_type, c.target_id, c.body_plain, c.body_rich,
               c.visibility, c.kind, c.parent_comment_id, c.metadata, c.created_by,
               c.updated_by, c.created_at, c.updated_at, c.deleted_at
        FROM public.app_comments c
        WHERE c.org_id = t.org_id AND c.target_type = 'helpdesk.ticket'
          AND c.target_id = t.id AND c.deleted_at IS NULL
        ORDER BY c.created_at, c.id
        LIMIT GREATEST(COALESCE(p_comment_limit, 50), 1) + 1
      ) c
    ), '[]'::jsonb),
    'qr', (
      SELECT jsonb_build_object(
        'id', q.id,
        'qr_code_id', q.qr_code_id,
        'qr_codes', (SELECT jsonb_build_object('token', qc.token, 'label', qc.label, 'status', qc.status)
                     FROM public.qr_codes qc WHERE qc.id = q.qr_code_id)
      )
      FROM public.qr_assignments q
      WHERE q.target_type = 'helpdesk.ticket' AND q.target_id = t.id AND q.revoked_at IS NULL
      LIMIT 1
    ),
    'can_manage', public.has_branch_permission(t.org_id, t.branch_id, 'helpdesk.tickets.manage')
  )
  FROM public.helpdesk_tickets t
  WHERE t.org_id = p_org_id
    AND t.ticket_number = p_ticket_number
    AND t.deleted_at IS NULL;
$$;

-- ---------------------------------------------------------------------------
-- Handler saves. Each returns the ticket as a list row, so the app writes it
-- into its cache instead of fetching the list and the card again.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.helpdesk_set_ticket_status(p_ticket_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ticket public.helpdesk_tickets;
  v_from text;
  v_now timestamptz := now();
BEGIN
  IF p_status NOT IN ('open', 'in_progress', 'waiting', 'waiting_response', 'resolved', 'closed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ticket FROM public.helpdesk_tickets
  WHERE id = p_ticket_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_branch_permission(v_ticket.org_id, v_ticket.branch_id, 'helpdesk.tickets.manage') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  v_from := v_ticket.status;
  IF v_from IS DISTINCT FROM p_status THEN
    UPDATE public.helpdesk_tickets SET
      status = p_status,
      updated_at = v_now,
      resolved_at = CASE WHEN p_status = 'resolved' THEN v_now ELSE resolved_at END,
      closed_at = CASE WHEN p_status IN ('closed', 'cancelled') THEN v_now ELSE NULL END,
      closed_by = CASE WHEN p_status IN ('closed', 'cancelled') THEN auth.uid() ELSE NULL END
    WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.helpdesk_ticket_activity (ticket_id, org_id, actor_id, event_type, payload)
    VALUES (p_ticket_id, v_ticket.org_id, auth.uid(), 'status_changed',
            jsonb_build_object('from', v_from, 'to', p_status));
  END IF;

  RETURN public.helpdesk_ticket_row_json(v_ticket);
END;
$$;

-- "Biorę": the caller takes the ticket and it moves to in_progress.
CREATE OR REPLACE FUNCTION public.helpdesk_take_ticket(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ticket public.helpdesk_tickets;
  v_from text;
  v_user uuid := auth.uid();
BEGIN
  SELECT * INTO v_ticket FROM public.helpdesk_tickets
  WHERE id = p_ticket_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_branch_permission(v_ticket.org_id, v_ticket.branch_id, 'helpdesk.tickets.manage') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;
  IF v_ticket.status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'Ticket is closed' USING ERRCODE = '22023';
  END IF;

  v_from := v_ticket.status;
  UPDATE public.helpdesk_tickets
  SET assigned_to = v_user, status = 'in_progress', updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.helpdesk_ticket_assignees
    (org_id, ticket_id, user_id, role, status, assigned_by, deleted_at)
  VALUES (v_ticket.org_id, p_ticket_id, v_user, 'responder', 'assigned', v_user, NULL)
  ON CONFLICT (ticket_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = EXCLUDED.status,
        assigned_by = EXCLUDED.assigned_by, deleted_at = NULL;

  INSERT INTO public.helpdesk_ticket_activity (ticket_id, org_id, actor_id, event_type, payload)
  VALUES (p_ticket_id, v_ticket.org_id, v_user, 'ticket_taken',
          jsonb_build_object('from', v_from, 'to', 'in_progress'));

  RETURN public.helpdesk_ticket_row_json(v_ticket);
END;
$$;

-- Close a ticket: its handlers, or the person who reported it.
CREATE OR REPLACE FUNCTION public.helpdesk_close_ticket(p_ticket_id uuid, p_resolution_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ticket public.helpdesk_tickets;
  v_user uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_ticket FROM public.helpdesk_tickets
  WHERE id = p_ticket_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_ticket.created_by IS DISTINCT FROM v_user
     AND NOT public.has_branch_permission(v_ticket.org_id, v_ticket.branch_id, 'helpdesk.tickets.manage') THEN
    RAISE EXCEPTION 'Only the ticket creator or a manager can close tickets' USING ERRCODE = '42501';
  END IF;

  UPDATE public.helpdesk_tickets
  SET status = 'closed', closed_at = v_now, closed_by = v_user, updated_at = v_now
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.helpdesk_ticket_activity (ticket_id, org_id, actor_id, event_type, payload)
  VALUES (p_ticket_id, v_ticket.org_id, v_user, 'ticket_closed',
          jsonb_build_object('resolution_note', p_resolution_note));

  RETURN public.helpdesk_ticket_row_json(v_ticket);
END;
$$;

-- The list's default sorts.
CREATE INDEX IF NOT EXISTS helpdesk_tickets_org_created_at_idx
  ON public.helpdesk_tickets (org_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS helpdesk_tickets_org_updated_at_idx
  ON public.helpdesk_tickets (org_id, updated_at DESC) WHERE deleted_at IS NULL;

REVOKE ALL ON FUNCTION public.helpdesk_user_json(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_ticket_row_json(public.helpdesk_tickets) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_ticket_list(uuid, text, text[], text[], uuid[], uuid[], uuid[], uuid[], boolean, timestamptz, timestamptz, text, boolean, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_ticket_view(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_set_ticket_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_take_ticket(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_close_ticket(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.helpdesk_user_json(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_ticket_row_json(public.helpdesk_tickets) TO authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_ticket_list(uuid, text, text[], text[], uuid[], uuid[], uuid[], uuid[], boolean, timestamptz, timestamptz, text, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_ticket_view(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_set_ticket_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_take_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_close_ticket(uuid, text) TO authenticated;
