-- =============================================
-- Verify and force remove location_id if it still exists
-- =============================================

DO $$
DECLARE
  v_column_exists BOOLEAN;
BEGIN
  -- Check if location_id column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_movements'
    AND column_name = 'location_id'
  ) INTO v_column_exists;

  IF v_column_exists THEN
    RAISE NOTICE 'location_id column STILL EXISTS - attempting to remove it again';

    -- Try to drop the column again
    ALTER TABLE stock_movements DROP COLUMN IF EXISTS location_id CASCADE;

    RAISE NOTICE 'Successfully removed location_id column';
  ELSE
    RAISE NOTICE 'location_id column does not exist (correct state)';
  END IF;
END $$;

-- Verify final state
DO $$
DECLARE
  v_has_location BOOLEAN;
  v_has_source BOOLEAN;
  v_has_destination BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'location_id'
  ) INTO v_has_location;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'source_location_id'
  ) INTO v_has_source;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'destination_location_id'
  ) INTO v_has_destination;

  RAISE NOTICE 'Final verification:';
  RAISE NOTICE '  - location_id: %', CASE WHEN v_has_location THEN 'EXISTS (ERROR!)' ELSE 'REMOVED (OK)' END;
  RAISE NOTICE '  - source_location_id: %', CASE WHEN v_has_source THEN 'EXISTS (OK)' ELSE 'MISSING (ERROR!)' END;
  RAISE NOTICE '  - destination_location_id: %', CASE WHEN v_has_destination THEN 'EXISTS (OK)' ELSE 'MISSING (ERROR!)' END;

  IF v_has_location THEN
    RAISE EXCEPTION 'location_id column still exists after forced removal';
  END IF;
END $$;
