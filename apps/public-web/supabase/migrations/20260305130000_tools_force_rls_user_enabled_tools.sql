-- Migration: tools_force_rls_user_enabled_tools
-- Date: 2026-03-05
--
-- Applies FORCE ROW LEVEL SECURITY to user_enabled_tools.
-- This ensures that even SECURITY DEFINER functions owned by the table owner
-- must satisfy the user_id = auth.uid() RLS policies.
-- tools_catalog is intentionally excluded: its SELECT policy is USING (true)
-- so FORCE RLS provides no security benefit there.

ALTER TABLE public.user_enabled_tools FORCE ROW LEVEL SECURITY;
