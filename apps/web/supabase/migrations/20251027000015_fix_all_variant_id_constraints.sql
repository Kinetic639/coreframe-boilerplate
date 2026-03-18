-- =============================================
-- Fix ALL variant_id NOT NULL constraints across the database
-- variant_id should be nullable everywhere since not all products have variants
-- =============================================

DO $$
DECLARE
  table_rec RECORD;
  constraint_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Scanning all tables for variant_id NOT NULL constraints...';

  -- Find all tables with variant_id that has NOT NULL constraint
  FOR table_rec IN
    SELECT
      table_name,
      column_name,
      is_nullable
    FROM information_schema.columns
    WHERE column_name = 'variant_id'
    AND table_schema = 'public'
    AND is_nullable = 'NO'
  LOOP
    RAISE NOTICE 'Found NOT NULL constraint in table: %', table_rec.table_name;

    -- Remove NOT NULL constraint
    EXECUTE format('ALTER TABLE %I ALTER COLUMN variant_id DROP NOT NULL', table_rec.table_name);

    RAISE NOTICE '  ✓ Removed NOT NULL constraint from %.variant_id', table_rec.table_name;
    constraint_count := constraint_count + 1;
  END LOOP;

  IF constraint_count = 0 THEN
    RAISE NOTICE 'No NOT NULL constraints found on variant_id columns';
  ELSE
    RAISE NOTICE 'Total constraints removed: %', constraint_count;
  END IF;
END $$;

-- Verify all variant_id columns are now nullable
DO $$
DECLARE
  table_rec RECORD;
  still_not_null INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Verification - Checking all variant_id columns:';

  FOR table_rec IN
    SELECT
      table_name,
      column_name,
      is_nullable
    FROM information_schema.columns
    WHERE column_name = 'variant_id'
    AND table_schema = 'public'
    ORDER BY table_name
  LOOP
    IF table_rec.is_nullable = 'NO' THEN
      RAISE NOTICE '  ✗ %.variant_id is still NOT NULL', table_rec.table_name;
      still_not_null := still_not_null + 1;
    ELSE
      RAISE NOTICE '  ✓ %.variant_id is nullable', table_rec.table_name;
    END IF;
  END LOOP;

  IF still_not_null > 0 THEN
    RAISE EXCEPTION 'Still found % tables with variant_id NOT NULL after fix', still_not_null;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'All variant_id columns are now nullable ✓';
END $$;

-- Add comments to all variant_id columns
DO $$
DECLARE
  table_rec RECORD;
BEGIN
  FOR table_rec IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE column_name = 'variant_id'
    AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'COMMENT ON COLUMN %I.variant_id IS ''Optional variant ID. NULL when the product does not have variants or when tracking at product level only.''',
      table_rec.table_name
    );
  END LOOP;
END $$;

-- =============================================
-- Migration Complete
-- =============================================
