-- =============================================================================
-- Chat: fix the GIF link check of 20261120090000_chat_reactions_and_gifs.sql
-- =============================================================================
-- The URL pattern used the repetition {1,1000}; Postgres allows at most 255
-- ("invalid regular expression: invalid repetition count(s)"), so every GIF
-- send failed. The length limit is now a separate char_length check. Plain
-- messages were not affected (the check is skipped when there is no GIF).
-- =============================================================================

CREATE OR REPLACE FUNCTION public._chat_valid_media(p_media jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT p_media IS NULL OR (
    jsonb_typeof(p_media) = 'object'
    AND pg_column_size(p_media) <= 4096
    AND p_media ->> 'kind' = 'gif'
    AND coalesce(p_media ->> 'provider', '') IN ('klipy', 'giphy', 'tenor')
    AND char_length(coalesce(p_media ->> 'id', '')) BETWEEN 1 AND 200
    AND char_length(coalesce(p_media ->> 'url', '')) <= 1000
    AND coalesce(p_media ->> 'url', '') ~
      '^https://([a-z0-9-]+\.)*(klipy\.com|klipy\.co|giphy\.com|tenor\.com)/[^\s"<>]+$'
    AND (p_media ->> 'preview_url' IS NULL OR (
      char_length(p_media ->> 'preview_url') <= 1000
      AND p_media ->> 'preview_url' ~
        '^https://([a-z0-9-]+\.)*(klipy\.com|klipy\.co|giphy\.com|tenor\.com)/[^\s"<>]+$'))
    AND jsonb_typeof(p_media -> 'width') = 'number'
    AND jsonb_typeof(p_media -> 'height') = 'number'
    AND (p_media ->> 'width')::numeric BETWEEN 1 AND 4096
    AND (p_media ->> 'height')::numeric BETWEEN 1 AND 4096
    AND char_length(coalesce(p_media ->> 'title', '')) <= 200
  );
$$;

REVOKE ALL ON FUNCTION public._chat_valid_media(jsonb) FROM PUBLIC, anon, authenticated;
