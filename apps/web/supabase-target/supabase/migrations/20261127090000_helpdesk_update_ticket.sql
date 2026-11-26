-- Help Desk: edit a ticket's title, description, priority and type from its card.
--
-- One request: the permission check, the save and one activity entry naming
-- what changed. Handlers (helpdesk.tickets.manage on the ticket's branch) can
-- edit any open ticket; the person who reported it can edit it while it is open.
-- SECURITY INVOKER, so the helpdesk_tickets RLS policies still apply.
--
-- p_fields holds only the fields being changed:
--   title text, description_plain text, description_rich jsonb,
--   priority text, ticket_type_id uuid (null clears the type).

CREATE OR REPLACE FUNCTION public.helpdesk_update_ticket(p_ticket_id uuid, p_fields jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ticket public.helpdesk_tickets;
  v_before public.helpdesk_tickets;
  v_user uuid := auth.uid();
  v_title text;
  v_priority text;
  v_type uuid;
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' THEN
    RAISE EXCEPTION 'Nothing to save' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before FROM public.helpdesk_tickets
  WHERE id = p_ticket_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'Ticket is closed' USING ERRCODE = '22023';
  END IF;
  IF v_before.created_by IS DISTINCT FROM v_user
     AND NOT public.has_branch_permission(v_before.org_id, v_before.branch_id, 'helpdesk.tickets.manage') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  v_title := CASE WHEN p_fields ? 'title' THEN btrim(p_fields->>'title') ELSE v_before.title END;
  IF v_title IS NULL OR v_title = '' OR length(v_title) > 255 THEN
    RAISE EXCEPTION 'Title is required' USING ERRCODE = '22023';
  END IF;

  v_priority := CASE WHEN p_fields ? 'priority' THEN p_fields->>'priority' ELSE v_before.priority END;
  IF v_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority' USING ERRCODE = '22023';
  END IF;

  v_type := CASE WHEN p_fields ? 'ticket_type_id'
                 THEN NULLIF(p_fields->>'ticket_type_id', '')::uuid
                 ELSE v_before.ticket_type_id END;
  IF v_type IS DISTINCT FROM v_before.ticket_type_id AND v_type IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.helpdesk_ticket_types tt
    WHERE tt.id = v_type AND tt.org_id = v_before.org_id AND tt.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid ticket type' USING ERRCODE = '22023';
  END IF;

  IF p_fields ? 'description_plain' AND length(coalesce(p_fields->>'description_plain', '')) > 10000 THEN
    RAISE EXCEPTION 'Description is too long' USING ERRCODE = '22023';
  END IF;

  UPDATE public.helpdesk_tickets SET
    title = v_title,
    priority = v_priority,
    ticket_type_id = v_type,
    description_plain = CASE WHEN p_fields ? 'description_plain'
                             THEN NULLIF(p_fields->>'description_plain', '')
                             ELSE description_plain END,
    description_rich = CASE WHEN p_fields ? 'description_rich'
                            THEN NULLIF(p_fields->'description_rich', 'null'::jsonb)
                            ELSE description_rich END,
    updated_at = now()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  IF v_ticket.title IS DISTINCT FROM v_before.title THEN
    v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('from', v_before.title, 'to', v_ticket.title));
  END IF;
  IF v_ticket.priority IS DISTINCT FROM v_before.priority THEN
    v_changes := v_changes || jsonb_build_object('priority', jsonb_build_object('from', v_before.priority, 'to', v_ticket.priority));
  END IF;
  IF v_ticket.ticket_type_id IS DISTINCT FROM v_before.ticket_type_id THEN
    v_changes := v_changes || jsonb_build_object('ticket_type_id', jsonb_build_object('from', v_before.ticket_type_id, 'to', v_ticket.ticket_type_id));
  END IF;
  IF v_ticket.description_rich IS DISTINCT FROM v_before.description_rich
     OR v_ticket.description_plain IS DISTINCT FROM v_before.description_plain THEN
    v_changes := v_changes || jsonb_build_object('description', true);
  END IF;

  IF v_changes <> '{}'::jsonb THEN
    INSERT INTO public.helpdesk_ticket_activity (ticket_id, org_id, actor_id, event_type, payload)
    VALUES (p_ticket_id, v_ticket.org_id, v_user, 'ticket_updated', v_changes);
  END IF;

  RETURN public.helpdesk_ticket_row_json(v_ticket);
END;
$$;

REVOKE ALL ON FUNCTION public.helpdesk_update_ticket(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helpdesk_update_ticket(uuid, jsonb) TO authenticated;
