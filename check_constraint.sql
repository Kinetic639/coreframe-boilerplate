-- Check the current constraint definition
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'contacts'::regclass
AND contype = 'c';

-- Also check contact_type values in the table
SELECT contact_type, COUNT(*)
FROM contacts
GROUP BY contact_type;
