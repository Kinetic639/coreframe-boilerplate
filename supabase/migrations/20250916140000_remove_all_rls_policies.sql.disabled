-- =============================================
-- Migration: Remove all RLS policies temporarily
-- We will implement comprehensive RLS in a separate security-focused task
-- =============================================

-- Drop RLS policies from product_templates
DROP POLICY IF EXISTS "Users can view system templates and org templates" ON product_templates;
DROP POLICY IF EXISTS "Users can create org templates" ON product_templates;
DROP POLICY IF EXISTS "Users can update own org templates" ON product_templates;
DROP POLICY IF EXISTS "Users can delete own org templates" ON product_templates;

-- Drop RLS policies from product_attribute_definitions
DROP POLICY IF EXISTS "Users can view attribute definitions" ON product_attribute_definitions;
DROP POLICY IF EXISTS "Users can manage attribute definitions for their templates" ON product_attribute_definitions;

-- Disable RLS on these tables for now
ALTER TABLE product_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_attribute_definitions DISABLE ROW LEVEL SECURITY;

-- Disable RLS on all flexible product system tables
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_attributes DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_request_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE movement_types DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE products IS 'Core products table - RLS will be implemented in security phase';
COMMENT ON TABLE product_templates IS 'Product templates - RLS will be implemented in security phase';