-- Force Row Level Security on org-management tables
-- Ensures RLS applies even to the table owner role (defense-in-depth).
-- No policies are modified — hygiene hardening only.

ALTER TABLE public.organization_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.org_positions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.org_position_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.branches FORCE ROW LEVEL SECURITY;
