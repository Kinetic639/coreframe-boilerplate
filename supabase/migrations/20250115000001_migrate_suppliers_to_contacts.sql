-- =============================================
-- Migrate Existing Suppliers to Unified Contacts System
-- =============================================

-- Migrate suppliers to contacts table
INSERT INTO contacts (
  id,
  organization_id,
  contact_type,
  entity_type,
  company_name,
  display_name,
  primary_email,
  work_phone,
  mobile_phone,
  website,
  payment_terms,
  tax_registration_number,
  company_id_number,
  notes,
  tags,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  gen_random_uuid() as id,
  s.organization_id,
  'vendor' as contact_type,
  'business' as entity_type,
  s.name as company_name,
  s.name as display_name,
  NULL as primary_email, -- Not in suppliers table
  NULL as work_phone, -- Not in suppliers table
  NULL as mobile_phone, -- Not in suppliers table
  s.website,
  s.payment_terms,
  s.tax_number as tax_registration_number,
  s.company_registration_number as company_id_number,
  s.notes,
  COALESCE(s.tags, ARRAY[]::TEXT[]) as tags,
  s.created_at,
  s.updated_at,
  s.deleted_at
FROM suppliers s
WHERE NOT EXISTS (
  SELECT 1 FROM contacts c WHERE c.company_name = s.name AND c.organization_id = s.organization_id
)
ON CONFLICT DO NOTHING;

-- Update suppliers table with contact_id references
UPDATE suppliers s
SET contact_id = c.id
FROM contacts c
WHERE c.company_name = s.name
  AND c.organization_id = s.organization_id
  AND c.contact_type = 'vendor'
  AND s.contact_id IS NULL;

-- Migrate supplier addresses to contact_addresses (billing)
INSERT INTO contact_addresses (
  contact_id,
  address_type,
  is_default,
  address_line_1,
  address_line_2,
  city,
  state_province,
  postal_code,
  country,
  created_at,
  updated_at
)
SELECT
  c.id as contact_id,
  'billing' as address_type,
  true as is_default,
  s.address_line_1,
  s.address_line_2,
  s.city,
  s.state_province,
  s.postal_code,
  s.country,
  s.created_at,
  s.updated_at
FROM suppliers s
JOIN contacts c ON c.id = s.contact_id
WHERE s.contact_id IS NOT NULL
  AND (
    s.address_line_1 IS NOT NULL OR
    s.city IS NOT NULL OR
    s.postal_code IS NOT NULL
  )
ON CONFLICT DO NOTHING;

-- Migrate supplier_contacts to contact_persons
INSERT INTO contact_persons (
  contact_id,
  salutation,
  first_name,
  last_name,
  email,
  work_phone,
  mobile_phone,
  designation,
  department,
  is_primary,
  is_active,
  notes,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  c.id as contact_id,
  NULL as salutation, -- Not in supplier_contacts
  sc.first_name,
  sc.last_name,
  sc.email,
  sc.phone as work_phone,
  sc.mobile as mobile_phone,
  sc.position as designation,
  sc.department,
  COALESCE(sc.is_primary, false) as is_primary,
  COALESCE(sc.is_active, true) as is_active,
  sc.notes,
  sc.created_at,
  sc.updated_at,
  sc.deleted_at
FROM supplier_contacts sc
JOIN suppliers s ON s.id = sc.supplier_id
JOIN contacts c ON c.id = s.contact_id
WHERE s.contact_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON COLUMN suppliers.contact_id IS 'Link to unified contacts table (for backward compatibility)';
