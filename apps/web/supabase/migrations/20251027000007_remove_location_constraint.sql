-- =============================================
-- Remove valid_locations constraint from stock_movements
-- This constraint required at least one location (source or destination)
-- We now allow receipts without locations (optional location assignment)
-- =============================================

-- Drop the constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'stock_movements'
    AND constraint_name = 'valid_locations'
  ) THEN
    ALTER TABLE stock_movements DROP CONSTRAINT valid_locations;
    RAISE NOTICE 'Dropped valid_locations constraint';
  ELSE
    RAISE NOTICE 'valid_locations constraint does not exist';
  END IF;
END $$;

-- Verify the constraint was removed
DO $$
DECLARE
  v_constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'stock_movements'
    AND constraint_name = 'valid_locations'
  ) INTO v_constraint_exists;

  IF v_constraint_exists THEN
    RAISE EXCEPTION 'valid_locations constraint still exists after removal';
  END IF;

  RAISE NOTICE 'Verified: valid_locations constraint has been removed';
  RAISE NOTICE 'Stock movements can now be created without source_location_id or destination_location_id';
END $$;

-- Add comment explaining location handling
COMMENT ON TABLE stock_movements IS
'Stock movements track all inventory changes.
Locations are now optional - movements can be created without source_location_id or destination_location_id.
This allows flexibility for receipts where location assignment is deferred.
Movement type configuration (requires_source_location, requires_destination_location) determines when locations are mandatory.';

-- =============================================
-- Migration Complete
-- =============================================
