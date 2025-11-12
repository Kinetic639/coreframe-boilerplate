-- =============================================
-- Enhance Stock Reservations for Sales Orders Integration
-- Created: 2024-11-12
-- Purpose: Add sales order specific fields and create available inventory view
-- Dependencies: stock_reservations, sales_orders
-- =============================================

-- =============================================
-- STEP 1: Add sales order fields to stock_reservations
-- =============================================

DO $$
BEGIN
  -- Add sales_order_id reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'sales_order_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN sales_order_id UUID REFERENCES sales_orders(id) ON DELETE RESTRICT;

    RAISE NOTICE 'Added sales_order_id column to stock_reservations';
  END IF;

  -- Add sales_order_item_id reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'sales_order_item_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE RESTRICT;

    RAISE NOTICE 'Added sales_order_item_id column to stock_reservations';
  END IF;

  -- Add priority field (for allocation when stock is low)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'priority'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN priority INTEGER DEFAULT 0;

    RAISE NOTICE 'Added priority column to stock_reservations';
  END IF;

  -- Add auto_release field (automatically release when fulfilled)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'auto_release'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN auto_release BOOLEAN DEFAULT true;

    RAISE NOTICE 'Added auto_release column to stock_reservations';
  END IF;
END $$;

-- Create index for sales order lookups
CREATE INDEX IF NOT EXISTS idx_stock_reservations_sales_order
ON stock_reservations(sales_order_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_reservations_sales_order_item
ON stock_reservations(sales_order_item_id) WHERE deleted_at IS NULL;

-- =============================================
-- STEP 2: Create available inventory view
-- =============================================

-- Drop view if exists
DROP VIEW IF EXISTS product_available_inventory;

-- Create view that calculates available quantity (on_hand - reserved)
CREATE OR REPLACE VIEW product_available_inventory AS
SELECT
  pls.product_id,
  pls.variant_id,
  pls.location_id,
  pls.organization_id,
  pls.branch_id,
  pls.quantity_on_hand,

  -- Calculate total reserved quantity (only active reservations)
  COALESCE(
    (SELECT SUM(sr.reserved_quantity - sr.released_quantity)
     FROM stock_reservations sr
     WHERE sr.product_id = pls.product_id
       AND (sr.variant_id = pls.variant_id OR (sr.variant_id IS NULL AND pls.variant_id IS NULL))
       AND sr.location_id = pls.location_id
       AND sr.status IN ('active', 'partial')
       AND sr.deleted_at IS NULL
       AND (sr.expires_at IS NULL OR sr.expires_at > NOW())
    ), 0
  ) as reserved_quantity,

  -- Calculate available quantity
  pls.quantity_on_hand - COALESCE(
    (SELECT SUM(sr.reserved_quantity - sr.released_quantity)
     FROM stock_reservations sr
     WHERE sr.product_id = pls.product_id
       AND (sr.variant_id = pls.variant_id OR (sr.variant_id IS NULL AND pls.variant_id IS NULL))
       AND sr.location_id = pls.location_id
       AND sr.status IN ('active', 'partial')
       AND sr.deleted_at IS NULL
       AND (sr.expires_at IS NULL OR sr.expires_at > NOW())
    ), 0
  ) as available_quantity,

  pls.updated_at
FROM product_location_stock pls
WHERE pls.deleted_at IS NULL;

-- Comment on view
COMMENT ON VIEW product_available_inventory IS 'Real-time view of available inventory (on_hand - reserved) per product/variant/location';

-- =============================================
-- STEP 3: Function to check product availability
-- =============================================

CREATE OR REPLACE FUNCTION check_product_availability(
  p_product_id UUID,
  p_variant_id UUID,
  p_location_id UUID,
  p_quantity DECIMAL
)
RETURNS TABLE (
  is_available BOOLEAN,
  available_quantity DECIMAL,
  reserved_quantity DECIMAL,
  on_hand_quantity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pai.available_quantity >= p_quantity as is_available,
    pai.available_quantity,
    pai.reserved_quantity,
    pai.quantity_on_hand as on_hand_quantity
  FROM product_available_inventory pai
  WHERE pai.product_id = p_product_id
    AND (pai.variant_id = p_variant_id OR (pai.variant_id IS NULL AND p_variant_id IS NULL))
    AND pai.location_id = p_location_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_product_availability IS 'Check if sufficient quantity is available for reservation';

-- =============================================
-- STEP 4: Function to auto-generate reservation numbers
-- =============================================

CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  -- Format: RSV-YYYY-#####
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get next sequential number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(reservation_number FROM 10) AS INTEGER)), 0) + 1
  INTO next_num
  FROM stock_reservations
  WHERE reservation_number LIKE 'RSV-' || year_part || '-%';

  -- Generate reservation number
  NEW.reservation_number := 'RSV-' || year_part || '-' || LPAD(next_num::TEXT, 5, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating reservation numbers
DROP TRIGGER IF EXISTS trg_generate_reservation_number ON stock_reservations;
CREATE TRIGGER trg_generate_reservation_number
  BEFORE INSERT ON stock_reservations
  FOR EACH ROW
  WHEN (NEW.reservation_number IS NULL OR NEW.reservation_number = '' OR NEW.reservation_number LIKE 'TEMP-%')
  EXECUTE FUNCTION generate_reservation_number();

-- =============================================
-- STEP 5: Function to create reservation for sales order item
-- =============================================

CREATE OR REPLACE FUNCTION create_sales_order_reservation(
  p_sales_order_id UUID,
  p_sales_order_item_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_location_id UUID,
  p_quantity DECIMAL,
  p_organization_id UUID,
  p_branch_id UUID,
  p_created_by UUID,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_reservation_id UUID;
  v_available DECIMAL;
  v_order_number TEXT;
BEGIN
  -- Check availability
  SELECT available_quantity INTO v_available
  FROM product_available_inventory
  WHERE product_id = p_product_id
    AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL))
    AND location_id = p_location_id;

  IF v_available IS NULL OR v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock available. Available: %, Requested: %', COALESCE(v_available, 0), p_quantity;
  END IF;

  -- Get order number for reference
  SELECT order_number INTO v_order_number
  FROM sales_orders
  WHERE id = p_sales_order_id;

  -- Create reservation
  INSERT INTO stock_reservations (
    organization_id,
    branch_id,
    product_id,
    variant_id,
    location_id,
    quantity,
    reserved_quantity,
    reference_type,
    reference_id,
    reference_number,
    sales_order_id,
    sales_order_item_id,
    status,
    expires_at,
    created_by,
    auto_release
  ) VALUES (
    p_organization_id,
    p_branch_id,
    p_product_id,
    p_variant_id,
    p_location_id,
    p_quantity,
    p_quantity, -- Initially fully reserved
    'sales_order',
    p_sales_order_id,
    v_order_number,
    p_sales_order_id,
    p_sales_order_item_id,
    'active',
    p_expires_at,
    p_created_by,
    true
  )
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_sales_order_reservation IS 'Create stock reservation for a sales order item with availability check';

-- =============================================
-- STEP 6: Function to release reservation
-- =============================================

CREATE OR REPLACE FUNCTION release_reservation(
  p_reservation_id UUID,
  p_quantity_to_release DECIMAL DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_reservation RECORD;
  v_release_qty DECIMAL;
BEGIN
  -- Get reservation details
  SELECT * INTO v_reservation
  FROM stock_reservations
  WHERE id = p_reservation_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  -- Determine quantity to release
  IF p_quantity_to_release IS NULL THEN
    v_release_qty := v_reservation.reserved_quantity - v_reservation.released_quantity;
  ELSE
    v_release_qty := LEAST(p_quantity_to_release, v_reservation.reserved_quantity - v_reservation.released_quantity);
  END IF;

  -- Update reservation
  UPDATE stock_reservations
  SET
    released_quantity = released_quantity + v_release_qty,
    status = CASE
      WHEN released_quantity + v_release_qty >= quantity THEN 'fulfilled'
      WHEN released_quantity + v_release_qty > 0 THEN 'partial'
      ELSE status
    END,
    fulfilled_at = CASE
      WHEN released_quantity + v_release_qty >= quantity THEN NOW()
      ELSE fulfilled_at
    END,
    updated_at = NOW()
  WHERE id = p_reservation_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_reservation IS 'Release stock reservation (partial or full)';

-- =============================================
-- STEP 7: Function to cancel reservation
-- =============================================

CREATE OR REPLACE FUNCTION cancel_reservation(
  p_reservation_id UUID,
  p_cancelled_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE stock_reservations
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = p_cancelled_by,
    updated_at = NOW()
  WHERE id = p_reservation_id
    AND deleted_at IS NULL
    AND status NOT IN ('fulfilled', 'cancelled');

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancel_reservation IS 'Cancel an active or partial reservation';

-- =============================================
-- STEP 8: Scheduled job to expire old reservations
-- =============================================

-- Function to expire old reservations
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE stock_reservations
  SET
    status = 'expired',
    updated_at = NOW()
  WHERE status IN ('active', 'partial')
    AND expires_at IS NOT NULL
    AND expires_at < NOW()
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_reservations IS 'Expire reservations that have passed their expiration date';

-- =============================================
-- Migration Complete
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Stock reservations enhanced for sales orders';
  RAISE NOTICE '📊 View: product_available_inventory (on_hand - reserved)';
  RAISE NOTICE '🔢 Auto-numbering: RSV-YYYY-#####';
  RAISE NOTICE '🔍 Functions: check_product_availability, create_sales_order_reservation';
  RAISE NOTICE '♻️  Functions: release_reservation, cancel_reservation';
  RAISE NOTICE '⏰ Scheduled: expire_old_reservations (requires cron setup)';
END $$;
