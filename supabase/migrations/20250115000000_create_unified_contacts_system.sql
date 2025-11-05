-- =============================================
-- Unified Contacts System (Zoho-style)
-- No RLS policies - to be added later
-- =============================================

-- Main contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Contact Type & Entity Type
  contact_type TEXT NOT NULL CHECK (contact_type IN ('customer', 'vendor', 'lead', 'employee', 'other')) DEFAULT 'customer',
  entity_type TEXT NOT NULL CHECK (entity_type IN ('business', 'individual')) DEFAULT 'business',

  -- Individual Fields
  salutation TEXT CHECK (salutation IN ('Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Mx', NULL)),
  first_name TEXT,
  last_name TEXT,

  -- Business Fields
  company_name TEXT,
  display_name TEXT NOT NULL,

  -- Contact Information
  primary_email TEXT,
  work_phone TEXT,
  mobile_phone TEXT,
  fax TEXT,
  website TEXT,

  -- Preferences
  language_code TEXT DEFAULT 'en',
  currency_code TEXT DEFAULT 'PLN',
  payment_terms TEXT,

  -- Financial
  credit_limit DECIMAL(15, 2),
  opening_balance DECIMAL(15, 2) DEFAULT 0,
  tax_exempt BOOLEAN DEFAULT false,
  tax_registration_number TEXT,
  tax_rate DECIMAL(5, 2),
  company_id_number TEXT, -- Company ID field from Zoho

  -- Portal
  portal_enabled BOOLEAN DEFAULT false,
  portal_language TEXT DEFAULT 'en',

  -- Additional Info
  price_list_id UUID, -- Will reference price_lists after it's created
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT entity_type_validation CHECK (
    (entity_type = 'individual' AND first_name IS NOT NULL) OR
    (entity_type = 'business' AND company_name IS NOT NULL)
  )
);

-- Contact addresses (multiple per contact)
CREATE TABLE IF NOT EXISTS contact_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  address_type TEXT NOT NULL CHECK (address_type IN ('billing', 'shipping', 'both')) DEFAULT 'billing',
  is_default BOOLEAN DEFAULT false,

  -- Address Fields
  attention_to TEXT,
  country TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  phone TEXT,
  fax_number TEXT,

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create unique index for only one default address per type per contact
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_addresses_default_per_type
  ON contact_addresses(contact_id, address_type)
  WHERE is_default = true AND deleted_at IS NULL;

-- Contact persons (multiple contacts per vendor/customer)
CREATE TABLE IF NOT EXISTS contact_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  salutation TEXT CHECK (salutation IN ('Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Mx', NULL)),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  work_phone TEXT,
  mobile_phone TEXT,
  designation TEXT,
  department TEXT,

  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  notes TEXT,

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create unique index for only one primary contact person per contact
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_persons_primary
  ON contact_persons(contact_id)
  WHERE is_primary = true AND deleted_at IS NULL;

-- Custom field definitions (organization-scoped)
CREATE TABLE IF NOT EXISTS contact_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox', 'url', 'email')),
  field_options JSONB, -- For dropdown: ["Option 1", "Option 2"]

  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  applies_to TEXT[] DEFAULT ARRAY['customer', 'vendor']::TEXT[], -- Which contact types

  display_order INT DEFAULT 0,
  help_text TEXT,

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create unique index for field names per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_field_defs_unique_name
  ON contact_custom_field_definitions(organization_id, field_name)
  WHERE deleted_at IS NULL;

-- Custom field values
CREATE TABLE IF NOT EXISTS contact_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES contact_custom_field_definitions(id) ON DELETE CASCADE,

  -- Value storage (use appropriate field based on field_type)
  value_text TEXT,
  value_number DECIMAL(15, 4),
  value_date DATE,
  value_boolean BOOLEAN,

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(contact_id, field_definition_id)
);

-- Price lists
CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  currency_code TEXT DEFAULT 'PLN',
  percentage_adjustment DECIMAL(5, 2) DEFAULT 0, -- +10% or -5%
  rounding_method TEXT CHECK (rounding_method IN ('none', 'nearest', 'up', 'down')) DEFAULT 'none',

  is_active BOOLEAN DEFAULT true,

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create unique index for price list names per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_lists_unique_name
  ON price_lists(organization_id, name)
  WHERE deleted_at IS NULL;

-- Contact price list assignment (many-to-many)
CREATE TABLE IF NOT EXISTS contact_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(contact_id, price_list_id)
);

-- Contact documents/attachments
CREATE TABLE IF NOT EXISTS contact_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL, -- Supabase Storage path

  document_type TEXT CHECK (document_type IN ('contract', 'certificate', 'license', 'invoice', 'quote', 'other')) DEFAULT 'other',
  description TEXT,

  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON contacts(contact_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_entity_type ON contacts(entity_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts(display_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_primary_email ON contacts(primary_email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING gin(tags) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_addresses_contact_id ON contact_addresses(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contact_addresses_type ON contact_addresses(address_type) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_persons_contact_id ON contact_persons(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contact_persons_email ON contact_persons(email) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_org_id ON contact_custom_field_definitions(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_custom_field_values_contact_id ON contact_custom_field_values(contact_id);

CREATE INDEX IF NOT EXISTS idx_price_lists_organization_id ON price_lists(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_documents_contact_id ON contact_documents(contact_id) WHERE deleted_at IS NULL;

-- =============================================
-- Add foreign key constraint to contacts for price_list_id
-- =============================================

ALTER TABLE contacts
ADD CONSTRAINT fk_contacts_price_list
FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE SET NULL;

-- =============================================
-- Update existing suppliers table for backward compatibility
-- =============================================

-- Add contact_id to suppliers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_suppliers_contact_id ON suppliers(contact_id);
  END IF;
END $$;

-- =============================================
-- Updated At Trigger Function
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contact_addresses_updated_at ON contact_addresses;
CREATE TRIGGER update_contact_addresses_updated_at BEFORE UPDATE ON contact_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contact_persons_updated_at ON contact_persons;
CREATE TRIGGER update_contact_persons_updated_at BEFORE UPDATE ON contact_persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_field_defs_updated_at ON contact_custom_field_definitions;
CREATE TRIGGER update_custom_field_defs_updated_at BEFORE UPDATE ON contact_custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_field_values_updated_at ON contact_custom_field_values;
CREATE TRIGGER update_custom_field_values_updated_at BEFORE UPDATE ON contact_custom_field_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_price_lists_updated_at ON price_lists;
CREATE TRIGGER update_price_lists_updated_at BEFORE UPDATE ON price_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON TABLE contacts IS 'Unified contacts table for customers, vendors, employees, and leads (Zoho-style)';
COMMENT ON TABLE contact_addresses IS 'Multiple addresses per contact (billing, shipping)';
COMMENT ON TABLE contact_persons IS 'Multiple contact persons per vendor/customer';
COMMENT ON TABLE contact_custom_field_definitions IS 'Dynamic custom field definitions per organization';
COMMENT ON TABLE contact_custom_field_values IS 'Custom field values for contacts';
COMMENT ON TABLE price_lists IS 'Customer-specific pricing lists';
COMMENT ON TABLE contact_price_lists IS 'Link table between contacts and price lists';
COMMENT ON TABLE contact_documents IS 'Document attachments for contacts';
