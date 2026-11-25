-- =============================================================================
-- Messages: group photo (avatar of a group conversation)
--
-- The group's owner (role 'owner') or its creator may set or remove a photo.
-- The file lives in the private "chat-avatars" bucket under
-- "<conversation_id>/<uuid>.<ext>"; the conversation row keeps only the path.
-- Members read the path through the existing RLS on chat_conversations and the
-- app signs it on the server. Changing the photo posts a system message
-- ("avatar"), which also refreshes the conversation for every member.
-- Idempotent: safe to run more than once.
-- =============================================================================

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS avatar_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_avatar_path_check'
  ) THEN
    ALTER TABLE public.chat_conversations
      ADD CONSTRAINT chat_conversations_avatar_path_check
      CHECK (
        avatar_path IS NULL
        OR (kind = 'group'
            AND char_length(avatar_path) <= 200
            AND avatar_path LIKE id::text || '/%')
      );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Who may change the photo: an active member of the group who owns it or
-- created it (and may use messages in its organization)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_can_manage_group(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    JOIN public.chat_members m
      ON m.conversation_id = c.id AND m.user_id = auth.uid() AND m.left_at IS NULL
    WHERE c.id = p_conversation_id
      AND c.kind = 'group'
      AND c.deleted_at IS NULL
      AND (m.role = 'owner' OR c.created_by = auth.uid())
      AND public.is_org_member(c.organization_id)
      AND public.has_permission(c.organization_id, 'messages.use')
  );
$$;

-- Storage policies get the first folder of the object name as text
CREATE OR REPLACE FUNCTION public.chat_avatar_folder_allowed(p_folder text, p_manage boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF p_folder IS NULL
     OR p_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  IF p_manage THEN
    RETURN public.chat_can_manage_group(p_folder::uuid);
  END IF;
  RETURN public.is_chat_member(p_folder::uuid);
END;
$$;

REVOKE ALL ON FUNCTION public.chat_can_manage_group(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_avatar_folder_allowed(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_can_manage_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_avatar_folder_allowed(text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Set (path) or remove (NULL) the photo. Returns the previous path, which the
-- app deletes from storage.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_set_avatar(p_conversation_id uuid, p_path text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org uuid;
  v_old text;
BEGIN
  SELECT organization_id, avatar_path INTO v_org, v_old
  FROM public.chat_conversations
  WHERE id = p_conversation_id AND kind = 'group' AND deleted_at IS NULL
  FOR UPDATE;
  IF v_org IS NULL OR NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;
  IF NOT public.chat_can_manage_group(p_conversation_id) THEN
    RAISE EXCEPTION 'only the owner or creator can change the group photo' USING ERRCODE = '42501';
  END IF;
  IF p_path IS NOT NULL AND (
    char_length(p_path) > 200
    OR p_path NOT LIKE p_conversation_id::text || '/%'
    OR p_path LIKE '%..%'
  ) THEN
    RAISE EXCEPTION 'invalid avatar path' USING ERRCODE = '22023';
  END IF;
  IF p_path IS NOT DISTINCT FROM v_old THEN
    RETURN NULL;
  END IF;

  UPDATE public.chat_conversations
  SET avatar_path = p_path, updated_at = now()
  WHERE id = p_conversation_id;

  PERFORM public._chat_system_message(p_conversation_id, v_org,
    jsonb_build_object('action', 'avatar', 'removed', p_path IS NULL));

  RETURN v_old;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_set_avatar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_set_avatar(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, members read, owner/creator upload and delete
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-avatars',
  'chat-avatars',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS chat_avatars_select_member ON storage.objects;
CREATE POLICY chat_avatars_select_member
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-avatars'
    AND public.chat_avatar_folder_allowed((storage.foldername(name))[1], false)
  );

DROP POLICY IF EXISTS chat_avatars_insert_manager ON storage.objects;
CREATE POLICY chat_avatars_insert_manager
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-avatars'
    AND public.chat_avatar_folder_allowed((storage.foldername(name))[1], true)
  );

DROP POLICY IF EXISTS chat_avatars_delete_manager ON storage.objects;
CREATE POLICY chat_avatars_delete_manager
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-avatars'
    AND public.chat_avatar_folder_allowed((storage.foldername(name))[1], true)
  );
