-- =============================================
-- Fix refresh_stock_snapshot to use source/destination location fields
-- =============================================

CREATE OR REPLACE FUNCTION refresh_stock_snapshot(
  p_organization_id UUID,
  p_branch_id UUID,
  p_location_id UUID,
  p_product_id UUID,
  p_variant_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  qty_on_hand NUMERIC;
  qty_reserved NUMERIC;
  last_mov_id UUID;
  last_mov_at TIMESTAMPTZ;
BEGIN
  -- Calculate current stock using the updated function
  qty_on_hand := calculate_current_stock(p_organization_id, p_branch_id, p_location_id, p_product_id, p_variant_id);
  qty_reserved := calculate_reserved_stock(p_organization_id, p_branch_id, p_location_id, p_product_id, p_variant_id);

  -- Get last movement info
  -- Check both source and destination locations
  SELECT id, occurred_at INTO last_mov_id, last_mov_at
  FROM stock_movements
  WHERE organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND (destination_location_id = p_location_id OR source_location_id = p_location_id)
    AND product_id = p_product_id
    AND (p_variant_id IS NULL OR variant_id = p_variant_id)
  ORDER BY occurred_at DESC, created_at DESC
  LIMIT 1;

  -- Upsert snapshot
  INSERT INTO product_location_stock (
    organization_id,
    branch_id,
    location_id,
    product_id,
    variant_id,
    quantity_on_hand,
    quantity_reserved,
    quantity_available,
    last_movement_id,
    last_movement_at,
    last_counted_at,
    last_counted_by
  ) VALUES (
    p_organization_id,
    p_branch_id,
    p_location_id,
    p_product_id,
    p_variant_id,
    qty_on_hand,
    qty_reserved,
    qty_on_hand - qty_reserved,
    last_mov_id,
    last_mov_at,
    NULL,
    NULL
  )
  ON CONFLICT (organization_id, branch_id, location_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    quantity_on_hand = EXCLUDED.quantity_on_hand,
    quantity_reserved = EXCLUDED.quantity_reserved,
    quantity_available = EXCLUDED.quantity_available,
    last_movement_id = EXCLUDED.last_movement_id,
    last_movement_at = EXCLUDED.last_movement_at,
    updated_at = NOW();
END;
$$;

-- Add comment
COMMENT ON FUNCTION refresh_stock_snapshot IS
'Refreshes the stock snapshot for a product/variant at a specific location.
Uses calculate_current_stock which handles both source_location_id and destination_location_id.
Checks both location fields when finding the last movement.';

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'refresh_stock_snapshot function updated successfully';
  RAISE NOTICE 'Function now uses source_location_id and destination_location_id';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
