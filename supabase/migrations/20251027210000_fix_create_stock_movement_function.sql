-- =============================================
-- Fix create_stock_movement function to accept ALL fields
-- Adds missing parameters: reference_number, batch_number, serial_number,
-- lot_number, expiry_date, manufacturing_date, currency, metadata
-- =============================================

-- Drop the old function
DROP FUNCTION IF EXISTS create_stock_movement(
  TEXT, UUID, UUID, UUID, DECIMAL,
  UUID, UUID, UUID, DECIMAL, TEXT,
  UUID, UUID, TEXT, TIMESTAMPTZ
);

-- Create the complete function with ALL parameters
CREATE OR REPLACE FUNCTION create_stock_movement(
  -- Core movement fields
  p_movement_type_code TEXT,
  p_organization_id UUID,
  p_branch_id UUID,
  p_product_id UUID,
  p_quantity DECIMAL,

  -- Location fields
  p_source_location_id UUID DEFAULT NULL,
  p_destination_location_id UUID DEFAULT NULL,

  -- Product variant
  p_variant_id UUID DEFAULT NULL,

  -- Cost fields
  p_unit_cost DECIMAL DEFAULT NULL,
  p_currency TEXT DEFAULT 'PLN',

  -- Reference fields
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,

  -- Tracking fields
  p_batch_number TEXT DEFAULT NULL,
  p_serial_number TEXT DEFAULT NULL,
  p_lot_number TEXT DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL,
  p_manufacturing_date DATE DEFAULT NULL,

  -- User and timestamp
  p_created_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),

  -- Additional data
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement_id UUID;
  v_movement_number TEXT;
  v_movement_type RECORD;
  v_category TEXT;
  v_requires_approval BOOLEAN;
  v_total_cost DECIMAL;
BEGIN
  -- Get movement type details
  SELECT * INTO v_movement_type
  FROM movement_types
  WHERE code = p_movement_type_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement type % not found', p_movement_type_code;
  END IF;

  -- Validate requirements
  IF v_movement_type.requires_source_location AND p_source_location_id IS NULL THEN
    RAISE EXCEPTION 'Movement type % requires source location', p_movement_type_code;
  END IF;

  IF v_movement_type.requires_destination_location AND p_destination_location_id IS NULL THEN
    RAISE EXCEPTION 'Movement type % requires destination location', p_movement_type_code;
  END IF;

  -- Ensure we have at least one location (source or destination)
  IF p_source_location_id IS NULL AND p_destination_location_id IS NULL THEN
    RAISE EXCEPTION 'At least one location (source or destination) must be specified';
  END IF;

  -- Check stock availability for issue movements
  IF v_movement_type.category = 'issue' AND p_source_location_id IS NOT NULL THEN
    IF NOT check_stock_availability(p_product_id, p_variant_id, p_source_location_id, p_quantity) THEN
      RAISE EXCEPTION 'Insufficient stock at location';
    END IF;
  END IF;

  -- Generate movement number
  v_movement_number := generate_movement_number(p_organization_id, p_movement_type_code);

  -- Calculate total cost
  v_total_cost := CASE WHEN p_unit_cost IS NOT NULL THEN p_unit_cost * p_quantity ELSE NULL END;

  -- Insert movement with ALL fields
  INSERT INTO stock_movements (
    movement_number,
    movement_type_code,
    category,
    organization_id,
    branch_id,
    product_id,
    variant_id,
    source_location_id,
    destination_location_id,
    quantity,
    unit_cost,
    total_cost,
    currency,
    reference_type,
    reference_id,
    reference_number,
    batch_number,
    serial_number,
    lot_number,
    expiry_date,
    manufacturing_date,
    requires_approval,
    status,
    occurred_at,
    created_by,
    notes,
    metadata
  ) VALUES (
    v_movement_number,
    p_movement_type_code,
    v_movement_type.category,
    p_organization_id,
    p_branch_id,
    p_product_id,
    p_variant_id,
    p_source_location_id,
    p_destination_location_id,
    p_quantity,
    p_unit_cost,
    v_total_cost,
    p_currency,
    p_reference_type,
    p_reference_id,
    p_reference_number,
    p_batch_number,
    p_serial_number,
    p_lot_number,
    p_expiry_date,
    p_manufacturing_date,
    v_movement_type.requires_approval,
    CASE WHEN v_movement_type.requires_approval THEN 'pending' ELSE 'approved' END,
    p_occurred_at,
    p_created_by,
    p_notes,
    p_metadata
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

-- Add comment explaining the updated function
COMMENT ON FUNCTION create_stock_movement IS
'Creates a stock movement with comprehensive validation and all supported fields.
Now includes: reference_number, batch_number, serial_number, lot_number,
expiry_date, manufacturing_date, currency, and metadata.
Updated: 2025-10-27';

-- Test the function
DO $$
BEGIN
  RAISE NOTICE '=== create_stock_movement function updated ===';
  RAISE NOTICE 'Added support for:';
  RAISE NOTICE '  - reference_number (TEXT)';
  RAISE NOTICE '  - batch_number (TEXT)';
  RAISE NOTICE '  - serial_number (TEXT)';
  RAISE NOTICE '  - lot_number (TEXT)';
  RAISE NOTICE '  - expiry_date (DATE)';
  RAISE NOTICE '  - manufacturing_date (DATE)';
  RAISE NOTICE '  - currency (TEXT)';
  RAISE NOTICE '  - metadata (JSONB)';
  RAISE NOTICE '========================================';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
