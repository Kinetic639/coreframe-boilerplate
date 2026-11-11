-- =============================================================================
-- Chat: group invitations — nobody is put into a group without their consent
-- =============================================================================
-- Creating a group makes only its creator a member; everyone else (and everyone
-- "added" later) gets a pending invitation and decides: join or decline. Until
-- they accept they see neither the conversation nor its messages.
--   chat_invitations                 one row per conversation and person
--   chat_create_group / chat_add_members   now invite (same signatures)
--   chat_invitation_respond(conv, accept)  the invited person joins or declines
--   chat_list_invitations(org)             my pending invitations
--   chat_pending_invitations(conv)         who was invited (for the members)
-- Invitations reach the invited person's inbox channel as "invitation"; the
-- conversation gets system lines: invited, joined, declined.
-- Existing members of existing groups are not affected. Additive only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_invitations (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_invitations_user_pending_idx
  ON public.chat_invitations (user_id, organization_id)
  WHERE status = 'pending';

ALTER TABLE public.chat_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_invitations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_invitations FROM anon, authenticated;
GRANT SELECT ON public.chat_invitations TO authenticated;

CREATE POLICY chat_invitations_select_own_or_member
  ON public.chat_invitations FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_chat_member(conversation_id));

CREATE OR REPLACE FUNCTION public._chat_user_name(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''),
                  u.email, '')
  FROM public.users u WHERE u.id = p_user;
$$;

-- Invites people to a group: a pending invitation each, a signal to their inbox
-- channel and one system line in the conversation. Nobody becomes a member here.
CREATE OR REPLACE FUNCTION public._chat_invite(p_conversation_id uuid, p_org uuid, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ids uuid[];
  u     uuid;
BEGIN
  -- Not for members, and not twice for someone already invited
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_ids
  FROM unnest(coalesce(p_user_ids, '{}')) AS x
  WHERE x IS DISTINCT FROM auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = p_conversation_id AND m.user_id = x AND m.left_at IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM public.chat_invitations i
      WHERE i.conversation_id = p_conversation_id AND i.user_id = x AND i.status = 'pending');
  IF cardinality(v_ids) = 0 THEN
    RETURN;
  END IF;
  IF NOT public._chat_users_in_org(p_org, v_ids) THEN
    RAISE EXCEPTION 'invalid members' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.chat_invitations (conversation_id, user_id, organization_id, invited_by)
  SELECT p_conversation_id, x, p_org, auth.uid() FROM unnest(v_ids) AS x
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET status = 'pending', invited_by = EXCLUDED.invited_by,
                created_at = now(), responded_at = NULL;

  FOREACH u IN ARRAY v_ids LOOP
    PERFORM realtime.send(
      jsonb_build_object('type', 'invitation', 'conversation_id', p_conversation_id),
      'chat', 'user:' || u::text || ':inbox', true);
  END LOOP;

  PERFORM public._chat_system_message(p_conversation_id, p_org,
    jsonb_build_object('action', 'invited', 'user_ids', to_jsonb(v_ids),
      'names', (SELECT jsonb_agg(public._chat_user_name(x)) FROM unnest(v_ids) AS x)));
END;
$$;

REVOKE ALL ON FUNCTION public._chat_user_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._chat_invite(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- Group conversation: the caller is its owner and only member; the others are invited
CREATE OR REPLACE FUNCTION public.chat_create_group(p_org uuid, p_name text, p_user_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid  uuid := public._chat_require_user(p_org);
  v_name text := btrim(coalesce(p_name, ''));
  v_ids  uuid[];
  v_id   uuid;
BEGIN
  SELECT coalesce(array_agg(DISTINCT u), '{}') INTO v_ids
  FROM unnest(coalesce(p_user_ids, '{}')) AS u WHERE u IS DISTINCT FROM v_uid;

  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'invalid group name' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_ids) NOT BETWEEN 1 AND 99 OR NOT public._chat_users_in_org(p_org, v_ids) THEN
    RAISE EXCEPTION 'invalid members' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.chat_conversations (organization_id, kind, name, created_by)
  VALUES (p_org, 'group', v_name, v_uid)
  RETURNING id INTO v_id;

  INSERT INTO public.chat_members (conversation_id, user_id, organization_id, role)
  VALUES (v_id, v_uid, p_org, 'owner');

  PERFORM public._chat_system_message(v_id, p_org,
    jsonb_build_object('action', 'created', 'name', v_name, 'user_ids', '[]'::jsonb));
  PERFORM public._chat_invite(v_id, p_org, v_ids);

  RETURN v_id;
END;
$$;

-- "Add members" invites: each person decides whether to join
CREATE OR REPLACE FUNCTION public.chat_add_members(p_conversation_id uuid, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.chat_conversations
  WHERE id = p_conversation_id AND kind = 'group' AND deleted_at IS NULL;
  IF v_org IS NULL OR NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;
  PERFORM public._chat_invite(p_conversation_id, v_org, p_user_ids);
END;
$$;

-- The invited person joins or declines
CREATE OR REPLACE FUNCTION public.chat_invitation_respond(p_conversation_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org uuid;
  v_uid uuid;
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
    INSERT INTO public.chat_members (conversation_id, user_id, organization_id, role)
    VALUES (p_conversation_id, v_uid, v_org, 'member')
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET left_at = NULL, joined_at = now(), last_read_at = now(), role = 'member';
  END IF;

  PERFORM public._chat_system_message(p_conversation_id, v_org,
    jsonb_build_object('action', CASE WHEN p_accept THEN 'joined' ELSE 'declined' END,
                       'name', public._chat_user_name(v_uid)));
END;
$$;

-- My pending invitations in an organization
CREATE OR REPLACE FUNCTION public.chat_list_invitations(p_org uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'conversation_id', c.id, 'name', c.name, 'created_at', i.created_at,
    'member_count', (SELECT count(*) FROM public.chat_members m
                     WHERE m.conversation_id = c.id AND m.left_at IS NULL),
    'invited_by', (SELECT jsonb_build_object('user_id', u.id, 'first_name', u.first_name,
                                             'last_name', u.last_name, 'email', u.email,
                                             'avatar_url', u.avatar_url)
                   FROM public.users u WHERE u.id = i.invited_by)
  ) ORDER BY i.created_at DESC), '[]'::jsonb)
  FROM public.chat_invitations i
  JOIN public.chat_conversations c ON c.id = i.conversation_id AND c.deleted_at IS NULL
  WHERE i.user_id = auth.uid() AND i.organization_id = p_org AND i.status = 'pending'
    AND public.is_org_member(p_org);
$$;

-- People invited to a conversation who have not answered yet (visible to its members)
CREATE OR REPLACE FUNCTION public.chat_pending_invitations(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
    'email', u.email, 'avatar_url', u.avatar_url, 'created_at', i.created_at
  ) ORDER BY i.created_at), '[]'::jsonb)
  FROM public.chat_invitations i
  JOIN public.users u ON u.id = i.user_id
  WHERE i.conversation_id = p_conversation_id AND i.status = 'pending'
    AND public.is_chat_member(p_conversation_id);
$$;

REVOKE ALL ON FUNCTION public.chat_invitation_respond(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_list_invitations(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_pending_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_invitation_respond(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_list_invitations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_pending_invitations(uuid) TO authenticated;
