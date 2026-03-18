# Low Stock Monitoring & Alerts - Implementation Plan

**Version:** 1.0
**Created:** November 16, 2024
**Status:** Planning
**Priority:** P2.1 (Optional Enhancement)
**Estimated Timeline:** 2-3 days

---

## 📋 Executive Summary

This document provides a focused implementation plan for **Low Stock Monitoring & Alerts** - a proactive two-tier system that separates UI monitoring from active notifications.

### Scope

- Real-time monitoring of product stock levels against reorder points
- Automated alert generation for low stock conditions
- Dashboard widget showing critical low stock items
- Alert management (acknowledge, resolve, ignore)
- **Two-tier system**: UI indicators for ALL low stock products + optional notifications for selected products
- Optional email/push notifications (future enhancement)

### Why This Is Valuable

- **Proactive Inventory Management** - Know when to reorder before stockouts occur
- **Prevent Stockouts** - Avoid lost sales and customer dissatisfaction
- **Reduce Manual Monitoring** - Eliminate spreadsheet tracking of stock levels
- **Better Cash Flow** - Order at the right time, not too early or too late
- **Granular Control** - See all low stock products in UI without alert fatigue from notifications
- **Progressive Adoption** - Set reorder points system-wide, enable notifications selectively

### Two-Tier Monitoring Architecture

**Key Design Decision**: Separate UI monitoring from active notifications.

**Tier 1: UI Monitoring (Always Active)**

- ANY product with `reorder_point` set that falls below threshold will:
  - Show "Low Stock" badge/tag in product lists
  - Appear in low stock filters and search results
  - Be logged in `stock_alerts` table for complete audit trail
  - Display in dashboards, reports, and widgets
  - Show stock status indicators (red/yellow/green)

**Tier 2: Active Notifications (Opt-in)**

- Only products with `send_low_stock_alerts = true` will:
  - Send email notifications (future enhancement)
  - Send push notifications (future enhancement)
  - Appear in high-priority alert queues
  - Trigger workflow actions
  - Generate user-facing alerts requiring acknowledgment

**Benefits**:

- Warehouse managers see ALL low stock products without being overwhelmed
- Critical products (fast-moving, high-value, customer-facing) get immediate attention
- Complete audit trail of all low stock events for analytics
- Gradual rollout: set reorder points first, enable notifications later
- Matches enterprise ERP patterns (SAP, Oracle, NetSuite)
- Reduces alert fatigue while maintaining visibility

**Example Scenarios**:

```
Product A: Reorder Point = 100, Alerts = ON
  → Stock falls to 80 → Shows in UI + Sends notification

Product B: Reorder Point = 50, Alerts = OFF
  → Stock falls to 30 → Shows in UI + NO notification

Product C: Reorder Point = NULL
  → Not monitored (e.g., non-inventory items)
```

### Integration Points

- Uses existing `reorder_point` field on products table (already exists)
- NEW: `send_low_stock_alerts` boolean flag on products table
- Integrates with `product_available_inventory` view for real-time stock data
- Links to purchase orders for quick reordering
- Can trigger from scheduled jobs or real-time on stock movements

---

## 🎯 Objectives

1. ✅ Monitor products approaching or below reorder point
2. ✅ Generate alerts with severity levels (info, warning, critical)
3. ✅ Provide dashboard widget for quick visibility
4. ✅ Allow users to acknowledge/resolve/ignore alerts
5. ✅ Link alerts to quick purchase order creation
6. ⏭️ Email notifications (deferred to future enhancement)

---

## 📊 Database Schema

### Step 1: Add Alert Flag to Products Table

```sql
-- Migration: Add send_low_stock_alerts column to products
ALTER TABLE products
ADD COLUMN send_low_stock_alerts BOOLEAN DEFAULT false;

COMMENT ON COLUMN products.send_low_stock_alerts IS
  'Enable active notifications (email/push) when stock falls below reorder_point.
   Does not affect UI visibility - all products with reorder_point set will show
   low stock indicators in the interface.';

-- Index for filtering products that need notifications
CREATE INDEX idx_products_low_stock_alerts
  ON products(send_low_stock_alerts)
  WHERE send_low_stock_alerts = true
    AND reorder_point IS NOT NULL
    AND deleted_at IS NULL;
```

### Step 2: Stock Alerts Table

Track low stock conditions with full lifecycle management. This table logs **ALL** products below reorder point, regardless of notification settings.

```sql
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization & Branch
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,

  -- Product Information
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Stock Levels (snapshot at time of alert)
  current_stock DECIMAL(15,3) NOT NULL,
  reorder_point DECIMAL(15,3) NOT NULL,
  available_stock DECIMAL(15,3) NOT NULL, -- After reservations

  -- Alert Classification
  alert_type TEXT NOT NULL, -- 'low_stock', 'out_of_stock', 'below_minimum'
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'

  -- Notification Tracking (Tier 2)
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  notification_type TEXT, -- 'email', 'push', 'both' (future use)

  -- Status Tracking
  status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'ignored'
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
  CHECK (notification_type IS NULL OR notification_type IN ('email', 'push', 'both'))
);

-- Indexes for performance
CREATE INDEX idx_stock_alerts_org ON stock_alerts(organization_id);
CREATE INDEX idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX idx_stock_alerts_status ON stock_alerts(status) WHERE status = 'active';
CREATE INDEX idx_stock_alerts_severity ON stock_alerts(severity) WHERE status = 'active';
CREATE INDEX idx_stock_alerts_created ON stock_alerts(created_at DESC);
CREATE INDEX idx_stock_alerts_location ON stock_alerts(location_id) WHERE location_id IS NOT NULL;

-- Index for pending notifications (Tier 2 alerts that haven't been sent yet)
CREATE INDEX idx_stock_alerts_pending_notifications
  ON stock_alerts(product_id, created_at)
  WHERE status = 'active'
    AND notification_sent = false;

-- Auto-update timestamp
CREATE TRIGGER trg_stock_alerts_updated_at
  BEFORE UPDATE ON stock_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Alert Type Logic

**Alert Types:**

- `out_of_stock` - Available stock = 0 (most critical)
- `below_minimum` - Available stock < 50% of reorder point (critical)
- `low_stock` - Available stock ≤ reorder point but > 50% (warning)

**Severity Levels:**

- `critical` - Out of stock or below minimum
- `warning` - Below reorder point but above minimum
- `info` - Approaching reorder point (optional)

**Two-Tier Behavior:**

- **ALL alerts logged**: Every product below reorder_point gets an entry in `stock_alerts`
- **Selective notifications**: Only alerts where `products.send_low_stock_alerts = true` will have `notification_sent = true` and trigger actual email/push notifications

---

## 🔧 Database Functions

### Function: Check Stock Levels and Create Alerts

Scans products and creates alerts for those below reorder points. This function implements the two-tier system:

- **Tier 1**: ALL products below reorder_point get logged in stock_alerts
- **Tier 2**: Only products with `send_low_stock_alerts = true` will be marked for notification

```sql
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
BEGIN
  -- Find products below reorder point (Tier 1: ALL products)
  FOR product_record IN
    SELECT
      p.id as product_id,
      p.organization_id,
      p.name,
      p.reorder_point,
      p.send_low_stock_alerts, -- NEW: Check if notifications enabled
      pai.quantity_on_hand,
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
    -- Check if alert already exists for this product/location
    IF NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE product_id = product_record.product_id
        AND (location_id = product_record.location_id OR (location_id IS NULL AND product_record.location_id IS NULL))
        AND status = 'active'
        AND created_at > NOW() - INTERVAL '24 hours'
    ) THEN
      -- Create new alert (logs ALL products below reorder point)
      INSERT INTO stock_alerts (
        organization_id,
        branch_id,
        product_id,
        location_id,
        current_stock,
        reorder_point,
        available_stock,
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
        product_record.quantity_on_hand,
        product_record.reorder_point,
        product_record.available_quantity,
        -- Determine alert type
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
        -- Tier 2: Mark as "notification sent" if alerts are disabled
        -- (prevents future notification jobs from processing)
        NOT product_record.send_low_stock_alerts,
        CASE
          WHEN NOT product_record.send_low_stock_alerts THEN NOW()
          ELSE NULL
        END
      )
      RETURNING id INTO new_alert_id;

      alert_count := alert_count + 1;

      -- Count if this alert needs notification (Tier 2)
      IF product_record.send_low_stock_alerts THEN
        notification_count := notification_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- Auto-resolve alerts where stock is now above reorder point
  UPDATE stock_alerts sa
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolution_notes = 'Auto-resolved: stock level returned above reorder point'
  FROM product_available_inventory pai
  WHERE sa.product_id = pai.product_id
    AND (sa.location_id = pai.location_id OR (sa.location_id IS NULL AND pai.location_id IS NULL))
    AND sa.status = 'active'
    AND pai.available_quantity > (
      SELECT reorder_point FROM products WHERE id = sa.product_id
    );

  GET DIAGNOSTICS resolved_count = ROW_COUNT;

  RETURN QUERY SELECT alert_count, resolved_count, notification_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_stock_levels_and_alert IS
  'Two-tier stock monitoring:
   Tier 1 - Logs ALL products below reorder_point in stock_alerts (for UI visibility)
   Tier 2 - Only products with send_low_stock_alerts=true are marked for notification
   Auto-resolves alerts when stock returns to normal.';
```

### Function: Get Alert Summary for Organization

```sql
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_alert_summary IS
  'Returns summary of alerts including two-tier metrics:
   - total_active: All products below reorder point (Tier 1)
   - notification_enabled_count: Products with notifications enabled (Tier 2)
   - pending_notifications: Alerts awaiting notification delivery';
```

### Function: Get Products Needing Notifications

For Tier 2 notification jobs (email/push).

```sql
CREATE OR REPLACE FUNCTION get_pending_notifications(
  p_organization_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  alert_id UUID,
  product_id UUID,
  product_name TEXT,
  product_sku TEXT,
  available_stock DECIMAL,
  reorder_point DECIMAL,
  alert_type TEXT,
  severity TEXT,
  location_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id as alert_id,
    p.id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    sa.available_stock,
    sa.reorder_point,
    sa.alert_type,
    sa.severity,
    COALESCE(l.name, 'All Locations') as location_name,
    sa.created_at
  FROM stock_alerts sa
  INNER JOIN products p ON sa.product_id = p.id
  LEFT JOIN locations l ON sa.location_id = l.id
  WHERE sa.status = 'active'
    AND sa.notification_sent = false
    AND sa.notification_sent_at IS NULL
    AND (p_organization_id IS NULL OR sa.organization_id = p_organization_id)
  ORDER BY
    CASE sa.severity
      WHEN 'critical' THEN 1
      WHEN 'warning' THEN 2
      ELSE 3
    END,
    sa.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pending_notifications IS
  'Retrieves Tier 2 alerts that need notification delivery.
   Only returns alerts where send_low_stock_alerts = true.
   Results ordered by severity then creation time.';
```

---

## 💻 Implementation Steps

### Step 1: Database Migration (0.5 day)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_stock_alerts.sql`

**Tasks:**

1. Add `send_low_stock_alerts` column to products table
2. Create `stock_alerts` table with all constraints including notification tracking
3. Add indexes for performance (including pending notifications index)
4. Create `check_stock_levels_and_alert()` function with two-tier logic
5. Create `get_alert_summary()` function with Tier 2 metrics
6. Create `get_pending_notifications()` function for notification jobs
7. Add trigger for updated_at

**Testing:**

```sql
-- Test: Set up a product with reorder point and alerts enabled
UPDATE products
SET reorder_point = 100, send_low_stock_alerts = true
WHERE id = 'some-product-id';

-- Test: Set up a product with reorder point but alerts disabled
UPDATE products
SET reorder_point = 50, send_low_stock_alerts = false
WHERE id = 'another-product-id';

-- Test alert creation (should create both Tier 1 and Tier 2)
SELECT * FROM check_stock_levels_and_alert();
-- Expected: alerts_created, alerts_resolved, notifications_pending

-- Test alert summary (should show Tier 2 metrics)
SELECT * FROM get_alert_summary('org-id-here');
-- Expected: total_active, notification_enabled_count, pending_notifications

-- Test pending notifications (should only return Tier 2 alerts)
SELECT * FROM get_pending_notifications('org-id-here');
-- Expected: Only products with send_low_stock_alerts = true

-- Verify Tier 1 behavior: Products with alerts disabled should still be in stock_alerts
SELECT * FROM stock_alerts WHERE notification_sent = true;
-- These are Tier 1 only (UI visibility, no notifications)
```

### Step 2: TypeScript Types (0.25 day)

**File:** `src/modules/warehouse/types/stock-alerts.ts`

```typescript
// Enums
export type AlertType = "low_stock" | "out_of_stock" | "below_minimum";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "ignored";

// Core Types
export interface StockAlert {
  id: string;
  organization_id: string;
  branch_id: string | null;
  product_id: string;
  product_variant_id: string | null;
  location_id: string | null;
  current_stock: number;
  reorder_point: number;
  available_stock: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  // Tier 2: Notification tracking
  notification_sent: boolean;
  notification_sent_at: string | null;
  notification_type: string | null;
  // Status tracking
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockAlertWithRelations extends StockAlert {
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    track_inventory: boolean;
  };
  location?: {
    id: string;
    name: string;
    code: string;
  };
  product_variant?: {
    id: string;
    name: string;
    sku: string | null;
  };
}

// Filter Types
export interface StockAlertFilters {
  search?: string;
  severity?: AlertSeverity[];
  alert_type?: AlertType[];
  status?: AlertStatus[];
  branch_id?: string;
  location_id?: string;
  limit?: number;
  offset?: number;
  sort_by?: "created_at" | "severity" | "available_stock";
  sort_order?: "asc" | "desc";
}

// Summary Types
export interface AlertSummary {
  total_active: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  out_of_stock_count: number;
  // Tier 2 metrics
  notification_enabled_count: number;
  pending_notifications: number;
}

// Helper to check if alert needs notification
export function needsNotification(alert: StockAlert): boolean {
  return !alert.notification_sent && alert.notification_sent_at === null;
}

// Helper to check if alert is Tier 1 only (UI monitoring without notifications)
export function isUiOnlyAlert(alert: StockAlert): boolean {
  return alert.notification_sent && alert.notification_sent_at !== null;
}

// Constants
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  out_of_stock: "Out of Stock",
  below_minimum: "Below Minimum",
  low_stock: "Low Stock",
};

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  active: "Active",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  ignored: "Ignored",
};

export const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "destructive",
  warning: "warning",
  info: "secondary",
};
```

### Step 3: Service Layer (0.5 day)

**File:** `src/modules/warehouse/api/stock-alerts-service.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../supabase/types/types";
import type {
  StockAlert,
  StockAlertWithRelations,
  StockAlertFilters,
  AlertSummary,
} from "../types/stock-alerts";

export class StockAlertsService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Get active alerts with optional filtering
   */
  async getAlerts(
    organizationId: string,
    filters: StockAlertFilters = {}
  ): Promise<StockAlertWithRelations[]> {
    let query = this.supabase
      .from("stock_alerts")
      .select(
        `
        *,
        product:products!product_id (
          id,
          name,
          sku,
          unit,
          track_inventory
        ),
        location:locations!location_id (
          id,
          name,
          code
        ),
        product_variant:product_variants!product_variant_id (
          id,
          name,
          sku
        )
      `
      )
      .eq("organization_id", organizationId);

    // Apply filters
    if (filters.search) {
      // Search by product name or SKU
      query = query.or(
        `product.name.ilike.%${filters.search}%,product.sku.ilike.%${filters.search}%`
      );
    }

    if (filters.severity && filters.severity.length > 0) {
      query = query.in("severity", filters.severity);
    }

    if (filters.alert_type && filters.alert_type.length > 0) {
      query = query.in("alert_type", filters.alert_type);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    } else {
      // Default to active only
      query = query.eq("status", "active");
    }

    if (filters.branch_id) {
      query = query.eq("branch_id", filters.branch_id);
    }

    if (filters.location_id) {
      query = query.eq("location_id", filters.location_id);
    }

    // Sorting
    const sortBy = filters.sort_by || "created_at";
    const sortOrder = filters.sort_order || "desc";

    if (sortBy === "severity") {
      // Custom sort for severity (critical > warning > info)
      query = query.order("severity", { ascending: false });
    } else {
      query = query.order(sortBy, { ascending: sortOrder === "asc" });
    }

    // Pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch alerts: ${error.message}`);
    }

    return (data as any[]) || [];
  }

  /**
   * Get alert summary statistics
   */
  async getAlertSummary(organizationId: string): Promise<AlertSummary> {
    const { data, error } = await this.supabase.rpc("get_alert_summary", {
      p_organization_id: organizationId,
    });

    if (error) {
      throw new Error(`Failed to fetch alert summary: ${error.message}`);
    }

    return (
      data[0] || {
        total_active: 0,
        critical_count: 0,
        warning_count: 0,
        info_count: 0,
        out_of_stock_count: 0,
      }
    );
  }

  /**
   * Check stock levels and create/update alerts
   */
  async checkStockLevels(organizationId?: string): Promise<{
    alerts_created: number;
    alerts_resolved: number;
  }> {
    const { data, error } = await this.supabase.rpc("check_stock_levels_and_alert", {
      p_organization_id: organizationId || null,
    });

    if (error) {
      throw new Error(`Failed to check stock levels: ${error.message}`);
    }

    return data[0] || { alerts_created: 0, alerts_resolved: 0 };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("stock_alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (error) {
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, userId: string, notes?: string): Promise<void> {
    const { error } = await this.supabase
      .from("stock_alerts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (error) {
      throw new Error(`Failed to resolve alert: ${error.message}`);
    }
  }

  /**
   * Ignore an alert
   */
  async ignoreAlert(alertId: string): Promise<void> {
    const { error } = await this.supabase
      .from("stock_alerts")
      .update({
        status: "ignored",
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (error) {
      throw new Error(`Failed to ignore alert: ${error.message}`);
    }
  }

  /**
   * Get alerts for a specific product
   */
  async getProductAlerts(productId: string): Promise<StockAlert[]> {
    const { data, error } = await this.supabase
      .from("stock_alerts")
      .select("*")
      .eq("product_id", productId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch product alerts: ${error.message}`);
    }

    return (data as StockAlert[]) || [];
  }
}
```

### Step 4: Server Actions (0.25 day)

**File:** `src/modules/warehouse/alerts/actions/stock-alerts-actions.ts`

```typescript
"use server";

import { createClient } from "@supabase/server";
import { StockAlertsService } from "../../api/stock-alerts-service";
import type {
  StockAlertWithRelations,
  StockAlertFilters,
  AlertSummary,
} from "../../types/stock-alerts";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

export async function getAlertsAction(
  organizationId: string,
  filters: StockAlertFilters = {}
): Promise<{
  success: boolean;
  data?: StockAlertWithRelations[];
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new StockAlertsService(supabase);
    const alerts = await service.getAlerts(organizationId, filters);

    return { success: true, data: alerts };
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch alerts",
    };
  }
}

export async function getAlertSummaryAction(organizationId: string): Promise<{
  success: boolean;
  data?: AlertSummary;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new StockAlertsService(supabase);
    const summary = await service.getAlertSummary(organizationId);

    return { success: true, data: summary };
  } catch (error) {
    console.error("Error fetching alert summary:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch summary",
    };
  }
}

export async function checkStockLevelsAction(organizationId?: string): Promise<{
  success: boolean;
  data?: { alerts_created: number; alerts_resolved: number };
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new StockAlertsService(supabase);
    const result = await service.checkStockLevels(organizationId);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error checking stock levels:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check stock levels",
    };
  }
}

export async function acknowledgeAlertAction(alertId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const service = new StockAlertsService(supabase);
    await service.acknowledgeAlert(alertId, user.id);

    return { success: true };
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to acknowledge alert",
    };
  }
}

export async function resolveAlertAction(
  alertId: string,
  notes?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const service = new StockAlertsService(supabase);
    await service.resolveAlert(alertId, user.id, notes);

    return { success: true };
  } catch (error) {
    console.error("Error resolving alert:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resolve alert",
    };
  }
}

export async function ignoreAlertAction(alertId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new StockAlertsService(supabase);
    await service.ignoreAlert(alertId);

    return { success: true };
  } catch (error) {
    console.error("Error ignoring alert:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to ignore alert",
    };
  }
}
```

### Step 5: UI Components (1 day)

#### A. Low Stock Dashboard Widget

**File:** `src/modules/warehouse/widgets/low-stock-widget.tsx`

**Features:**

- Display alert summary (total, critical, warning counts)
- Click to view full alerts page
- Color-coded severity indicators
- Refresh button

#### B. Stock Alerts Page

**File:** `src/app/[locale]/dashboard/warehouse/alerts/page.tsx`

**Features:**

- List all alerts with product information
- Filter by severity, alert type, status
- Sort by various fields
- Actions: Acknowledge, Resolve, Ignore
- Quick link to create purchase order
- Batch actions support

#### C. Alert List Component

**File:** `src/modules/warehouse/alerts/components/stock-alerts-list.tsx`

**Displays:**

- Product name, SKU, location
- Current stock vs reorder point
- Severity badge
- Alert type badge
- Time created
- Action buttons

#### D. Alert Details Modal

**Features:**

- Product details
- Stock level information
- Location breakdown
- Preferred supplier info
- Quick create PO button
- Acknowledge/Resolve/Ignore actions
- Resolution notes input

### Step 6: Scheduled Job (0.25 day)

**File:** `src/lib/cron/check-stock-levels.ts`

```typescript
import { createClient } from "@/utils/supabase/server";

export async function checkStockLevelsJob() {
  try {
    const supabase = await createClient();

    // Call the database function to check all organizations
    const { data, error } = await supabase.rpc("check_stock_levels_and_alert");

    if (error) {
      console.error("Error checking stock levels:", error);
      return;
    }

    const result = data[0];
    console.log(
      `Stock levels checked: ${result.alerts_created} alerts created, ${result.alerts_resolved} alerts resolved`
    );
  } catch (error) {
    console.error("Error in stock levels job:", error);
  }
}
```

**Cron Configuration:**

- Run every hour (or as configured)
- Can also trigger on stock movement completion
- Should run during off-peak hours for performance

---

## 🔗 Integration Points

### 1. Product Details Page

Add alert indicator showing both tiers:

- Show active alerts count badge
- Display alert status (critical/warning)
- Show if notifications are enabled (Tier 2 indicator)
- Link to alerts for this product
- Toggle for `send_low_stock_alerts` setting

```tsx
// Example UI
<div className="flex items-center gap-2">
  <Badge variant="warning">Low Stock (3 alerts)</Badge>
  {product.send_low_stock_alerts && (
    <Badge variant="secondary">
      <Bell className="h-3 w-3" /> Notifications ON
    </Badge>
  )}
</div>
```

### 2. Product List/Table

Add low stock filters and indicators:

- Filter: "Low Stock" - shows ALL products with active alerts (Tier 1)
- Filter: "Critical Alerts" - shows only critical severity
- Badge/tag on each low stock product
- Color coding: red (critical), yellow (warning)
- Works even if notifications are disabled

### 3. Inventory Dashboard

Add low stock widget with two-tier metrics:

- Total low stock products (Tier 1 - all monitored)
- Products with notifications enabled (Tier 2 subset)
- Pending notifications count
- Critical items count
- Quick navigation to alerts page

```tsx
// Example widget
<Card>
  <CardHeader>Low Stock Alerts</CardHeader>
  <CardContent>
    <div className="text-3xl font-bold">{summary.total_active}</div>
    <div className="text-sm text-muted-foreground">Products below reorder point</div>
    <div className="mt-2 text-sm">{summary.notification_enabled_count} with alerts enabled</div>
    {summary.pending_notifications > 0 && (
      <Badge variant="destructive">{summary.pending_notifications} pending notifications</Badge>
    )}
  </CardContent>
</Card>
```

### 4. Purchase Orders

Link to quick PO creation:

- "Create PO" button on alert (works for both Tier 1 and Tier 2)
- Pre-fill supplier from preferred supplier
- Pre-fill quantity based on reorder quantity
- Mark alert as resolved after PO creation

### 5. Navigation

Add menu item with notification badge:

- `/dashboard/warehouse/alerts` page
- Badge showing total active alerts (Tier 1 count)
- Red dot if pending notifications exist (Tier 2)
- Highlight if critical alerts exist

### 6. Product Edit Form

Add notification settings:

- Checkbox: "Send notifications when low stock"
- Help text: "Product will still show as low stock in lists and filters even if disabled"
- Only show if `reorder_point` is set

---

## 📊 Success Metrics

- [ ] Alerts created for products below reorder point
- [ ] Alerts auto-resolved when stock returns to normal
- [ ] Dashboard shows active alerts count
- [ ] Low stock widget on warehouse dashboard
- [ ] Alerts can be acknowledged/resolved/ignored
- [ ] Alert severity properly calculated
- [ ] Integration with purchase orders works
- [ ] Performance acceptable with large product catalogs

---

## 🚀 Future Enhancements

See [FUTURE_ENHANCEMENTS.md](FUTURE_ENHANCEMENTS.md):

1. **Email Notifications** - Send emails for critical alerts
2. **Smart Alerts** - ML-based reorder point suggestions
3. **Alert History** - Track alert patterns over time
4. **Forecasting** - Predict when products will hit reorder point
5. **Batch Operations** - Acknowledge/resolve multiple alerts at once
6. **Custom Thresholds** - Per-location or per-product alert rules

---

## 📝 Testing Checklist

- [ ] Database migration applied
- [ ] TypeScript types generated
- [ ] Service layer tested with various stock levels
- [ ] Alert creation works correctly
- [ ] Alert auto-resolution works
- [ ] UI components render properly
- [ ] Filters and sorting work
- [ ] Actions (acknowledge, resolve, ignore) work
- [ ] Integration with purchase orders works
- [ ] Performance tested with large datasets
- [ ] Scheduled job runs successfully

---

**Version:** 1.0
**Created:** November 16, 2024
**Next Review:** After implementation completion
