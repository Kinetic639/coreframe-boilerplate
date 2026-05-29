-- ---------------------------------------------------------------------------
-- Helpdesk: Ticket Acceptance Workflow
-- Adds optional "requires acceptance" flag to tickets, a table of authorized
-- acceptors, and a SECURITY DEFINER RPC for the accept action.
-- ---------------------------------------------------------------------------

-- 1. New columns on helpdesk_tickets
ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS requires_acceptance BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_by         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at         TIMESTAMPTZ;

-- 2. Authorized acceptors table
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_acceptors (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID        NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  org_id     UUID        NOT NULL REFERENCES public.organizations(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id)            ON DELETE CASCADE,
  added_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, user_id)
);

ALTER TABLE public.helpdesk_ticket_acceptors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS helpdesk_ticket_acceptors_ticket_idx
  ON public.helpdesk_ticket_acceptors (ticket_id);

CREATE INDEX IF NOT EXISTS helpdesk_ticket_acceptors_user_org_idx
  ON public.helpdesk_ticket_acceptors (org_id, user_id);

-- RLS: any ticket reader can see who the acceptors are
CREATE POLICY "helpdesk_ticket_acceptors_select"
  ON public.helpdesk_ticket_acceptors
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
  );

CREATE POLICY "helpdesk_ticket_acceptors_insert"
  ON public.helpdesk_ticket_acceptors
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND (
      has_permission(org_id, 'helpdesk.tickets.create')
      OR has_permission(org_id, 'helpdesk.tickets.manage')
    )
  );

CREATE POLICY "helpdesk_ticket_acceptors_delete"
  ON public.helpdesk_ticket_acceptors
  FOR DELETE TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.manage')
  );

-- 3. Update helpdesk_create_ticket RPC to handle acceptors
CREATE OR REPLACE FUNCTION public.helpdesk_create_ticket(
  p_org_id              UUID,
  p_title               TEXT,
  p_description_plain   TEXT,
  p_description_rich    JSONB,
  p_status              TEXT,
  p_priority            TEXT,
  p_ticket_type_id      UUID,
  p_branch_id           UUID,
  p_assignee_ids        UUID[],
  p_due_at              TIMESTAMPTZ DEFAULT NULL,
  p_requires_acceptance BOOLEAN     DEFAULT false,
  p_acceptor_ids        UUID[]      DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id     UUID;
  v_ticket_number TEXT;
  v_prefix        TEXT := 'HD';
  v_seq_num       BIGINT;
  v_assignee_id   UUID;
  v_acceptor_id   UUID;
BEGIN
  IF NOT (is_org_member(p_org_id) AND has_permission(p_org_id, 'helpdesk.tickets.create')) THEN
    RAISE EXCEPTION 'Unauthorized: cannot create ticket';
  END IF;

  SELECT COALESCE(ticket_prefix, 'HD') INTO v_prefix
  FROM   public.helpdesk_settings
  WHERE  org_id = p_org_id;

  v_seq_num       := nextval('public.helpdesk_ticket_number_seq');
  v_ticket_number := COALESCE(v_prefix, 'HD') || '-' || LPAD(v_seq_num::TEXT, 6, '0');

  INSERT INTO public.helpdesk_tickets (
    org_id, ticket_number, title,
    description, description_plain, description_rich,
    status, priority, ticket_type_id, branch_id,
    created_by, requested_by, due_at,
    requires_acceptance
  ) VALUES (
    p_org_id, v_ticket_number, p_title,
    p_description_plain, p_description_plain, p_description_rich,
    p_status, p_priority, p_ticket_type_id, p_branch_id,
    auth.uid(), auth.uid(), p_due_at,
    p_requires_acceptance
  )
  RETURNING id INTO v_ticket_id;

  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_assignee_id IN ARRAY p_assignee_ids LOOP
      INSERT INTO public.helpdesk_ticket_assignees (
        org_id, ticket_id, user_id, role, status, assigned_by
      ) VALUES (
        p_org_id, v_ticket_id, v_assignee_id, 'responder', 'assigned', auth.uid()
      )
      ON CONFLICT (ticket_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  IF p_requires_acceptance AND p_acceptor_ids IS NOT NULL
     AND array_length(p_acceptor_ids, 1) > 0 THEN
    FOREACH v_acceptor_id IN ARRAY p_acceptor_ids LOOP
      INSERT INTO public.helpdesk_ticket_acceptors (
        org_id, ticket_id, user_id, added_by
      ) VALUES (
        p_org_id, v_ticket_id, v_acceptor_id, auth.uid()
      )
      ON CONFLICT (ticket_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  INSERT INTO public.helpdesk_ticket_activity (
    ticket_id, org_id, actor_id, event_type, payload
  ) VALUES (
    v_ticket_id, p_org_id, auth.uid(), 'ticket_created',
    jsonb_build_object(
      'ticket_number',        v_ticket_number,
      'title',                p_title,
      'status',               p_status,
      'priority',             p_priority,
      'assignee_count',       COALESCE(array_length(p_assignee_ids, 1), 0),
      'requires_acceptance',  p_requires_acceptance,
      'acceptor_count',       COALESCE(array_length(p_acceptor_ids, 1), 0)
    )
  );

  RETURN jsonb_build_object('id', v_ticket_id, 'ticket_number', v_ticket_number);
END;
$$;

-- 4. SECURITY DEFINER RPC for accepting a ticket
--    Validates: is org member + has read permission + is authorized acceptor or manager
CREATE OR REPLACE FUNCTION public.helpdesk_accept_ticket(
  p_ticket_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket       RECORD;
  v_is_acceptor  BOOLEAN;
  v_is_manager   BOOLEAN;
  v_now          TIMESTAMPTZ := now();
BEGIN
  SELECT id, org_id, requires_acceptance, accepted_by, ticket_number
  INTO   v_ticket
  FROM   public.helpdesk_tickets
  WHERE  id = p_ticket_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF NOT (is_org_member(v_ticket.org_id) AND has_permission(v_ticket.org_id, 'helpdesk.tickets.read')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT v_ticket.requires_acceptance THEN
    RAISE EXCEPTION 'Ticket does not require acceptance';
  END IF;

  IF v_ticket.accepted_by IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket has already been accepted';
  END IF;

  v_is_manager := has_permission(v_ticket.org_id, 'helpdesk.tickets.manage');

  SELECT EXISTS(
    SELECT 1 FROM public.helpdesk_ticket_acceptors
    WHERE  ticket_id = p_ticket_id AND user_id = auth.uid()
  ) INTO v_is_acceptor;

  IF NOT (v_is_manager OR v_is_acceptor) THEN
    RAISE EXCEPTION 'Not authorized to accept this ticket';
  END IF;

  UPDATE public.helpdesk_tickets
  SET    accepted_by = auth.uid(),
         accepted_at = v_now,
         updated_at  = v_now
  WHERE  id = p_ticket_id;

  INSERT INTO public.helpdesk_ticket_activity (
    ticket_id, org_id, actor_id, event_type, payload
  ) VALUES (
    p_ticket_id, v_ticket.org_id, auth.uid(), 'ticket_accepted',
    jsonb_build_object('accepted_at', v_now)
  );

  RETURN jsonb_build_object(
    'id',            p_ticket_id,
    'ticket_number', v_ticket.ticket_number,
    'accepted_by',   auth.uid(),
    'accepted_at',   v_now
  );
END;
$$;
