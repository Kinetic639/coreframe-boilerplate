-- =============================================================================
-- Messages: only colleagues who can open the messenger are offered and accepted
-- =============================================================================
-- The messenger lives in the ERP. A portal-only account (for example an
-- advisor with access to Zgłoszenia only) has no ERP and no `messages.use`, so
-- it must not appear in "New message" or in the contacts' "Message" button,
-- and the chat RPCs must refuse to start or invite it.
--
-- A colleague can be messaged in an organization when they are an active
-- member holding, org-wide, both `messages.use` and `app.erp.access`.
--
--   _chat_user_can_message(org, user)   the rule above
--   _chat_users_in_org(org, users)      now also requires it (used by
--                                       chat_open_direct, chat_create_group
--                                       and _chat_invite)
--   chat_list_people(org)               ids of colleagues I can message
-- =============================================================================

CREATE OR REPLACE FUNCTION public._chat_user_can_message(p_org uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.user_effective_permissions p
           WHERE p.user_id = p_user
             AND p.organization_id = p_org
             AND p.branch_id IS NULL
             AND p.permission_slug_exact = 'messages.use'
         )
     AND EXISTS (
           SELECT 1 FROM public.user_effective_permissions p
           WHERE p.user_id = p_user
             AND p.organization_id = p_org
             AND p.branch_id IS NULL
             AND p.permission_slug_exact = 'app.erp.access'
         );
$$;

-- All given users are active members of the organization who can use the
-- messenger (and none is the caller)
CREATE OR REPLACE FUNCTION public._chat_users_in_org(p_org uuid, p_user_ids uuid[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(cardinality(p_user_ids), 0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM unnest(p_user_ids) AS u(id)
       WHERE u.id IS NULL
          OR u.id = auth.uid()
          OR NOT EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p_org
              AND om.user_id = u.id
              AND om.status = 'active'
              AND om.deleted_at IS NULL
          )
          OR NOT public._chat_user_can_message(p_org, u.id)
     );
$$;

-- Colleagues (the caller excluded) the caller can start a conversation with
CREATE OR REPLACE FUNCTION public.chat_list_people(p_org uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := public._chat_require_user(p_org);
BEGIN
  RETURN QUERY
  SELECT om.user_id
  FROM public.organization_members om
  WHERE om.organization_id = p_org
    AND om.status = 'active'
    AND om.deleted_at IS NULL
    AND om.user_id <> v_uid
    AND public._chat_user_can_message(p_org, om.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public._chat_user_can_message(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._chat_users_in_org(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_list_people(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_list_people(uuid) TO authenticated;
