-- =============================================
-- Add branch_admin role to roles table
-- =============================================

INSERT INTO roles (id, slug, label, description)
SELECT gen_random_uuid(), 'branch_admin', 'Branch Admin', 'Administers a specific branch'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE slug = 'branch_admin'
); 