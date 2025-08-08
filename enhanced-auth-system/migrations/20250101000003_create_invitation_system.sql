-- =============================================
-- Enhanced Multi-Tenant Auth System - Invitation System
-- Migration 3: Create comprehensive invitation and onboarding system
-- =============================================

-- =============================================
-- INVITATIONS SYSTEM
-- =============================================

-- Comprehensive invitations table
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic invitation data
  email text NOT NULL,
  token text UNIQUE NOT NULL,
  
  -- Target organization and branch
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE, -- Optional: specific branch assignment
  
  -- Role assignment
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL, -- Pre-assigned role
  
  -- Invitation metadata
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  status text DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'expired', 'cancelled', 'resent')
  ),
  invite_type text DEFAULT 'standard' CHECK (
    invite_type IN ('standard', 'bulk', 'auto_accept', 'admin_invite')
  ),
  
  -- Timing and expiration
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users(id),
  
  -- Resend tracking
  resent_count integer DEFAULT 0,
  last_resent_at timestamptz,
  
  -- Customization
  custom_message text,
  custom_subject text,
  
  -- Additional data
  metadata jsonb DEFAULT '{}'::jsonb, -- Additional invitation context
  invitation_data jsonb DEFAULT '{}'::jsonb, -- Custom fields for the invitation
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  -- Constraints
  CONSTRAINT valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT valid_accepted_at CHECK (accepted_at IS NULL OR accepted_at >= created_at),
  CONSTRAINT accepted_status_consistency CHECK (
    (status = 'accepted' AND accepted_at IS NOT NULL AND accepted_by IS NOT NULL) OR
    (status != 'accepted' AND (accepted_at IS NULL OR accepted_by IS NULL))
  )
);

-- Bulk invitation management
CREATE TABLE bulk_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name text NOT NULL, -- Descriptive name for the bulk invite
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  
  -- Status tracking
  status text DEFAULT 'processing' CHECK (
    status IN ('processing', 'completed', 'failed', 'cancelled', 'partially_completed')
  ),
  
  -- Statistics
  total_invites integer DEFAULT 0,
  sent_invites integer DEFAULT 0,
  accepted_invites integer DEFAULT 0,
  failed_invites integer DEFAULT 0,
  cancelled_invites integer DEFAULT 0,
  
  -- Configuration
  invitation_template text, -- Email template to use
  default_role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  default_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  default_message text,
  
  -- Bulk data
  invitation_data jsonb NOT NULL, -- Array of invitation objects
  processing_log jsonb DEFAULT '[]'::jsonb, -- Processing status and errors
  
  -- Settings
  batch_size integer DEFAULT 10,
  delay_between_batches integer DEFAULT 1000, -- milliseconds
  auto_resend boolean DEFAULT false,
  
  -- Timing
  started_at timestamptz,
  completed_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Invitation templates for reusable invitation configurations
CREATE TABLE invitation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  
  -- Template configuration
  subject_template text NOT NULL,
  message_template text NOT NULL,
  default_role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  default_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  
  -- Template settings
  expiry_hours integer DEFAULT 168, -- 7 days
  allow_resend boolean DEFAULT true,
  max_resends integer DEFAULT 3,
  
  -- Usage tracking
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  
  -- Metadata
  is_active boolean DEFAULT true,
  is_system_template boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  UNIQUE(organization_id, name)
);

-- Track invitation events and history
CREATE TABLE invitation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (
    event_type IN ('created', 'sent', 'opened', 'clicked', 'accepted', 'expired', 'cancelled', 'resent')
  ),
  
  -- Event metadata
  user_agent text,
  ip_address inet,
  referrer text,
  
  -- Additional data
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Invitations indexes
CREATE INDEX idx_invitations_email ON invitations(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_invitations_token ON invitations(token) WHERE deleted_at IS NULL;
CREATE INDEX idx_invitations_organization_id ON invitations(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invitations_status ON invitations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_invitations_invited_by ON invitations(invited_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_invitations_pending ON invitations(status, expires_at) WHERE status = 'pending' AND deleted_at IS NULL;

-- Bulk invitations indexes
CREATE INDEX idx_bulk_invitations_organization_id ON bulk_invitations(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bulk_invitations_status ON bulk_invitations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bulk_invitations_created_by ON bulk_invitations(created_by) WHERE deleted_at IS NULL;

-- Invitation templates indexes
CREATE INDEX idx_invitation_templates_organization_id ON invitation_templates(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invitation_templates_active ON invitation_templates(is_active) WHERE deleted_at IS NULL;

-- Invitation events indexes
CREATE INDEX idx_invitation_events_invitation_id ON invitation_events(invitation_id);
CREATE INDEX idx_invitation_events_type ON invitation_events(event_type);
CREATE INDEX idx_invitation_events_created_at ON invitation_events(created_at);

-- =============================================
-- INVITATION MANAGEMENT FUNCTIONS
-- =============================================

-- Generate secure invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  token_chars text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  token_length integer := 64;
  token text := '';
  i integer;
BEGIN
  FOR i IN 1..token_length LOOP
    token := token || substr(token_chars, floor(random() * length(token_chars) + 1)::integer, 1);
  END LOOP;
  
  -- Ensure token is unique
  WHILE EXISTS (SELECT 1 FROM invitations WHERE token = token) LOOP
    token := '';
    FOR i IN 1..token_length LOOP
      token := token || substr(token_chars, floor(random() * length(token_chars) + 1)::integer, 1);
    END LOOP;
  END LOOP;
  
  RETURN token;
END;
$$;

-- Validate invitation token and get invitation data
CREATE OR REPLACE FUNCTION validate_invitation_token(invitation_token text)
RETURNS TABLE (
  invitation_id uuid,
  email text,
  organization_id uuid,
  organization_name text,
  branch_id uuid,
  branch_name text,
  role_id uuid,
  role_name text,
  invited_by_name text,
  expires_at timestamptz,
  custom_message text,
  is_valid boolean,
  error_message text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  inv_record record;
  is_expired boolean;
  is_already_accepted boolean;
BEGIN
  -- Get invitation details
  SELECT 
    i.id,
    i.email,
    i.organization_id,
    op.name as org_name,
    i.branch_id,
    bp.name as branch_name,
    i.role_id,
    r.name as role_name,
    COALESCE(u.first_name || ' ' || u.last_name, u.email) as inviter_name,
    i.expires_at,
    i.custom_message,
    i.status,
    (i.expires_at < now()) as expired,
    (i.status = 'accepted') as accepted
  INTO inv_record
  FROM invitations i
  JOIN organizations o ON o.id = i.organization_id
  JOIN organization_profiles op ON op.organization_id = o.id
  LEFT JOIN branches b ON b.id = i.branch_id
  LEFT JOIN branch_profiles bp ON bp.branch_id = b.id
  LEFT JOIN roles r ON r.id = i.role_id
  LEFT JOIN users u ON u.id = i.invited_by
  WHERE i.token = invitation_token
    AND i.deleted_at IS NULL;
  
  -- Check if invitation exists
  IF inv_record.id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text,
      NULL::uuid, NULL::text, NULL::text, NULL::timestamptz, NULL::text,
      false, 'Invalid invitation token';
    RETURN;
  END IF;
  
  -- Check if expired
  IF inv_record.expired THEN
    RETURN QUERY SELECT 
      inv_record.id, inv_record.email, inv_record.organization_id, inv_record.org_name,
      inv_record.branch_id, inv_record.branch_name, inv_record.role_id, inv_record.role_name,
      inv_record.inviter_name, inv_record.expires_at, inv_record.custom_message,
      false, 'Invitation has expired';
    RETURN;
  END IF;
  
  -- Check if already accepted
  IF inv_record.accepted THEN
    RETURN QUERY SELECT 
      inv_record.id, inv_record.email, inv_record.organization_id, inv_record.org_name,
      inv_record.branch_id, inv_record.branch_name, inv_record.role_id, inv_record.role_name,
      inv_record.inviter_name, inv_record.expires_at, inv_record.custom_message,
      false, 'Invitation has already been accepted';
    RETURN;
  END IF;
  
  -- Check if cancelled
  IF inv_record.status IN ('cancelled', 'expired') THEN
    RETURN QUERY SELECT 
      inv_record.id, inv_record.email, inv_record.organization_id, inv_record.org_name,
      inv_record.branch_id, inv_record.branch_name, inv_record.role_id, inv_record.role_name,
      inv_record.inviter_name, inv_record.expires_at, inv_record.custom_message,
      false, 'Invitation has been cancelled';
    RETURN;
  END IF;
  
  -- Valid invitation
  RETURN QUERY SELECT 
    inv_record.id, inv_record.email, inv_record.organization_id, inv_record.org_name,
    inv_record.branch_id, inv_record.branch_name, inv_record.role_id, inv_record.role_name,
    inv_record.inviter_name, inv_record.expires_at, inv_record.custom_message,
    true, NULL::text;
END;
$$;

-- Accept invitation and create user role assignment
CREATE OR REPLACE FUNCTION accept_invitation(
  invitation_token text,
  accepting_user_id uuid
)
RETURNS TABLE (
  success boolean,
  invitation_id uuid,
  organization_id uuid,
  role_assignment_id uuid,
  error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  inv_record record;
  validation_result record;
  assignment_id uuid;
BEGIN
  -- Validate the invitation
  SELECT * INTO validation_result
  FROM validate_invitation_token(invitation_token)
  LIMIT 1;
  
  IF NOT validation_result.is_valid THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, validation_result.error_message;
    RETURN;
  END IF;
  
  -- Get full invitation record
  SELECT * INTO inv_record
  FROM invitations
  WHERE token = invitation_token
    AND deleted_at IS NULL;
  
  -- Check if user already has access to this organization
  IF EXISTS (
    SELECT 1 FROM user_role_assignments
    WHERE user_id = accepting_user_id
      AND scope = 'organization'
      AND scope_id = inv_record.organization_id
      AND deleted_at IS NULL
  ) THEN
    -- User already has access, just mark invitation as accepted
    UPDATE invitations
    SET status = 'accepted',
        accepted_at = now(),
        accepted_by = accepting_user_id,
        updated_at = now()
    WHERE id = inv_record.id;
    
    RETURN QUERY SELECT true, inv_record.id, inv_record.organization_id, NULL::uuid, 'User already has access to organization'::text;
    RETURN;
  END IF;
  
  -- Assign role to user
  IF inv_record.role_id IS NOT NULL THEN
    assignment_id := assign_role_to_user(
      accepting_user_id,
      inv_record.role_id,
      CASE WHEN inv_record.branch_id IS NOT NULL THEN 'branch' ELSE 'organization' END,
      COALESCE(inv_record.branch_id, inv_record.organization_id),
      inv_record.invited_by,
      'Accepted invitation'
    );
  END IF;
  
  -- Mark invitation as accepted
  UPDATE invitations
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = accepting_user_id,
      updated_at = now()
  WHERE id = inv_record.id;
  
  -- Log invitation event
  INSERT INTO invitation_events (invitation_id, event_type, metadata)
  VALUES (inv_record.id, 'accepted', jsonb_build_object('accepted_by', accepting_user_id));
  
  -- Create onboarding record if needed
  INSERT INTO user_onboarding (user_id, organization_id, onboarding_type)
  VALUES (accepting_user_id, inv_record.organization_id, 'invitation')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN QUERY SELECT true, inv_record.id, inv_record.organization_id, assignment_id, NULL::text;
END;
$$;

-- Function to expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  expired_count integer;
BEGIN
  -- Update expired invitations
  WITH expired_invitations AS (
    UPDATE invitations
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'pending'
      AND expires_at < now()
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired_invitations;
  
  -- Log expiration events
  INSERT INTO invitation_events (invitation_id, event_type)
  SELECT id, 'expired'
  FROM invitations
  WHERE status = 'expired'
    AND updated_at >= now() - interval '1 minute'; -- Only recently expired
  
  RETURN expired_count;
END;
$$;

-- Function to cleanup old invitation events
CREATE OR REPLACE FUNCTION cleanup_old_invitation_events(retention_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted_events AS (
    DELETE FROM invitation_events
    WHERE created_at < now() - (retention_days || ' days')::interval
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_events;
  
  RETURN deleted_count;
END;
$$;

-- =============================================
-- AUTO INVITATION TOKEN GENERATION TRIGGER
-- =============================================

-- Trigger to auto-generate invitation token
CREATE OR REPLACE FUNCTION auto_generate_invitation_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.token IS NULL OR NEW.token = '' THEN
    NEW.token := generate_invitation_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_invitation_token_trigger
  BEFORE INSERT ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invitation_token();

-- =============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================

CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bulk_invitations_updated_at
  BEFORE UPDATE ON bulk_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invitation_templates_updated_at
  BEFORE UPDATE ON invitation_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SCHEDULED TASKS SETUP (for future use with pg_cron)
-- =============================================

-- Note: These would need to be set up manually with pg_cron extension
-- Example: SELECT cron.schedule('expire-invitations', '0 * * * *', 'SELECT expire_old_invitations();');
-- Example: SELECT cron.schedule('cleanup-events', '0 2 * * *', 'SELECT cleanup_old_invitation_events(90);');

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE invitations IS 'Comprehensive invitation system with status tracking and metadata';
COMMENT ON TABLE bulk_invitations IS 'Bulk invitation management with batch processing capabilities';
COMMENT ON TABLE invitation_templates IS 'Reusable invitation templates for organizations';
COMMENT ON TABLE invitation_events IS 'Event tracking for invitation lifecycle and analytics';

COMMENT ON FUNCTION generate_invitation_token IS 'Generates a unique, secure token for invitations';
COMMENT ON FUNCTION validate_invitation_token IS 'Validates an invitation token and returns invitation details';
COMMENT ON FUNCTION accept_invitation IS 'Accepts an invitation and assigns the user to the organization/role';
COMMENT ON FUNCTION expire_old_invitations IS 'Marks expired invitations and logs events';
COMMENT ON FUNCTION cleanup_old_invitation_events IS 'Removes old invitation events for data retention';