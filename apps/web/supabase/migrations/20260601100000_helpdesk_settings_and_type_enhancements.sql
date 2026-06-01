-- Extend helpdesk_settings with status/priority config JSONB
ALTER TABLE public.helpdesk_settings
  ADD COLUMN IF NOT EXISTS status_configs   JSONB,
  ADD COLUMN IF NOT EXISTS priority_configs JSONB;

-- Add scope, branch, and requires_acceptance to helpdesk_ticket_types
ALTER TABLE public.helpdesk_ticket_types
  ADD COLUMN IF NOT EXISTS scope               TEXT    NOT NULL DEFAULT 'org'
    CHECK (scope IN ('org', 'branch')),
  ADD COLUMN IF NOT EXISTS branch_id           UUID    REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_acceptance BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS helpdesk_ticket_types_branch_idx
  ON public.helpdesk_ticket_types (org_id, branch_id)
  WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

-- Default acceptors per ticket type
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_type_acceptors (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL REFERENCES public.organizations(id)         ON DELETE CASCADE,
  ticket_type_id UUID        NOT NULL REFERENCES public.helpdesk_ticket_types(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES public.users(id)                 ON DELETE CASCADE,
  created_by     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_type_id, user_id)
);

ALTER TABLE public.helpdesk_ticket_type_acceptors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS helpdesk_ticket_type_acceptors_type_idx
  ON public.helpdesk_ticket_type_acceptors (ticket_type_id);

CREATE POLICY "helpdesk_ticket_type_acceptors_select"
  ON public.helpdesk_ticket_type_acceptors FOR SELECT TO authenticated
  USING (is_org_member(org_id) AND has_permission(org_id, 'helpdesk.read'));

CREATE POLICY "helpdesk_ticket_type_acceptors_insert"
  ON public.helpdesk_ticket_type_acceptors FOR INSERT TO authenticated
  WITH CHECK (is_org_member(org_id) AND has_permission(org_id, 'helpdesk.ticket-types.manage'));

CREATE POLICY "helpdesk_ticket_type_acceptors_delete"
  ON public.helpdesk_ticket_type_acceptors FOR DELETE TO authenticated
  USING (is_org_member(org_id) AND has_permission(org_id, 'helpdesk.ticket-types.manage'));
