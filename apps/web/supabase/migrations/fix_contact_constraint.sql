-- Fix contact_type constraint issue
-- This script updates existing data and recreates the constraint

-- Step 1: Update any existing contacts with old contact_type values
UPDATE contacts
SET contact_type = 'contact'
WHERE contact_type IN ('customer', 'vendor', 'employee')
  OR contact_type IS NULL;

-- Step 2: Drop the old constraint if it exists
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_contact_type_check;

-- Step 3: Add the new constraint
ALTER TABLE contacts
ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IN ('contact', 'lead', 'other'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'contacts'::regclass
AND conname = 'contacts_contact_type_check';
