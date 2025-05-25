-- =============================================
-- Add created_by to organizations table
-- =============================================

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id); 