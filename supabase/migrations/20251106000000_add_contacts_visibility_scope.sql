-- =============================================
-- Add Visibility Scope to Contacts System
-- =============================================

DO $$
BEGIN
  -- Add visibility scope column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'visibility_scope'
  ) THEN
    ALTER TABLE contacts
    ADD COLUMN visibility_scope TEXT NOT NULL
      CHECK (visibility_scope IN ('private', 'branch', 'organization'))
      DEFAULT 'organization';
  END IF;

  -- Add owner_user_id for private contacts if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE contacts
    ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add branch_id for branch-scoped contacts if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE contacts
    ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_visibility_scope
  ON contacts(visibility_scope) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_owner_user
  ON contacts(owner_user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_branch
  ON contacts(branch_id) WHERE deleted_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN contacts.visibility_scope IS 'Contact visibility: private (user only), branch (branch members), organization (all org members)';
COMMENT ON COLUMN contacts.owner_user_id IS 'User who created/owns the contact (required for private contacts)';
COMMENT ON COLUMN contacts.branch_id IS 'Branch for branch-scoped contacts';

-- Update existing contacts with old types before changing constraint
UPDATE contacts
SET contact_type = 'contact'
WHERE contact_type IN ('customer', 'vendor', 'employee')
  OR contact_type IS NULL;

-- Update contact_type check constraint to only allow: contact, lead, other
-- Remove customer and vendor as they are separate entities
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_contact_type_check;

  -- Add new constraint with updated values
  ALTER TABLE contacts
  ADD CONSTRAINT contacts_contact_type_check
    CHECK (contact_type IN ('contact', 'lead', 'other'));

EXCEPTION
  WHEN OTHERS THEN
    -- If constraint doesn't exist or other error, just continue
    NULL;
END $$;

-- Update existing contacts to have default visibility_scope if needed
UPDATE contacts
SET visibility_scope = 'organization'
WHERE visibility_scope IS NULL;
