-- =============================================
-- Migration: Create units of measure table
-- Simple table for organization units - no RLS
-- =============================================

CREATE TABLE units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  symbol TEXT,

  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_units_of_measure_org ON units_of_measure(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_units_of_measure_name ON units_of_measure(organization_id, name) WHERE deleted_at IS NULL;

-- Update timestamp trigger
CREATE TRIGGER update_units_of_measure_updated_at
  BEFORE UPDATE ON units_of_measure
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
