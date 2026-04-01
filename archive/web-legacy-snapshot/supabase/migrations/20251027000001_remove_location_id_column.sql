-- =============================================
-- Remove unwanted location_id column from stock_movements
-- This column was manually added and is not part of the specification
-- The system uses source_location_id and destination_location_id instead
-- =============================================

-- Remove location_id column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements'
    AND column_name = 'location_id'
  ) THEN
    -- Drop the column
    ALTER TABLE stock_movements DROP COLUMN location_id;

    RAISE NOTICE 'Removed location_id column from stock_movements table';
  ELSE
    RAISE NOTICE 'location_id column does not exist in stock_movements table';
  END IF;
END $$;

-- Verify the table structure is correct
DO $$
DECLARE
  v_has_source BOOLEAN;
  v_has_destination BOOLEAN;
  v_has_location BOOLEAN;
BEGIN
  -- Check for source_location_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements'
    AND column_name = 'source_location_id'
  ) INTO v_has_source;

  -- Check for destination_location_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements'
    AND column_name = 'destination_location_id'
  ) INTO v_has_destination;

  -- Check for location_id (should not exist)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements'
    AND column_name = 'location_id'
  ) INTO v_has_location;

  -- Log results
  RAISE NOTICE 'Stock movements table structure:';
  RAISE NOTICE '  - source_location_id: %', CASE WHEN v_has_source THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE '  - destination_location_id: %', CASE WHEN v_has_destination THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE '  - location_id: %', CASE WHEN v_has_location THEN 'EXISTS (ERROR!)' ELSE 'REMOVED (OK)' END;

  -- Ensure we have the required columns
  IF NOT v_has_source OR NOT v_has_destination THEN
    RAISE EXCEPTION 'Missing required location columns in stock_movements table';
  END IF;

  -- Ensure we don't have the unwanted column
  IF v_has_location THEN
    RAISE EXCEPTION 'location_id column still exists after removal attempt';
  END IF;
END $$;

-- Add comment explaining the location columns
COMMENT ON COLUMN stock_movements.source_location_id IS
'Source location for issues and transfers (where stock is coming from). Required for movement types that have requires_source_location = true.';

COMMENT ON COLUMN stock_movements.destination_location_id IS
'Destination location for receipts and transfers (where stock is going to). Required for movement types that have requires_destination_location = true.';

-- =============================================
-- Migration Complete
-- =============================================
