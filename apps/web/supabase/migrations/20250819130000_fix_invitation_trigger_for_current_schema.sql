-- =============================================
-- Fix Invitation Trigger for Current Database Schema
-- =============================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

-- Create fixed function to handle new user registration with current schema
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  invitation_token TEXT;
  invitation_org_id UUID;
  invitation_role_id UUID;
  invitation_branch_id UUID;
  invitation_record RECORD;
  org_owner_role_id UUID;
  new_org_id UUID;
  new_org_slug TEXT;
  default_branch_id UUID;
  domain_name TEXT;
BEGIN
  -- Extract invitation data from user metadata
  invitation_token := NEW.raw_user_meta_data->>'invitation_token';
  invitation_org_id := (NEW.raw_user_meta_data->>'invitation_organization_id')::UUID;
  invitation_role_id := (NEW.raw_user_meta_data->>'invitation_role_id')::UUID;
  invitation_branch_id := (NEW.raw_user_meta_data->>'invitation_branch_id')::UUID;

  -- Insert into public.users table with user metadata
  INSERT INTO public.users (
    id, 
    email, 
    first_name, 
    last_name,
    created_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    timezone('utc', now())
  )
  ON CONFLICT (id) DO NOTHING;

  -- Check if user is registering from an invitation
  IF invitation_token IS NOT NULL AND invitation_org_id IS NOT NULL THEN
    -- Validate and get invitation details
    SELECT * INTO invitation_record
    FROM invitations
    WHERE token = invitation_token
      AND status = 'pending'
      AND organization_id = invitation_org_id
      AND email = NEW.email
      AND expires_at > now();
    
    IF FOUND THEN
      -- User is registering from a valid invitation
      
      -- Set user's default branch to invitation branch (if user_preferences table exists)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
        INSERT INTO user_preferences (user_id, last_branch_id)
        VALUES (NEW.id, invitation_branch_id)
        ON CONFLICT (user_id) DO UPDATE SET
          last_branch_id = invitation_branch_id;
      END IF;
      
      -- Assign the role from invitation using current auth system
      INSERT INTO user_role_assignments (
        user_id,
        role_id,
        scope,
        scope_id
      ) VALUES (
        NEW.id,
        invitation_role_id,
        'organization',
        invitation_org_id
      )
      ON CONFLICT (user_id, role_id, scope, scope_id) DO NOTHING;
      
      -- If role should also have branch-level access, add branch assignment
      IF invitation_branch_id IS NOT NULL THEN
        INSERT INTO user_role_assignments (
          user_id,
          role_id,
          scope,
          scope_id
        ) VALUES (
          NEW.id,
          invitation_role_id,
          'branch',
          invitation_branch_id
        )
        ON CONFLICT (user_id, role_id, scope, scope_id) DO NOTHING;
      END IF;
      
      -- Mark invitation as accepted
      UPDATE invitations
      SET 
        status = 'accepted',
        accepted_at = now()
      WHERE token = invitation_token;
      
    END IF;
    
  ELSE
    -- Regular registration (no invitation) - create new organization
    
    -- Extract domain from email
    domain_name := split_part(NEW.email, '@', 2);
    
    -- Generate organization slug from domain
    new_org_slug := lower(regexp_replace(
      regexp_replace(domain_name, '\\.[^.]*$', ''), -- Remove TLD
      '[^a-z0-9]+', '-', 'g' -- Replace non-alphanumeric with dashes
    ));
    
    -- Ensure unique slug
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = new_org_slug) LOOP
      new_org_slug := new_org_slug || '-' || floor(random() * 1000)::text;
    END LOOP;
    
    -- Create new organization
    INSERT INTO organizations (slug, created_by)
    VALUES (new_org_slug, NEW.id)
    RETURNING id INTO new_org_id;
    
    -- Create organization profile
    INSERT INTO organization_profiles (
      organization_id,
      name,
      created_at
    )
    VALUES (
      new_org_id,
      domain_name,
      timezone('utc', now())
    );
    
    -- Create default branch for the organization
    INSERT INTO branches (organization_id, name)
    VALUES (new_org_id, 'Main Branch')
    RETURNING id INTO default_branch_id;
    
    -- Set user preferences (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
      INSERT INTO user_preferences (user_id, last_branch_id)
      VALUES (NEW.id, default_branch_id)
      ON CONFLICT (user_id) DO UPDATE SET
        last_branch_id = default_branch_id;
    END IF;
    
    -- Get org_owner role ID
    SELECT id INTO org_owner_role_id
    FROM roles
    WHERE name = 'org_owner'
      AND organization_id IS NULL
      AND deleted_at IS NULL;
    
    -- Assign org_owner role to the user
    IF org_owner_role_id IS NOT NULL THEN
      INSERT INTO user_role_assignments (
        user_id,
        role_id,
        scope,
        scope_id
      ) VALUES (
        NEW.id,
        org_owner_role_id,
        'organization',
        new_org_id
      )
      ON CONFLICT (user_id, role_id, scope, scope_id) DO NOTHING;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION handle_new_auth_user() IS 'Fixed user creation handler with invitation support for current database schema';