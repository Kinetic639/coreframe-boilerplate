-- Migration: tools_pinned_partial_idx
-- Date: 2026-03-05
--
-- Adds a partial index on user_enabled_tools for the pinned-tools sidebar query.
--
-- Query pattern (listPinnedToolsForSidebar):
--   SELECT tool_slug, created_at FROM user_enabled_tools
--   WHERE user_id = $1 AND pinned = true
--   ORDER BY created_at ASC
--
-- The existing user_enabled_tools_user_enabled_idx covers (user_id, enabled)
-- but does not help when filtering by pinned = true. This partial index is very
-- small because only pinned rows are included, making index scans fast even at
-- large row counts.

CREATE INDEX IF NOT EXISTS user_enabled_tools_pinned_idx
  ON public.user_enabled_tools (user_id, created_at)
  WHERE pinned = true;
