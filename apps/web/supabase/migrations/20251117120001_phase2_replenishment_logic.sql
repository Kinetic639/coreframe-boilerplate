-- =====================================================
-- Phase 2: Replenishment & Optimal Ordering Logic
-- Part of: Inventory Replenishment System
-- =====================================================
-- This migration adds replenishment calculation fields to products table
-- and creates the calculate_order_quantity() function.
--
-- Key Concept: Products define WHEN and HOW MUCH to order using three methods:
--   - Fixed: Always order same amount (reorder_quantity)
--   - Min/Max: Order up to maximum level (max_stock_level)
--   - Auto: Calculate from demand history (future enhancement)
--
-- This is the "Decision" layer in the 3-domain pipeline:
--   Detection (alerts) → Decision (this) → Adjustment (Phase 1)
--
-- Migration ID: 20251117120001
-- Phase: 2 of 4 (Replenishment Logic)
-- Dependencies: Phase 1 (adjust_for_packaging function)
-- =====================================================

-- Add replenishment calculation fields to products table
ALTER TABLE products
ADD COLUMN reorder_quantity DECIMAL(15,3),
ADD COLUMN max_stock_level DECIMAL(15,3),
ADD COLUMN reorder_calculation_method TEXT DEFAULT 'min_max';

-- Add constraint for calculation method
ALTER TABLE products
ADD CONSTRAINT check_reorder_calculation_method
  CHECK (reorder_calculation_method IN ('fixed', 'min_max', 'auto'));

-- Add column comments
COMMENT ON COLUMN products.reorder_quantity IS
  'For FIXED method: Always order this amount when stock falls below reorder_point.
   Example: If reorder_quantity=500, always order 500 units regardless of current stock.
   Useful for products with consistent demand and standard order sizes.';

COMMENT ON COLUMN products.max_stock_level IS
  'For MIN/MAX method: Order enough to reach this maximum stock level.
   Example: If max_stock_level=1000 and available_stock=200, order 800 units.
   Recommended approach - adapts to current stock levels.';

COMMENT ON COLUMN products.reorder_calculation_method IS
  'How to calculate order quantity when stock falls below reorder_point:
   - fixed: Always order reorder_quantity (simple, predictable)
   - min_max: Order to reach max_stock_level (adaptive, efficient)
   - auto: Calculate from historical demand data (future enhancement)

   Default: min_max (most flexible and commonly used)';

-- Create function to calculate optimal order quantity
CREATE OR REPLACE FUNCTION calculate_order_quantity(
  p_product_id UUID,
  p_supplier_id UUID,
  p_available_stock DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  raw_quantity DECIMAL,
  adjusted_quantity DECIMAL,
  packages DECIMAL,
  calculation_method TEXT,
  adjustment_reason TEXT
) AS $$
DECLARE
  v_product RECORD;
  v_available_stock DECIMAL;
  v_raw_qty DECIMAL;
  v_product_supplier_id UUID;
  v_adjusted RECORD;
BEGIN
  -- Get product replenishment settings
  SELECT
    reorder_point,
    reorder_quantity,
    max_stock_level,
    reorder_calculation_method
  INTO v_product
  FROM products
  WHERE id = p_product_id
    AND deleted_at IS NULL;

  -- If product not found or not configured, return null
  IF NOT FOUND OR v_product.reorder_point IS NULL THEN
    RETURN QUERY SELECT
      NULL::DECIMAL,
      NULL::DECIMAL,
      NULL::DECIMAL,
      NULL::TEXT,
      'Product not found or reorder_point not set'::TEXT;
    RETURN;
  END IF;

  -- Get current available stock if not provided
  IF p_available_stock IS NULL THEN
    SELECT COALESCE(available_quantity, 0) INTO v_available_stock
    FROM product_available_inventory
    WHERE product_id = p_product_id
    LIMIT 1;

    -- If no inventory record found, assume 0
    v_available_stock := COALESCE(v_available_stock, 0);
  ELSE
    v_available_stock := p_available_stock;
  END IF;

  -- Calculate raw order quantity based on method
  CASE v_product.reorder_calculation_method
    WHEN 'fixed' THEN
      -- Fixed: Always order reorder_quantity
      -- Fallback to reorder_point if reorder_quantity not set
      v_raw_qty := COALESCE(v_product.reorder_quantity, v_product.reorder_point);

    WHEN 'min_max' THEN
      -- Min/Max: Order to reach max_stock_level
      IF v_product.max_stock_level IS NOT NULL THEN
        v_raw_qty := v_product.max_stock_level - v_available_stock;
      ELSE
        -- Fallback: Order to 2x reorder point if max not set
        v_raw_qty := (v_product.reorder_point * 2) - v_available_stock;
      END IF;

    WHEN 'auto' THEN
      -- Auto: Calculate from demand history (future enhancement)
      -- For now, use min_max logic as fallback
      v_raw_qty := COALESCE(v_product.max_stock_level, v_product.reorder_point * 2) - v_available_stock;

    ELSE
      -- Default: Order to bring stock to reorder point
      v_raw_qty := v_product.reorder_point - v_available_stock;
  END CASE;

  -- Ensure positive quantity
  v_raw_qty := GREATEST(v_raw_qty, 0);

  -- If quantity is 0 or negative, no need to order
  IF v_raw_qty <= 0 THEN
    RETURN QUERY SELECT
      0::DECIMAL,
      0::DECIMAL,
      NULL::DECIMAL,
      v_product.reorder_calculation_method,
      'Stock level is sufficient, no order needed'::TEXT;
    RETURN;
  END IF;

  -- Get product_supplier relationship
  SELECT id INTO v_product_supplier_id
  FROM product_suppliers
  WHERE product_id = p_product_id
    AND supplier_id = p_supplier_id
    AND deleted_at IS NULL
  LIMIT 1;

  -- Adjust for supplier packaging constraints (Phase 1 function)
  IF v_product_supplier_id IS NOT NULL THEN
    SELECT * INTO v_adjusted
    FROM adjust_for_packaging(v_raw_qty, v_product_supplier_id);

    RETURN QUERY SELECT
      v_raw_qty,
      v_adjusted.adjusted_quantity,
      v_adjusted.packages,
      v_product.reorder_calculation_method,
      v_adjusted.adjustment_reason;
  ELSE
    -- No supplier relationship or no packaging constraints
    RETURN QUERY SELECT
      v_raw_qty,
      v_raw_qty,
      NULL::DECIMAL,
      v_product.reorder_calculation_method,
      NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_order_quantity IS
  'Calculates optimal order quantity using 3-domain pipeline:
   1. Detection: Product is below reorder_point (caller checks this)
   2. Decision: Calculate raw quantity based on replenishment method (this function)
   3. Adjustment: Apply supplier packaging constraints (calls adjust_for_packaging)

   Methods:
   - fixed: Always order reorder_quantity
   - min_max: Order to max_stock_level (recommended)
   - auto: Based on demand history (future)

   Returns:
   - raw_quantity: Initial calculated quantity
   - adjusted_quantity: After supplier constraints applied
   - packages: Number of packages (if applicable)
   - calculation_method: Which method was used
   - adjustment_reason: Explanation of any adjustments

   Example:
   Product: reorder_point=100, max_stock_level=1000, method=min_max
   Current stock: 80
   Supplier: box of 100, no partial boxes
   Result: raw=920, adjusted=1000 (10 boxes)';

-- Create indexes for replenishment queries
CREATE INDEX IF NOT EXISTS idx_products_replenishment
  ON products(reorder_point, max_stock_level, reorder_calculation_method)
  WHERE reorder_point IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_low_stock
  ON products(reorder_point)
  WHERE reorder_point IS NOT NULL AND track_inventory = true AND deleted_at IS NULL;

-- Test function with sample data (commented out for production)
-- To test after applying migration:
/*
-- Set up test product
UPDATE products
SET
  reorder_point = 100,
  max_stock_level = 1000,
  reorder_calculation_method = 'min_max'
WHERE id = 'your-product-id-here';

-- Set up supplier packaging
UPDATE product_suppliers
SET
  package_unit = 'box',
  package_quantity = 100,
  allow_partial_package = false
WHERE product_id = 'your-product-id-here'
  AND supplier_id = 'your-supplier-id-here';

-- Test calculation with current stock = 80
SELECT * FROM calculate_order_quantity(
  'your-product-id-here',
  'your-supplier-id-here',
  80  -- available stock
);
-- Expected: raw_quantity=920, adjusted_quantity=1000, packages=10, method='min_max'
*/
