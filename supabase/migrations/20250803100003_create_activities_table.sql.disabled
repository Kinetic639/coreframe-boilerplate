-- Create activities table with normalized references
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization/Branch context
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID REFERENCES branches(id), -- nullable for org-level activities
  user_id UUID REFERENCES users(id), -- nullable for system activities

  -- Normalized references
  module_id UUID REFERENCES activity_modules(id),
  entity_type_id UUID REFERENCES activity_entity_types(id),
  action_id UUID REFERENCES activity_actions(id),

  -- Entity and description
  entity_id UUID, -- ID of the affected entity
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Status tracking
  status TEXT DEFAULT 'recorded' CHECK (
    status IN ('recorded', 'processed', 'archived', 'error')
  ),

  -- Request context
  url TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id UUID,

  -- Comprehensive timestamp tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- Enable RLS for activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Performance indexes
CREATE INDEX idx_activities_org_branch ON activities(organization_id, branch_id);
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_entity ON activities(entity_type_id, entity_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);
CREATE INDEX idx_activities_deleted_at ON activities(deleted_at);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_module ON activities(module_id);

-- Composite indexes for common queries
CREATE INDEX idx_activities_org_module_created ON activities(organization_id, module_id, created_at DESC);
CREATE INDEX idx_activities_user_created ON activities(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_active ON activities(organization_id, created_at DESC) WHERE deleted_at IS NULL;

-- Trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_activities_updated_at 
  BEFORE UPDATE ON activities 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for activities

-- Policy: Users can read activities from their organization/branches
CREATE POLICY "activities_read_policy" ON activities
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      organization_id IN (
        SELECT ura.organization_id
        FROM user_role_assignments ura
        WHERE ura.user_id = auth.uid()
      )
      OR
      (branch_id IS NOT NULL AND branch_id IN (
        SELECT ura.branch_id
        FROM user_role_assignments ura
        WHERE ura.user_id = auth.uid()
        AND ura.branch_id IS NOT NULL
      ))
    )
    AND deleted_at IS NULL
  );

-- Policy: Service role can do everything
CREATE POLICY "activities_service_policy" ON activities
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Users can insert activities for their org/branch context
CREATE POLICY "activities_insert_policy" ON activities
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      organization_id IN (
        SELECT ura.organization_id
        FROM user_role_assignments ura
        WHERE ura.user_id = auth.uid()
      )
    )
  );

-- Policy: Users can update activities they created (for status updates)
CREATE POLICY "activities_update_policy" ON activities
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    user_id = auth.uid() AND
    deleted_at IS NULL
  )
  WITH CHECK (
    user_id = auth.uid() AND
    deleted_at IS NULL
  );