-- =============================================
-- Add Row Level Security Policies for Contacts Table
-- =============================================

-- Enable RLS on contacts table
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to view all contacts
-- Visibility filtering is handled at application level
CREATE POLICY "contacts_select_policy" ON contacts
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow all authenticated users to insert contacts
CREATE POLICY "contacts_insert_policy" ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow all authenticated users to update contacts
CREATE POLICY "contacts_update_policy" ON contacts
  FOR UPDATE
  TO authenticated
  USING (true);

-- Policy: Allow all authenticated users to delete contacts
CREATE POLICY "contacts_delete_policy" ON contacts
  FOR DELETE
  TO authenticated
  USING (true);

-- Enable RLS on contact_addresses table
ALTER TABLE contact_addresses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage contact addresses
CREATE POLICY "contact_addresses_all_policy" ON contact_addresses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
