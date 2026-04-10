-- =============================================
-- Drop old index on stock_movements.location_id
-- This column no longer exists
-- =============================================

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_stock_movements_location;

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Dropped idx_stock_movements_location index (if it existed)';
  RAISE NOTICE 'This index was for the old location_id column which has been removed';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
