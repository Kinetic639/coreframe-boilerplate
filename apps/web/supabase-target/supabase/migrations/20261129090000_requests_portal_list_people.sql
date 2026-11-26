-- =============================================================================
-- Ambra Zgłoszenia: who resolves each request and how many wait for an answer,
-- for the new list (a "Rozwiązują" column and a count on the "Twoja kolej"
-- filter). Same functions as 20261128090000_requests_portal_rpc, same
-- signatures and grants; only the returned JSON grows.
-- =============================================================================

-- A request as a list row, now with its responders.
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
    'responders', COALESCE((
      SELECT jsonb_agg(public.portal_person_json(a.user_id) ORDER BY a.assigned_at, a.user_id)
      FROM public.helpdesk_ticket_assignees a
      WHERE a.ticket_id = t.id AND a.deleted_at IS NULL AND a.role = 'responder'
    ), '[]'::jsonb),
    'comment_count', (
      SELECT count(*) FROM public.app_comments c
      WHERE c.org_id = t.org_id AND c.target_type = 'helpdesk.ticket'
        AND c.target_id = t.id AND c.visibility <> 'internal' AND c.deleted_at IS NULL
    )
  );
$$;

-- One page of the portal list, now with the number of requests waiting for
-- the caller's answer (whatever the filter, type and search).
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
    -- Open requests waiting for the caller's answer in the same scope, for the filter badge.
    'your_turn', (
      SELECT count(*) FROM public.helpdesk_tickets t
      WHERE t.org_id = p_org_id
        AND t.branch_id = ANY (p_branch_ids)
        AND t.deleted_at IS NULL
        AND t.status = 'waiting_response'
        AND (NOT COALESCE(p_mine, true) OR t.created_by = auth.uid() OR t.requested_by = auth.uid())
    ),
    'rows', COALESCE((
      SELECT jsonb_agg(public.portal_request_json(t) ORDER BY pg.ord)
      FROM page pg
      JOIN public.helpdesk_tickets t ON t.id = pg.id, params p
      WHERE pg.ord > p.off AND pg.ord <= p.off + p.lim
    ), '[]'::jsonb)
  );
$$;
