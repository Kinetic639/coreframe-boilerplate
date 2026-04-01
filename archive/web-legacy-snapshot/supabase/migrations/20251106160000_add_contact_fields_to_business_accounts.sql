-- =============================================
-- Migration: Add contact fields to business_accounts
-- Description: Add email and phone fields for direct contact info
-- =============================================

-- Add email and phone fields
ALTER TABLE business_accounts
ADD COLUMN email text,
ADD COLUMN phone text;

-- Add comments
COMMENT ON COLUMN business_accounts.email IS 'Primary email address for the business account';
COMMENT ON COLUMN business_accounts.phone IS 'Primary phone number for the business account';

-- Add index on email for faster lookups
CREATE INDEX idx_business_accounts_email ON business_accounts(email) WHERE email IS NOT NULL;
