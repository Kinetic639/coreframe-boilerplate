-- =============================================
-- Fix variant_id to be nullable in stock_movements
-- variant_id should be optional since not all products have variants
-- =============================================

-- Make variant_id nullable (remove NOT NULL constraint if it exists)
DO $$
BEGIN
  -- Check if variant_id has a NOT NULL constraint
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_movements'
    AND column_name = 'variant_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Remove the NOT NULL constraint
    ALTER TABLE stock_movements
    ALTER COLUMN variant_id DROP NOT NULL;

    RAISE NOTICE 'Removed NOT NULL constraint from variant_id column';
  ELSE
    RAISE NOTICE 'variant_id column is already nullable';
  END IF;
END $$;

-- Verify the change
DO $$
DECLARE
  v_is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_name = 'stock_movements'
  AND column_name = 'variant_id';

  IF v_is_nullable = 'NO' THEN
    RAISE EXCEPTION 'variant_id column is still NOT NULL after migration';
  END IF;

  RAISE NOTICE 'variant_id column is now nullable (is_nullable: %)', v_is_nullable;
END $$;

-- Add comment explaining this column
COMMENT ON COLUMN stock_movements.variant_id IS
'Optional variant ID. NULL when the product does not have variants or when tracking at product level only.';

-- =============================================
-- Migration Complete
-- =============================================
