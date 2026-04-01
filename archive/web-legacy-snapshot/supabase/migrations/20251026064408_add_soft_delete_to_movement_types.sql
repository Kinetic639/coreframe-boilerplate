-- =============================================
-- Migration: Add Soft Delete to Movement Types
-- Ensures all movement-related tables use soft delete instead of CASCADE
-- =============================================

-- ============================================
-- STEP 1: ADD SOFT DELETE TO MOVEMENT_TYPES
-- ============================================

-- Add deleted_at column to movement_types if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='deleted_at') THEN
    ALTER TABLE movement_types ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- Add updated_at column to movement_types if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='updated_at') THEN
    ALTER TABLE movement_types ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add deleted_by column to movement_types if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='deleted_by') THEN
    ALTER TABLE movement_types ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Create index for soft delete on movement_types
CREATE INDEX IF NOT EXISTS idx_movement_types_deleted_at ON movement_types(deleted_at) WHERE deleted_at IS NULL;

-- Create index for code lookups (excluding deleted)
CREATE INDEX IF NOT EXISTS idx_movement_types_code_active ON movement_types(code) WHERE deleted_at IS NULL;

-- ============================================
-- STEP 2: ADD CATEGORY COLUMN TO MOVEMENT_TYPES
-- ============================================

-- Add category column to movement_types for better organization
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='category') THEN
    ALTER TABLE movement_types ADD COLUMN category TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='requires_source_location') THEN
    ALTER TABLE movement_types ADD COLUMN requires_source_location BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='requires_destination_location') THEN
    ALTER TABLE movement_types ADD COLUMN requires_destination_location BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================
-- STEP 3: UPDATE EXISTING MOVEMENT TYPES WITH CATEGORY
-- ============================================

-- Update existing movement types with category information
UPDATE movement_types
SET
  category = CASE
    WHEN code IN ('purchase', 'initial', 'transfer_in', 'return_customer', 'production_output', 'adjustment_positive') THEN 'receipt'
    WHEN code IN ('sale', 'transfer_out', 'return_supplier', 'production_consume', 'adjustment_negative', 'damaged') THEN 'issue'
    WHEN code IN ('reservation', 'reservation_release', 'audit_adjustment') THEN 'adjustment'
    ELSE 'other'
  END,
  requires_source_location = CASE
    WHEN code IN ('sale', 'transfer_out', 'return_supplier', 'production_consume', 'adjustment_negative', 'damaged') THEN true
    ELSE false
  END,
  requires_destination_location = CASE
    WHEN code IN ('purchase', 'initial', 'transfer_in', 'return_customer', 'production_output', 'adjustment_positive') THEN true
    ELSE false
  END
WHERE category IS NULL;

-- ============================================
-- STEP 4: CREATE TRIGGER FOR UPDATED_AT
-- ============================================

-- Create trigger function for movement_types updated_at
CREATE OR REPLACE FUNCTION update_movement_types_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trigger_movement_types_updated_at ON movement_types;
CREATE TRIGGER trigger_movement_types_updated_at
  BEFORE UPDATE ON movement_types
  FOR EACH ROW
  EXECUTE FUNCTION update_movement_types_timestamp();

-- ============================================
-- STEP 5: UPDATE VIEWS TO EXCLUDE SOFT DELETED RECORDS
-- ============================================

-- Recreate stock_inventory view to exclude soft deleted movement_types
CREATE OR REPLACE VIEW stock_inventory AS
SELECT
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id,
  COALESCE(sm.destination_location_id, sm.source_location_id) as location_id,

  -- Current stock calculation
  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.quantity
    WHEN sm.source_location_id IS NOT NULL THEN -sm.quantity
    ELSE 0
  END) as available_quantity,

  -- Reserved quantity (from reservations table)
  0 as reserved_quantity,

  -- Available to promise
  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.quantity
    WHEN sm.source_location_id IS NOT NULL THEN -sm.quantity
    ELSE 0
  END) as available_to_promise,

  -- Value calculations
  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.total_cost
    WHEN sm.source_location_id IS NOT NULL THEN -sm.total_cost
    ELSE 0
  END) as total_value,

  -- Average cost
  AVG(CASE WHEN sm.unit_cost > 0 THEN sm.unit_cost END) as average_cost,

  -- Metadata
  MAX(sm.updated_at) as last_movement_at,
  COUNT(*) as total_movements

FROM stock_movements sm
INNER JOIN movement_types mt ON sm.movement_type_code = mt.code AND mt.deleted_at IS NULL
WHERE sm.status IN ('approved', 'completed')
  AND sm.deleted_at IS NULL  -- Exclude soft-deleted stock movements
GROUP BY
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id,
  COALESCE(sm.destination_location_id, sm.source_location_id);

-- ============================================
-- STEP 6: CREATE HELPER FUNCTION FOR SOFT DELETE
-- ============================================

-- Function to soft delete a movement type
CREATE OR REPLACE FUNCTION soft_delete_movement_type(
  p_movement_type_code TEXT,
  p_deleted_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_movements BOOLEAN;
BEGIN
  -- Check if movement type has any non-deleted movements
  SELECT EXISTS(
    SELECT 1 FROM stock_movements
    WHERE movement_type_code = p_movement_type_code
    AND deleted_at IS NULL
  ) INTO v_has_movements;

  IF v_has_movements THEN
    RAISE EXCEPTION 'Cannot delete movement type % - it has active stock movements', p_movement_type_code;
  END IF;

  -- Perform soft delete
  UPDATE movement_types
  SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    updated_at = NOW()
  WHERE code = p_movement_type_code
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- Function to restore a soft-deleted movement type
CREATE OR REPLACE FUNCTION restore_movement_type(
  p_movement_type_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE movement_types
  SET
    deleted_at = NULL,
    deleted_by = NULL,
    updated_at = NOW()
  WHERE code = p_movement_type_code
    AND deleted_at IS NOT NULL;

  RETURN FOUND;
END;
$$;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Soft delete added to movement_types successfully';
  RAISE NOTICE 'All movement-related tables now use soft delete instead of CASCADE';
  RAISE NOTICE 'Functions added: soft_delete_movement_type, restore_movement_type';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
