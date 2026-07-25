-- =============================================
-- Comprehensive validation of all stock_movements related schema
-- Ensures everything is correct and no hidden issues remain
-- =============================================

DO $$
DECLARE
  issue_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== COMPREHENSIVE SCHEMA VALIDATION ===';
  RAISE NOTICE '';

  -- 1. Check stock_movements table structure
  RAISE NOTICE '1. Validating stock_movements table:';

  -- Verify location_id does NOT exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'location_id'
  ) THEN
    RAISE WARNING '  ✗ location_id column still exists in stock_movements';
    issue_count := issue_count + 1;
  ELSE
    RAISE NOTICE '  ✓ location_id column removed';
  END IF;

  -- Verify source_location_id exists and is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'source_location_id' AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE '  ✓ source_location_id exists and is nullable';
  ELSE
    RAISE WARNING '  ✗ source_location_id missing or not nullable';
    issue_count := issue_count + 1;
  END IF;

  -- Verify destination_location_id exists and is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'destination_location_id' AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE '  ✓ destination_location_id exists and is nullable';
  ELSE
    RAISE WARNING '  ✗ destination_location_id missing or not nullable';
    issue_count := issue_count + 1;
  END IF;

  -- Verify variant_id is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'variant_id' AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE '  ✓ variant_id is nullable';
  ELSE
    RAISE WARNING '  ✗ variant_id is not nullable';
    issue_count := issue_count + 1;
  END IF;

  RAISE NOTICE '';

  -- 2. Check stock_snapshots table
  RAISE NOTICE '2. Validating stock_snapshots table:';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_snapshots') THEN
    RAISE NOTICE '  ✓ stock_snapshots table exists';

    -- Verify variant_id is nullable
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'stock_snapshots' AND column_name = 'variant_id' AND is_nullable = 'YES'
    ) THEN
      RAISE NOTICE '  ✓ stock_snapshots.variant_id is nullable';
    ELSE
      RAISE WARNING '  ✗ stock_snapshots.variant_id is not nullable';
      issue_count := issue_count + 1;
    END IF;
  ELSE
    RAISE NOTICE '  ℹ stock_snapshots table does not exist (optional)';
  END IF;

  RAISE NOTICE '';

  -- 3. Check stock_reservations table
  RAISE NOTICE '3. Validating stock_reservations table:';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_reservations') THEN
    RAISE NOTICE '  ✓ stock_reservations table exists';

    -- Verify variant_id is nullable
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'stock_reservations' AND column_name = 'variant_id' AND is_nullable = 'YES'
    ) THEN
      RAISE NOTICE '  ✓ stock_reservations.variant_id is nullable';
    ELSE
      RAISE WARNING '  ✗ stock_reservations.variant_id is not nullable';
      issue_count := issue_count + 1;
    END IF;
  ELSE
    RAISE NOTICE '  ℹ stock_reservations table does not exist (optional)';
  END IF;

  RAISE NOTICE '';

  -- 4. Check functions
  RAISE NOTICE '4. Validating functions:';

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_stock_movement') THEN
    RAISE NOTICE '  ✓ create_stock_movement function exists';
  ELSE
    RAISE WARNING '  ✗ create_stock_movement function missing';
    issue_count := issue_count + 1;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_current_stock') THEN
    RAISE NOTICE '  ✓ calculate_current_stock function exists';
  ELSE
    RAISE WARNING '  ✗ calculate_current_stock function missing';
    issue_count := issue_count + 1;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_stock_snapshot') THEN
    RAISE NOTICE '  ✓ refresh_stock_snapshot function exists';
  ELSE
    RAISE NOTICE '  ℹ refresh_stock_snapshot function missing (optional)';
  END IF;

  RAISE NOTICE '';

  -- 5. Check triggers
  RAISE NOTICE '5. Validating triggers:';

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'refresh_snapshot_on_movement' AND tgrelid = 'stock_movements'::regclass
  ) THEN
    RAISE NOTICE '  ✓ refresh_snapshot_on_movement trigger exists';
  ELSE
    RAISE NOTICE '  ℹ refresh_snapshot_on_movement trigger missing (optional)';
  END IF;

  RAISE NOTICE '';

  -- 6. Check movement type 101
  RAISE NOTICE '6. Validating movement type 101 (GR from PO):';

  IF EXISTS (
    SELECT 1 FROM movement_types
    WHERE code = '101' AND requires_destination_location = false
  ) THEN
    RAISE NOTICE '  ✓ Movement type 101 allows optional destination location';
  ELSE
    RAISE WARNING '  ✗ Movement type 101 requires destination location (should be optional)';
    issue_count := issue_count + 1;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== VALIDATION COMPLETE ===';
  RAISE NOTICE '';

  IF issue_count = 0 THEN
    RAISE NOTICE '✓ All checks passed! Schema is correct.';
  ELSE
    RAISE WARNING '✗ Found % issues that need attention', issue_count;
  END IF;
END $$;

-- =============================================
-- Migration Complete
-- =============================================
