-- Create activity_actions table for normalized action references
CREATE TABLE activity_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for activity_actions
ALTER TABLE activity_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to all authenticated users
CREATE POLICY "activity_actions_read_policy" ON activity_actions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only service role can insert/update/delete
CREATE POLICY "activity_actions_service_policy" ON activity_actions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create index for efficient slug lookups
CREATE INDEX idx_activity_actions_slug ON activity_actions(slug);

-- Insert initial action data
INSERT INTO activity_actions (slug, description) VALUES
  ('created', 'Entity was created'),
  ('updated', 'Entity was updated'),
  ('deleted', 'Entity was deleted'),
  ('restored', 'Entity was restored from deletion'),
  ('activated', 'Entity was activated'),
  ('deactivated', 'Entity was deactivated'),
  ('moved', 'Entity was moved or transferred'),
  ('assigned', 'Entity was assigned'),
  ('unassigned', 'Entity was unassigned'),
  ('processed', 'Entity was processed'),
  ('completed', 'Process was completed'),
  ('failed', 'Process failed'),
  ('cancelled', 'Process was cancelled'),
  ('started', 'Process was started'),
  ('paused', 'Process was paused'),
  ('resumed', 'Process was resumed'),
  ('approved', 'Entity was approved'),
  ('rejected', 'Entity was rejected'),
  ('reviewed', 'Entity was reviewed'),
  ('published', 'Entity was published'),
  ('archived', 'Entity was archived'),
  ('exported', 'Data was exported'),
  ('imported', 'Data was imported'),
  ('accessed', 'Entity was accessed'),
  ('viewed', 'Entity was viewed'),
  ('downloaded', 'Entity was downloaded'),
  ('uploaded', 'Entity was uploaded'),
  ('synchronized', 'Entity was synchronized'),
  ('logged_in', 'User logged in'),
  ('logged_out', 'User logged out'),
  ('invited', 'User was invited'),
  ('joined', 'User joined'),
  ('left', 'User left'),
  ('promoted', 'User was promoted'),
  ('demoted', 'User was demoted'),
  ('suspended', 'User was suspended'),
  ('unsuspended', 'User was unsuspended'),
  ('verified', 'Entity was verified'),
  ('unverified', 'Entity was unverified');