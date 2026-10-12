-- =============================================================================
-- Chat: a group everyone has left is closed
-- =============================================================================
-- Before: when the last member left, the group stayed open with no members and
-- no owner. An invitation still waiting could then be accepted — the invited
-- person walked into an empty group, read its whole history and could invite
-- others, with nobody able to manage it.
-- Now: the last member leaving marks the conversation deleted (the rows stay)
-- and the pending invitations lapse. As a safety net, joining a group that has
-- no owner makes that person its owner.
-- chat_remove_member and chat_invitation_respond keep their signatures.
-- Additive only (CREATE OR REPLACE).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.chat_remove_member(p_conversation_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_org  uuid;
  v_self boolean := (p_user_id = auth.uid());
  r      record;
BEGIN
  SELECT organization_id INTO v_org FROM public.chat_conversations
  WHERE id = p_conversation_id AND kind = 'group' AND deleted_at IS NULL;
  IF v_org IS NULL OR NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;
  IF NOT v_self AND NOT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE conversation_id = p_conversation_id AND user_id = v_uid AND role = 'owner' AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'only the owner can remove members' USING ERRCODE = '42501';
  END IF;

  UPDATE public.chat_members SET left_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id AND left_at IS NULL;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM public._chat_system_message(p_conversation_id, v_org,
    jsonb_build_object('action', CASE WHEN v_self THEN 'left' ELSE 'removed' END,
                       'user_ids', jsonb_build_array(p_user_id)));

  -- The last member left: the group is closed. Its history stays in the database
  -- but nobody can open it, and invitations still waiting lapse — otherwise an
  -- invited person could walk into an empty group and read what others wrote.
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE conversation_id = p_conversation_id AND left_at IS NULL
  ) THEN
    FOR r IN
      UPDATE public.chat_invitations
      SET status = 'declined', responded_at = now(), withdrawn_by = v_uid
      WHERE conversation_id = p_conversation_id AND status = 'pending'
      RETURNING user_id
    LOOP
      PERFORM realtime.send(
        jsonb_build_object('type', 'invitation', 'conversation_id', p_conversation_id),
        'chat', 'user:' || r.user_id::text || ':inbox', true);
    END LOOP;
    UPDATE public.chat_conversations
    SET deleted_at = now(), updated_at = now()
    WHERE id = p_conversation_id;
    RETURN;
  END IF;

  -- The group keeps an owner: the longest-standing member takes over
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE conversation_id = p_conversation_id AND role = 'owner' AND left_at IS NULL
  ) THEN
    UPDATE public.chat_members SET role = 'owner'
    WHERE (conversation_id, user_id) = (
      SELECT conversation_id, user_id FROM public.chat_members
      WHERE conversation_id = p_conversation_id AND left_at IS NULL
      ORDER BY joined_at LIMIT 1
    );
  END IF;
END;
$$;

-- The invited person joins or declines. Joining a group that has no owner (it
-- should not happen: an empty group is closed) makes that person its owner.
CREATE OR REPLACE FUNCTION public.chat_invitation_respond(p_conversation_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org  uuid;
  v_uid  uuid;
  v_role text := 'member';
BEGIN
  SELECT c.organization_id INTO v_org FROM public.chat_conversations c
  WHERE c.id = p_conversation_id AND c.kind = 'group' AND c.deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = '42501';
  END IF;
  v_uid := public._chat_require_user(v_org);

  UPDATE public.chat_invitations
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = v_uid AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = '42501';
  END IF;

  IF p_accept THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE conversation_id = p_conversation_id AND role = 'owner' AND left_at IS NULL
    ) THEN
      v_role := 'owner';
    END IF;
    INSERT INTO public.chat_members (conversation_id, user_id, organization_id, role)
    VALUES (p_conversation_id, v_uid, v_org, v_role)
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET left_at = NULL, joined_at = now(), last_read_at = now(), role = EXCLUDED.role;
  END IF;

  PERFORM public._chat_system_message(p_conversation_id, v_org,
    jsonb_build_object('action', CASE WHEN p_accept THEN 'joined' ELSE 'declined' END,
                       'name', public._chat_user_name(v_uid)));
END;
$$;
