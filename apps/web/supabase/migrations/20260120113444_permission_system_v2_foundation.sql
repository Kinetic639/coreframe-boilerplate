-- ============================================================================
-- Permission System V2 - Foundation Migration
-- ============================================================================
-- This migration implements a "compile, don't evaluate" permission architecture:
-- - Roles + overrides describe INTENT
-- - Compiler turns intent into FACTS
-- - RLS only checks FACTS (user_effective_permissions)
-- ============================================================================

-- ============================================================================
-- PART 1: Create user_effective_permissions table (THE KEY TABLE)
-- ============================================================================
-- This table contains ONLY explicit facts: "User X can do Y in Org Z"
-- No wildcards, no roles, no logic - just facts.

CREATE TABLE IF NOT EXISTS public.user_effective_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  permission_slug TEXT NOT NULL,

  -- Metadata for debugging
  source_type TEXT NOT NULL DEFAULT 'role', -- 'role' or 'override'
  source_id UUID, -- role_id or override_id that granted this

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  compiled_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- When the compiler last ran

  -- Unique constraint: one permission per user per org
  CONSTRAINT user_effective_permissions_unique
    UNIQUE (user_id, organization_id, permission_slug)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_uep_user_org
  ON public.user_effective_permissions(user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_uep_permission
  ON public.user_effective_permissions(permission_slug);

CREATE INDEX IF NOT EXISTS idx_uep_user_org_permission
  ON public.user_effective_permissions(user_id, organization_id, permission_slug);

-- ============================================================================
-- PART 2: Seed V1 Permissions (Dictionary of allowed actions)
-- ============================================================================

-- Clear existing permissions and start fresh with v1 set
TRUNCATE TABLE public.permissions CASCADE;

INSERT INTO public.permissions (slug, action, category, description) VALUES
-- Organization permissions
('org.read', 'read', 'organization', 'View organization information'),
('org.update', 'update', 'organization', 'Update organization settings'),

-- Branch permissions
('branches.read', 'read', 'branches', 'View branches'),
('branches.create', 'create', 'branches', 'Create new branches'),
('branches.update', 'update', 'branches', 'Update branch information'),
('branches.delete', 'delete', 'branches', 'Delete branches'),

-- Member permissions
('members.read', 'read', 'members', 'View member list'),
('members.manage', 'manage', 'members', 'Invite, remove, and manage member roles'),

-- Self permissions (always granted to authenticated users)
('self.read', 'read', 'self', 'View own profile'),
('self.update', 'update', 'self', 'Update own profile'),

-- Invite permissions
('invites.create', 'create', 'invites', 'Send invitations'),
('invites.read', 'read', 'invites', 'View pending invitations'),
('invites.cancel', 'cancel', 'invites', 'Cancel pending invitations');

-- ============================================================================
-- PART 3: Ensure base roles exist
-- ============================================================================

-- Update existing roles or insert if they don't exist
DO $$
BEGIN
  -- org_owner
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'org_owner' AND deleted_at IS NULL) THEN
    UPDATE public.roles SET
      description = 'Organization owner with full access',
      scope_type = 'org',
      is_basic = true
    WHERE name = 'org_owner' AND deleted_at IS NULL;
  ELSE
    INSERT INTO public.roles (name, description, scope_type, is_basic)
    VALUES ('org_owner', 'Organization owner with full access', 'org', true);
  END IF;

  -- org_member (rename from 'member' if it exists)
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'member' AND deleted_at IS NULL) THEN
    UPDATE public.roles SET
      name = 'org_member',
      description = 'Regular organization member with limited access',
      scope_type = 'org',
      is_basic = true
    WHERE name = 'member' AND deleted_at IS NULL;
  ELSIF NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'org_member' AND deleted_at IS NULL) THEN
    INSERT INTO public.roles (name, description, scope_type, is_basic)
    VALUES ('org_member', 'Regular organization member with limited access', 'org', true);
  END IF;
END $$;

-- ============================================================================
-- PART 4: Assign permissions to roles
-- ============================================================================

-- Clear existing role_permissions
DELETE FROM public.role_permissions;

-- org_owner gets ALL permissions
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'org_owner';

-- org_member gets limited permissions (handle both 'member' and 'org_member' names)
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('org_member', 'member')
AND r.deleted_at IS NULL
AND p.slug IN (
  'org.read',
  'branches.read',
  'members.read',
  'self.read',
  'self.update'
);

-- ============================================================================
-- PART 5: Simplify user_permission_overrides table
-- ============================================================================

-- Add effect column if it doesn't exist (grant/revoke)
DO $$
BEGIN
  -- Check if the 'effect' column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_permission_overrides'
    AND column_name = 'effect'
  ) THEN
    -- Add the effect column
    ALTER TABLE public.user_permission_overrides
    ADD COLUMN effect TEXT NOT NULL DEFAULT 'grant'
    CHECK (effect IN ('grant', 'revoke'));

    -- Migrate existing data: allowed=true -> grant, allowed=false -> revoke
    UPDATE public.user_permission_overrides
    SET effect = CASE WHEN allowed THEN 'grant' ELSE 'revoke' END;
  END IF;
END $$;

-- Add permission_slug column for direct permission reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_permission_overrides'
    AND column_name = 'permission_slug'
  ) THEN
    ALTER TABLE public.user_permission_overrides
    ADD COLUMN permission_slug TEXT;

    -- Migrate existing data from permission_id to permission_slug
    UPDATE public.user_permission_overrides upo
    SET permission_slug = p.slug
    FROM public.permissions p
    WHERE upo.permission_id = p.id
    AND upo.permission_slug IS NULL;
  END IF;
END $$;

-- Add organization_id column if using scope/scope_id pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_permission_overrides'
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.user_permission_overrides
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

    -- Migrate existing data from scope_id where scope='org'
    UPDATE public.user_permission_overrides
    SET organization_id = scope_id
    WHERE scope = 'org' AND organization_id IS NULL;
  END IF;
END $$;

-- ============================================================================
-- PART 6: Create helper function to check effective permissions
-- ============================================================================

-- Function to check if a user has a specific permission in an org
CREATE OR REPLACE FUNCTION public.user_has_effective_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_permission_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id = p_user_id
    AND organization_id = p_organization_id
    AND permission_slug = p_permission_slug
  );
$$;

-- Function to check if current user has a permission (for RLS)
CREATE OR REPLACE FUNCTION public.current_user_has_permission(
  p_organization_id UUID,
  p_permission_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND permission_slug = p_permission_slug
  );
$$;

-- Function to check if current user is a member of an org (tenant boundary)
CREATE OR REPLACE FUNCTION public.current_user_is_org_member(
  p_organization_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND status = 'active'
    AND deleted_at IS NULL
  );
$$;

-- ============================================================================
-- PART 7: Create the permission compiler function
-- ============================================================================

-- This function compiles effective permissions for a specific user in an org
CREATE OR REPLACE FUNCTION public.compile_user_permissions(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_permission_slugs TEXT[];
  v_role_record RECORD;
  v_override_record RECORD;
BEGIN
  -- Initialize empty permission set
  v_permission_slugs := ARRAY[]::TEXT[];

  -- Step 1: Collect permissions from all assigned roles
  FOR v_role_record IN
    SELECT DISTINCT p.slug
    FROM public.user_role_assignments ura
    JOIN public.roles r ON ura.role_id = r.id
    JOIN public.role_permissions rp ON r.id = rp.role_id AND rp.allowed = true
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ura.user_id = p_user_id
    AND ura.scope = 'org'
    AND ura.scope_id = p_organization_id
    AND ura.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND rp.deleted_at IS NULL
    AND p.deleted_at IS NULL
  LOOP
    -- Add to permission set
    v_permission_slugs := array_append(v_permission_slugs, v_role_record.slug);
  END LOOP;

  -- Step 2: Apply overrides
  FOR v_override_record IN
    SELECT permission_slug, effect
    FROM public.user_permission_overrides
    WHERE user_id = p_user_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL
    AND permission_slug IS NOT NULL
  LOOP
    IF v_override_record.effect = 'grant' THEN
      -- Add permission if not already present
      IF NOT v_override_record.permission_slug = ANY(v_permission_slugs) THEN
        v_permission_slugs := array_append(v_permission_slugs, v_override_record.permission_slug);
      END IF;
    ELSIF v_override_record.effect = 'revoke' THEN
      -- Remove permission if present
      v_permission_slugs := array_remove(v_permission_slugs, v_override_record.permission_slug);
    END IF;
  END LOOP;

  -- Step 3: Delete existing effective permissions for this user/org
  DELETE FROM public.user_effective_permissions
  WHERE user_id = p_user_id
  AND organization_id = p_organization_id;

  -- Step 4: Insert new effective permissions
  INSERT INTO public.user_effective_permissions (
    user_id,
    organization_id,
    permission_slug,
    source_type,
    compiled_at
  )
  SELECT
    p_user_id,
    p_organization_id,
    unnest(v_permission_slugs),
    'role', -- Default to role, could be enhanced to track source
    now()
  ON CONFLICT (user_id, organization_id, permission_slug) DO UPDATE
  SET compiled_at = now();

END;
$$;

-- Function to compile permissions for ALL users in an organization
CREATE OR REPLACE FUNCTION public.compile_org_permissions(
  p_organization_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
BEGIN
  -- Compile for each active member
  FOR v_user_record IN
    SELECT DISTINCT user_id
    FROM public.organization_members
    WHERE organization_id = p_organization_id
    AND status = 'active'
    AND deleted_at IS NULL
  LOOP
    PERFORM public.compile_user_permissions(v_user_record.user_id, p_organization_id);
  END LOOP;
END;
$$;

-- Function to compile permissions for a user across ALL their organizations
CREATE OR REPLACE FUNCTION public.compile_all_user_permissions(
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_record RECORD;
BEGIN
  -- Compile for each org the user is a member of
  FOR v_org_record IN
    SELECT DISTINCT organization_id
    FROM public.organization_members
    WHERE user_id = p_user_id
    AND status = 'active'
    AND deleted_at IS NULL
  LOOP
    PERFORM public.compile_user_permissions(p_user_id, v_org_record.organization_id);
  END LOOP;
END;
$$;

-- ============================================================================
-- PART 8: Create triggers to auto-compile on changes
-- ============================================================================

-- Trigger function for role assignment changes
CREATE OR REPLACE FUNCTION public.trigger_compile_on_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Recompile for the old user/org
    IF OLD.scope = 'org' THEN
      PERFORM public.compile_user_permissions(OLD.user_id, OLD.scope_id);
    END IF;
    RETURN OLD;
  ELSE
    -- INSERT or UPDATE: compile for the new user/org
    IF NEW.scope = 'org' THEN
      PERFORM public.compile_user_permissions(NEW.user_id, NEW.scope_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger function for override changes
CREATE OR REPLACE FUNCTION public.trigger_compile_on_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.organization_id IS NOT NULL THEN
      PERFORM public.compile_user_permissions(OLD.user_id, OLD.organization_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.organization_id IS NOT NULL THEN
      PERFORM public.compile_user_permissions(NEW.user_id, NEW.organization_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger function for role_permissions changes (affects all users with that role)
CREATE OR REPLACE FUNCTION public.trigger_compile_on_role_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role_id UUID;
  v_assignment RECORD;
BEGIN
  -- Get the affected role_id
  IF TG_OP = 'DELETE' THEN
    v_role_id := OLD.role_id;
  ELSE
    v_role_id := NEW.role_id;
  END IF;

  -- Recompile for all users who have this role
  FOR v_assignment IN
    SELECT user_id, scope_id
    FROM public.user_role_assignments
    WHERE role_id = v_role_id
    AND scope = 'org'
    AND deleted_at IS NULL
  LOOP
    PERFORM public.compile_user_permissions(v_assignment.user_id, v_assignment.scope_id);
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_role_assignment_compile ON public.user_role_assignments;
DROP TRIGGER IF EXISTS trigger_override_compile ON public.user_permission_overrides;
DROP TRIGGER IF EXISTS trigger_role_permission_compile ON public.role_permissions;

-- Create triggers
CREATE TRIGGER trigger_role_assignment_compile
  AFTER INSERT OR UPDATE OR DELETE ON public.user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_role_assignment();

CREATE TRIGGER trigger_override_compile
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_override();

CREATE TRIGGER trigger_role_permission_compile
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_role_permission();

-- ============================================================================
-- PART 9: Initial compilation for all existing users
-- ============================================================================

-- Compile permissions for all existing organization members
DO $$
DECLARE
  v_member RECORD;
BEGIN
  FOR v_member IN
    SELECT DISTINCT user_id, organization_id
    FROM public.organization_members
    WHERE status = 'active'
    AND deleted_at IS NULL
  LOOP
    PERFORM public.compile_user_permissions(v_member.user_id, v_member.organization_id);
  END LOOP;
END $$;

-- ============================================================================
-- PART 10: Add RLS policies for user_effective_permissions
-- ============================================================================

-- Enable RLS
ALTER TABLE public.user_effective_permissions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own effective permissions
CREATE POLICY "Users can view own effective permissions"
  ON public.user_effective_permissions
  FOR SELECT
  USING (user_id = auth.uid());

-- Only system/triggers can insert/update/delete (via SECURITY DEFINER functions)
-- No direct INSERT/UPDATE/DELETE policies for regular users

-- ============================================================================
-- DONE
-- ============================================================================
-- After this migration:
-- 1. user_effective_permissions table exists with compiled facts
-- 2. V1 permissions are seeded (org, branches, members, self, invites)
-- 3. org_owner and org_member roles have their permissions assigned
-- 4. Triggers auto-compile on role/override changes
-- 5. Helper functions exist for RLS policy checks
-- 6. All existing users have their permissions compiled
-- ============================================================================
