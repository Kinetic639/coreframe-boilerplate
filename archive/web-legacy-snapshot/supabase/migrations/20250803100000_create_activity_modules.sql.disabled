-- Create activity_modules table for normalized module references
CREATE TABLE activity_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for activity_modules
ALTER TABLE activity_modules ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to all authenticated users
CREATE POLICY "activity_modules_read_policy" ON activity_modules
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only service role can insert/update/delete
CREATE POLICY "activity_modules_service_policy" ON activity_modules
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create index for efficient slug lookups
CREATE INDEX idx_activity_modules_slug ON activity_modules(slug);

-- Insert initial module data
INSERT INTO activity_modules (slug, name) VALUES
  ('warehouse', 'Warehouse Management'),
  ('catalog', 'Product Catalog'),
  ('organization', 'Organization Management'),
  ('teams', 'Team Collaboration'),
  ('support', 'Support & Help'),
  ('system', 'System Operations'),
  ('security', 'Security & Authentication'),
  ('analytics', 'Analytics & Reports');