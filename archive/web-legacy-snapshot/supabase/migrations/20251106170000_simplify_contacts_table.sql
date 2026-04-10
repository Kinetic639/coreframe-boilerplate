-- =============================================
-- Migration: Simplify Contacts Table
-- Description: Remove business-related fields from contacts table
--              Contacts should be simple people/persons, not business entities
--              Business logic belongs in business_accounts table
-- =============================================

-- Add tags column for categorizing contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Drop business-related columns that don't belong in a contact book
ALTER TABLE contacts
DROP COLUMN IF EXISTS currency_code,
DROP COLUMN IF EXISTS language_code,
DROP COLUMN IF EXISTS payment_terms,
DROP COLUMN IF EXISTS credit_limit,
DROP COLUMN IF EXISTS opening_balance,
DROP COLUMN IF EXISTS tax_exempt,
DROP COLUMN IF EXISTS tax_registration_number,
DROP COLUMN IF EXISTS tax_rate,
DROP COLUMN IF EXISTS company_id_number,
DROP COLUMN IF EXISTS portal_enabled,
DROP COLUMN IF EXISTS portal_language,
DROP COLUMN IF EXISTS price_list_id,
DROP COLUMN IF EXISTS metadata,
DROP COLUMN IF EXISTS company_name,
DROP COLUMN IF EXISTS entity_type;

-- Drop contact_persons table (contacts ARE persons, not containers for persons)
DROP TABLE IF EXISTS contact_persons CASCADE;

-- Drop price list related tables (business logic)
DROP TABLE IF EXISTS contact_price_lists CASCADE;

-- Add comments
COMMENT ON COLUMN contacts.tags IS 'Tags for categorizing contacts (e.g., partner, vendor-contact, client-contact)';
COMMENT ON TABLE contacts IS 'Simple contact book for people/persons. Business entities are in business_accounts table.';

-- Create index on tags for faster filtering
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
