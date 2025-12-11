-- =====================================================
-- Phase 1: Migrate Reorder Points to Branch Settings
-- =====================================================
-- This migration migrates existing product-level inventory settings
-- to the new product_branch_settings table for all branches.
--
-- Strategy:
-- - Copy global reorder_point to ALL branches
-- - Each warehouse starts with same settings
-- - Warehouses can customize later via UI
--
-- Migration ID: 20251118000006
-- Phase: 1 - Foundation
-- =====================================================

-- Migrate existing product settings to all branches
-- Note: min_stock_level and lead_time_days don't exist in products table,
-- so they will be NULL initially. Warehouses can set them later via UI.
INSERT INTO product_branch_settings (
  product_id,
  branch_id,
  organization_id,
  reorder_point,
  max_stock_level,
  reorder_quantity,
  reorder_calculation_method,
  track_inventory,
  send_low_stock_alerts
)
SELECT
  p.id as product_id,
  b.id as branch_id,
  p.organization_id,
  p.reorder_point,
  p.max_stock_level,
  p.reorder_quantity,
  p.reorder_calculation_method,
  p.track_inventory,
  p.send_low_stock_alerts
FROM products p
CROSS JOIN branches b
WHERE p.organization_id = b.organization_id
  AND p.deleted_at IS NULL
  AND b.deleted_at IS NULL
  -- Only migrate if product has some inventory settings
  AND (
    p.reorder_point IS NOT NULL OR
    p.max_stock_level IS NOT NULL OR
    p.reorder_quantity IS NOT NULL OR
    p.track_inventory = true
  )
ON CONFLICT (product_id, branch_id) DO UPDATE SET
  reorder_point = EXCLUDED.reorder_point,
  max_stock_level = EXCLUDED.max_stock_level,
  reorder_quantity = EXCLUDED.reorder_quantity,
  reorder_calculation_method = EXCLUDED.reorder_calculation_method,
  track_inventory = EXCLUDED.track_inventory,
  send_low_stock_alerts = EXCLUDED.send_low_stock_alerts,
  updated_at = NOW();

-- Add deprecation notices to products table columns
COMMENT ON COLUMN products.reorder_point IS
  'DEPRECATED: Use product_branch_settings.reorder_point instead.

   This field is kept for backward compatibility but NEW CODE should use
   product_branch_settings table for per-warehouse reorder points.

   Different warehouses need different reorder points based on:
   - Local demand patterns
   - Storage capacity
   - Lead times from suppliers
   - Service level requirements';

COMMENT ON COLUMN products.max_stock_level IS
  'DEPRECATED: Use product_branch_settings.max_stock_level instead.
   Each warehouse may have different maximum storage capacity.';

COMMENT ON COLUMN products.reorder_quantity IS
  'DEPRECATED: Use product_branch_settings.reorder_quantity instead.
   Each warehouse may order different quantities based on capacity and demand.';

COMMENT ON COLUMN products.reorder_calculation_method IS
  'DEPRECATED: Use product_branch_settings.reorder_calculation_method instead.
   Each warehouse may use different calculation methods.';

COMMENT ON COLUMN products.send_low_stock_alerts IS
  'DEPRECATED: Use product_branch_settings.send_low_stock_alerts instead.
   Alert preferences should be configured per warehouse.';

-- Log the migration results
DO $$
DECLARE
  v_products_count INTEGER;
  v_branches_count INTEGER;
  v_settings_created INTEGER;
  v_products_with_settings INTEGER;
BEGIN
  -- Count products
  SELECT COUNT(*) INTO v_products_count
  FROM products
  WHERE deleted_at IS NULL;

  -- Count branches
  SELECT COUNT(*) INTO v_branches_count
  FROM branches
  WHERE deleted_at IS NULL;

  -- Count settings created
  SELECT COUNT(*) INTO v_settings_created
  FROM product_branch_settings
  WHERE deleted_at IS NULL;

  -- Count products that have at least one branch setting
  SELECT COUNT(DISTINCT product_id) INTO v_products_with_settings
  FROM product_branch_settings
  WHERE deleted_at IS NULL;

  RAISE NOTICE '=== Reorder Points Migration Complete ===';
  RAISE NOTICE 'Total products: %', v_products_count;
  RAISE NOTICE 'Total branches: %', v_branches_count;
  RAISE NOTICE 'Settings created: %', v_settings_created;
  RAISE NOTICE 'Products with settings: %', v_products_with_settings;
  RAISE NOTICE '';
  RAISE NOTICE 'Each product now has inventory settings for each warehouse.';
  RAISE NOTICE 'Warehouses can customize their settings independently.';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: New code should use product_branch_settings table.';
  RAISE NOTICE 'The products.reorder_point and related fields are DEPRECATED.';
  RAISE NOTICE '==========================================';
END $$;
