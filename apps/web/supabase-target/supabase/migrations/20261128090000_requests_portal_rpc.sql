-- =============================================================================
-- Ambra Zgłoszenia (apps/requests-portal): the list, a request card, creating,
-- closing and replying in one request each.
--
-- Before: a list page took up to four PostgREST requests one after another
-- (order-number search, tickets, their order references, every public
-- comment row to count them), a request card two rounds plus the comments'
-- authors, creating a request four (types, default priority, the ticket, the
-- order reference, the last one outside the ticket's transaction), closing
-- two and a reply three writes.
--
-- Reads and writes are SECURITY INVOKER: every row goes through the caller's
-- RLS and the requester update guard exactly as the separate requests did.
-- helpdesk_create_ticket and portal_find_repair_order keep their own checks.
--
-- The portal calls these first and falls back to the separate requests when
-- they are missing or fail, so it works before this migration is applied.
-- =============================================================================

-- A person as the portal shows one.
CREATE OR REPLACE FUNCTION public.portal_person_json(p_user_id uuid)
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
    'avatar_url', u.avatar_url
  )
  FROM public.users u
  WHERE u.id = p_user_id;
$$;

-- A request as a list row: own fields, type, requester, repair order and the
-- number of public comments.
CREATE OR REPLACE FUNCTION public.portal_request_json(t public.helpdesk_tickets)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jsonb_build_object(
    'id', t.id,
    'ticket_number', t.ticket_number,
    'title', t.title,
    'status', t.status,
    'requires_acceptance', t.requires_acceptance,
    'accepted_at', t.accepted_at,
    'branch_id', t.branch_id,
    'created_by', t.created_by,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'ticket_type', (
      SELECT jsonb_build_object('id', ty.id, 'name', ty.name, 'color', ty.color, 'icon', ty.icon)
      FROM public.helpdesk_ticket_types ty WHERE ty.id = t.ticket_type_id
    ),
    'creator', public.portal_person_json(t.created_by),
    'order_ref', (
      SELECT jsonb_build_object(
        'source_type', r.source_type,
        'source_id', r.source_id,
        'context_snapshot', r.context_snapshot
      )
      FROM public.helpdesk_ticket_references r
      WHERE r.ticket_id = t.id AND r.source_type IN ('repair_order', 'repair_order_number')
      ORDER BY r.created_at
      LIMIT 1
    ),
    'comment_count', (
      SELECT count(*) FROM public.app_comments c
      WHERE c.org_id = t.org_id AND c.target_type = 'helpdesk.ticket'
        AND c.target_id = t.id AND c.visibility <> 'internal' AND c.deleted_at IS NULL
    )
  );
$$;

-- One page of the portal list with the number of matching requests.
-- Same filters as listRequests in apps/requests-portal (requests.service.ts).
CREATE OR REPLACE FUNCTION public.portal_request_list(
  p_org_id uuid,
  p_branch_ids uuid[],
  p_mine boolean DEFAULT true,
  p_filter text DEFAULT 'open',
  p_type_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'activity',
  p_limit integer DEFAULT 25,
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
      -- "51481", "3252", "ZL/51481/...": digits and slashes of the term, when it has 3+ digits.
      CASE WHEN regexp_replace(COALESCE(p_search, ''), '[^0-9/]', '', 'g') ~ '[0-9]{3,}'
        THEN '%' || regexp_replace(p_search, '[^0-9/]', '', 'g') || '%' END AS order_pattern,
      LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100) AS lim,
      GREATEST(COALESCE(p_offset, 0), 0) AS off
  ),
  matching AS (
    SELECT t.id, t.created_at, t.updated_at, count(*) OVER () AS total
    FROM public.helpdesk_tickets t, params p
    WHERE t.org_id = p_org_id
      AND t.branch_id = ANY (p_branch_ids)
      AND t.deleted_at IS NULL
      AND (NOT COALESCE(p_mine, true) OR t.created_by = auth.uid() OR t.requested_by = auth.uid())
      AND (p_type_id IS NULL OR t.ticket_type_id = p_type_id)
      AND CASE p_filter
        WHEN 'yourTurn' THEN t.status = 'waiting_response'
        WHEN 'answered' THEN t.status = 'resolved'
        WHEN 'closed' THEN t.status IN ('closed', 'cancelled')
        WHEN 'approval' THEN t.status NOT IN ('closed', 'cancelled')
          AND t.requires_acceptance AND t.accepted_at IS NULL
        ELSE t.status NOT IN ('closed', 'cancelled')
      END
      AND (p.pattern IS NULL
        OR t.title ILIKE p.pattern
        OR t.ticket_number ILIKE p.pattern
        OR (p.order_pattern IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.helpdesk_ticket_references r
          WHERE r.ticket_id = t.id
            AND r.source_type IN ('repair_order', 'repair_order_number')
            AND (r.context_snapshot->>'order_number' ILIKE p.order_pattern
              OR r.context_snapshot->>'zl_number' ILIKE p.order_pattern)
        )))
  ),
  page AS (
    SELECT m.id, row_number() OVER (
      ORDER BY
        CASE WHEN p_sort = 'newest' THEN m.created_at END DESC,
        m.updated_at DESC,
        m.id
    ) AS ord
    FROM matching m
  )
  SELECT jsonb_build_object(
    'total', COALESCE((SELECT max(total) FROM matching), 0),
    'rows', COALESCE((
      SELECT jsonb_agg(public.portal_request_json(t) ORDER BY pg.ord)
      FROM page pg
      JOIN public.helpdesk_tickets t ON t.id = pg.id, params p
      WHERE pg.ord > p.off AND pg.ord <= p.off + p.lim
    ), '[]'::jsonb)
  );
$$;

-- A request card: the list fields, description, responders, acceptors,
-- activity, public comments with their authors and the files. NULL when the
-- caller cannot see the request.
CREATE OR REPLACE FUNCTION public.portal_request_view(p_org_id uuid, p_ticket_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.portal_request_json(t) || jsonb_build_object(
    'description_plain', t.description_plain,
    'description_rich', t.description_rich,
    'closed_at', t.closed_at,
    'responders', COALESCE((
      SELECT jsonb_agg(public.portal_person_json(a.user_id) ORDER BY a.assigned_at, a.user_id)
      FROM public.helpdesk_ticket_assignees a
      WHERE a.ticket_id = t.id AND a.deleted_at IS NULL AND a.role = 'responder'
    ), '[]'::jsonb),
    'acceptors', COALESCE((
      SELECT jsonb_agg(public.portal_person_json(a.user_id) ORDER BY a.added_at, a.user_id)
      FROM public.helpdesk_ticket_acceptors a
      WHERE a.ticket_id = t.id
    ), '[]'::jsonb),
    'activity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'payload', e.payload,
        'created_at', e.created_at,
        'actor', public.portal_person_json(e.actor_id)
      ) ORDER BY e.created_at, e.id)
      FROM public.helpdesk_ticket_activity e
      WHERE e.ticket_id = t.id
    ), '[]'::jsonb),
    'comments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'body_plain', c.body_plain,
        'body_rich', c.body_rich,
        'created_by', c.created_by,
        'created_at', c.created_at,
        'updated_at', c.updated_at,
        'author', public.portal_person_json(c.created_by)
      ) ORDER BY c.created_at, c.id)
      FROM public.app_comments c
      WHERE c.org_id = t.org_id AND c.target_type = 'helpdesk.ticket' AND c.target_id = t.id
        AND c.visibility <> 'internal' AND c.deleted_at IS NULL
    ), '[]'::jsonb),
    'attachments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', f.id,
        'storage_path', f.storage_path,
        'file_name', f.file_name,
        'content_type', f.content_type,
        'size_bytes', f.size_bytes,
        'metadata', f.metadata,
        'created_by', f.created_by,
        'created_at', f.created_at
      ) ORDER BY f.created_at, f.id)
      FROM public.app_attachments f
      WHERE f.org_id = t.org_id AND f.target_type = 'helpdesk.ticket' AND f.target_id = t.id
        AND f.deleted_at IS NULL
    ), '[]'::jsonb)
  )
  FROM public.helpdesk_tickets t
  WHERE t.id = p_ticket_id AND t.org_id = p_org_id AND t.deleted_at IS NULL;
$$;

-- New request: responders, acceptors and priority always come from the type,
-- and the repair-order reference commits together with the ticket.
CREATE OR REPLACE FUNCTION public.portal_create_request(
  p_org_id uuid,
  p_branch_id uuid,
  p_type_id uuid,
  p_title text,
  p_description_plain text,
  p_description_rich jsonb,
  p_order_number text DEFAULT NULL,
  p_warehouse text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_priority text;
  v_requires_acceptance boolean;
  v_responders uuid[];
  v_acceptors uuid[];
  v_created jsonb;
  v_ticket_id uuid;
  v_ro_id uuid;
  v_zl text;
BEGIN
  SELECT COALESCE(ty.default_priority, 'medium'), COALESCE(ty.requires_acceptance, false)
  INTO v_priority, v_requires_acceptance
  FROM public.helpdesk_ticket_types ty
  WHERE ty.id = p_type_id AND ty.org_id = p_org_id AND ty.is_active AND ty.deleted_at IS NULL
    AND (ty.scope IS DISTINCT FROM 'branch' OR ty.branch_id = p_branch_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_type' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(array_agg(r.responder_user_id ORDER BY r.created_at), '{}')
  INTO v_responders
  FROM public.helpdesk_ticket_type_default_responders r
  WHERE r.ticket_type_id = p_type_id AND r.deleted_at IS NULL;

  SELECT COALESCE(array_agg(a.user_id ORDER BY a.created_at), '{}')
  INTO v_acceptors
  FROM public.helpdesk_ticket_type_acceptors a
  WHERE a.ticket_type_id = p_type_id;

  v_created := public.helpdesk_create_ticket(
    p_org_id => p_org_id,
    p_title => p_title,
    p_description_plain => COALESCE(p_description_plain, ''),
    p_description_rich => p_description_rich,
    p_status => 'open',
    p_priority => v_priority,
    p_ticket_type_id => p_type_id,
    p_branch_id => p_branch_id,
    p_assignee_ids => v_responders,
    p_requires_acceptance => v_requires_acceptance AND cardinality(v_acceptors) > 0,
    p_acceptor_ids => v_acceptors
  );
  v_ticket_id := (v_created->>'id')::uuid;

  IF p_order_number IS NOT NULL AND p_warehouse IS NOT NULL THEN
    SELECT ro.id, ro.zl_number INTO v_ro_id, v_zl
    FROM public.portal_find_repair_order(p_org_id, p_order_number, p_warehouse) ro;
    IF v_zl IS NULL THEN
      v_ro_id := NULL;
    END IF;
    INSERT INTO public.helpdesk_ticket_references
      (ticket_id, source_module, source_type, source_id, context_snapshot, created_by)
    VALUES (
      v_ticket_id,
      'workshop',
      CASE WHEN v_ro_id IS NULL THEN 'repair_order_number' ELSE 'repair_order' END,
      COALESCE(v_ro_id::text, p_order_number || '/' || p_warehouse),
      jsonb_build_object('order_number', p_order_number, 'warehouse', p_warehouse, 'zl_number', v_zl),
      auth.uid()
    );
  END IF;

  RETURN v_created;
END;
$$;

-- The requester closes ("Sprawa załatwiona") or withdraws their own open
-- request; the activity entry commits with it. Returns the saved list row.
CREATE OR REPLACE FUNCTION public.portal_close_request(p_ticket_id uuid, p_outcome text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ticket public.helpdesk_tickets;
BEGIN
  IF p_outcome NOT IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_outcome' USING ERRCODE = '22023';
  END IF;

  UPDATE public.helpdesk_tickets
  SET status = p_outcome, closed_at = now(), closed_by = auth.uid(), updated_at = now()
  WHERE id = p_ticket_id
    AND created_by = auth.uid()
    AND status NOT IN ('closed', 'cancelled')
    AND deleted_at IS NULL
  RETURNING * INTO v_ticket;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.helpdesk_ticket_activity (ticket_id, org_id, actor_id, event_type, payload)
  VALUES (
    v_ticket.id, v_ticket.org_id, auth.uid(), 'ticket_closed',
    jsonb_build_object('resolution_note', NULL, 'status', p_outcome, 'source', 'requests-portal')
  );

  RETURN public.portal_request_json(v_ticket);
END;
$$;

-- A public reply. A reply by the requester to a "resolved" request puts it
-- back in the queue as "open". The comment, its activity entry and the
-- ticket's updated_at commit together. Returns the comment.
CREATE OR REPLACE FUNCTION public.portal_add_comment(
  p_ticket_id uuid,
  p_body_plain text,
  p_body_rich jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ticket public.helpdesk_tickets;
  v_comment public.app_comments;
BEGIN
  SELECT * INTO v_ticket
  FROM public.helpdesk_tickets
  WHERE id = p_ticket_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_ticket.status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'closed' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.app_comments
    (org_id, target_type, target_id, body_plain, body_rich, visibility, kind, created_by)
  VALUES
    (v_ticket.org_id, 'helpdesk.ticket', v_ticket.id, p_body_plain, p_body_rich, 'default', 'comment', auth.uid())
  RETURNING * INTO v_comment;

  INSERT INTO public.helpdesk_ticket_activity (ticket_id, org_id, actor_id, event_type, payload)
  VALUES (v_ticket.id, v_ticket.org_id, auth.uid(), 'comment_added', jsonb_build_object('is_internal', false));

  UPDATE public.helpdesk_tickets
  SET updated_at = now(),
      status = CASE WHEN status = 'resolved' AND created_by = auth.uid() THEN 'open' ELSE status END
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'id', v_comment.id,
    'body_plain', v_comment.body_plain,
    'body_rich', v_comment.body_rich,
    'created_by', v_comment.created_by,
    'created_at', v_comment.created_at,
    'updated_at', v_comment.updated_at,
    'author', public.portal_person_json(v_comment.created_by)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_person_json(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_request_json(public.helpdesk_tickets) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_request_list(uuid, uuid[], boolean, text, uuid, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_request_view(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_create_request(uuid, uuid, uuid, text, text, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_close_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_add_comment(uuid, text, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.portal_person_json(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_request_json(public.helpdesk_tickets) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_request_list(uuid, uuid[], boolean, text, uuid, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_request_view(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_request(uuid, uuid, uuid, text, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_close_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_add_comment(uuid, text, jsonb) TO authenticated;
