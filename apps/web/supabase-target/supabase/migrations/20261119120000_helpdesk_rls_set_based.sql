-- =============================================================================
-- Helpdesk: the same read rules, checked once per query instead of per row.
--
-- Same approach as 20261119080000_planning_rls_set_based.sql. The helpdesk
-- read policies called is_org_member, has_permission, has_branch_permission
-- and helpdesk_ticket_branch_permission for every row. Those are SECURITY
-- DEFINER functions, so Postgres cannot inline them and each row paid for
-- several lookups. Each rule now becomes a set computed once per query
-- (`x = ANY (ARRAY(SELECT f()))` runs as an InitPlan) and compared per row,
-- reusing the planning_my_* helpers:
--   * is_org_member(org)                 -> org = ANY (planning_my_org_ids())
--   * has_permission(org, p)             -> org = ANY (planning_my_permission_org_ids(p))
--   * has_branch_permission(org, br, p)  -> org-wide grant OR "<org>:<branch>" grant
--   * helpdesk_ticket_branch_permission(ticket, 'helpdesk.tickets.read')
--       its body is "the ticket exists, I am a member and hold the read
--       permission for its branch", which is exactly the helpdesk_tickets
--       read policy, so it becomes EXISTS on helpdesk_tickets under that RLS.
--   * auth.uid() -> (SELECT auth.uid()), evaluated once.
-- Who sees what does not change. Write rules (INSERT/UPDATE/DELETE) are not
-- touched.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------

-- was: is_org_member(org_id) AND has_branch_permission(org_id, branch_id, 'helpdesk.tickets.read')
ALTER POLICY helpdesk_tickets_select ON public.helpdesk_tickets
  USING (
    org_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND (
      org_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('helpdesk.tickets.read')))
      OR (
        branch_id IS NOT NULL
        AND (org_id::text || ':' || branch_id::text)
          = ANY (ARRAY(SELECT public.planning_my_permission_branch_keys('helpdesk.tickets.read')))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Ticket child tables
-- ---------------------------------------------------------------------------

-- was: is_org_member(org_id) AND helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.read')
ALTER POLICY helpdesk_ticket_assignees_select ON public.helpdesk_ticket_assignees
  USING (
    org_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = helpdesk_ticket_assignees.ticket_id
    )
  );

-- was: is_org_member(org_id) AND helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.read')
ALTER POLICY helpdesk_ticket_acceptors_select ON public.helpdesk_ticket_acceptors
  USING (
    org_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = helpdesk_ticket_acceptors.ticket_id
    )
  );

-- was: helpdesk_ticket_branch_permission(ticket_id, 'helpdesk.tickets.read')
ALTER POLICY helpdesk_ticket_references_select ON public.helpdesk_ticket_references
  USING (
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = helpdesk_ticket_references.ticket_id
    )
  );

-- was: is_org_member(org_id) AND EXISTS (ticket t WHERE has_branch_permission(t.org_id,
--   t.branch_id, 'helpdesk.tickets.read') AND (t.created_by = auth.uid()
--   OR has_branch_permission(t.org_id, t.branch_id, 'helpdesk.tickets.manage')
--   OR I am an active assignee))
-- The read check on the ticket is the helpdesk_tickets read policy, which the
-- EXISTS now goes through.
ALTER POLICY helpdesk_ticket_activity_select ON public.helpdesk_ticket_activity
  USING (
    org_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = helpdesk_ticket_activity.ticket_id
        AND (
          t.created_by = (SELECT auth.uid())
          OR t.org_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('helpdesk.tickets.manage')))
          OR (
            t.branch_id IS NOT NULL
            AND (t.org_id::text || ':' || t.branch_id::text)
              = ANY (ARRAY(SELECT public.planning_my_permission_branch_keys('helpdesk.tickets.manage')))
          )
          OR EXISTS (
            SELECT 1 FROM public.helpdesk_ticket_assignees a
            WHERE a.ticket_id = t.id
              AND a.user_id = (SELECT auth.uid())
              AND a.deleted_at IS NULL
          )
        )
    )
  );

-- was: is_org_member(org_id) AND has_permission(org_id, 'helpdesk.tickets.read')
--   AND ((NOT is_internal) OR has_permission(org_id, 'helpdesk.tickets.manage'))
--   AND EXISTS (ticket t WHERE t.id = ticket_id AND (t.created_by = auth.uid()
--     OR has_permission(t.org_id, 'helpdesk.tickets.manage') OR I am an active assignee))
-- The EXISTS on helpdesk_tickets ran under its read policy before too.
ALTER POLICY helpdesk_ticket_comments_select ON public.helpdesk_ticket_comments
  USING (
    org_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND org_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('helpdesk.tickets.read')))
    AND (
      NOT is_internal
      OR org_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('helpdesk.tickets.manage')))
    )
    AND EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = helpdesk_ticket_comments.ticket_id
        AND (
          t.created_by = (SELECT auth.uid())
          OR t.org_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('helpdesk.tickets.manage')))
          OR EXISTS (
            SELECT 1 FROM public.helpdesk_ticket_assignees a
            WHERE a.ticket_id = t.id
              AND a.user_id = (SELECT auth.uid())
              AND a.deleted_at IS NULL
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Settings and ticket types
-- ---------------------------------------------------------------------------

-- was: is_org_member(org_id) AND has_permission(org_id, 'helpdesk.read')
ALTER POLICY helpdesk_settings_select ON public.helpdesk_settings
  USING (
    org_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND org_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('helpdesk.read')))
  );

ALTER POLICY helpdesk_ticket_types_select ON public.helpdesk_ticket_types
  USING (
    org_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND org_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('helpdesk.read')))
  );

ALTER POLICY helpdesk_ticket_type_acceptors_select ON public.helpdesk_ticket_type_acceptors
  USING (
    org_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND org_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('helpdesk.read')))
  );

ALTER POLICY helpdesk_type_default_responders_select ON public.helpdesk_ticket_type_default_responders
  USING (
    org_id = ANY (ARRAY(SELECT public.planning_my_org_ids()))
    AND org_id = ANY (ARRAY(SELECT public.planning_my_permission_org_ids('helpdesk.read')))
  );
