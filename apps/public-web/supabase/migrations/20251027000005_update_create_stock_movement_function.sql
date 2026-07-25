-- =============================================
-- Update create_stock_movement function to remove location_id parameter
-- The function should only use source_location_id and destination_location_id
-- =============================================

-- Drop the old function (all versions)
DROP FUNCTION IF EXISTS create_stock_movement(
  TEXT, UUID, UUID, UUID, DECIMAL,
  UUID, UUID, UUID, UUID, DECIMAL, TEXT,
  UUID, UUID, TEXT, TIMESTAMPTZ
);

DROP FUNCTION IF EXISTS create_stock_movement(
  TEXT, UUID, UUID, UUID, DECIMAL,
  UUID, UUID, UUID, DECIMAL, TEXT,
  UUID, UUID, TEXT, TIMESTAMPTZ
);

-- Recreate the function without p_location_id parameter
CREATE OR REPLACE FUNCTION create_stock_movement(
  p_movement_type_code TEXT,
  p_organization_id UUID,
  p_branch_id UUID,
  p_product_id UUID,
  p_quantity DECIMAL,
  p_source_location_id UUID DEFAULT NULL,
  p_destination_location_id UUID DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL,
  p_unit_cost DECIMAL DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
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

  -- Insert movement (WITHOUT location_id column)
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
    reference_type,
    reference_id,
    requires_approval,
    status,
    occurred_at,
    created_by,
    notes
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
    p_reference_type,
    p_reference_id,
    v_movement_type.requires_approval,
    CASE WHEN v_movement_type.requires_approval THEN 'pending' ELSE 'approved' END,
    p_occurred_at,
    p_created_by,
    p_notes
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION create_stock_movement IS
'Creates a stock movement with proper validation.
Uses source_location_id for issues/transfers-out and destination_location_id for receipts/transfers-in.
At least one location (source or destination) must be provided based on movement type requirements.';

-- Test the function
DO $$
BEGIN
  RAISE NOTICE 'create_stock_movement function updated successfully';
  RAISE NOTICE 'Function no longer uses location_id parameter';
  RAISE NOTICE 'Only source_location_id and destination_location_id are used';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
