-- =============================================
-- Enhanced User Creation Trigger with Invitation Support
-- =============================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

-- Create enhanced function to handle new user registration
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
      
      -- Set user's default branch to invitation branch
      INSERT INTO user_preferences (user_id, default_organization_id, default_branch_id)
      VALUES (NEW.id, invitation_org_id, invitation_branch_id)
      ON CONFLICT (user_id) DO UPDATE SET
        default_organization_id = invitation_org_id,
        default_branch_id = invitation_branch_id;
      
      -- Add user to organization
      INSERT INTO user_organizations (user_id, organization_id)
      VALUES (NEW.id, invitation_org_id)
      ON CONFLICT (user_id, organization_id) DO NOTHING;
      
      -- Assign the role from invitation using the enhanced auth system
      INSERT INTO user_role_assignments (
        user_id,
        role_id,
        scope,
        scope_id,
        assigned_by,
        assignment_type,
        reason,
        is_active
      ) VALUES (
        NEW.id,
        invitation_role_id,
        'organization',
        invitation_org_id,
        invitation_record.invited_by,
        'invitation',
        'Assigned via invitation token: ' || invitation_token,
        true
      )
      ON CONFLICT (user_id, role_id, scope, scope_id) DO NOTHING;
      
      -- If role should also have branch-level access, add branch assignment
      IF invitation_branch_id IS NOT NULL THEN
        INSERT INTO user_role_assignments (
          user_id,
          role_id,
          scope,
          scope_id,
          assigned_by,
          assignment_type,
          reason,
          is_active
        ) VALUES (
          NEW.id,
          invitation_role_id,
          'branch',
          invitation_branch_id,
          invitation_record.invited_by,
          'invitation',
          'Branch assignment via invitation token: ' || invitation_token,
          true
        )
        ON CONFLICT (user_id, role_id, scope, scope_id) DO NOTHING;
      END IF;
      
      -- Mark invitation as accepted
      UPDATE invitations
      SET 
        status = 'accepted',
        accepted_at = now(),
        updated_at = now()
      WHERE token = invitation_token;
      
    END IF;
    
  ELSE
    -- Regular registration (no invitation) - create new organization
    
    -- Extract domain from email
    domain_name := split_part(NEW.email, '@', 2);
    
    -- Generate organization slug from domain
    new_org_slug := lower(regexp_replace(
      regexp_replace(domain_name, '\.[^.]*$', ''), -- Remove TLD
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
      slug,
      created_at
    )
    VALUES (
      new_org_id,
      domain_name,
      new_org_slug,
      timezone('utc', now())
    );
    
    -- Create default branch for the organization
    INSERT INTO branches (organization_id, name, slug)
    VALUES (new_org_id, 'Main Branch', 'main')
    RETURNING id INTO default_branch_id;
    
    -- Create branch profile
    INSERT INTO branch_profiles (
      branch_id,
      name,
      created_at
    )
    VALUES (
      default_branch_id,
      'Main Branch',
      timezone('utc', now())
    );
    
    -- Set user preferences
    INSERT INTO user_preferences (user_id, default_organization_id, default_branch_id)
    VALUES (NEW.id, new_org_id, default_branch_id)
    ON CONFLICT (user_id) DO UPDATE SET
      default_organization_id = new_org_id,
      default_branch_id = default_branch_id;
    
    -- Add user to organization
    INSERT INTO user_organizations (user_id, organization_id)
    VALUES (NEW.id, new_org_id);
    
    -- Get org_owner role ID
    SELECT id INTO org_owner_role_id
    FROM roles
    WHERE slug = 'org_owner'
      AND organization_id IS NULL
      AND deleted_at IS NULL;
    
    -- Assign org_owner role to the user
    IF org_owner_role_id IS NOT NULL THEN
      INSERT INTO user_role_assignments (
        user_id,
        role_id,
        scope,
        scope_id,
        assigned_by,
        assignment_type,
        reason,
        is_active
      ) VALUES (
        NEW.id,
        org_owner_role_id,
        'organization',
        new_org_id,
        NEW.id,
        'auto',
        'Automatically assigned as organization creator',
        true
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

-- Create function to clean up expired invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  WITH expired_invitations AS (
    UPDATE invitations
    SET 
      status = 'expired',
      updated_at = now()
    WHERE status = 'pending'
      AND expires_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired_invitations;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old invitation events
CREATE OR REPLACE FUNCTION cleanup_old_invitation_events(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- This is a placeholder for invitation events cleanup
  -- In a full implementation, this would clean up invitation event logs
  cleaned_count := 0;
  
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION handle_new_auth_user() IS 'Enhanced user creation handler with invitation support - creates organization for normal registration or assigns user to invited organization';
COMMENT ON FUNCTION expire_old_invitations() IS 'Marks expired invitations as expired';
COMMENT ON FUNCTION cleanup_old_invitation_events() IS 'Cleans up old invitation event logs';