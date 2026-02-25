-- Migration: grant_avatar_path_update
-- Purpose: Grant UPDATE on avatar_path column to authenticated role.
-- The previous migration (20260225090000) added the column but omitted the
-- column-level UPDATE grant, causing 403 on PATCH /rest/v1/users when saving
-- the avatar path after a successful storage upload.
-- Date: 2026-02-25

GRANT UPDATE (avatar_path) ON public.users TO authenticated;
