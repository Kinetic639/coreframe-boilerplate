-- =============================================
-- Migration: Add entity_type to business_accounts
-- Description: Add entity_type column to support both business and individual clients
-- =============================================

-- Add entity_type column
ALTER TABLE business_accounts
ADD COLUMN entity_type text NOT NULL DEFAULT 'business'
CHECK (entity_type IN ('business', 'individual'));

-- Add individual person fields for when entity_type = 'individual'
ALTER TABLE business_accounts
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Add comment
COMMENT ON COLUMN business_accounts.entity_type IS 'Type of entity: business (company) or individual (person)';
COMMENT ON COLUMN business_accounts.first_name IS 'First name when entity_type is individual';
COMMENT ON COLUMN business_accounts.last_name IS 'Last name when entity_type is individual';

-- Add index on entity_type for faster filtering
CREATE INDEX idx_business_accounts_entity_type ON business_accounts(entity_type);

-- Add validation constraint: business entities must have name, individuals can have first/last name
-- Note: This is a soft constraint - we'll handle validation in the application layer
-- since some businesses might use individual names and vice versa
