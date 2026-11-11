-- "Someone is typing" for Help Desk tickets (Ambra + Ambra Zapytania).
-- Private Realtime Broadcast channels "helpdesk-ticket:<ticket uuid>:typing": nothing is
-- stored, Realtime authorizes join/send through RLS on realtime.messages. Only users who
-- may read the ticket's comments can listen or send.

CREATE OR REPLACE FUNCTION public.can_use_helpdesk_ticket_topic(p_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ticket uuid;
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL
     OR p_topic IS NULL
     OR p_topic !~ '^helpdesk-ticket:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:typing$' THEN
    RETURN false;
  END IF;

  v_ticket := split_part(p_topic, ':', 2)::uuid;
  SELECT org_id INTO v_org FROM public.helpdesk_tickets WHERE id = v_ticket;
  IF v_org IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.can_access_comment_target(v_org, 'helpdesk.ticket', v_ticket, 'select', 'default');
END;
$$;

REVOKE ALL ON FUNCTION public.can_use_helpdesk_ticket_topic(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_helpdesk_ticket_topic(text) TO authenticated;

CREATE POLICY "helpdesk ticket typing: receive"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND public.can_use_helpdesk_ticket_topic((SELECT realtime.topic()))
  );

CREATE POLICY "helpdesk ticket typing: send"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'broadcast'
    AND public.can_use_helpdesk_ticket_topic((SELECT realtime.topic()))
  );
