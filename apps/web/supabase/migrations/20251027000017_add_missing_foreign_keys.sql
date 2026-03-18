-- =============================================
-- Add missing foreign key constraints for stock_movements
-- Needed for Supabase queries to work properly
-- =============================================

-- Add product_id foreign key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stock_movements_product_id_fkey'
    AND table_name = 'stock_movements'
  ) THEN
    ALTER TABLE stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

    RAISE NOTICE 'Added stock_movements_product_id_fkey';
  ELSE
    RAISE NOTICE 'stock_movements_product_id_fkey already exists';
  END IF;
END $$;

-- Add variant_id foreign key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stock_movements_variant_id_fkey'
    AND table_name = 'stock_movements'
  ) THEN
    ALTER TABLE stock_movements
    ADD CONSTRAINT stock_movements_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT;

    RAISE NOTICE 'Added stock_movements_variant_id_fkey';
  ELSE
    RAISE NOTICE 'stock_movements_variant_id_fkey already exists';
  END IF;
END $$;

-- Verify all necessary foreign keys exist
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE table_name = 'stock_movements'
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name IN (
    'stock_movements_product_id_fkey',
    'stock_movements_variant_id_fkey',
    'stock_movements_organization_id_fkey',
    'stock_movements_branch_id_fkey',
    'stock_movements_source_location_id_fkey',
    'stock_movements_destination_location_id_fkey',
    'stock_movements_movement_type_code_fkey'
  );

  RAISE NOTICE 'Found % foreign keys on stock_movements', fk_count;

  IF fk_count < 7 THEN
    RAISE WARNING 'Expected 7 foreign keys, found %', fk_count;
  ELSE
    RAISE NOTICE 'All required foreign keys exist ✓';
  END IF;
END $$;

-- =============================================
-- Migration Complete
-- =============================================
