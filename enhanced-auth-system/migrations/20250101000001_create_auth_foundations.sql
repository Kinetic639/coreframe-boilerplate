-- =============================================
-- Enhanced Multi-Tenant Auth System - Core Foundations
-- Migration 1: Create foundational auth tables
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ORGANIZATIONS
-- =============================================

-- Core organizations table
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Organization public profiles (publicly accessible data)
CREATE TABLE organization_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text,
  bio text,
  logo_url text,
  website text,
  theme_color text DEFAULT '#2563eb',
  font_color text DEFAULT '#1f2937',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

-- Organization settings (private configuration)
CREATE TABLE organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Invitation settings
  invitation_expiry_hours integer DEFAULT 168, -- 7 days
  auto_accept_domain text,
  require_email_verification boolean DEFAULT true,
  allow_branch_admins_invite boolean DEFAULT true,
  max_users integer DEFAULT 1000,
  
  -- Security settings
  enforce_mfa boolean DEFAULT false,
  password_policy jsonb DEFAULT '{
    "minLength": 8,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumbers": true,
    "requireSpecialChars": false,
    "maxAge": 0
  }'::jsonb,
  session_timeout_minutes integer DEFAULT 480, -- 8 hours
  allowed_login_methods text[] DEFAULT '{"email"}',
  
  -- Notification settings
  email_notifications jsonb DEFAULT '{
    "welcomeEmails": true,
    "invitationReminders": true,
    "securityAlerts": true,
    "adminNotifications": true
  }'::jsonb,
  
  -- Feature flags
  features jsonb DEFAULT '{
    "apiAccess": true,
    "webhooks": false,
    "ssoEnabled": false,
    "auditLogs": true
  }'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- BRANCHES
-- =============================================

-- Hierarchical branches table
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  parent_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  level integer DEFAULT 1,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(organization_id, slug)
);

-- Branch public profiles
CREATE TABLE branch_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  name text,
  bio text,
  logo_url text,
  website text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(branch_id)
);

-- =============================================
-- ENHANCED USERS
-- =============================================

-- Extended user profiles (linked to auth.users)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  language text DEFAULT 'en',
  is_active boolean DEFAULT true,
  last_seen_at timestamptz,
  email_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- User preferences and settings
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  default_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  default_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  
  -- UI preferences
  theme text DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  notifications_enabled boolean DEFAULT true,
  email_notifications jsonb DEFAULT '{
    "invitations": true,
    "roleChanges": true,
    "securityAlerts": true,
    "weeklyDigest": false
  }'::jsonb,
  
  -- UI customizations
  ui_preferences jsonb DEFAULT '{
    "sidebarCollapsed": false,
    "density": "comfortable",
    "showAvatars": true
  }'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User onboarding tracking
CREATE TABLE user_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  onboarding_type text DEFAULT 'standard' CHECK (onboarding_type IN ('standard', 'invitation', 'import')),
  completed_steps jsonb DEFAULT '[]'::jsonb,
  current_step text,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  skipped_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, organization_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Organizations indexes
CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_created_by ON organizations(created_by);
CREATE INDEX idx_organizations_created_at ON organizations(created_at);

-- Branches indexes
CREATE INDEX idx_branches_organization_id ON branches(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_branches_parent_id ON branches(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_branches_slug ON branches(organization_id, slug) WHERE deleted_at IS NULL;

-- Users indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_last_seen ON users(last_seen_at);

-- User preferences indexes
CREATE INDEX idx_user_preferences_default_org ON user_preferences(default_organization_id);
CREATE INDEX idx_user_preferences_default_branch ON user_preferences(default_branch_id);

-- Onboarding indexes
CREATE INDEX idx_user_onboarding_user_org ON user_onboarding(user_id, organization_id);
CREATE INDEX idx_user_onboarding_incomplete ON user_onboarding(organization_id) WHERE completed_at IS NULL;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to generate unique organization slug
CREATE OR REPLACE FUNCTION generate_unique_org_slug(org_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
BEGIN
  -- Create base slug from organization name
  base_slug := lower(trim(regexp_replace(org_name, '[^a-zA-Z0-9\s-]', '', 'g')));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(base_slug, '-');
  
  -- Ensure slug is not empty
  IF base_slug = '' THEN
    base_slug := 'organization';
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug AND deleted_at IS NULL) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Function to generate unique branch slug within organization
CREATE OR REPLACE FUNCTION generate_unique_branch_slug(org_id uuid, branch_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
BEGIN
  -- Create base slug from branch name
  base_slug := lower(trim(regexp_replace(branch_name, '[^a-zA-Z0-9\s-]', '', 'g')));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(base_slug, '-');
  
  -- Ensure slug is not empty
  IF base_slug = '' THEN
    base_slug := 'branch';
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness within organization
  WHILE EXISTS (
    SELECT 1 FROM branches 
    WHERE organization_id = org_id 
    AND slug = final_slug 
    AND deleted_at IS NULL
  ) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================

-- Organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Organization profiles
CREATE TRIGGER update_organization_profiles_updated_at
  BEFORE UPDATE ON organization_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Organization settings
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Branches
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Branch profiles
CREATE TRIGGER update_branch_profiles_updated_at
  BEFORE UPDATE ON branch_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Users
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- User preferences
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- User onboarding
CREATE TRIGGER update_user_onboarding_updated_at
  BEFORE UPDATE ON user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- AUTO-PROFILE CREATION TRIGGERS
-- =============================================

-- Auto-create organization profile when organization is created
CREATE OR REPLACE FUNCTION create_organization_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO organization_profiles (organization_id, name)
  VALUES (NEW.id, NEW.name);
  
  INSERT INTO organization_settings (organization_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_organization_profile_trigger
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_organization_profile();

-- Auto-create branch profile when branch is created
CREATE OR REPLACE FUNCTION create_branch_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO branch_profiles (branch_id, name)
  VALUES (NEW.id, NEW.name);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_branch_profile_trigger
  AFTER INSERT ON branches
  FOR EACH ROW
  EXECUTE FUNCTION create_branch_profile();

-- Auto-create user profile and preferences when auth.users is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into public.users table
  INSERT INTO public.users (id, email, created_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  
  -- Create user preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users (requires elevated privileges)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =============================================
-- GRANT PERMISSIONS FOR AUTH ADMIN
-- =============================================

-- Grant necessary permissions to supabase_auth_admin
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION handle_new_user() TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;

-- Grant specific table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO supabase_auth_admin;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE organizations IS 'Core organizations table for multi-tenancy';
COMMENT ON TABLE organization_profiles IS 'Public organization profile data';
COMMENT ON TABLE organization_settings IS 'Private organization configuration and settings';
COMMENT ON TABLE branches IS 'Hierarchical branches within organizations';
COMMENT ON TABLE branch_profiles IS 'Public branch profile data';
COMMENT ON TABLE users IS 'Extended user profiles linked to auth.users';
COMMENT ON TABLE user_preferences IS 'User-specific preferences and settings';
COMMENT ON TABLE user_onboarding IS 'Tracks user onboarding progress per organization';