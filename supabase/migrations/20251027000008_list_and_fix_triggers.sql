-- =============================================
-- List all triggers on stock_movements and fix any that reference location_id
-- =============================================

-- First, list all triggers on stock_movements table
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  RAISE NOTICE 'Listing all triggers on stock_movements table:';

  FOR trigger_rec IN
    SELECT tgname, pg_get_triggerdef(oid) as definition
    FROM pg_trigger
    WHERE tgrelid = 'stock_movements'::regclass
    AND tgisinternal = false
  LOOP
    RAISE NOTICE 'Trigger: %', trigger_rec.tgname;
    RAISE NOTICE 'Definition: %', trigger_rec.definition;
  END LOOP;
END $$;

-- Drop any triggers that might be referencing location_id
-- This is a safety measure in case there are old triggers
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'stock_movements'::regclass
    AND tgisinternal = false
    AND tgname NOT IN ('trigger_stock_movements_updated_at') -- Keep the updated_at trigger
  LOOP
    RAISE NOTICE 'Checking trigger: %', trigger_rec.tgname;
    -- We'll list them but not drop automatically for safety
  END LOOP;
END $$;

-- =============================================
-- Migration Complete
-- =============================================
