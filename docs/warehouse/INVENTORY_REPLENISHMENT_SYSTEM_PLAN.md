# Inventory Replenishment System - Implementation Plan

**Version:** 1.1
**Created:** November 17, 2024
**Updated:** November 17, 2024
**Status:** ✅ Phases 1-3 Complete | Phase 4 Pending
**Priority:** P2.1 (Core Enhancement)
**Estimated Timeline:** 5 days

---

## 🎉 Implementation Status

### ✅ Phase 1: Supplier Packaging & Ordering Constraints (COMPLETED)

- ✅ Database migration created and applied
- ✅ TypeScript types created (`packaging.ts`)
- ✅ Service layer implemented (`packaging-service.ts`)
- ✅ UI updated (product-supplier form with packaging fields)
- ✅ All type-check and lint errors fixed

### ✅ Phase 2: Replenishment & Optimal Ordering (COMPLETED)

- ✅ Database migration created and applied
- ✅ TypeScript types created (`replenishment.ts`)
- ✅ Service layer implemented (`replenishment-service.ts`)
- ✅ Product form updated with replenishment settings section
- ✅ Real-time calculation preview implemented
- ✅ All type-check and lint errors fixed

### ✅ Phase 3: Low Stock Monitoring & Alerts (COMPLETED)

- ✅ Database migration created and applied
- ✅ TypeScript types created (`stock-alerts.ts`)
- ✅ Service layer implemented (`stock-alerts-service.ts`)
- ✅ Server actions implemented (`stock-alerts-actions.ts`)
- ✅ Alerts page created (`/dashboard/warehouse/alerts`)
- ✅ Module config updated with alerts route
- ✅ i18n translations added (English & Polish)
- ✅ All `base_unit` references fixed to `unit`
- ✅ All `variant_name` references fixed to `name`
- ✅ **CRITICAL FIX:** Alert `current_stock` now uses `available_quantity` (not `quantity_on_hand`)
- ✅ Enhanced visibility: Alerts table shows on-hand, reserved, and available stock breakdown
- ✅ Database columns added: `quantity_on_hand`, `reserved_quantity` to stock_alerts table
- ✅ All type-check and lint errors fixed

### ⏳ Phase 4: PO Creation from Alerts (PENDING)

- ⏳ Batch PO creation dialog
- ⏳ Supplier-grouped product display
- ⏳ Multi-supplier PO workflow

**Important Fixes:**

1. **Column name corrections:**
   - Changed all `base_unit` → `unit` (products table)
   - Changed all `variant_name` → `name` (product_variants table)

2. **Critical alert calculation fix:**
   - Alert `current_stock` field now correctly stores `available_quantity` (usable stock after reservations)
   - Previously incorrectly stored `quantity_on_hand` (total physical stock)
   - This ensures alerts show the actual stock available for sale/use, not just physical inventory
   - Example: If you have 150 units on-hand but 100 reserved for orders, alerts now correctly show 50 units available

3. **Enhanced stock visibility in alerts:**
   - Added `quantity_on_hand` and `reserved_quantity` columns to `stock_alerts` table
   - UI now displays complete stock breakdown: On Hand - Reserved = Available
   - Allows verification of stock calculations at a glance

4. **Delivery creation fix:**
   - Fixed `stock_movements` table to allow `'draft'` status
   - Fixed `save-draft-delivery` action to provide required `movement_number` field
   - Draft movements now use `DRAFT-{UUID}` format for movement numbers
   - Resolves "Failed to save item" error when creating deliveries

---

## 📋 Executive Summary

This document provides a comprehensive implementation plan for an **enterprise-grade Inventory Replenishment System** that handles:

- Supplier-specific packaging and ordering constraints
- Multiple replenishment calculation methods (fixed, min/max, auto)
- Two-tier low stock monitoring (UI + Notifications)
- Intelligent purchase order creation from alerts

### Why This Architecture?

This design follows the **3-Domain Pipeline** used by SAP, Oracle NetSuite, and other enterprise ERP systems:

```
┌──────────────────────────────────────────────┐
│ Domain 1: DETECTION (Low Stock Alerts)       │
│ IF available_stock <= reorder_point THEN     │
│   CREATE alert                               │
└──────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────┐
│ Domain 2: DECISION (Replenishment Logic)     │
│ raw_qty = calculate_order_quantity()         │
│   - fixed: use reorder_quantity              │
│   - min_max: max_level - available_stock     │
│   - auto: based on demand (future)           │
└──────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────┐
│ Domain 3: ADJUSTMENT (Packaging & MOQ)       │
│ final_qty = adjust_for_supplier_rules()      │
│   - Apply MOQ                                │
│   - Apply multiples                          │
│   - Round to full packages if required       │
└──────────────────────────────────────────────┘
                     ↓
           Present to User:
  "Order 10 boxes (600 pcs) from Supplier A"
```

### Key Architectural Decisions

1. **✅ Packaging belongs to `product_suppliers`, NOT `products`**
   Different suppliers sell the same product with different packaging, MOQs, and ordering rules.

2. **✅ Two-tier alert system**
   - **Tier 1**: ALL products below reorder point show in UI (for visibility)
   - **Tier 2**: Only selected products send notifications (prevents alert fatigue)

3. **✅ Bottom-up implementation** (Section 3 → 2 → 1 → 4)
   Build foundation first, then add dependent layers.

4. **✅ Supplier-first approach**
   Calculations respect supplier-specific constraints.

---

## 🎯 Objectives

**Section 3: Supplier Packaging & Ordering Constraints**

- ✅ Define how products CAN be ordered from each supplier
- ✅ Handle full package vs partial package rules
- ✅ Support MOQ and order multiples

**Section 2: Replenishment & Optimal Ordering**

- ✅ Calculate how much we WANT to order
- ✅ Support multiple calculation methods (fixed, min/max, auto)
- ✅ Respect supplier packaging constraints

**Section 1: Low Stock Monitoring & Alerts**

- ✅ Detect products below reorder point
- ✅ Generate alerts with suggested quantities
- ✅ Two-tier notification system
- ✅ Auto-resolve when stock returns to normal

**Section 4: PO Creation from Alerts**

- ✅ Batch create POs grouped by supplier
- ✅ Handle multi-supplier scenarios
- ✅ Show supplier-specific packaging in UI
- ✅ Validate and adjust quantities

---

## 📅 Implementation Timeline (Bottom-Up)

### Phase 1: Section 3 - Supplier Packaging & Ordering Constraints (1 day)

**Status**: Foundation Layer
**Dependencies**: None
**Deliverables**:

- Database migration with supplier packaging fields
- `adjust_for_packaging()` function
- Updated product-supplier relationship UI

### Phase 2: Section 2 - Replenishment & Optimal Ordering (1 day)

**Status**: Business Logic Layer
**Dependencies**: Phase 1 (needs packaging rules)
**Deliverables**:

- Database migration with replenishment fields
- `calculate_order_quantity()` function
- Product reorder settings UI
- Calculation preview

### Phase 3: Section 1 - Low Stock Monitoring & Alerts (1.5 days)

**Status**: Detection Layer
**Dependencies**: Phase 2 (needs replenishment logic)
**Deliverables**:

- `stock_alerts` table with suggested quantities
- `check_stock_levels_and_alert()` function
- Alerts list page and widgets
- Two-tier notification system

### Phase 4: Section 4 - PO Creation from Alerts (1.5 days)

**Status**: User Interface Layer
**Dependencies**: Phases 1, 2, 3 (needs all layers)
**Deliverables**:

- Batch PO creation dialog
- Supplier-specific packaging display
- Quantity validation and adjustment
- Multi-supplier handling

---

## 📊 Database Schema

### Phase 1: Supplier Packaging Fields

```sql
-- Migration: Add packaging and ordering constraints to product_suppliers
ALTER TABLE product_suppliers
ADD COLUMN package_unit VARCHAR(50),              -- 'box', 'case', 'pallet', 'drum'
ADD COLUMN package_quantity DECIMAL(15,3),       -- How many base units per package
ADD COLUMN allow_partial_package BOOLEAN DEFAULT true,
ADD COLUMN min_order_quantity DECIMAL(15,3),     -- Minimum quantity from this supplier
ADD COLUMN order_in_multiples_of DECIMAL(15,3),  -- Must order in multiples of this
ADD COLUMN supplier_lead_time_days INTEGER,      -- Supplier-specific lead time
ADD COLUMN supplier_price DECIMAL(15,2);         -- Price per base unit

COMMENT ON COLUMN product_suppliers.package_unit IS
  'How this supplier packages the product (box, case, pallet, drum, etc.)';

COMMENT ON COLUMN product_suppliers.package_quantity IS
  'How many base units (from products.base_unit) are in one package';

COMMENT ON COLUMN product_suppliers.allow_partial_package IS
  'Can order partial packages? If false, orders must be in full packages only';

COMMENT ON COLUMN product_suppliers.min_order_quantity IS
  'Minimum quantity that can be ordered from this supplier (in base units)';

COMMENT ON COLUMN product_suppliers.order_in_multiples_of IS
  'Orders must be in multiples of this number (in base units)';
```

**Example Data:**

| Product | Supplier   | package_unit | package_quantity | allow_partial | min_order_qty | order_in_multiples |
| ------- | ---------- | ------------ | ---------------- | ------------- | ------------- | ------------------ |
| Gloves  | Supplier A | box          | 50               | true          | 10            | 10                 |
| Gloves  | Supplier B | case         | 100              | false         | 100           | 100                |
| Paint   | Supplier C | can          | 5                | false         | 5             | 5                  |

### Phase 2: Replenishment Logic Fields

```sql
-- Migration: Add replenishment calculation fields to products
ALTER TABLE products
ADD COLUMN reorder_quantity DECIMAL(15,3),          -- Fixed order amount
ADD COLUMN max_stock_level DECIMAL(15,3),           -- Maximum desired stock
ADD COLUMN reorder_calculation_method TEXT DEFAULT 'min_max',
ADD CONSTRAINT check_reorder_method
  CHECK (reorder_calculation_method IN ('fixed', 'min_max', 'auto'));

COMMENT ON COLUMN products.reorder_quantity IS
  'For fixed method: always order this amount when stock is low';

COMMENT ON COLUMN products.max_stock_level IS
  'For min_max method: order enough to reach this level';

COMMENT ON COLUMN products.reorder_calculation_method IS
  'How to calculate order quantity:
   - fixed: always order reorder_quantity
   - min_max: order to max_stock_level
   - auto: calculate from demand history (future)';

-- Note: reorder_point, base_unit, lead_time_days already exist
```

### Phase 3: Stock Alerts Table

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
  available_stock DECIMAL(15,3) NOT NULL,

  -- Suggested Replenishment (from Section 2 calculation)
  suggested_order_quantity DECIMAL(15,3),
  suggested_supplier_id UUID REFERENCES business_accounts(id) ON DELETE SET NULL,
  calculation_method TEXT,  -- Which method was used

  -- Alert Classification
  alert_type TEXT NOT NULL,  -- 'low_stock', 'out_of_stock', 'below_minimum'
  severity TEXT NOT NULL,    -- 'info', 'warning', 'critical'

  -- Two-Tier Notification System
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  notification_type TEXT,

  -- Status Tracking
  status TEXT DEFAULT 'active',
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

-- Indexes
CREATE INDEX idx_stock_alerts_org ON stock_alerts(organization_id);
CREATE INDEX idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX idx_stock_alerts_status ON stock_alerts(status) WHERE status = 'active';
CREATE INDEX idx_stock_alerts_severity ON stock_alerts(severity) WHERE status = 'active';
CREATE INDEX idx_stock_alerts_created ON stock_alerts(created_at DESC);
CREATE INDEX idx_stock_alerts_pending_notifications
  ON stock_alerts(product_id, created_at)
  WHERE status = 'active' AND notification_sent = false;

-- Auto-update timestamp
CREATE TRIGGER trg_stock_alerts_updated_at
  BEFORE UPDATE ON stock_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 🔧 Database Functions

### Phase 1: Packaging Adjustment Function

```sql
CREATE OR REPLACE FUNCTION adjust_for_packaging(
  p_raw_quantity DECIMAL,
  p_product_supplier_id UUID
)
RETURNS TABLE (
  adjusted_quantity DECIMAL,
  packages DECIMAL,
  adjustment_reason TEXT
) AS $$
DECLARE
  v_supplier RECORD;
  v_qty DECIMAL;
  v_packages DECIMAL;
  v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Get supplier packaging rules
  SELECT
    package_unit,
    package_quantity,
    allow_partial_package,
    min_order_quantity,
    order_in_multiples_of
  INTO v_supplier
  FROM product_suppliers
  WHERE id = p_product_supplier_id;

  v_qty := p_raw_quantity;

  -- Apply minimum order quantity
  IF v_supplier.min_order_quantity IS NOT NULL AND v_qty < v_supplier.min_order_quantity THEN
    v_qty := v_supplier.min_order_quantity;
    v_reasons := array_append(v_reasons, 'adjusted to minimum order quantity');
  END IF;

  -- Apply order multiples
  IF v_supplier.order_in_multiples_of IS NOT NULL
     AND (v_qty % v_supplier.order_in_multiples_of) != 0 THEN
    v_qty := CEIL(v_qty / v_supplier.order_in_multiples_of) * v_supplier.order_in_multiples_of;
    v_reasons := array_append(v_reasons, 'rounded to multiple of ' || v_supplier.order_in_multiples_of);
  END IF;

  -- Apply full package requirement
  IF v_supplier.allow_partial_package = false
     AND v_supplier.package_quantity IS NOT NULL
     AND (v_qty % v_supplier.package_quantity) != 0 THEN
    v_packages := CEIL(v_qty / v_supplier.package_quantity);
    v_qty := v_packages * v_supplier.package_quantity;
    v_reasons := array_append(v_reasons, 'rounded to ' || v_packages || ' full ' || v_supplier.package_unit || 's');
  END IF;

  -- Calculate final packages
  IF v_supplier.package_quantity IS NOT NULL THEN
    v_packages := v_qty / v_supplier.package_quantity;
  ELSE
    v_packages := NULL;
  END IF;

  RETURN QUERY SELECT
    v_qty,
    v_packages,
    CASE
      WHEN array_length(v_reasons, 1) > 0 THEN array_to_string(v_reasons, ', ')
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION adjust_for_packaging IS
  'Adjusts raw order quantity based on supplier packaging constraints.
   Returns adjusted quantity, number of packages, and adjustment explanation.';
```

### Phase 2: Replenishment Calculation Function

```sql
CREATE OR REPLACE FUNCTION calculate_order_quantity(
  p_product_id UUID,
  p_supplier_id UUID,
  p_available_stock DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  raw_quantity DECIMAL,
  adjusted_quantity DECIMAL,
  packages DECIMAL,
  calculation_method TEXT,
  adjustment_reason TEXT
) AS $$
DECLARE
  v_product RECORD;
  v_available_stock DECIMAL;
  v_raw_qty DECIMAL;
  v_product_supplier_id UUID;
  v_adjusted RECORD;
BEGIN
  -- Get product settings
  SELECT
    reorder_point,
    reorder_quantity,
    max_stock_level,
    reorder_calculation_method
  INTO v_product
  FROM products
  WHERE id = p_product_id;

  -- Get current stock if not provided
  IF p_available_stock IS NULL THEN
    SELECT available_quantity INTO v_available_stock
    FROM product_available_inventory
    WHERE product_id = p_product_id
    LIMIT 1;
  ELSE
    v_available_stock := p_available_stock;
  END IF;

  -- Calculate raw order quantity based on method
  CASE v_product.reorder_calculation_method
    WHEN 'fixed' THEN
      -- Fixed: always order reorder_quantity
      v_raw_qty := COALESCE(v_product.reorder_quantity, v_product.reorder_point);

    WHEN 'min_max' THEN
      -- Min/Max: order up to max_stock_level
      IF v_product.max_stock_level IS NOT NULL THEN
        v_raw_qty := v_product.max_stock_level - v_available_stock;
      ELSE
        -- Fallback: order to 2x reorder point if max not set
        v_raw_qty := (v_product.reorder_point * 2) - v_available_stock;
      END IF;

    WHEN 'auto' THEN
      -- Auto: calculate from demand (future enhancement)
      -- For now, use min_max logic
      v_raw_qty := COALESCE(v_product.max_stock_level, v_product.reorder_point * 2) - v_available_stock;

    ELSE
      -- Default: order to bring stock to reorder point
      v_raw_qty := v_product.reorder_point - v_available_stock;
  END CASE;

  -- Ensure positive quantity
  v_raw_qty := GREATEST(v_raw_qty, 0);

  -- Get product_supplier relationship
  SELECT id INTO v_product_supplier_id
  FROM product_suppliers
  WHERE product_id = p_product_id
    AND supplier_id = p_supplier_id
    AND deleted_at IS NULL
  LIMIT 1;

  -- Adjust for supplier packaging constraints
  IF v_product_supplier_id IS NOT NULL THEN
    SELECT * INTO v_adjusted
    FROM adjust_for_packaging(v_raw_qty, v_product_supplier_id);

    RETURN QUERY SELECT
      v_raw_qty,
      v_adjusted.adjusted_quantity,
      v_adjusted.packages,
      v_product.reorder_calculation_method,
      v_adjusted.adjustment_reason;
  ELSE
    -- No supplier constraints
    RETURN QUERY SELECT
      v_raw_qty,
      v_raw_qty,
      NULL::DECIMAL,
      v_product.reorder_calculation_method,
      NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_order_quantity IS
  'Calculates optimal order quantity using product replenishment settings,
   then adjusts based on supplier packaging constraints.
   Returns raw quantity, adjusted quantity, packages, and explanations.';
```

### Phase 3: Stock Alert Detection Function

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
  suggested_qty RECORD;
  preferred_supplier UUID;
BEGIN
  -- Find products below reorder point
  FOR product_record IN
    SELECT
      p.id as product_id,
      p.organization_id,
      p.name,
      p.reorder_point,
      p.send_low_stock_alerts,
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
    -- Check if alert already exists
    IF NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE product_id = product_record.product_id
        AND (location_id = product_record.location_id OR (location_id IS NULL AND product_record.location_id IS NULL))
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
        suggested_order_quantity,
        suggested_supplier_id,
        calculation_method,
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
        suggested_qty.adjusted_quantity,
        preferred_supplier,
        suggested_qty.calculation_method,
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
        -- Two-tier: mark as sent if alerts disabled
        NOT product_record.send_low_stock_alerts,
        CASE
          WHEN NOT product_record.send_low_stock_alerts THEN NOW()
          ELSE NULL
        END
      )
      RETURNING id INTO new_alert_id;

      alert_count := alert_count + 1;

      -- Count notifications needed
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
  'Three-domain replenishment system:
   1. Detection - Finds products below reorder point
   2. Decision - Calculates suggested order quantity
   3. Adjustment - Applies supplier packaging constraints
   Stores results in stock_alerts with two-tier notification tracking.';
```

### Additional Helper Functions

```sql
-- Get alert summary with Tier 2 metrics
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
    COUNT(*) FILTER (WHERE notification_sent = false)::INTEGER as notification_enabled_count,
    COUNT(*) FILTER (WHERE notification_sent = false AND notification_sent_at IS NULL)::INTEGER as pending_notifications
  FROM stock_alerts
  WHERE organization_id = p_organization_id
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Get low stock products grouped by supplier
CREATE OR REPLACE FUNCTION get_low_stock_by_supplier(p_organization_id UUID)
RETURNS TABLE (
  supplier_id UUID,
  supplier_name TEXT,
  product_count INTEGER,
  total_suggested_quantity DECIMAL,
  products JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ba.id as supplier_id,
    ba.name as supplier_name,
    COUNT(DISTINCT sa.product_id)::INTEGER as product_count,
    SUM(sa.suggested_order_quantity) as total_suggested_quantity,
    jsonb_agg(
      jsonb_build_object(
        'product_id', p.id,
        'product_name', p.name,
        'sku', p.sku,
        'available_stock', sa.available_stock,
        'reorder_point', sa.reorder_point,
        'suggested_quantity', sa.suggested_order_quantity,
        'alert_id', sa.id,
        'severity', sa.severity
      )
      ORDER BY sa.severity, sa.created_at
    ) as products
  FROM stock_alerts sa
  INNER JOIN products p ON sa.product_id = p.id
  INNER JOIN business_accounts ba ON sa.suggested_supplier_id = ba.id
  WHERE sa.status = 'active'
    AND sa.organization_id = p_organization_id
  GROUP BY ba.id, ba.name
  ORDER BY total_suggested_quantity DESC;
END;
$$ LANGUAGE plpgsql;
```

---

## 💻 TypeScript Types

### Phase 1: Product Supplier Types

```typescript
// src/modules/warehouse/types/product-suppliers.ts

export interface ProductSupplierPackaging {
  package_unit: string | null; // 'box', 'case', 'pallet'
  package_quantity: number | null; // Units per package
  allow_partial_package: boolean; // Can order partial?
  min_order_quantity: number | null; // Minimum from this supplier
  order_in_multiples_of: number | null; // Must be multiples of
  supplier_lead_time_days: number | null;
  supplier_price: number | null;
}

export interface ProductSupplierWithPackaging extends ProductSupplier, ProductSupplierPackaging {
  // Combines base product_supplier with packaging fields
}

export interface PackagingAdjustment {
  raw_quantity: number;
  adjusted_quantity: number;
  packages: number | null;
  adjustment_reason: string | null;
}
```

### Phase 2: Replenishment Types

```typescript
// src/modules/warehouse/types/replenishment.ts

export type ReorderCalculationMethod = "fixed" | "min_max" | "auto";

export interface ProductReplenishmentSettings {
  reorder_point: number | null;
  reorder_quantity: number | null; // For fixed method
  max_stock_level: number | null; // For min_max method
  reorder_calculation_method: ReorderCalculationMethod;
  base_unit: string;
  lead_time_days: number | null;
}

export interface OrderQuantityCalculation {
  raw_quantity: number;
  adjusted_quantity: number;
  packages: number | null;
  calculation_method: ReorderCalculationMethod;
  adjustment_reason: string | null;
}
```

### Phase 3: Stock Alerts Types

```typescript
// src/modules/warehouse/types/stock-alerts.ts

export type AlertType = "low_stock" | "out_of_stock" | "below_minimum";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "ignored";

export interface StockAlert {
  id: string;
  organization_id: string;
  branch_id: string | null;
  product_id: string;
  product_variant_id: string | null;
  location_id: string | null;

  // Stock levels
  current_stock: number;
  reorder_point: number;
  available_stock: number;

  // Suggested replenishment
  suggested_order_quantity: number | null;
  suggested_supplier_id: string | null;
  calculation_method: ReorderCalculationMethod | null;

  // Alert classification
  alert_type: AlertType;
  severity: AlertSeverity;

  // Two-tier notifications
  notification_sent: boolean;
  notification_sent_at: string | null;
  notification_type: string | null;

  // Status
  status: AlertStatus;
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
    base_unit: string;
  };
  location?: {
    id: string;
    name: string;
    code: string;
  };
  suggested_supplier?: {
    id: string;
    name: string;
  };
}

export interface AlertSummary {
  total_active: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  out_of_stock_count: number;
  notification_enabled_count: number;
  pending_notifications: number;
}

export interface AlertsBySupplier {
  supplier_id: string;
  supplier_name: string;
  product_count: number;
  total_suggested_quantity: number;
  products: Array<{
    product_id: string;
    product_name: string;
    sku: string;
    available_stock: number;
    reorder_point: number;
    suggested_quantity: number;
    alert_id: string;
    severity: AlertSeverity;
  }>;
}
```

---

## 🔗 Integration Points & UI Components

### Phase 1: Supplier Packaging UI

**Component**: Product-Supplier Relationship Form
**Location**: When adding/editing suppliers for a product

```tsx
<Card>
  <CardHeader>
    <CardTitle>Packaging & Ordering Rules</CardTitle>
    <CardDescription>How {supplier.name} packages and ships this product</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      <FormField name="package_unit" label="Package Unit">
        <Select>
          <option value="box">Box</option>
          <option value="case">Case</option>
          <option value="pallet">Pallet</option>
          <option value="drum">Drum</option>
        </Select>
      </FormField>

      <FormField
        name="package_quantity"
        label={`${product.base_unit}s per package`}
        type="number"
      />
    </div>

    <Checkbox
      name="allow_partial_package"
      label="Allow partial packages"
      description="Can order less than one full package"
    />

    <FormField
      name="min_order_quantity"
      label="Minimum Order Quantity"
      type="number"
      description={`In ${product.base_unit}s`}
    />

    <FormField name="order_in_multiples_of" label="Order in Multiples Of" type="number" />
  </CardContent>
</Card>
```

### Phase 2: Replenishment Settings UI

**Component**: Product Reorder Settings
**Location**: Product edit form

```tsx
<Card>
  <CardHeader>
    <CardTitle>Reorder Settings</CardTitle>
  </CardHeader>
  <CardContent>
    <FormField
      name="reorder_point"
      label="Reorder Point (Minimum)"
      type="number"
      description="Alert when stock falls below this"
    />

    <FormField name="reorder_calculation_method" label="Order Quantity Method" type="select">
      <option value="fixed">Fixed - Always order same amount</option>
      <option value="min_max">Min/Max - Order up to maximum</option>
      <option value="auto">Auto - Based on demand (future)</option>
    </FormField>

    {method === "fixed" && <FormField name="reorder_quantity" label="Fixed Order Quantity" />}

    {method === "min_max" && <FormField name="max_stock_level" label="Maximum Stock Level" />}

    {/* Preview */}
    <Alert>
      <AlertTitle>Order Preview</AlertTitle>
      <AlertDescription>
        When stock hits {reorderPoint}, system will suggest:
        <div className="text-lg font-bold mt-2">
          {previewQuantity} {baseUnit}s
        </div>
      </AlertDescription>
    </Alert>
  </CardContent>
</Card>
```

### Phase 3: Alerts List & Dashboard

**Page**: `/dashboard/warehouse/alerts`

```tsx
<div className="space-y-6">
  {/* Summary Cards */}
  <div className="grid grid-cols-4 gap-4">
    <Card>
      <CardHeader>Total Alerts</CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{summary.total_active}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>Critical</CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-destructive">{summary.critical_count}</div>
      </CardContent>
    </Card>

    {/* More cards... */}
  </div>

  {/* Alerts Table */}
  <DataTable
    data={alerts}
    columns={[
      { id: "severity" /* badge */ },
      { id: "product" /* with SKU */ },
      { id: "available_stock" /* vs reorder point */ },
      { id: "suggested_quantity" /* with supplier */ },
      { id: "actions" /* Acknowledge, Create PO */ },
    ]}
  />
</div>
```

**Widget**: Low Stock Dashboard Widget

```tsx
<Card>
  <CardHeader>
    <CardTitle>Low Stock Alerts</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold">{summary.total_active}</div>
    <div className="text-sm text-muted-foreground">Products below reorder point</div>

    {summary.pending_notifications > 0 && (
      <Badge variant="destructive" className="mt-2">
        {summary.pending_notifications} need attention
      </Badge>
    )}

    <Button variant="link" onClick={() => router.push("/warehouse/alerts")}>
      View All Alerts →
    </Button>
  </CardContent>
</Card>
```

### Phase 4: PO Creation from Alerts

**Dialog**: Batch Create POs Grouped by Supplier

```tsx
<Dialog>
  <DialogHeader>
    <DialogTitle>Create Purchase Orders from Alerts</DialogTitle>
    <DialogDescription>
      {selectedAlerts.length} products from {supplierGroups.length} suppliers
    </DialogDescription>
  </DialogHeader>

  <DialogContent>
    {supplierGroups.map((group) => (
      <Card key={group.supplier_id}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{group.supplier_name}</CardTitle>
              <CardDescription>{group.products.length} products</CardDescription>
            </div>
            <Checkbox checked={group.selected} onChange={() => toggleSupplier(group.supplier_id)} />
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Suggested Order</TableHead>
                <TableHead>Packages</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.products.map((product) => (
                <TableRow key={product.product_id}>
                  <TableCell>{product.product_name}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{product.available_stock}</Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={product.order_quantity}
                      onChange={/* validation */}
                    />
                  </TableCell>
                  <TableCell>
                    {product.packages && (
                      <span className="text-sm text-muted-foreground">
                        {product.packages} {product.package_unit}s
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    ))}
  </DialogContent>

  <DialogFooter>
    <Button onClick={handleBatchCreatePOs}>
      Create {selectedSuppliers.length} Purchase Orders
    </Button>
  </DialogFooter>
</Dialog>
```

---

## 📊 Success Metrics

**Phase 1 Complete:**

- [ ] Supplier packaging fields added to database
- [ ] `adjust_for_packaging()` function working
- [ ] Product-supplier form updated
- [ ] Can configure different packaging per supplier
- [ ] Packaging adjustments tested

**Phase 2 Complete:**

- [ ] Replenishment fields added to products table
- [ ] `calculate_order_quantity()` function working
- [ ] All three methods (fixed, min_max, auto) implemented
- [ ] Product reorder settings UI complete
- [ ] Calculation preview working
- [ ] Integration with Phase 1 (calls packaging adjustment)

**Phase 3 Complete:**

- [ ] Stock alerts table created
- [ ] `check_stock_levels_and_alert()` creates alerts with suggestions
- [ ] Two-tier notification system working
- [ ] Alerts list page functional
- [ ] Dashboard widget displays metrics
- [ ] Auto-resolution working
- [ ] Integration with Phase 2 (suggested quantities calculated)

**Phase 4 Complete:**

- [ ] Batch PO creation dialog working
- [ ] Products grouped by supplier correctly
- [ ] Supplier-specific packaging displayed
- [ ] Quantity validation and adjustment working
- [ ] Multi-supplier scenarios handled
- [ ] PO creation resolves alerts
- [ ] Full end-to-end workflow tested

---

## 🚀 Testing Strategy

### Unit Tests

- Database functions return correct calculations
- Packaging adjustments respect constraints
- Replenishment methods calculate correctly

### Integration Tests

- Alert creation calls replenishment logic
- Replenishment logic calls packaging adjustment
- PO creation resolves alerts

### End-to-End Tests

1. Set up product with multiple suppliers (different packaging)
2. Set reorder point and max level
3. Reduce stock below reorder point
4. Run `check_stock_levels_and_alert()`
5. Verify alert created with correct suggested quantity
6. Create PO from alert
7. Verify alert marked as resolved

### Performance Tests

- Alert generation with 10,000+ products
- Batch PO creation with 100+ products

---

## 📝 Migration Checklist

**Pre-Implementation:**

- [ ] Review existing product_suppliers table structure
- [ ] Review existing products table structure
- [ ] Backup database
- [ ] Test migrations in development

**Phase 1 Deployment:**

- [ ] Run supplier packaging migration
- [ ] Generate TypeScript types
- [ ] Run type-check and lint
- [ ] Test with sample data

**Phase 2 Deployment:**

- [ ] Run replenishment migration
- [ ] Generate TypeScript types
- [ ] Test calculation functions
- [ ] Verify integration with Phase 1

**Phase 3 Deployment:**

- [ ] Run stock alerts migration
- [ ] Generate TypeScript types
- [ ] Test alert creation
- [ ] Configure scheduled job (hourly check)

**Phase 4 Deployment:**

- [ ] Deploy UI components
- [ ] Test batch PO creation
- [ ] User acceptance testing
- [ ] Production deployment

---

## 🔄 Future Enhancements

**Auto Calculation Method:**

- Historical demand analysis
- Seasonality detection
- Lead time optimization
- Safety stock calculations

**Advanced Features:**

- Email/push notifications (Tier 2)
- Multi-location optimization
- Supplier performance tracking
- Cost optimization algorithms

**Analytics:**

- Forecast accuracy
- Stockout prevention rate
- Ordering efficiency metrics
- Supplier lead time analysis

---

**Version:** 1.0
**Created:** November 17, 2024
**Next Review:** After Phase 1 completion
**Approved By:** User
**Implementation Start:** November 17, 2024
