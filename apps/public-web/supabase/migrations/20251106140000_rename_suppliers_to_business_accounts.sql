-- =============================================
-- Migration: Rename suppliers table to business_accounts
-- Description: Refactor suppliers table to business_accounts to better reflect
--              that it contains both vendors (suppliers) and customers (clients)
-- =============================================

-- Step 1: Rename the table
ALTER TABLE suppliers RENAME TO business_accounts;

-- Step 2: Add partner_type column to distinguish between vendors and customers
ALTER TABLE business_accounts
ADD COLUMN partner_type text NOT NULL DEFAULT 'vendor'
CHECK (partner_type IN ('vendor', 'customer'));

-- Step 3: Add comment to the table
COMMENT ON TABLE business_accounts IS 'Business partners including both vendors (suppliers) and customers (clients)';
COMMENT ON COLUMN business_accounts.partner_type IS 'Type of business partner: vendor (supplier) or customer (client)';

-- Step 4: Update foreign key constraints in products table
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_preferred_vendor_id_fkey;

ALTER TABLE products
RENAME COLUMN preferred_vendor_id TO preferred_business_account_id;

ALTER TABLE products
ADD CONSTRAINT products_preferred_business_account_id_fkey
FOREIGN KEY (preferred_business_account_id) REFERENCES business_accounts(id) ON DELETE SET NULL;

-- Step 5: Update foreign key constraints in incoming_deliveries table (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incoming_deliveries' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE incoming_deliveries DROP CONSTRAINT IF EXISTS incoming_deliveries_supplier_id_fkey;
    ALTER TABLE incoming_deliveries RENAME COLUMN supplier_id TO business_account_id;
    ALTER TABLE incoming_deliveries ADD CONSTRAINT incoming_deliveries_business_account_id_fkey
      FOREIGN KEY (business_account_id) REFERENCES business_accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 6: Update indexes
DROP INDEX IF EXISTS idx_suppliers_organization_id;
DROP INDEX IF EXISTS idx_suppliers_deleted_at;
DROP INDEX IF EXISTS idx_suppliers_contact_id;

CREATE INDEX idx_business_accounts_organization_id ON business_accounts(organization_id);
CREATE INDEX idx_business_accounts_deleted_at ON business_accounts(deleted_at);
CREATE INDEX idx_business_accounts_partner_type ON business_accounts(partner_type);
CREATE INDEX IF NOT EXISTS idx_business_accounts_contact_id ON business_accounts(contact_id);

-- Step 7: Update RLS policies (if any exist)
DROP POLICY IF EXISTS suppliers_org_isolation ON business_accounts;

-- Note: RLS policies will be added separately if needed
-- CREATE POLICY business_accounts_org_isolation ON business_accounts
-- FOR ALL
-- USING (auth.uid() IS NOT NULL);

-- Step 8: Update index on products table
DROP INDEX IF EXISTS idx_products_preferred_vendor_id;
CREATE INDEX idx_products_preferred_business_account_id ON products(preferred_business_account_id);

-- Step 9: Update index on incoming_deliveries table (if exists)
DROP INDEX IF EXISTS idx_incoming_deliveries_supplier_id;
DROP INDEX IF EXISTS idx_incoming_deliveries_business_account_id;
