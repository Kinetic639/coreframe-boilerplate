-- =====================================================
-- Phase 1: Supplier Packaging & Ordering Constraints
-- Part of: Inventory Replenishment System
-- =====================================================
-- This migration adds supplier-specific packaging and ordering rules
-- to the product_suppliers table.
--
-- Key Concept: Different suppliers sell the same product with different
-- packaging, MOQs, and ordering constraints. These rules belong to the
-- supplier relationship, NOT the product itself.
--
-- Example: "Industrial Gloves"
--   - Supplier A: Boxes of 50, allows partial boxes, MOQ = 10
--   - Supplier B: Cases of 100, NO partial cases, MOQ = 100
--   - Supplier C: Individual items, MOQ = 5
--
-- Migration ID: 20251117120000
-- Phase: 1 of 4 (Supplier Packaging)
-- =====================================================

-- Add packaging and ordering constraint columns to product_suppliers
ALTER TABLE product_suppliers
ADD COLUMN package_unit VARCHAR(50),
ADD COLUMN package_quantity DECIMAL(15,3),
ADD COLUMN allow_partial_package BOOLEAN DEFAULT true,
ADD COLUMN min_order_quantity DECIMAL(15,3),
ADD COLUMN order_in_multiples_of DECIMAL(15,3),
ADD COLUMN supplier_lead_time_days INTEGER,
ADD COLUMN supplier_price DECIMAL(15,2);

-- Add column comments for documentation
COMMENT ON COLUMN product_suppliers.package_unit IS
  'How this supplier packages the product (e.g., box, case, pallet, drum, bundle, carton).
   Used for display and packaging calculations.';

COMMENT ON COLUMN product_suppliers.package_quantity IS
  'How many base units (from products.base_unit) are in one package.
   Example: If base_unit=piece and package_unit=box, this might be 100 (100 pieces per box).';

COMMENT ON COLUMN product_suppliers.allow_partial_package IS
  'Can order partial packages?
   - true: Can order any quantity (e.g., 150 pieces even if box=100)
   - false: Must order full packages only (e.g., must order 200 pieces = 2 boxes)
   Affects order quantity adjustment logic.';

COMMENT ON COLUMN product_suppliers.min_order_quantity IS
  'Minimum quantity that can be ordered from this supplier (in base units).
   Example: If base_unit=piece and min_order_quantity=50, cannot order less than 50 pieces.
   Applied before packaging constraints.';

COMMENT ON COLUMN product_suppliers.order_in_multiples_of IS
  'Orders must be in multiples of this number (in base units).
   Example: If order_in_multiples_of=10, can order 10, 20, 30 but not 15, 25.
   Applied before packaging constraints.';

COMMENT ON COLUMN product_suppliers.supplier_lead_time_days IS
  'Supplier-specific lead time in days.
   Overrides the global lead_time_days from products table for this supplier.
   Used for delivery date calculation and demand forecasting.';

COMMENT ON COLUMN product_suppliers.supplier_price IS
  'Current price per base unit from this supplier.
   Stored here for quick access (also tracked in product_supplier_price_history).
   Used for PO creation and cost calculations.';

-- Create function to adjust quantity based on supplier packaging constraints
CREATE OR REPLACE FUNCTION adjust_for_packaging(
  p_raw_quantity DECIMAL,
  p_product_supplier_id UUID
)
RETURNS TABLE (
  adjusted_quantity DECIMAL,
  packages DECIMAL,
  adjustment_reason TEXT
) AS $$
DECLARE
  v_supplier RECORD;
  v_qty DECIMAL;
  v_packages DECIMAL;
  v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Get supplier packaging rules
  SELECT
    package_unit,
    package_quantity,
    allow_partial_package,
    min_order_quantity,
    order_in_multiples_of
  INTO v_supplier
  FROM product_suppliers
  WHERE id = p_product_supplier_id
    AND deleted_at IS NULL;

  -- If supplier not found or no constraints, return raw quantity
  IF NOT FOUND THEN
    RETURN QUERY SELECT p_raw_quantity, NULL::DECIMAL, NULL::TEXT;
    RETURN;
  END IF;

  v_qty := p_raw_quantity;

  -- Step 1: Apply minimum order quantity
  IF v_supplier.min_order_quantity IS NOT NULL AND v_qty < v_supplier.min_order_quantity THEN
    v_qty := v_supplier.min_order_quantity;
    v_reasons := array_append(v_reasons, 'adjusted to minimum order quantity of ' || v_supplier.min_order_quantity);
  END IF;

  -- Step 2: Apply order multiples constraint
  IF v_supplier.order_in_multiples_of IS NOT NULL
     AND v_supplier.order_in_multiples_of > 0
     AND (v_qty % v_supplier.order_in_multiples_of) != 0 THEN
    v_qty := CEIL(v_qty / v_supplier.order_in_multiples_of) * v_supplier.order_in_multiples_of;
    v_reasons := array_append(v_reasons, 'rounded to multiple of ' || v_supplier.order_in_multiples_of);
  END IF;

  -- Step 3: Apply full package requirement (if enabled)
  IF v_supplier.allow_partial_package = false
     AND v_supplier.package_quantity IS NOT NULL
     AND v_supplier.package_quantity > 0
     AND (v_qty % v_supplier.package_quantity) != 0 THEN
    v_packages := CEIL(v_qty / v_supplier.package_quantity);
    v_qty := v_packages * v_supplier.package_quantity;
    v_reasons := array_append(
      v_reasons,
      'rounded to ' || v_packages || ' full ' ||
      COALESCE(v_supplier.package_unit, 'package') ||
      CASE WHEN v_packages > 1 THEN 's' ELSE '' END
    );
  END IF;

  -- Calculate final number of packages
  IF v_supplier.package_quantity IS NOT NULL AND v_supplier.package_quantity > 0 THEN
    v_packages := v_qty / v_supplier.package_quantity;
  ELSE
    v_packages := NULL;
  END IF;

  -- Return results
  RETURN QUERY SELECT
    v_qty,
    v_packages,
    CASE
      WHEN array_length(v_reasons, 1) > 0 THEN array_to_string(v_reasons, '; ')
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION adjust_for_packaging IS
  'Adjusts raw order quantity based on supplier packaging constraints.

   Applies rules in order:
   1. Minimum order quantity (MOQ)
   2. Order in multiples of X
   3. Full package requirement (if allow_partial_package = false)

   Returns:
   - adjusted_quantity: Final quantity after all adjustments
   - packages: Number of packages (if applicable)
   - adjustment_reason: Human-readable explanation of adjustments

   Example:
   Raw quantity: 127 pieces
   Supplier rules: MOQ=50, multiples=10, package_qty=100, allow_partial=false
   Result: 200 pieces (2 packages)
   Reason: "rounded to multiple of 10; rounded to 2 full boxes"';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_suppliers_packaging
  ON product_suppliers(package_unit, package_quantity)
  WHERE package_unit IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_suppliers_ordering_constraints
  ON product_suppliers(min_order_quantity, order_in_multiples_of)
  WHERE (min_order_quantity IS NOT NULL OR order_in_multiples_of IS NOT NULL)
    AND deleted_at IS NULL;

-- Test function with sample data (commented out for production)
-- To test after applying migration:
/*
-- Set up test data
UPDATE product_suppliers
SET
  package_unit = 'box',
  package_quantity = 100,
  allow_partial_package = false,
  min_order_quantity = 50,
  order_in_multiples_of = 10
WHERE id = 'your-product-supplier-id-here';

-- Test the function
SELECT * FROM adjust_for_packaging(127, 'your-product-supplier-id-here');
-- Expected: adjusted_quantity=200, packages=2, adjustment_reason='rounded to multiple of 10; rounded to 2 full boxes'

SELECT * FROM adjust_for_packaging(45, 'your-product-supplier-id-here');
-- Expected: adjusted_quantity=100, packages=1, adjustment_reason='adjusted to minimum order quantity of 50; rounded to multiple of 10; rounded to 1 full box'
*/
