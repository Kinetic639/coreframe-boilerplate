-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inventory_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock_locations ENABLE ROW LEVEL SECURITY;

-- Products
CREATE POLICY authenticated_select_products
  ON products
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY authenticated_insert_products
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY authenticated_update_products
  ON products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY authenticated_soft_delete_products
  ON products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Product Variants
CREATE POLICY authenticated_select_product_variants
  ON product_variants
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY authenticated_insert_product_variants
  ON product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY authenticated_update_product_variants
  ON product_variants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Product Inventory Data
CREATE POLICY authenticated_select_product_inventory_data
  ON product_inventory_data
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY authenticated_insert_product_inventory_data
  ON product_inventory_data
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY authenticated_update_product_inventory_data
  ON product_inventory_data
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Product Stock Locations
CREATE POLICY authenticated_select_product_stock_locations
  ON product_stock_locations
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY authenticated_insert_product_stock_locations
  ON product_stock_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY authenticated_update_product_stock_locations
  ON product_stock_locations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_inventory_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_stock_locations TO authenticated;

-- Grant access to sequences (if needed)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
