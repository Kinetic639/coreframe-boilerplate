-- =============================================
-- Fix calculate_current_stock to use source/destination location fields
-- The function was using location_id which no longer exists
-- =============================================

CREATE OR REPLACE FUNCTION calculate_current_stock(
  p_organization_id UUID,
  p_branch_id UUID,
  p_location_id UUID,
  p_product_id UUID,
  p_variant_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_stock NUMERIC := 0;
BEGIN
  -- Calculate stock based on movements affecting this location
  -- Receipts/Transfers-In increase stock (destination_location_id)
  -- Issues/Transfers-Out decrease stock (source_location_id)
  SELECT COALESCE(
    SUM(
      CASE
        -- If this location is the destination, add quantity * affects_stock
        WHEN sm.destination_location_id = p_location_id THEN sm.quantity * mt.affects_stock
        -- If this location is the source, subtract quantity * affects_stock
        WHEN sm.source_location_id = p_location_id THEN -1 * sm.quantity * mt.affects_stock
        ELSE 0
      END
    ), 0
  ) INTO total_stock
  FROM stock_movements sm
  JOIN movement_types mt ON sm.movement_type_code = mt.code
  WHERE sm.organization_id = p_organization_id
    AND sm.branch_id = p_branch_id
    AND (sm.destination_location_id = p_location_id OR sm.source_location_id = p_location_id)
    AND sm.product_id = p_product_id
    AND (p_variant_id IS NULL OR sm.variant_id = p_variant_id);

  RETURN total_stock;
END;
$$;

-- Add comment explaining the updated logic
COMMENT ON FUNCTION calculate_current_stock IS
'Calculates current stock for a product/variant at a specific location.
Uses destination_location_id for receipts (stock increases) and source_location_id for issues (stock decreases).
Handles both movements with and without variants (p_variant_id can be NULL).';

-- Verify the function was updated
DO $$
BEGIN
  RAISE NOTICE 'calculate_current_stock function updated successfully';
  RAISE NOTICE 'Function now uses source_location_id and destination_location_id';
  RAISE NOTICE 'Stock calculation: destination adds, source subtracts';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
