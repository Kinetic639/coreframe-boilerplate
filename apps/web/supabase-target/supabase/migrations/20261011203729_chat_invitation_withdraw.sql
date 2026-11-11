-- =============================================================================
-- Chat: withdrawing a group invitation
-- =============================================================================
-- The person who invited, or the group's owner, can take back an invitation that
-- has not been answered. It is closed like a declined one (the status check of
-- chat_invitations stays as it is); withdrawn_by tells the two apart. The invited
-- person's list reloads (inbox signal) and the conversation gets a system line.
-- chat_pending_invitations now returns who invited. Additive only.
-- =============================================================================

ALTER TABLE public.chat_invitations
  ADD COLUMN IF NOT EXISTS withdrawn_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- The inviter or the group's owner takes a pending invitation back
CREATE OR REPLACE FUNCTION public.chat_invitation_withdraw(p_conversation_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  SELECT c.organization_id INTO v_org FROM public.chat_conversations c
  WHERE c.id = p_conversation_id AND c.kind = 'group' AND c.deleted_at IS NULL;
  IF v_uid IS NULL OR v_org IS NULL OR NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = '42501';
  END IF;

  -- Closed like a declined one; withdrawn_by tells the two apart
  UPDATE public.chat_invitations i
  SET status = 'declined', responded_at = now(), withdrawn_by = v_uid
  WHERE i.conversation_id = p_conversation_id AND i.user_id = p_user_id AND i.status = 'pending'
    AND (i.invited_by = v_uid OR EXISTS (
          SELECT 1 FROM public.chat_members m
          WHERE m.conversation_id = p_conversation_id AND m.user_id = v_uid
            AND m.left_at IS NULL AND m.role = 'owner'));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = '42501';
  END IF;

  -- The invited person's list of invitations reloads
  PERFORM realtime.send(
    jsonb_build_object('type', 'invitation', 'conversation_id', p_conversation_id),
    'chat', 'user:' || p_user_id::text || ':inbox', true);

  PERFORM public._chat_system_message(p_conversation_id, v_org,
    jsonb_build_object('action', 'withdrawn', 'user_ids', jsonb_build_array(p_user_id),
                       'names', jsonb_build_array(public._chat_user_name(p_user_id))));
END;
$$;

REVOKE ALL ON FUNCTION public.chat_invitation_withdraw(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_invitation_withdraw(uuid, uuid) TO authenticated;

-- Pending invitations now say who invited (to offer "withdraw" to that person)
CREATE OR REPLACE FUNCTION public.chat_pending_invitations(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
    'email', u.email, 'avatar_url', u.avatar_url, 'created_at', i.created_at,
    'invited_by', i.invited_by
  ) ORDER BY i.created_at), '[]'::jsonb)
  FROM public.chat_invitations i
  JOIN public.users u ON u.id = i.user_id
  WHERE i.conversation_id = p_conversation_id AND i.status = 'pending'
    AND public.is_chat_member(p_conversation_id);
$$;
