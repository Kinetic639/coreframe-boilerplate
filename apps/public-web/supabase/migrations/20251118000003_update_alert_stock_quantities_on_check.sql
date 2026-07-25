-- =====================================================
-- Update Alert Stock Quantities on Check
-- =====================================================
-- This migration modifies check_stock_levels_and_alert() to update
-- stock quantities in existing active alerts when running stock checks.
--
-- Previously: Only created new alerts and resolved alerts
-- Now: Also updates current stock levels in active alerts
--
-- Migration ID: 20251118000003
-- Type: Function Enhancement
-- =====================================================

-- Drop the existing function (required to change return type)
DROP FUNCTION IF EXISTS check_stock_levels_and_alert(UUID);

-- Recreate the function with stock update logic
CREATE OR REPLACE FUNCTION check_stock_levels_and_alert(
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  alerts_created INTEGER,
  alerts_resolved INTEGER,
  alerts_updated INTEGER,
  notifications_pending INTEGER
) AS $$
DECLARE
  product_record RECORD;
  alert_count INTEGER := 0;
  resolved_count INTEGER := 0;
  updated_count INTEGER := 0;
  notification_count INTEGER := 0;
  new_alert_id UUID;
  suggested_qty RECORD;
  preferred_supplier UUID;
BEGIN
  -- STEP 1: Update stock quantities in existing ACTIVE alerts
  -- This ensures the UI shows current stock levels, not stale snapshots
  UPDATE stock_alerts sa
  SET
    quantity_on_hand = pai.quantity_on_hand,
    reserved_quantity = pai.reserved_quantity,
    current_stock = pai.available_quantity,
    available_stock = pai.available_quantity,
    updated_at = NOW()
  FROM product_available_inventory pai
  WHERE sa.product_id = pai.product_id
    AND (sa.location_id = pai.location_id
         OR (sa.location_id IS NULL AND pai.location_id IS NULL))
    AND sa.status = 'active'
    AND (p_organization_id IS NULL OR sa.organization_id = p_organization_id);

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- STEP 2: Auto-resolve alerts where stock returned to normal
  UPDATE stock_alerts sa
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolution_notes = 'Auto-resolved: stock level returned above reorder point'
  FROM product_available_inventory pai
  WHERE sa.product_id = pai.product_id
    AND (sa.location_id = pai.location_id
         OR (sa.location_id IS NULL AND pai.location_id IS NULL))
    AND sa.status = 'active'
    AND pai.available_quantity > (
      SELECT reorder_point FROM products WHERE id = sa.product_id
    )
    AND (p_organization_id IS NULL OR sa.organization_id = p_organization_id);

  GET DIAGNOSTICS resolved_count = ROW_COUNT;

  -- STEP 3: Find products below reorder point and create NEW alerts
  FOR product_record IN
    SELECT
      p.id as product_id,
      p.organization_id,
      p.name,
      p.reorder_point,
      p.send_low_stock_alerts,
      pai.quantity_on_hand,
      pai.reserved_quantity,
      pai.available_quantity,
      pai.location_id,
      pai.branch_id
    FROM products p
    INNER JOIN product_available_inventory pai ON p.id = pai.product_id
    WHERE p.track_inventory = true
      AND p.reorder_point IS NOT NULL
      AND p.reorder_point > 0
      AND p.deleted_at IS NULL
      AND pai.available_quantity <= p.reorder_point
      AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
  LOOP
    -- Check if alert already exists for this product/location (prevent duplicates)
    IF NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE product_id = product_record.product_id
        AND (location_id = product_record.location_id
             OR (location_id IS NULL AND product_record.location_id IS NULL))
        AND status = 'active'
        AND created_at > NOW() - INTERVAL '24 hours'
    ) THEN
      -- Get preferred supplier
      SELECT supplier_id INTO preferred_supplier
      FROM product_suppliers
      WHERE product_id = product_record.product_id
        AND is_preferred = true
        AND deleted_at IS NULL
      LIMIT 1;

      -- Calculate suggested order quantity
      SELECT * INTO suggested_qty
      FROM calculate_order_quantity(product_record.product_id, preferred_supplier);

      -- Create alert (Tier 1: ALL products)
      INSERT INTO stock_alerts (
        organization_id,
        product_id,
        location_id,
        branch_id,
        current_stock,
        reorder_point,
        available_stock,
        quantity_on_hand,
        reserved_quantity,
        suggested_order_quantity,
        suggested_packages,
        suggested_supplier_id,
        alert_type,
        severity,
        status,
        notification_sent,
        notification_sent_at
      )
      VALUES (
        product_record.organization_id,
        product_record.product_id,
        product_record.location_id,
        product_record.branch_id,
        product_record.available_quantity,
        product_record.reorder_point,
        product_record.available_quantity,
        product_record.quantity_on_hand,
        product_record.reserved_quantity,
        suggested_qty.final_quantity,
        suggested_qty.packages,
        preferred_supplier,
        CASE
          WHEN product_record.available_quantity = 0 THEN 'out_of_stock'
          ELSE 'low_stock'
        END,
        CASE
          WHEN product_record.available_quantity = 0 THEN 'critical'
          WHEN product_record.available_quantity < product_record.reorder_point * 0.5 THEN 'critical'
          ELSE 'warning'
        END,
        'active',
        NOT product_record.send_low_stock_alerts,
        CASE
          WHEN NOT product_record.send_low_stock_alerts THEN NOW()
          ELSE NULL
        END
      )
      RETURNING id INTO new_alert_id;

      alert_count := alert_count + 1;

      IF product_record.send_low_stock_alerts THEN
        notification_count := notification_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT alert_count, resolved_count, updated_count, notification_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_stock_levels_and_alert IS
  'Enhanced stock alert check with three operations:
   1. UPDATE: Refreshes stock quantities in existing active alerts
   2. RESOLVE: Auto-resolves alerts when stock returns above reorder point
   3. CREATE: Creates new alerts for products below reorder point

   Three-domain replenishment pipeline:
   1. Detection: Finds products below reorder_point (this function)
   2. Decision: Calculates suggested order quantity (calls calculate_order_quantity)
   3. Adjustment: Applies supplier packaging constraints (via calculate_order_quantity)

   Two-tier alert system:
   - Tier 1: ALL low stock products logged in stock_alerts (for UI visibility)
   - Tier 2: Only products with send_low_stock_alerts=true need notifications

   Run this function:
   - On schedule (e.g., hourly via cron job)
   - After stock movements complete
   - On demand via UI action';

-- Log the change
DO $$
BEGIN
  RAISE NOTICE '=== Stock Alert Function Enhanced ===';
  RAISE NOTICE 'check_stock_levels_and_alert() now updates stock quantities in active alerts';
  RAISE NOTICE 'Returns: alerts_created, alerts_resolved, alerts_updated, notifications_pending';
  RAISE NOTICE '========================================';
END $$;
