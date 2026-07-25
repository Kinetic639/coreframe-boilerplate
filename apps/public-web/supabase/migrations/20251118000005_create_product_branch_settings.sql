-- =====================================================
-- Phase 1: Create Product Branch Settings Table
-- =====================================================
-- This migration creates a table for per-warehouse product inventory settings.
--
-- Background:
-- - Products are organization-wide (single catalog)
-- - Different warehouses need different reorder points, max levels, etc.
-- - Warsaw might need reorder_point = 100, Poznań might need 300
--
-- This table allows each warehouse to configure its own inventory thresholds.
--
-- Migration ID: 20251118000005
-- Phase: 1 - Foundation
-- =====================================================

-- Create the product_branch_settings table
CREATE TABLE product_branch_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References (soft delete - no CASCADE)
  product_id UUID NOT NULL REFERENCES products(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Inventory Settings (per-warehouse thresholds)
  reorder_point DECIMAL(15,3),
  max_stock_level DECIMAL(15,3),
  min_stock_level DECIMAL(15,3),
  reorder_quantity DECIMAL(15,3),
  reorder_calculation_method TEXT
    CHECK (reorder_calculation_method IN ('fixed', 'min_max', 'auto')),

  -- Warehouse-specific preferences
  track_inventory BOOLEAN DEFAULT true,
  send_low_stock_alerts BOOLEAN DEFAULT false,
  lead_time_days INTEGER,

  -- Optional: Default receiving location in this warehouse
  preferred_receiving_location_id UUID REFERENCES locations(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT product_branch_settings_unique UNIQUE(product_id, branch_id),

  -- Ensure min <= reorder <= max
  CONSTRAINT valid_stock_levels CHECK (
    (min_stock_level IS NULL OR max_stock_level IS NULL OR min_stock_level <= max_stock_level) AND
    (min_stock_level IS NULL OR reorder_point IS NULL OR min_stock_level <= reorder_point) AND
    (reorder_point IS NULL OR max_stock_level IS NULL OR reorder_point <= max_stock_level)
  )
);

-- Indexes for performance
CREATE INDEX idx_product_branch_settings_product
  ON product_branch_settings(product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_product_branch_settings_branch
  ON product_branch_settings(branch_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_product_branch_settings_org
  ON product_branch_settings(organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_product_branch_settings_reorder
  ON product_branch_settings(product_id, branch_id, reorder_point)
  WHERE reorder_point IS NOT NULL
    AND track_inventory = true
    AND deleted_at IS NULL;

CREATE INDEX idx_product_branch_settings_alerts
  ON product_branch_settings(branch_id, send_low_stock_alerts)
  WHERE send_low_stock_alerts = true
    AND track_inventory = true
    AND deleted_at IS NULL;

-- Auto-update timestamp trigger
CREATE TRIGGER trg_product_branch_settings_updated_at
  BEFORE UPDATE ON product_branch_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Note: RLS policies will be added later by the user
-- ALTER TABLE product_branch_settings ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE product_branch_settings IS
  'Per-warehouse inventory settings for products.

   Each warehouse (branch) can have different reorder points, max levels, and lead times
   for the same product based on local demand, capacity, and supply chain considerations.

   Example:
   - Product: "Widget A"
   - Warsaw warehouse: reorder_point = 100, max_stock_level = 500
   - Poznań warehouse: reorder_point = 300, max_stock_level = 1000

   This allows multi-warehouse operations where each facility has different
   inventory management needs while maintaining a single product catalog.';

COMMENT ON COLUMN product_branch_settings.reorder_point IS
  'Minimum stock level that triggers low stock alert for THIS warehouse.
   When warehouse total stock falls below this point, an alert is created
   and a purchase order may be suggested.';

COMMENT ON COLUMN product_branch_settings.max_stock_level IS
  'Maximum stock level for THIS warehouse.
   Used in min/max reorder calculation method.
   Order quantity = max_stock_level - current_stock.';

COMMENT ON COLUMN product_branch_settings.min_stock_level IS
  'Minimum desired stock level for THIS warehouse.
   Used as a buffer below reorder_point.';

COMMENT ON COLUMN product_branch_settings.reorder_quantity IS
  'Fixed quantity to order when stock falls below reorder point.
   Used when reorder_calculation_method = "fixed".';

COMMENT ON COLUMN product_branch_settings.reorder_calculation_method IS
  'How to calculate suggested order quantity for THIS warehouse:
   - fixed: Always order reorder_quantity
   - min_max: Order (max_stock_level - current_stock)
   - auto: Calculate based on demand history (future feature)';

COMMENT ON COLUMN product_branch_settings.track_inventory IS
  'Whether to track inventory for this product in THIS warehouse.
   Can be disabled per warehouse if product is not stocked there.';

COMMENT ON COLUMN product_branch_settings.send_low_stock_alerts IS
  'Whether to send notifications for low stock in THIS warehouse.
   Separate from products.send_low_stock_alerts (global setting).';

COMMENT ON COLUMN product_branch_settings.lead_time_days IS
  'Lead time in days for replenishment to THIS warehouse.
   May differ per warehouse based on supplier proximity and shipping methods.';

COMMENT ON COLUMN product_branch_settings.preferred_receiving_location_id IS
  'Default bin/location to receive this product in THIS warehouse.
   Optional: Used to auto-suggest receiving location during putaway.';

-- =====================================================
-- Soft Delete Cascade Triggers
-- =====================================================
-- When a product, branch, or organization is soft deleted,
-- automatically soft delete related product_branch_settings

-- Trigger: Soft delete when product is soft deleted
CREATE OR REPLACE FUNCTION soft_delete_product_branch_settings_on_product()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE product_branch_settings
    SET deleted_at = NEW.deleted_at
    WHERE product_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_soft_delete_product_branch_settings_on_product
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION soft_delete_product_branch_settings_on_product();

-- Trigger: Soft delete when branch is soft deleted
CREATE OR REPLACE FUNCTION soft_delete_product_branch_settings_on_branch()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE product_branch_settings
    SET deleted_at = NEW.deleted_at
    WHERE branch_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_soft_delete_product_branch_settings_on_branch
  AFTER UPDATE ON branches
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION soft_delete_product_branch_settings_on_branch();

-- Trigger: Soft delete when organization is soft deleted
CREATE OR REPLACE FUNCTION soft_delete_product_branch_settings_on_organization()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE product_branch_settings
    SET deleted_at = NEW.deleted_at
    WHERE organization_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_soft_delete_product_branch_settings_on_organization
  AFTER UPDATE ON organizations
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION soft_delete_product_branch_settings_on_organization();

-- Log the creation
DO $$
BEGIN
  RAISE NOTICE '=== Product Branch Settings Table Created ===';
  RAISE NOTICE 'Table: product_branch_settings';
  RAISE NOTICE 'Purpose: Per-warehouse inventory thresholds';
  RAISE NOTICE 'Soft delete triggers: product, branch, organization';
  RAISE NOTICE 'Next step: Migrate existing reorder points from products table';
  RAISE NOTICE '=============================================';
END $$;
