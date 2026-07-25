-- Create activity_entity_types table for normalized entity type references
CREATE TABLE activity_entity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  module_id UUID REFERENCES activity_modules(id) ON DELETE SET NULL,
  table_name TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for activity_entity_types
ALTER TABLE activity_entity_types ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to all authenticated users
CREATE POLICY "activity_entity_types_read_policy" ON activity_entity_types
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only service role can insert/update/delete
CREATE POLICY "activity_entity_types_service_policy" ON activity_entity_types
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create indexes for efficient lookups
CREATE INDEX idx_activity_entity_types_slug ON activity_entity_types(slug);
CREATE INDEX idx_activity_entity_types_module_id ON activity_entity_types(module_id);

-- Insert initial entity type data
INSERT INTO activity_entity_types (slug, module_id, table_name, description) VALUES
  ('product', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'products', 'Product entities'),
  ('product_variant', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'product_variants', 'Product variant entities'),
  ('location', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'locations', 'Storage location entities'),
  ('supplier', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'suppliers', 'Supplier entities'),
  ('delivery', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'deliveries', 'Delivery entities'),
  ('stock_movement', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'stock_movements', 'Stock movement entities'),
  ('audit', (SELECT id FROM activity_modules WHERE slug = 'warehouse'), 'audits', 'Audit entities'),
  ('user', (SELECT id FROM activity_modules WHERE slug = 'organization'), 'users', 'User entities'),
  ('branch', (SELECT id FROM activity_modules WHERE slug = 'organization'), 'branches', 'Branch entities'),
  ('organization', (SELECT id FROM activity_modules WHERE slug = 'organization'), 'organizations', 'Organization entities'),
  ('role', (SELECT id FROM activity_modules WHERE slug = 'organization'), 'roles', 'Role entities'),
  ('permission', (SELECT id FROM activity_modules WHERE slug = 'organization'), 'permissions', 'Permission entities'),
  ('team', (SELECT id FROM activity_modules WHERE slug = 'teams'), 'teams', 'Team entities'),
  ('project', (SELECT id FROM activity_modules WHERE slug = 'teams'), 'projects', 'Project entities'),
  ('task', (SELECT id FROM activity_modules WHERE slug = 'teams'), 'tasks', 'Task entities'),
  ('ticket', (SELECT id FROM activity_modules WHERE slug = 'support'), 'support_tickets', 'Support ticket entities'),
  ('session', (SELECT id FROM activity_modules WHERE slug = 'security'), 'user_sessions', 'User session entities'),
  ('report', (SELECT id FROM activity_modules WHERE slug = 'analytics'), 'reports', 'Report entities'),
  ('dashboard', (SELECT id FROM activity_modules WHERE slug = 'analytics'), 'dashboards', 'Dashboard entities');