-- Fix RLS policies for suppliers table
DROP POLICY IF EXISTS "suppliers_select_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete_policy" ON suppliers;

-- Create proper RLS policies for suppliers
CREATE POLICY "suppliers_select_policy" ON suppliers
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "suppliers_insert_policy" ON suppliers
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "suppliers_update_policy" ON suppliers
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  ) WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "suppliers_delete_policy" ON suppliers
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- Fix RLS policies for supplier_contacts table
DROP POLICY IF EXISTS "supplier_contacts_select_policy" ON supplier_contacts;
DROP POLICY IF EXISTS "supplier_contacts_insert_policy" ON supplier_contacts;
DROP POLICY IF EXISTS "supplier_contacts_update_policy" ON supplier_contacts;
DROP POLICY IF EXISTS "supplier_contacts_delete_policy" ON supplier_contacts;

-- Create proper RLS policies for supplier_contacts
CREATE POLICY "supplier_contacts_select_policy" ON supplier_contacts
  FOR SELECT USING (
    supplier_id IN (
      SELECT id FROM suppliers 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "supplier_contacts_insert_policy" ON supplier_contacts
  FOR INSERT WITH CHECK (
    supplier_id IN (
      SELECT id FROM suppliers 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "supplier_contacts_update_policy" ON supplier_contacts
  FOR UPDATE USING (
    supplier_id IN (
      SELECT id FROM suppliers 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  ) WITH CHECK (
    supplier_id IN (
      SELECT id FROM suppliers 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "supplier_contacts_delete_policy" ON supplier_contacts
  FOR DELETE USING (
    supplier_id IN (
      SELECT id FROM suppliers 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );