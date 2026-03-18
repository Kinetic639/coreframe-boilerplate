-- =====================================================
-- Phase 3: Fix Stock Alerts to Work at Branch Level
-- =====================================================
-- This migration fixes the stock alerts system to:
-- 1. Use warehouse-level stock totals (not bin-level)
-- 2. Use per-warehouse reorder points from product_branch_settings
-- 3. Create ONE alert per product per warehouse (not per bin)
-- 4. Set location_id to NULL (alerts are warehouse-level)
--
-- Changes:
-- - Make stock_alerts.branch_id NOT NULL
-- - Drop and recreate check_stock_levels_and_alert() function
-- - Update get_alert_summary() function
-- - Update calculate_order_quantity() function to accept branch_id
--
-- Migration ID: 20251118000008
-- Phase: 3 - Alerts System
-- =====================================================

-- =====================================================
-- Step 1: Make branch_id NOT NULL in stock_alerts
-- =====================================================

-- Backfill any NULL branch_id from location (shouldn't exist)
DO $$
DECLARE
  v_null_alerts INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_alerts
  FROM stock_alerts
  WHERE branch_id IS NULL;

  IF v_null_alerts > 0 THEN
    RAISE NOTICE 'Found % alerts without branch_id. Backfilling from location...', v_null_alerts;

    UPDATE stock_alerts sa
    SET branch_id = l.branch_id
    FROM locations l
    WHERE sa.location_id = l.id
      AND sa.branch_id IS NULL;

    RAISE NOTICE 'Backfilled branch_id for alerts with location references';
  END IF;
END $$;

-- Make branch_id NOT NULL
ALTER TABLE stock_alerts
ALTER COLUMN branch_id SET NOT NULL;

-- Add comment
COMMENT ON COLUMN stock_alerts.branch_id IS
  'Branch (warehouse) where the alert applies.
   REQUIRED: Alerts are warehouse-level, not bin-level.
   One alert per product per warehouse when stock falls below reorder point.';

COMMENT ON COLUMN stock_alerts.location_id IS
  'DEPRECATED: Set to NULL for warehouse-level alerts.
   Kept for backward compatibility but not used in new alert detection.
   Alerts track warehouse totals, not individual bin levels.';

-- =====================================================
-- Step 2: Update calculate_order_quantity function
-- =====================================================

-- Drop old version (with p_available_stock parameter)
DROP FUNCTION IF EXISTS calculate_order_quantity(UUID, UUID, DECIMAL);

-- Create new version with branch_id parameter
CREATE OR REPLACE FUNCTION calculate_order_quantity(
  p_product_id UUID,
  p_supplier_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  base_quantity DECIMAL,
  adjusted_quantity DECIMAL,
  final_quantity DECIMAL,
  packages DECIMAL,
  package_unit TEXT,
  calculation_notes TEXT
) AS $$
DECLARE
  product_settings RECORD;
  supplier_settings RECORD;
  current_stock DECIMAL;
  suggested_qty DECIMAL;
  adj_qty DECIMAL;
  pkg_qty DECIMAL;
  pkg_unit TEXT;
  notes TEXT := '';
BEGIN
  -- Get product branch settings (or fall back to product defaults)
  IF p_branch_id IS NOT NULL THEN
    SELECT
      COALESCE(pbs.reorder_quantity, p.reorder_quantity) as reorder_quantity,
      COALESCE(pbs.max_stock_level, p.max_stock_level) as max_stock_level,
      COALESCE(pbs.reorder_calculation_method, p.reorder_calculation_method) as calculation_method,
      COALESCE(pbs.reorder_point, p.reorder_point) as reorder_point
    INTO product_settings
    FROM products p
    LEFT JOIN product_branch_settings pbs
      ON p.id = pbs.product_id AND pbs.branch_id = p_branch_id AND pbs.deleted_at IS NULL
    WHERE p.id = p_product_id;
  ELSE
    -- Fallback to global product settings
    SELECT
      reorder_quantity,
      max_stock_level,
      reorder_calculation_method as calculation_method,
      reorder_point
    INTO product_settings
    FROM products
    WHERE id = p_product_id;
  END IF;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::TEXT, 'Product not found'::TEXT;
    RETURN;
  END IF;

  -- Get current stock for this branch (or total if no branch specified)
  IF p_branch_id IS NOT NULL THEN
    SELECT COALESCE(available_quantity, 0)
    INTO current_stock
    FROM product_available_inventory_by_branch
    WHERE product_id = p_product_id
      AND branch_id = p_branch_id;
  ELSE
    SELECT COALESCE(SUM(available_quantity), 0)
    INTO current_stock
    FROM product_available_inventory;
  END IF;

  -- Calculate base quantity based on method
  CASE product_settings.calculation_method
    WHEN 'fixed' THEN
      suggested_qty := COALESCE(product_settings.reorder_quantity, 0);
      notes := 'Fixed reorder quantity';

    WHEN 'min_max' THEN
      suggested_qty := GREATEST(
        COALESCE(product_settings.max_stock_level, 0) - current_stock,
        0
      );
      notes := 'Min/Max calculation: ' || COALESCE(product_settings.max_stock_level, 0)::TEXT || ' - ' || current_stock::TEXT;

    WHEN 'auto' THEN
      -- Placeholder for demand-based calculation (future)
      suggested_qty := COALESCE(product_settings.reorder_quantity, 0);
      notes := 'Auto calculation (not yet implemented, using fixed)';

    ELSE
      -- Default to fixed
      suggested_qty := COALESCE(product_settings.reorder_quantity, 0);
      notes := 'Default: fixed reorder quantity';
  END CASE;

  -- Get supplier packaging constraints
  IF p_supplier_id IS NOT NULL THEN
    SELECT
      minimum_order_quantity,
      order_multiple,
      package_quantity,
      package_unit
    INTO supplier_settings
    FROM product_suppliers
    WHERE product_id = p_product_id
      AND supplier_id = p_supplier_id
      AND deleted_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      -- Apply MOQ
      IF supplier_settings.minimum_order_quantity IS NOT NULL
         AND suggested_qty < supplier_settings.minimum_order_quantity THEN
        adj_qty := supplier_settings.minimum_order_quantity;
        notes := notes || '; Applied MOQ: ' || supplier_settings.minimum_order_quantity::TEXT;
      ELSE
        adj_qty := suggested_qty;
      END IF;

      -- Apply order multiples
      IF supplier_settings.order_multiple IS NOT NULL AND supplier_settings.order_multiple > 0 THEN
        adj_qty := CEIL(adj_qty / supplier_settings.order_multiple) * supplier_settings.order_multiple;
        notes := notes || '; Rounded to multiple of ' || supplier_settings.order_multiple::TEXT;
      END IF;

      -- Calculate packages
      IF supplier_settings.package_quantity IS NOT NULL AND supplier_settings.package_quantity > 0 THEN
        pkg_qty := CEIL(adj_qty / supplier_settings.package_quantity);
        pkg_unit := supplier_settings.package_unit;
        notes := notes || '; ' || pkg_qty::TEXT || ' ' || COALESCE(pkg_unit, 'packages');
      ELSE
        pkg_qty := adj_qty;
        pkg_unit := NULL;
      END IF;
    ELSE
      adj_qty := suggested_qty;
      pkg_qty := suggested_qty;
      pkg_unit := NULL;
    END IF;
  ELSE
    adj_qty := suggested_qty;
    pkg_qty := suggested_qty;
    pkg_unit := NULL;
  END IF;

  RETURN QUERY SELECT
    suggested_qty,
    adj_qty,
    adj_qty as final_quantity,
    pkg_qty,
    pkg_unit,
    notes;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_order_quantity(UUID, UUID, UUID) IS
  'Calculate suggested order quantity with supplier packaging constraints.

   Updated to support per-branch reorder settings.

   Parameters:
   - p_product_id: Product to calculate for
   - p_supplier_id: Supplier (optional, for packaging constraints)
   - p_branch_id: Branch/warehouse (optional, for branch-specific settings)

   Returns:
   - base_quantity: Raw calculated quantity
   - adjusted_quantity: After MOQ and multiples applied
   - final_quantity: Final recommended order quantity
   - packages: Number of packages to order
   - package_unit: Unit name (box, pallet, etc.)
   - calculation_notes: Explanation of calculation';

-- =====================================================
-- Step 3: Drop and recreate alert detection function
-- =====================================================

DROP FUNCTION IF EXISTS check_stock_levels_and_alert(UUID);

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
  product_branch_record RECORD;
  alert_count INTEGER := 0;
  resolved_count INTEGER := 0;
  updated_count INTEGER := 0;
  notification_count INTEGER := 0;
  new_alert_id UUID;
  suggested_qty RECORD;
  preferred_supplier UUID;
BEGIN
  -- STEP 1: Update stock quantities in existing ACTIVE alerts
  -- This ensures the UI shows current warehouse stock levels, not stale snapshots
  UPDATE stock_alerts sa
  SET
    quantity_on_hand = inv.quantity_on_hand,
    reserved_quantity = inv.reserved_quantity,
    current_stock = inv.available_quantity,
    available_stock = inv.available_quantity,
    updated_at = NOW()
  FROM product_available_inventory_by_branch inv
  WHERE sa.product_id = inv.product_id
    AND sa.branch_id = inv.branch_id
    AND sa.product_variant_id IS NOT DISTINCT FROM inv.variant_id
    AND sa.status = 'active'
    AND (p_organization_id IS NULL OR sa.organization_id = p_organization_id);

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- STEP 2: Auto-resolve alerts where warehouse stock returned above reorder point
  UPDATE stock_alerts sa
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolution_notes = 'Auto-resolved: warehouse stock level returned above reorder point'
  FROM product_available_inventory_by_branch inv
  INNER JOIN product_branch_settings pbs
    ON inv.product_id = pbs.product_id
   AND inv.branch_id = pbs.branch_id
   AND pbs.deleted_at IS NULL
  WHERE sa.product_id = inv.product_id
    AND sa.branch_id = inv.branch_id
    AND sa.product_variant_id IS NOT DISTINCT FROM inv.variant_id
    AND sa.status = 'active'
    AND inv.available_quantity > pbs.reorder_point
    AND (p_organization_id IS NULL OR sa.organization_id = p_organization_id);

  GET DIAGNOSTICS resolved_count = ROW_COUNT;

  -- STEP 3: Find products below reorder point and create NEW alerts (warehouse-level)
  FOR product_branch_record IN
    SELECT
      p.id as product_id,
      p.organization_id,
      p.name,
      pbs.branch_id,
      pbs.reorder_point,
      pbs.send_low_stock_alerts,
      pbs.reorder_calculation_method,
      inv.quantity_on_hand,
      inv.reserved_quantity,
      inv.available_quantity,
      inv.locations_count
    FROM products p
    INNER JOIN product_branch_settings pbs
      ON p.id = pbs.product_id
     AND pbs.deleted_at IS NULL
    INNER JOIN product_available_inventory_by_branch inv
      ON p.id = inv.product_id
     AND pbs.branch_id = inv.branch_id
    WHERE pbs.track_inventory = true
      AND pbs.reorder_point IS NOT NULL
      AND pbs.reorder_point > 0
      AND p.deleted_at IS NULL
      AND inv.available_quantity <= pbs.reorder_point
      AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
  LOOP
    -- Check if alert already exists for this product/warehouse (prevent duplicates)
    IF NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE product_id = product_branch_record.product_id
        AND branch_id = product_branch_record.branch_id
        AND status = 'active'
        AND created_at > NOW() - INTERVAL '24 hours'
    ) THEN
      -- Get preferred supplier
      SELECT supplier_id INTO preferred_supplier
      FROM product_suppliers
      WHERE product_id = product_branch_record.product_id
        AND is_preferred = true
        AND deleted_at IS NULL
      LIMIT 1;

      -- Calculate suggested order quantity for THIS warehouse
      SELECT * INTO suggested_qty
      FROM calculate_order_quantity(
        product_branch_record.product_id,
        preferred_supplier,
        product_branch_record.branch_id
      );

      -- Create alert (ONE per product per warehouse, location_id = NULL)
      INSERT INTO stock_alerts (
        organization_id,
        branch_id,
        product_id,
        product_variant_id,
        location_id,
        current_stock,
        reorder_point,
        available_stock,
        quantity_on_hand,
        reserved_quantity,
        suggested_order_quantity,
        suggested_packages,
        suggested_supplier_id,
        calculation_method,
        alert_type,
        severity,
        status,
        notification_sent,
        notification_sent_at
      )
      VALUES (
        product_branch_record.organization_id,
        product_branch_record.branch_id,
        product_branch_record.product_id,
        NULL,  -- variant_id (add variant support later if needed)
        NULL,  -- ✅ location_id is NULL - alert is WAREHOUSE-LEVEL
        product_branch_record.available_quantity,
        product_branch_record.reorder_point,
        product_branch_record.available_quantity,
        product_branch_record.quantity_on_hand,
        product_branch_record.reserved_quantity,
        suggested_qty.final_quantity,
        suggested_qty.packages,
        preferred_supplier,
        product_branch_record.reorder_calculation_method,
        CASE
          WHEN product_branch_record.available_quantity = 0 THEN 'out_of_stock'
          ELSE 'low_stock'
        END,
        CASE
          WHEN product_branch_record.available_quantity = 0 THEN 'critical'
          WHEN product_branch_record.available_quantity < product_branch_record.reorder_point * 0.5 THEN 'critical'
          ELSE 'warning'
        END,
        'active',
        NOT product_branch_record.send_low_stock_alerts,
        CASE
          WHEN NOT product_branch_record.send_low_stock_alerts THEN NOW()
          ELSE NULL
        END
      )
      RETURNING id INTO new_alert_id;

      alert_count := alert_count + 1;

      IF product_branch_record.send_low_stock_alerts THEN
        notification_count := notification_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT alert_count, resolved_count, updated_count, notification_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON FUNCTION check_stock_levels_and_alert IS
  'Warehouse-level stock alert detection with per-branch reorder points.

   KEY CHANGES from previous version:
   - Uses product_branch_settings for warehouse-specific reorder points
   - Compares WAREHOUSE TOTAL stock (not bin-level) to reorder point
   - Creates ONE alert per product per warehouse (not per bin)
   - Sets location_id to NULL (alert is warehouse-level)
   - Updates existing alerts with current warehouse stock levels

   Three operations:
   1. UPDATE: Refreshes stock quantities in existing active alerts
   2. RESOLVE: Auto-resolves alerts when warehouse stock returns above threshold
   3. CREATE: Creates new alerts for warehouses below their reorder point

   Example:
   - Warsaw warehouse: 105 units total across 3 bins
   - Warsaw reorder_point: 100 units
   - Result: 105 > 100 → NO alert created ✅

   - Poznań warehouse: 80 units total across 2 bins
   - Poznań reorder_point: 300 units
   - Result: 80 < 300 → CREATE alert ✅';

-- =====================================================
-- Step 4: Update alert summary function
-- =====================================================

-- Drop old version (has different return signature)
DROP FUNCTION IF EXISTS get_alert_summary(UUID);

-- Create new version with affected_branches and affected_products
CREATE OR REPLACE FUNCTION get_alert_summary(
  p_organization_id UUID
)
RETURNS TABLE (
  total_active INTEGER,
  critical_count INTEGER,
  warning_count INTEGER,
  info_count INTEGER,
  out_of_stock_count INTEGER,
  notification_enabled_count INTEGER,
  pending_notifications INTEGER,
  affected_branches INTEGER,
  affected_products INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_active,
    COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER as critical_count,
    COUNT(*) FILTER (WHERE severity = 'warning')::INTEGER as warning_count,
    COUNT(*) FILTER (WHERE severity = 'info')::INTEGER as info_count,
    COUNT(*) FILTER (WHERE alert_type = 'out_of_stock')::INTEGER as out_of_stock_count,
    COUNT(*) FILTER (WHERE notification_sent = false AND status = 'active')::INTEGER as notification_enabled_count,
    COUNT(*) FILTER (WHERE notification_sent = false AND status = 'active')::INTEGER as pending_notifications,
    COUNT(DISTINCT branch_id)::INTEGER as affected_branches,
    COUNT(DISTINCT product_id)::INTEGER as affected_products
  FROM stock_alerts
  WHERE organization_id = p_organization_id
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_alert_summary IS
  'Get summary statistics for active stock alerts.

   Updated to include affected_branches and affected_products counts.
   Shows how many warehouses and unique products have active alerts.';

-- =====================================================
-- Step 5: Add indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_stock_alerts_branch_product_active
  ON stock_alerts(branch_id, product_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_stock_alerts_org_branch_active
  ON stock_alerts(organization_id, branch_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_stock_alerts_branch_severity
  ON stock_alerts(branch_id, severity)
  WHERE status = 'active';

-- Log completion
DO $$
DECLARE
  v_active_alerts INTEGER;
  v_affected_branches INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT branch_id)
  INTO v_active_alerts, v_affected_branches
  FROM stock_alerts
  WHERE status = 'active';

  RAISE NOTICE '=== Stock Alerts System Fixed ===';
  RAISE NOTICE 'Alerts now work at WAREHOUSE level (not bin level)';
  RAISE NOTICE 'Uses per-warehouse reorder points from product_branch_settings';
  RAISE NOTICE 'Creates ONE alert per product per warehouse';
  RAISE NOTICE 'Alert location_id set to NULL (warehouse-level)';
  RAISE NOTICE '';
  RAISE NOTICE 'Current active alerts: %', v_active_alerts;
  RAISE NOTICE 'Affected warehouses: %', v_affected_branches;
  RAISE NOTICE '';
  RAISE NOTICE 'Run SELECT * FROM check_stock_levels_and_alert() to refresh alerts';
  RAISE NOTICE '=====================================';
END $$;
