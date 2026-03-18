-- Migration: Add cross-branch location validation for Polish WMS compliance
-- This ensures that stock movements respect warehouse (branch) boundaries
-- Required for Polish warehouse law compliance

-- =====================================================
-- FUNCTION: Validate location belongs to branch
-- =====================================================
CREATE OR REPLACE FUNCTION validate_location_branch(
  p_location_id uuid,
  p_expected_branch_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_location_branch_id uuid;
BEGIN
  -- If location_id is NULL, validation passes (optional locations)
  IF p_location_id IS NULL THEN
    RETURN true;
  END IF;

  -- Get the branch_id of the location
  SELECT branch_id INTO v_location_branch_id
  FROM locations
  WHERE id = p_location_id
    AND deleted_at IS NULL;

  -- If location not found, fail validation
  IF v_location_branch_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if location belongs to expected branch
  RETURN v_location_branch_id = p_expected_branch_id;
END;
$$;

COMMENT ON FUNCTION validate_location_branch IS 'Validates that a location belongs to a specific branch for WMS compliance';

-- =====================================================
-- FUNCTION: Validate stock movement locations
-- =====================================================
CREATE OR REPLACE FUNCTION validate_stock_movement_locations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement_category text;
  v_is_inter_branch boolean;
BEGIN
  -- Get movement type details
  SELECT
    category,
    CASE
      WHEN code IN ('311', '312') THEN true
      ELSE false
    END as is_inter_branch
  INTO v_movement_category, v_is_inter_branch
  FROM movement_types
  WHERE code = NEW.movement_type_code;

  -- Skip validation for inter-branch transfers (311, 312)
  -- These are allowed to have locations from different branches
  IF v_is_inter_branch THEN
    RETURN NEW;
  END IF;

  -- For all other movement types, validate locations belong to the movement's branch

  -- Validate source location (if provided)
  IF NEW.source_location_id IS NOT NULL THEN
    IF NOT validate_location_branch(NEW.source_location_id, NEW.branch_id) THEN
      RAISE EXCEPTION 'Source location (%) does not belong to branch (%). Polish WMS compliance requires locations to match the movement branch.',
        NEW.source_location_id, NEW.branch_id
        USING ERRCODE = 'check_violation',
              HINT = 'Ensure the source location belongs to the same branch as the stock movement';
    END IF;
  END IF;

  -- Validate destination location (if provided)
  IF NEW.destination_location_id IS NOT NULL THEN
    IF NOT validate_location_branch(NEW.destination_location_id, NEW.branch_id) THEN
      RAISE EXCEPTION 'Destination location (%) does not belong to branch (%). Polish WMS compliance requires locations to match the movement branch.',
        NEW.destination_location_id, NEW.branch_id
        USING ERRCODE = 'check_violation',
              HINT = 'Ensure the destination location belongs to the same branch as the stock movement';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_stock_movement_locations IS 'Trigger function to enforce cross-branch location validation for Polish WMS compliance';

-- =====================================================
-- TRIGGER: Enforce location validation on stock movements
-- =====================================================
DROP TRIGGER IF EXISTS trigger_validate_stock_movement_locations ON stock_movements;

CREATE TRIGGER trigger_validate_stock_movement_locations
  BEFORE INSERT OR UPDATE OF source_location_id, destination_location_id, branch_id
  ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION validate_stock_movement_locations();

COMMENT ON TRIGGER trigger_validate_stock_movement_locations ON stock_movements IS
  'Ensures stock movements comply with Polish WMS regulations by validating locations belong to the correct branch';

-- =====================================================
-- VALIDATION: Add check for stock_reservations
-- =====================================================
CREATE OR REPLACE FUNCTION validate_stock_reservation_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate location belongs to the reservation's branch
  IF NEW.location_id IS NOT NULL THEN
    IF NOT validate_location_branch(NEW.location_id, NEW.branch_id) THEN
      RAISE EXCEPTION 'Reservation location (%) does not belong to branch (%). WMS compliance requires locations to match the reservation branch.',
        NEW.location_id, NEW.branch_id
        USING ERRCODE = 'check_violation',
              HINT = 'Ensure the location belongs to the same branch as the stock reservation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_stock_reservation_location IS 'Validates stock reservation locations belong to correct branch';

DROP TRIGGER IF EXISTS trigger_validate_stock_reservation_location ON stock_reservations;

CREATE TRIGGER trigger_validate_stock_reservation_location
  BEFORE INSERT OR UPDATE OF location_id, branch_id
  ON stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION validate_stock_reservation_location();

-- =====================================================
-- VALIDATION: Add check for stock_snapshots
-- =====================================================
CREATE OR REPLACE FUNCTION validate_stock_snapshot_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate location belongs to the snapshot's branch
  IF NOT validate_location_branch(NEW.location_id, NEW.branch_id) THEN
    RAISE EXCEPTION 'Stock snapshot location (%) does not belong to branch (%). WMS compliance requires locations to match the branch.',
      NEW.location_id, NEW.branch_id
      USING ERRCODE = 'check_violation',
            HINT = 'Ensure the location belongs to the same branch as the stock snapshot';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_stock_snapshot_location IS 'Validates stock snapshot locations belong to correct branch';

DROP TRIGGER IF EXISTS trigger_validate_stock_snapshot_location ON stock_snapshots;

CREATE TRIGGER trigger_validate_stock_snapshot_location
  BEFORE INSERT OR UPDATE OF location_id, branch_id
  ON stock_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION validate_stock_snapshot_location();

-- =====================================================
-- Add helpful comments to tables
-- =====================================================
COMMENT ON TABLE stock_movements IS
  'Stock movements with Polish WMS compliance. Locations must belong to the movement branch except for inter-branch transfers (codes 311-312).';

COMMENT ON COLUMN stock_movements.branch_id IS
  'Branch (warehouse) where this movement occurs. All locations must belong to this branch unless inter-branch transfer.';

COMMENT ON COLUMN stock_movements.source_location_id IS
  'Source location (bin) within the branch. Must belong to movement branch_id except for inter-branch transfers.';

COMMENT ON COLUMN stock_movements.destination_location_id IS
  'Destination location (bin) within the branch. Must belong to movement branch_id except for inter-branch transfers.';
