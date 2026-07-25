-- =============================================
-- Fix Stock Movements User Foreign Keys
-- Change from auth.users to public.users for proper JOIN support
-- =============================================

-- Drop existing foreign key constraints that reference auth.users
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey,
  DROP CONSTRAINT IF EXISTS stock_movements_approved_by_fkey,
  DROP CONSTRAINT IF EXISTS stock_movements_updated_by_fkey,
  DROP CONSTRAINT IF EXISTS stock_movements_cancelled_by_fkey;

-- Add new foreign key constraints that reference public.users
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT stock_movements_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT stock_movements_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT stock_movements_cancelled_by_fkey
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;

-- Also fix stock_reservations table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_reservations') THEN
    -- Drop old constraints
    ALTER TABLE stock_reservations
      DROP CONSTRAINT IF EXISTS stock_reservations_created_by_fkey,
      DROP CONSTRAINT IF EXISTS stock_reservations_cancelled_by_fkey;

    -- Add new constraints
    ALTER TABLE stock_reservations
      ADD CONSTRAINT stock_reservations_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      ADD CONSTRAINT stock_reservations_cancelled_by_fkey
        FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add comment to document the change
COMMENT ON CONSTRAINT stock_movements_created_by_fkey ON stock_movements IS
  'References public.users instead of auth.users to enable proper JOINs in PostgREST queries';
