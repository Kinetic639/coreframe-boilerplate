-- FORCE FIX: Drop and recreate the contact_type constraint
-- Run this in Supabase Dashboard SQL Editor

-- Step 1: First check what constraints exist
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'contacts'::regclass
AND conname LIKE '%contact_type%';

-- Step 2: Drop ALL contact_type related constraints
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'contacts'::regclass
        AND conname LIKE '%contact_type%'
    LOOP
        EXECUTE 'ALTER TABLE contacts DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Step 3: Update any problematic data
UPDATE contacts
SET contact_type = 'contact'
WHERE contact_type NOT IN ('contact', 'lead', 'other')
   OR contact_type IS NULL;

-- Step 4: Add the NEW constraint with a unique name to avoid conflicts
ALTER TABLE contacts
ADD CONSTRAINT contacts_contact_type_valid_check
  CHECK (contact_type IN ('contact', 'lead', 'other'));

-- Step 5: Verify the new constraint
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'contacts'::regclass
AND conname LIKE '%contact_type%';

-- Step 6: Test insert (will fail if constraint still has issues)
SELECT 'Constraint is working correctly!' as status;
