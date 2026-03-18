-- =============================================
-- Make destination location optional for receipt movements
-- Allows receiving deliveries without immediate location assignment
-- =============================================

-- Update movement type 101 (GR from PO) to make destination location optional
-- This allows users to receive deliveries and assign locations later if needed
UPDATE movement_types
SET requires_destination_location = false
WHERE code = '101';

-- Verify the change
DO $$
DECLARE
  v_requires_dest BOOLEAN;
BEGIN
  SELECT requires_destination_location INTO v_requires_dest
  FROM movement_types
  WHERE code = '101';

  IF v_requires_dest THEN
    RAISE EXCEPTION 'Movement type 101 still requires destination location';
  END IF;

  RAISE NOTICE 'Movement type 101 (GR from PO) now allows optional destination location';
END $$;

-- Add comment explaining this change
COMMENT ON COLUMN movement_types.requires_destination_location IS
'When true, the movement MUST have a destination_location_id. When false, destination_location_id is optional.
For receipts (type 101), this is now false to allow receiving deliveries without immediate location assignment.';

-- =============================================
-- Migration Complete
-- =============================================
