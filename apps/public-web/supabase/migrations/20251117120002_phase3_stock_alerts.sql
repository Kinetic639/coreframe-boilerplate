-- =====================================================
-- Phase 3: Low Stock Monitoring & Alerts
-- Part of: Inventory Replenishment System
-- =====================================================
-- This migration creates the stock alerts system with two-tier notifications.
--
-- Key Concept: Two-tier alert system
--   Tier 1 (UI Monitoring): ALL products below reorder_point show in UI
--   Tier 2 (Active Notifications): Only selected products send email/push alerts
--
-- This prevents alert fatigue - users see all low stock products in dashboards
-- and lists, but only get notified about critical ones.
--
-- Migration ID: 20251117120002
-- Phase: 3 of 4 (Stock Alerts)
-- Dependencies: Phase 1 (packaging), Phase 2 (replenishment)
-- =====================================================

-- Add notification flag to products table
ALTER TABLE products
ADD COLUMN send_low_stock_alerts BOOLEAN DEFAULT false;

COMMENT ON COLUMN products.send_low_stock_alerts IS
  'Tier 2: Enable active notifications (email/push) when stock falls below reorder_point.

   Does NOT affect UI visibility - all products with reorder_point set will show
   low stock indicators in the interface regardless of this setting.

   Use this for critical products that need immediate attention:
   - Fast-moving items
   - High-value products
   - Customer-facing inventory
   - Items with long lead times

   Example workflow:
   1. Set reorder_point on ALL products (Tier 1 - UI monitoring)
   2. Enable send_low_stock_alerts only for critical products (Tier 2 - notifications)';

-- Create index for products with notifications enabled
CREATE INDEX IF NOT EXISTS idx_products_low_stock_alerts
  ON products(send_low_stock_alerts)
  WHERE send_low_stock_alerts = true
    AND reorder_point IS NOT NULL
    AND deleted_at IS NULL;

-- Create stock_alerts table
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization & Branch
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,

  -- Product Information
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Stock Levels (snapshot at time of alert creation)
  current_stock DECIMAL(15,3) NOT NULL,  -- Available stock (after reservations) at alert creation
  reorder_point DECIMAL(15,3) NOT NULL,
  available_stock DECIMAL(15,3) NOT NULL,  -- Same as current_stock (kept for clarity)

  -- Suggested Replenishment (from Phase 2 calculation)
  suggested_order_quantity DECIMAL(15,3),
  suggested_packages DECIMAL(15,3),
  suggested_supplier_id UUID REFERENCES business_accounts(id) ON DELETE SET NULL,
  calculation_method TEXT,  -- 'fixed', 'min_max', 'auto'
  calculation_notes TEXT,   -- Adjustment reasons from packaging

  -- Alert Classification
  alert_type TEXT NOT NULL,  -- 'low_stock', 'out_of_stock', 'below_minimum'
  severity TEXT NOT NULL,    -- 'info', 'warning', 'critical'

  -- Two-Tier Notification System
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  notification_type TEXT,  -- 'email', 'push', 'both' (future use)

  -- Status Tracking
  status TEXT DEFAULT 'active',  -- 'active', 'acknowledged', 'resolved', 'ignored'
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (alert_type IN ('low_stock', 'out_of_stock', 'below_minimum')),
  CHECK (severity IN ('info', 'warning', 'critical')),
  CHECK (status IN ('active', 'acknowledged', 'resolved', 'ignored')),
  CHECK (notification_type IS NULL OR notification_type IN ('email', 'push', 'both')),
  CHECK (calculation_method IS NULL OR calculation_method IN ('fixed', 'min_max', 'auto'))
);

-- Create indexes for performance
CREATE INDEX idx_stock_alerts_org ON stock_alerts(organization_id);
CREATE INDEX idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX idx_stock_alerts_status ON stock_alerts(status) WHERE status = 'active';
CREATE INDEX idx_stock_alerts_severity ON stock_alerts(severity) WHERE status = 'active';
CREATE INDEX idx_stock_alerts_created ON stock_alerts(created_at DESC);
CREATE INDEX idx_stock_alerts_location ON stock_alerts(location_id) WHERE location_id IS NOT NULL;

-- Index for Tier 2 notifications (pending notifications)
CREATE INDEX idx_stock_alerts_pending_notifications
  ON stock_alerts(product_id, created_at)
  WHERE status = 'active'
    AND notification_sent = false;

-- Index for supplier-grouped queries
CREATE INDEX idx_stock_alerts_by_supplier
  ON stock_alerts(suggested_supplier_id, status)
  WHERE suggested_supplier_id IS NOT NULL AND status = 'active';

-- Auto-update timestamp trigger
CREATE TRIGGER trg_stock_alerts_updated_at
  BEFORE UPDATE ON stock_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE stock_alerts IS
  'Tracks low stock alerts with two-tier notification system.

   Tier 1 (ALL products): Logged here for UI visibility and reporting
   Tier 2 (Selected products): notification_sent flag determines if notifications sent

   Complete audit trail of all low stock events regardless of notification settings.';

COMMENT ON COLUMN stock_alerts.notification_sent IS
  'Tier 2 flag: Has notification been sent for this alert?

   - false: Notification needs to be sent (if product.send_low_stock_alerts = true)
   - true: Either notification was sent OR alerts disabled for this product

   Products with send_low_stock_alerts=false get notification_sent=true immediately
   to prevent notification jobs from processing them.';

-- Function: Check stock levels and create alerts
CREATE OR REPLACE FUNCTION check_stock_levels_and_alert(
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  alerts_created INTEGER,
  alerts_resolved INTEGER,
  notifications_pending INTEGER
) AS $$
DECLARE
  product_record RECORD;
  alert_count INTEGER := 0;
  resolved_count INTEGER := 0;
  notification_count INTEGER := 0;
  new_alert_id UUID;
  suggested_qty RECORD;
  preferred_supplier UUID;
BEGIN
  -- Find products below reorder point (Tier 1: ALL products)
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

      -- Calculate suggested order quantity (Phase 2 function)
      IF preferred_supplier IS NOT NULL THEN
        SELECT * INTO suggested_qty
        FROM calculate_order_quantity(
          product_record.product_id,
          preferred_supplier,
          product_record.available_quantity
        );
      END IF;

      -- Create new alert
      INSERT INTO stock_alerts (
        organization_id,
        branch_id,
        product_id,
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
        calculation_notes,
        alert_type,
        severity,
        status,
        notification_sent,
        notification_sent_at
      ) VALUES (
        product_record.organization_id,
        product_record.branch_id,
        product_record.product_id,
        product_record.location_id,
        product_record.available_quantity,  -- Available stock (after reservations)
        product_record.reorder_point,
        product_record.available_quantity,  -- Same as current_stock
        product_record.quantity_on_hand,    -- Physical stock
        product_record.reserved_quantity,   -- Reserved stock
        suggested_qty.adjusted_quantity,
        suggested_qty.packages,
        preferred_supplier,
        suggested_qty.calculation_method,
        suggested_qty.adjustment_reason,
        -- Determine alert type based on stock level
        CASE
          WHEN product_record.available_quantity = 0 THEN 'out_of_stock'
          WHEN product_record.available_quantity < product_record.reorder_point * 0.5 THEN 'below_minimum'
          ELSE 'low_stock'
        END,
        -- Determine severity
        CASE
          WHEN product_record.available_quantity = 0 THEN 'critical'
          WHEN product_record.available_quantity < product_record.reorder_point * 0.5 THEN 'critical'
          ELSE 'warning'
        END,
        'active',
        -- Tier 2: Mark as "sent" if alerts disabled (prevents notification jobs from processing)
        NOT product_record.send_low_stock_alerts,
        CASE
          WHEN NOT product_record.send_low_stock_alerts THEN NOW()
          ELSE NULL
        END
      )
      RETURNING id INTO new_alert_id;

      alert_count := alert_count + 1;

      -- Count notifications that need to be sent (Tier 2)
      IF product_record.send_low_stock_alerts THEN
        notification_count := notification_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- Auto-resolve alerts where stock returned to normal
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
    );

  GET DIAGNOSTICS resolved_count = ROW_COUNT;

  RETURN QUERY SELECT alert_count, resolved_count, notification_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_stock_levels_and_alert IS
  'Three-domain replenishment pipeline:
   1. Detection: Finds products below reorder_point (this function)
   2. Decision: Calculates suggested order quantity (calls calculate_order_quantity)
   3. Adjustment: Applies supplier packaging constraints (via calculate_order_quantity)

   Two-tier alert system:
   - Tier 1: ALL low stock products logged in stock_alerts (for UI visibility)
   - Tier 2: Only products with send_low_stock_alerts=true need notifications

   Auto-resolves alerts when stock returns to normal.

   Run this function:
   - On schedule (e.g., hourly via cron job)
   - After stock movements complete
   - On demand via UI action';

-- Function: Get alert summary with Tier 2 metrics
CREATE OR REPLACE FUNCTION get_alert_summary(p_organization_id UUID)
RETURNS TABLE (
  total_active INTEGER,
  critical_count INTEGER,
  warning_count INTEGER,
  info_count INTEGER,
  out_of_stock_count INTEGER,
  notification_enabled_count INTEGER,
  pending_notifications INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_active,
    COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER as critical_count,
    COUNT(*) FILTER (WHERE severity = 'warning')::INTEGER as warning_count,
    COUNT(*) FILTER (WHERE severity = 'info')::INTEGER as info_count,
    COUNT(*) FILTER (WHERE alert_type = 'out_of_stock')::INTEGER as out_of_stock_count,
    -- Tier 2 metrics
    COUNT(*) FILTER (WHERE notification_sent = false)::INTEGER as notification_enabled_count,
    COUNT(*) FILTER (WHERE notification_sent = false AND notification_sent_at IS NULL)::INTEGER as pending_notifications
  FROM stock_alerts
  WHERE organization_id = p_organization_id
    AND status = 'active';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_alert_summary IS
  'Returns alert summary with two-tier metrics:
   - total_active: All products below reorder point (Tier 1)
   - critical_count, warning_count: By severity
   - out_of_stock_count: Products with zero stock
   - notification_enabled_count: Products with notifications enabled (Tier 2)
   - pending_notifications: Alerts awaiting notification delivery';

-- Function: Get low stock products grouped by supplier
CREATE OR REPLACE FUNCTION get_low_stock_by_supplier(p_organization_id UUID)
RETURNS TABLE (
  supplier_id UUID,
  supplier_name TEXT,
  product_count INTEGER,
  total_suggested_quantity DECIMAL,
  total_packages DECIMAL,
  products JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ba.id as supplier_id,
    ba.name as supplier_name,
    COUNT(DISTINCT sa.product_id)::INTEGER as product_count,
    SUM(sa.suggested_order_quantity) as total_suggested_quantity,
    SUM(sa.suggested_packages) as total_packages,
    jsonb_agg(
      jsonb_build_object(
        'alert_id', sa.id,
        'product_id', p.id,
        'product_name', p.name,
        'sku', p.sku,
        'unit', p.unit,
        'available_stock', sa.available_stock,
        'reorder_point', sa.reorder_point,
        'suggested_quantity', sa.suggested_order_quantity,
        'suggested_packages', sa.suggested_packages,
        'severity', sa.severity,
        'alert_type', sa.alert_type,
        'created_at', sa.created_at
      )
      ORDER BY
        CASE sa.severity
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          ELSE 3
        END,
        sa.created_at
    ) as products
  FROM stock_alerts sa
  INNER JOIN products p ON sa.product_id = p.id
  INNER JOIN business_accounts ba ON sa.suggested_supplier_id = ba.id
  WHERE sa.status = 'active'
    AND sa.organization_id = p_organization_id
    AND sa.suggested_supplier_id IS NOT NULL
  GROUP BY ba.id, ba.name
  ORDER BY
    -- Sort suppliers by total suggested quantity descending
    SUM(sa.suggested_order_quantity) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_low_stock_by_supplier IS
  'Groups active low stock alerts by supplier for batch PO creation.

   Returns supplier-grouped data with:
   - Supplier information
   - Count of low stock products from this supplier
   - Total suggested order quantity and packages
   - Array of products with alert details

   Used in Phase 4 for batch PO creation dialog.';

-- Test queries (commented out for production)
-- To test after applying migration:
/*
-- 1. Set up test products
UPDATE products
SET
  reorder_point = 100,
  max_stock_level = 1000,
  send_low_stock_alerts = true  -- Enable notifications
WHERE name = 'Test Product A';

UPDATE products
SET
  reorder_point = 50,
  send_low_stock_alerts = false  -- UI only, no notifications
WHERE name = 'Test Product B';

-- 2. Run alert detection
SELECT * FROM check_stock_levels_and_alert('your-org-id');
-- Expected: alerts_created, alerts_resolved, notifications_pending

-- 3. View alert summary
SELECT * FROM get_alert_summary('your-org-id');
-- Expected: Tier 1 and Tier 2 metrics

-- 4. View alerts grouped by supplier
SELECT * FROM get_low_stock_by_supplier('your-org-id');
-- Expected: Supplier-grouped product lists with suggested quantities

-- 5. View all active alerts
SELECT
  sa.*,
  p.name as product_name,
  p.sku,
  ba.name as supplier_name
FROM stock_alerts sa
LEFT JOIN products p ON sa.product_id = p.id
LEFT JOIN business_accounts ba ON sa.suggested_supplier_id = ba.id
WHERE sa.status = 'active'
ORDER BY sa.severity, sa.created_at DESC;
*/
