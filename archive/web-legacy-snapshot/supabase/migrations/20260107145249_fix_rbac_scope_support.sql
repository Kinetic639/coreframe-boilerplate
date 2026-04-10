-- Migration: Fix RBAC Scope Support
--
-- This migration adds proper scope support to the RBAC system:
-- 1. Adds scope_type to roles table to declare intended assignment scope
-- 2. Adds validation trigger to enforce scope_type constraints
-- 3. Improves get_permissions_for_roles RPC with deduplication

-- =====================================================
-- Part 1: Add scope_type to roles table
-- =====================================================

-- Add scope_type column to roles table
ALTER TABLE public.roles
ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'org'
CHECK (scope_type IN ('org', 'branch', 'both'));

COMMENT ON COLUMN public.roles.scope_type IS
  'Defines where this role can be assigned: org (organization-wide), branch (branch-specific), or both';

-- =====================================================
-- Part 2: Add validation trigger for role assignments
-- =====================================================

-- Create function to validate role assignment scope
CREATE OR REPLACE FUNCTION public.validate_role_assignment_scope()
RETURNS TRIGGER AS $$
DECLARE
  role_scope_type text;
BEGIN
  -- Get the role's intended scope_type
  SELECT scope_type INTO role_scope_type
  FROM public.roles
  WHERE id = NEW.role_id;

  -- Validate assignment scope matches role's scope_type
  IF role_scope_type = 'org' AND NEW.scope != 'org' THEN
    RAISE EXCEPTION 'Role % can only be assigned at org scope', NEW.role_id;
  END IF;

  IF role_scope_type = 'branch' AND NEW.scope != 'branch' THEN
    RAISE EXCEPTION 'Role % can only be assigned at branch scope', NEW.role_id;
  END IF;

  -- 'both' allows either scope, so no check needed

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_role_assignments
DROP TRIGGER IF EXISTS check_role_assignment_scope ON public.user_role_assignments;
CREATE TRIGGER check_role_assignment_scope
  BEFORE INSERT OR UPDATE ON public.user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_assignment_scope();

-- =====================================================
-- Part 3: Improve get_permissions_for_roles RPC
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_permissions_for_roles(uuid[]);

-- Create improved version with DISTINCT and ORDER BY
CREATE OR REPLACE FUNCTION public.get_permissions_for_roles(role_ids uuid[])
RETURNS SETOF text AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.slug
  FROM public.role_permissions rp
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE rp.role_id = ANY(role_ids)
    AND rp.allowed = true
    AND rp.deleted_at IS NULL
    AND p.deleted_at IS NULL
  ORDER BY p.slug;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_permissions_for_roles(uuid[]) IS
  'Returns distinct permission slugs for given role IDs. Uses DISTINCT to avoid duplicates and ORDER BY for deterministic results.';
