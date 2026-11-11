-- =============================================================================
-- Messages (chat) M0 — foundation. Plan: docs/MESSAGES_PLAN.md
--
-- Direct (1:1) and group conversations between members of one organization.
-- Reads go through RLS (members only); every write goes through a SECURITY
-- DEFINER RPC that checks membership, organization and `messages.use`.
-- Realtime: one private broadcast channel per user ("user:<uid>:inbox") fed by
-- triggers, typing on "chat:<conversation>:typing", presence on
-- "org:<org>:presence". Attachments reuse app_attachments with the target type
-- "chat.conversation".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Permission: every member may use messages (org_member + org_owner)
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES ('messages.use', 'Messages Use', 'messages', 'use')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.is_basic = true
  AND r.name IN ('org_member', 'org_owner')
  AND r.deleted_at IS NULL
  AND p.slug = 'messages.use'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.chat_conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('direct', 'group')),
  name             text CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 80),
  direct_key       text,
  created_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  last_message_at  timestamptz,
  last_message_id  uuid,
  deleted_at       timestamptz,
  CHECK ((kind = 'direct') = (direct_key IS NOT NULL)),
  CHECK (kind = 'group' OR name IS NULL)
);

CREATE UNIQUE INDEX chat_conversations_direct_key_unique
  ON public.chat_conversations (organization_id, direct_key)
  WHERE direct_key IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.chat_members (
  conversation_id      uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role                 text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at            timestamptz NOT NULL DEFAULT now(),
  left_at              timestamptz,
  last_read_at         timestamptz NOT NULL DEFAULT now(),
  last_read_message_id uuid,
  muted_until          timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX chat_members_user_active_idx
  ON public.chat_members (user_id, organization_id)
  WHERE left_at IS NULL;

CREATE TABLE public.chat_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  kind             text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'system')),
  body_plain       text NOT NULL DEFAULT '' CHECK (char_length(body_plain) <= 8000),
  body_rich        jsonb,
  mentions         jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachment_ids   uuid[] NOT NULL DEFAULT '{}',
  system_event     jsonb,
  client_id        uuid,
  created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  edited_at        timestamptz,
  deleted_at       timestamptz,
  CHECK (kind = 'system' OR author_id IS NOT NULL OR deleted_at IS NOT NULL)
);

CREATE INDEX chat_messages_conversation_created_idx
  ON public.chat_messages (conversation_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX chat_messages_author_client_unique
  ON public.chat_messages (author_id, client_id)
  WHERE client_id IS NOT NULL;

ALTER TABLE public.chat_conversations
  ADD CONSTRAINT chat_conversations_last_message_fkey
  FOREIGN KEY (last_message_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Membership check (used by every policy; SECURITY DEFINER avoids policy
--    recursion on chat_members)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_chat_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members m
    JOIN public.chat_conversations c ON c.id = m.conversation_id
    WHERE m.conversation_id = p_conversation_id
      AND m.user_id = auth.uid()
      AND m.left_at IS NULL
      AND c.deleted_at IS NULL
      AND public.is_org_member(c.organization_id)
      AND public.has_permission(c.organization_id, 'messages.use')
  );
$$;

REVOKE ALL ON FUNCTION public.is_chat_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS: members read; nobody writes directly (RPCs only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.chat_conversations FROM anon, authenticated;
REVOKE ALL ON public.chat_members FROM anon, authenticated;
REVOKE ALL ON public.chat_messages FROM anon, authenticated;
GRANT SELECT ON public.chat_conversations TO authenticated;
GRANT SELECT ON public.chat_members TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;

CREATE POLICY chat_conversations_select_member
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (public.is_chat_member(id));

CREATE POLICY chat_members_select_member
  ON public.chat_members FOR SELECT TO authenticated
  USING (public.is_chat_member(conversation_id));

CREATE POLICY chat_messages_select_member
  ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_chat_member(conversation_id));

-- ---------------------------------------------------------------------------
-- 5. Internal helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._chat_require_user(p_org uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_org IS NULL OR NOT public.is_org_member(p_org) OR NOT public.has_permission(p_org, 'messages.use') THEN
    RAISE EXCEPTION 'messages not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$$;

-- All given users are active members of the organization (and none is the caller)
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
     );
$$;

CREATE OR REPLACE FUNCTION public._chat_system_message(
  p_conversation_id uuid, p_org uuid, p_event jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id uuid;
  v_at timestamptz;
BEGIN
  INSERT INTO public.chat_messages (conversation_id, organization_id, author_id, kind, system_event)
  VALUES (p_conversation_id, p_org, auth.uid(), 'system', p_event)
  RETURNING id, created_at INTO v_id, v_at;

  UPDATE public.chat_conversations
  SET last_message_at = v_at, last_message_id = v_id, updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public._chat_require_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._chat_users_in_org(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._chat_system_message(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPCs
-- ---------------------------------------------------------------------------

-- 1:1 conversation with a colleague; returns the existing one when there is one
CREATE OR REPLACE FUNCTION public.chat_open_direct(p_org uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := public._chat_require_user(p_org);
  v_key text;
  v_id  uuid;
BEGIN
  IF NOT public._chat_users_in_org(p_org, ARRAY[p_user_id]) THEN
    RAISE EXCEPTION 'user not in organization' USING ERRCODE = '22023';
  END IF;

  v_key := least(v_uid::text, p_user_id::text) || ':' || greatest(v_uid::text, p_user_id::text);

  INSERT INTO public.chat_conversations (organization_id, kind, direct_key, created_by)
  VALUES (p_org, 'direct', v_key, v_uid)
  ON CONFLICT (organization_id, direct_key) WHERE direct_key IS NOT NULL AND deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.chat_conversations
    WHERE organization_id = p_org AND direct_key = v_key AND deleted_at IS NULL;
  END IF;

  INSERT INTO public.chat_members (conversation_id, user_id, organization_id, role)
  VALUES (v_id, v_uid, p_org, 'member'), (v_id, p_user_id, p_org, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

-- Group conversation: the caller is its owner
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
  INSERT INTO public.chat_members (conversation_id, user_id, organization_id, role)
  SELECT v_id, u, p_org, 'member' FROM unnest(v_ids) AS u;

  PERFORM public._chat_system_message(v_id, p_org,
    jsonb_build_object('action', 'created', 'name', v_name, 'user_ids', to_jsonb(v_ids)));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_send(
  p_conversation_id uuid,
  p_body_plain      text,
  p_body_rich       jsonb DEFAULT NULL,
  p_client_id       uuid DEFAULT NULL,
  p_attachment_ids  uuid[] DEFAULT '{}',
  p_mentions        jsonb DEFAULT '[]'::jsonb
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_org  uuid;
  v_body text := btrim(coalesce(p_body_plain, ''));
  v_att  uuid[] := coalesce(p_attachment_ids, '{}');
  v_msg  public.chat_messages;
BEGIN
  SELECT c.organization_id INTO v_org
  FROM public.chat_conversations c
  WHERE c.id = p_conversation_id AND c.deleted_at IS NULL;

  IF v_uid IS NULL OR v_org IS NULL OR NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;

  -- Retried send (same client id): return the message already stored
  IF p_client_id IS NOT NULL THEN
    SELECT * INTO v_msg FROM public.chat_messages
    WHERE author_id = v_uid AND client_id = p_client_id;
    IF FOUND THEN
      RETURN v_msg;
    END IF;
  END IF;

  IF char_length(v_body) > 8000 OR pg_column_size(p_body_rich) > 65536 THEN
    RAISE EXCEPTION 'message too long' USING ERRCODE = '22001';
  END IF;
  IF v_body = '' AND cardinality(v_att) = 0 THEN
    RAISE EXCEPTION 'empty message' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_att) > 10
     OR jsonb_typeof(coalesce(p_mentions, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_mentions, '[]'::jsonb)) > 50 THEN
    RAISE EXCEPTION 'invalid message' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_att) AS a(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.app_attachments t
      WHERE t.id = a.id
        AND t.org_id = v_org
        AND t.target_type = 'chat.conversation'
        AND t.target_id = p_conversation_id
        AND t.created_by = v_uid
        AND t.deleted_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'invalid attachment' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id, organization_id, author_id, kind,
    body_plain, body_rich, mentions, attachment_ids, client_id
  )
  VALUES (
    p_conversation_id, v_org, v_uid, 'text',
    v_body, p_body_rich, coalesce(p_mentions, '[]'::jsonb), v_att, p_client_id
  )
  RETURNING * INTO v_msg;

  UPDATE public.chat_conversations
  SET last_message_at = v_msg.created_at, last_message_id = v_msg.id, updated_at = now()
  WHERE id = p_conversation_id;

  UPDATE public.chat_members
  SET last_read_at = greatest(last_read_at, v_msg.created_at), last_read_message_id = v_msg.id
  WHERE conversation_id = p_conversation_id AND user_id = v_uid;

  RETURN v_msg;
END;
$$;

-- Marks the conversation read up to now (or up to p_until)
CREATE OR REPLACE FUNCTION public.chat_mark_read(p_conversation_id uuid, p_until timestamptz DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_until timestamptz := least(coalesce(p_until, now()), now());
  v_last  uuid;
  v_at    timestamptz;
BEGIN
  IF NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_last FROM public.chat_messages
  WHERE conversation_id = p_conversation_id AND created_at <= v_until
  ORDER BY created_at DESC, id DESC LIMIT 1;

  UPDATE public.chat_members
  SET last_read_at = v_until, last_read_message_id = coalesce(v_last, last_read_message_id)
  WHERE conversation_id = p_conversation_id AND user_id = auth.uid() AND last_read_at < v_until
  RETURNING last_read_at INTO v_at;

  RETURN coalesce(v_at, v_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_add_members(p_conversation_id uuid, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org uuid;
  v_ids uuid[];
BEGIN
  SELECT organization_id INTO v_org FROM public.chat_conversations
  WHERE id = p_conversation_id AND kind = 'group' AND deleted_at IS NULL;
  IF v_org IS NULL OR NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(DISTINCT u), '{}') INTO v_ids
  FROM unnest(coalesce(p_user_ids, '{}')) AS u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chat_members m
    WHERE m.conversation_id = p_conversation_id AND m.user_id = u AND m.left_at IS NULL
  );
  IF cardinality(v_ids) = 0 THEN
    RETURN;
  END IF;
  IF NOT public._chat_users_in_org(v_org, v_ids) THEN
    RAISE EXCEPTION 'invalid members' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.chat_members (conversation_id, user_id, organization_id, role)
  SELECT p_conversation_id, u, v_org, 'member' FROM unnest(v_ids) AS u
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET left_at = NULL, joined_at = now(), last_read_at = now(), role = 'member';

  PERFORM public._chat_system_message(p_conversation_id, v_org,
    jsonb_build_object('action', 'added', 'user_ids', to_jsonb(v_ids)));
END;
$$;

-- Owner removes someone; anyone may remove themselves (= leave)
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

  PERFORM public._chat_system_message(p_conversation_id, v_org,
    jsonb_build_object('action', CASE WHEN v_self THEN 'left' ELSE 'removed' END,
                       'user_ids', jsonb_build_array(p_user_id)));
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_rename(p_conversation_id uuid, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org  uuid;
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  SELECT organization_id INTO v_org FROM public.chat_conversations
  WHERE id = p_conversation_id AND kind = 'group' AND deleted_at IS NULL;
  IF v_org IS NULL OR NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'invalid group name' USING ERRCODE = '22023';
  END IF;

  UPDATE public.chat_conversations SET name = v_name, updated_at = now() WHERE id = p_conversation_id;
  PERFORM public._chat_system_message(p_conversation_id, v_org,
    jsonb_build_object('action', 'renamed', 'name', v_name));
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_set_muted(p_conversation_id uuid, p_until timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;
  UPDATE public.chat_members SET muted_until = p_until
  WHERE conversation_id = p_conversation_id AND user_id = auth.uid();
END;
$$;

-- Conversation list for the bar / page: last message, unread count and the
-- first members (names for 1:1 and avatars) in one query
CREATE OR REPLACE FUNCTION public.chat_list_conversations(
  p_org uuid, p_limit integer DEFAULT 50, p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid, kind text, name text, created_at timestamptz, activity_at timestamptz,
  unread_count integer, muted boolean, member_count integer, members jsonb, last_message jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    c.id, c.kind, c.name, c.created_at,
    coalesce(c.last_message_at, c.created_at) AS activity_at,
    (SELECT count(*)::int FROM (
       SELECT 1 FROM public.chat_messages m
       WHERE m.conversation_id = c.id AND m.created_at > me.last_read_at
         AND m.deleted_at IS NULL AND m.kind = 'text' AND m.author_id IS DISTINCT FROM auth.uid()
       LIMIT 99) x) AS unread_count,
    (me.muted_until IS NOT NULL AND me.muted_until > now()) AS muted,
    (SELECT count(*)::int FROM public.chat_members o
     WHERE o.conversation_id = c.id AND o.left_at IS NULL) AS member_count,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
              'email', u.email, 'avatar_url', u.avatar_url, 'role', o.role,
              'last_read_at', o.last_read_at) ORDER BY o.joined_at), '[]'::jsonb)
     FROM (SELECT * FROM public.chat_members o2
           WHERE o2.conversation_id = c.id AND o2.left_at IS NULL
           ORDER BY o2.joined_at LIMIT 6) o
     JOIN public.users u ON u.id = o.user_id) AS members,
    (SELECT jsonb_build_object(
              'id', m.id, 'author_id', m.author_id, 'kind', m.kind,
              'body_plain', left(m.body_plain, 200), 'system_event', m.system_event,
              'attachment_count', cardinality(m.attachment_ids), 'created_at', m.created_at,
              'deleted', m.deleted_at IS NOT NULL)
     FROM public.chat_messages m WHERE m.id = c.last_message_id) AS last_message
  FROM public.chat_members me
  JOIN public.chat_conversations c ON c.id = me.conversation_id
  WHERE me.user_id = auth.uid()
    AND me.left_at IS NULL
    AND c.organization_id = p_org
    AND c.deleted_at IS NULL
    AND public.is_org_member(p_org)
    AND public.has_permission(p_org, 'messages.use')
    -- An empty 1:1 shows only to whoever opened it
    AND (c.kind = 'group' OR c.last_message_id IS NOT NULL OR c.created_by = auth.uid())
    AND (p_before IS NULL OR coalesce(c.last_message_at, c.created_at) < p_before)
  ORDER BY coalesce(c.last_message_at, c.created_at) DESC, c.id
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- One conversation with all members (also former ones, for author names)
CREATE OR REPLACE FUNCTION public.chat_get_conversation(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jsonb_build_object(
    'id', c.id, 'organization_id', c.organization_id, 'kind', c.kind, 'name', c.name,
    'created_by', c.created_by, 'created_at', c.created_at,
    'members', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
               'email', u.email, 'avatar_url', u.avatar_url, 'role', m.role,
               'joined_at', m.joined_at, 'left_at', m.left_at,
               'last_read_at', m.last_read_at, 'muted_until', m.muted_until)
             ORDER BY m.joined_at), '[]'::jsonb)
      FROM public.chat_members m JOIN public.users u ON u.id = m.user_id
      WHERE m.conversation_id = c.id)
  )
  FROM public.chat_conversations c
  WHERE c.id = p_conversation_id AND c.deleted_at IS NULL AND public.is_chat_member(c.id);
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.chat_open_direct(uuid, uuid)',
    'public.chat_create_group(uuid, text, uuid[])',
    'public.chat_send(uuid, text, jsonb, uuid, uuid[], jsonb)',
    'public.chat_mark_read(uuid, timestamptz)',
    'public.chat_add_members(uuid, uuid[])',
    'public.chat_remove_member(uuid, uuid)',
    'public.chat_rename(uuid, text)',
    'public.chat_set_muted(uuid, timestamptz)',
    'public.chat_list_conversations(uuid, integer, timestamptz)',
    'public.chat_get_conversation(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Realtime: inbox fan-out from the database
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._chat_broadcast_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record;
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'type', 'message',
    'conversation_id', NEW.conversation_id,
    'message', to_jsonb(NEW) - 'organization_id'
  );
  FOR r IN
    SELECT user_id FROM public.chat_members
    WHERE conversation_id = NEW.conversation_id AND left_at IS NULL
  LOOP
    PERFORM realtime.send(v_payload, 'chat', 'user:' || r.user_id::text || ':inbox', true);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER chat_messages_broadcast
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public._chat_broadcast_message();

-- Read receipts to the other members; membership changes to the member concerned
CREATE OR REPLACE FUNCTION public._chat_broadcast_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.last_read_at IS DISTINCT FROM OLD.last_read_at AND NEW.left_at IS NULL THEN
    FOR r IN
      SELECT user_id FROM public.chat_members
      WHERE conversation_id = NEW.conversation_id AND left_at IS NULL AND user_id <> NEW.user_id
    LOOP
      PERFORM realtime.send(
        jsonb_build_object('type', 'read', 'conversation_id', NEW.conversation_id,
                           'user_id', NEW.user_id, 'last_read_at', NEW.last_read_at),
        'chat', 'user:' || r.user_id::text || ':inbox', true);
    END LOOP;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.left_at IS DISTINCT FROM OLD.left_at) THEN
    PERFORM realtime.send(
      jsonb_build_object('type', 'membership', 'conversation_id', NEW.conversation_id,
                         'active', NEW.left_at IS NULL),
      'chat', 'user:' || NEW.user_id::text || ':inbox', true);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER chat_members_broadcast
  AFTER INSERT OR UPDATE ON public.chat_members
  FOR EACH ROW EXECUTE FUNCTION public._chat_broadcast_member();

REVOKE ALL ON FUNCTION public._chat_broadcast_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._chat_broadcast_member() FROM PUBLIC, anon, authenticated;

-- Channel authorization: own inbox (receive only), typing in own conversations,
-- presence within own organization
CREATE OR REPLACE FUNCTION public.can_use_chat_topic(p_topic text, p_send boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uuid text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  v_org  uuid;
BEGIN
  IF auth.uid() IS NULL OR p_topic IS NULL THEN
    RETURN false;
  END IF;

  IF p_topic = 'user:' || auth.uid()::text || ':inbox' THEN
    RETURN NOT p_send;
  END IF;

  IF p_topic ~ ('^chat:' || v_uuid || ':typing$') THEN
    RETURN public.is_chat_member(split_part(p_topic, ':', 2)::uuid);
  END IF;

  IF p_topic ~ ('^org:' || v_uuid || ':presence$') THEN
    v_org := split_part(p_topic, ':', 2)::uuid;
    RETURN public.is_org_member(v_org) AND public.has_permission(v_org, 'messages.use');
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_use_chat_topic(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_chat_topic(text, boolean) TO authenticated;

CREATE POLICY "chat channels: receive"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.can_use_chat_topic((SELECT realtime.topic()), false)
  );

CREATE POLICY "chat channels: send"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.can_use_chat_topic((SELECT realtime.topic()), true)
  );

-- ---------------------------------------------------------------------------
-- 8. Attachments in conversations: comment-target access gains "chat.conversation"
--    (members may read and add; nobody moderates other people's files)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_comment_target(p_org_id uuid, p_target_type text, p_target_id uuid, p_action text, p_visibility text DEFAULT 'default'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_manager boolean := false;
  v_can_access boolean := false;
  v_branch_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL OR p_target_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_org_member(p_org_id) THEN
    RETURN false;
  END IF;

  IF p_target_type = 'helpdesk.ticket' THEN
    SELECT t.branch_id INTO v_branch_id
    FROM public.helpdesk_tickets t
    WHERE t.id = p_target_id AND t.org_id = p_org_id AND t.deleted_at IS NULL;

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    v_is_manager := public.has_branch_permission(p_org_id, v_branch_id, 'helpdesk.tickets.manage');

    SELECT EXISTS (
      SELECT 1
      FROM public.helpdesk_tickets t
      WHERE t.id = p_target_id
        AND t.org_id = p_org_id
        AND t.deleted_at IS NULL
        AND public.has_branch_permission(t.org_id, t.branch_id, 'helpdesk.tickets.read')
        AND (
          t.created_by = auth.uid()
          OR v_is_manager
          OR EXISTS (
            SELECT 1
            FROM public.helpdesk_ticket_assignees a
            WHERE a.ticket_id = t.id
              AND a.user_id = auth.uid()
              AND a.deleted_at IS NULL
          )
        )
    )
    INTO v_can_access;

    IF NOT v_can_access THEN
      RETURN false;
    END IF;

    IF p_visibility = 'internal' AND NOT v_is_manager THEN
      RETURN false;
    END IF;

    IF p_action = 'moderate' THEN
      RETURN v_is_manager;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  IF p_target_type = 'planning.task' THEN
    v_is_manager := public.has_permission(p_org_id, 'planning.tasks.update');

    SELECT EXISTS (
      SELECT 1
      FROM public.planning_tasks t
      WHERE t.id = p_target_id
        AND t.organization_id = p_org_id
        AND t.deleted_at IS NULL
        AND public.has_permission(t.organization_id, 'planning.tasks.read')
    )
    INTO v_can_access;

    IF NOT v_can_access THEN
      RETURN false;
    END IF;

    IF p_visibility = 'internal' AND NOT v_is_manager THEN
      RETURN false;
    END IF;

    IF p_action = 'moderate' THEN
      RETURN v_is_manager;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  IF p_target_type = 'planning.kanban_card' THEN
    v_is_manager := public.has_permission(p_org_id, 'planning.boards.update');

    SELECT EXISTS (
      SELECT 1
      FROM public.planning_kanban_cards c
      JOIN public.planning_kanban_boards b ON b.id = c.board_id
      WHERE c.id = p_target_id
        AND c.organization_id = p_org_id
        AND b.organization_id = p_org_id
        AND c.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND public.has_permission(c.organization_id, 'planning.boards.read')
    )
    INTO v_can_access;

    IF NOT v_can_access THEN
      RETURN false;
    END IF;

    IF p_visibility = 'internal' AND NOT v_is_manager THEN
      RETURN false;
    END IF;

    IF p_action = 'moderate' THEN
      RETURN v_is_manager;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  IF p_target_type = 'workshop.repair_order' THEN
    SELECT r.branch_id INTO v_branch_id
    FROM public.repair_orders r
    WHERE r.id = p_target_id AND r.organization_id = p_org_id AND r.deleted_at IS NULL;

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    IF NOT public.has_branch_permission(p_org_id, v_branch_id, 'workshop.repair_orders.read') THEN
      RETURN false;
    END IF;

    v_is_manager := public.has_branch_permission(p_org_id, v_branch_id, 'workshop.repair_orders.manage_all');

    IF p_visibility = 'internal' AND NOT v_is_manager THEN
      RETURN false;
    END IF;

    IF p_action = 'moderate' THEN
      RETURN v_is_manager;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  IF p_target_type = 'chat.conversation' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = p_target_id AND c.organization_id = p_org_id AND c.deleted_at IS NULL
    ) OR NOT public.is_chat_member(p_target_id) THEN
      RETURN false;
    END IF;

    IF p_visibility = 'internal' OR p_action = 'moderate' THEN
      RETURN false;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  RETURN false;
END;
$function$;
