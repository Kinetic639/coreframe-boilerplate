-- =============================================
-- Migration: Add Business Account Contacts Link Table
-- Description: Allow multiple contacts per business account with primary designation
-- =============================================

-- Create junction table to link business_accounts with multiple contacts
CREATE TABLE IF NOT EXISTS business_account_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Relationship metadata
  is_primary BOOLEAN DEFAULT false,
  position TEXT, -- e.g., "CEO", "Sales Manager", "Accountant"
  department TEXT, -- e.g., "Sales", "Finance", "IT"
  notes TEXT,

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Ensure unique contact per business account
  UNIQUE(business_account_id, contact_id)
);

-- Create unique index for only one primary contact per business account
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_account_contacts_primary
  ON business_account_contacts(business_account_id)
  WHERE is_primary = true AND deleted_at IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_account_contacts_business_account_id
  ON business_account_contacts(business_account_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_account_contacts_contact_id
  ON business_account_contacts(contact_id) WHERE deleted_at IS NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_business_account_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_business_account_contacts_updated_at ON business_account_contacts;
CREATE TRIGGER update_business_account_contacts_updated_at
  BEFORE UPDATE ON business_account_contacts
  FOR EACH ROW EXECUTE FUNCTION update_business_account_contacts_updated_at();

-- Add comments
COMMENT ON TABLE business_account_contacts IS 'Links multiple contacts to business accounts (vendors/customers)';
COMMENT ON COLUMN business_account_contacts.is_primary IS 'Designates the primary contact for this business account';
COMMENT ON COLUMN business_account_contacts.position IS 'Contact''s position/title at the business';
COMMENT ON COLUMN business_account_contacts.department IS 'Contact''s department at the business';

-- Note: The business_accounts.contact_id column can remain for backward compatibility
-- but new code should use business_account_contacts table for multiple contacts
COMMENT ON COLUMN business_accounts.contact_id IS 'DEPRECATED: Use business_account_contacts table instead. Kept for backward compatibility.';
