# Warehouse Architecture Refactoring Plan

**Version:** 1.0
**Created:** November 18, 2024
**Status:** 🔴 CRITICAL - Architecture Flaw Identified
**Priority:** P0 - Blocks Multi-Warehouse Operations

---

## Executive Summary

This document outlines a critical architectural flaw in the current warehouse management system and provides a comprehensive step-by-step plan to refactor it to comply with Polish accounting and warehouse management requirements.

### The Problem

The system currently treats **locations (bins)** as the primary inventory container instead of **branches (warehouses)**. This violates the fundamental principle that:

- **Branch = Legal Warehouse** (for documents, accounting, stock totals)
- **Location = Storage Bin** (internal position within warehouse)

### Impact

- ❌ **Duplicate alerts** created (one per bin instead of one per warehouse)
- ❌ **Stock calculations wrong** (per-bin instead of per-warehouse totals)
- ❌ **Reorder points are global** (same threshold for all warehouses)
- ❌ **Purchase orders based on incorrect stock levels**
- ❌ **Polish accounting compliance at risk** (PZ, WZ, MM documents need warehouse-level data)

### Solution Overview

Refactor the system in 4 phases:

1. **Foundation** - Fix data integrity (locations must belong to branches)
2. **Core Views** - Create warehouse-level stock aggregation
3. **Alerts System** - Fix alerts to work per warehouse
4. **Services & UI** - Update application layer

---

## Table of Contents

1. [Current Database Setup](#1-current-database-setup)
2. [Target Architecture](#2-target-architecture)
3. [Migration Plan](#3-migration-plan)
4. [Implementation Steps](#4-implementation-steps)
5. [Testing Checklist](#5-testing-checklist)
6. [Rollback Plan](#6-rollback-plan)

---

## 1. Current Database Setup

### 1.1 Branches Table (Warehouses)

**Current Schema:**

```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  slug TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);
```

**Status:** ✅ CORRECT (but minimal)

**What's Missing:**

- No warehouse-specific fields (address, type, capacity)
- No `is_default` flag for primary warehouse
- No operational settings

**Example Data:**

```sql
-- Typical branch record
{
  id: "uuid-123",
  organization_id: "org-456",
  name: "Warsaw Central Warehouse",
  slug: "warsaw-central"
}
```

---

### 1.2 Locations Table (Bins/Shelves/Racks)

**Current Schema:**

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY,
  organization_id UUID,  -- ⚠️ NULLABLE!
  branch_id UUID,        -- ❌ NULLABLE! This is the problem!
  parent_id UUID REFERENCES locations(id),

  name TEXT NOT NULL,
  code TEXT,
  level INTEGER,

  icon_name TEXT,
  color TEXT,
  description TEXT,

  is_virtual BOOLEAN,
  sort_order INTEGER,

  -- QR code fields
  has_qr_assigned BOOLEAN,
  qr_label_id UUID,
  qr_assigned_at TIMESTAMPTZ,
  qr_assigned_by UUID,

  image_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
```

**Status:** ❌ CRITICAL ISSUE

**Problems:**

1. **`branch_id` is NULLABLE**
   - Locations can exist without a warehouse
   - Breaks the fundamental hierarchy: Warehouse → Bin
   - Allows orphaned locations

2. **`organization_id` is NULLABLE**
   - Security risk in multi-tenant system
   - No proper data isolation

**Impact:**

- Stock can be tracked at locations that don't belong to any warehouse
- Alerts can be created for locations without warehouse context
- Impossible to aggregate stock per warehouse if some locations are orphaned

---

### 1.3 Products Table

**Current Schema:**

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,

  -- Inventory Settings (⚠️ GLOBAL!)
  track_inventory BOOLEAN DEFAULT true,
  reorder_point NUMERIC DEFAULT 0,           -- ❌ Global for all warehouses
  max_stock_level NUMERIC DEFAULT 0,         -- ❌ Global for all warehouses
  reorder_quantity DECIMAL(15,3),            -- ❌ Global for all warehouses
  reorder_calculation_method TEXT,           -- 'fixed', 'min_max', 'auto'
  send_low_stock_alerts BOOLEAN DEFAULT false,
  lead_time_days INTEGER,

  -- ... other fields
);
```

**Status:** ❌ CRITICAL ISSUE

**Problem:**

- **Reorder settings are organization-wide**, not per-warehouse
- Warsaw warehouse might need `reorder_point = 100`
- Poznań warehouse might need `reorder_point = 500`
- Currently **impossible to configure differently**

**What's Missing:**

```sql
-- THIS TABLE DOES NOT EXIST!
CREATE TABLE product_branch_settings (
  product_id UUID REFERENCES products(id),
  branch_id UUID REFERENCES branches(id),
  reorder_point DECIMAL(15,3),
  max_stock_level DECIMAL(15,3),
  min_stock_level DECIMAL(15,3),
  reorder_quantity DECIMAL(15,3),
  -- ...
);
```

---

### 1.4 Stock Inventory Views

#### View 1: `stock_inventory` (Base)

**Current Implementation:**

```sql
CREATE OR REPLACE VIEW stock_inventory AS
SELECT
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id,
  COALESCE(sm.destination_location_id, sm.source_location_id) as location_id,

  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.quantity
    WHEN sm.source_location_id IS NOT NULL THEN -sm.quantity
    ELSE 0
  END) as available_quantity,

  -- ... other calculations

FROM stock_movements sm
INNER JOIN movement_types mt ON sm.movement_type_code = mt.code
WHERE sm.status IN ('approved', 'completed')
  AND sm.deleted_at IS NULL
GROUP BY
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id,
  COALESCE(sm.destination_location_id, sm.source_location_id);  -- ✅ Per location
```

**Status:** ✅ CORRECT for location-level tracking

**What It Returns:**

```
product_id | branch_id | location_id | available_quantity
-----------|-----------|-------------|-------------------
prod-123   | war-01    | A-01-01     | 50
prod-123   | war-01    | A-02-03     | 30
prod-123   | war-01    | B-04-12     | 20
```

**Problem:**

- Works perfectly for **bin-level** operations (picking, putaway)
- Does NOT provide **warehouse-level** totals
- To get "Total stock in Warsaw warehouse", you must manually SUM all locations

---

#### View 2: `product_available_inventory` (With Reservations)

**Current Implementation:**

```sql
CREATE OR REPLACE VIEW product_available_inventory AS
WITH inventory AS (
  SELECT
    organization_id,
    branch_id,
    product_id,
    variant_id,
    location_id,
    available_quantity,
    -- ... other fields
  FROM stock_inventory
),
active_reservations AS (
  SELECT
    organization_id,
    branch_id,
    product_id,
    variant_id,
    location_id,  -- ✅ Reservations per location
    SUM(reserved_quantity - released_quantity) AS reserved_quantity
  FROM stock_reservations
  WHERE status IN ('active', 'partial')
    AND deleted_at IS NULL
  GROUP BY organization_id, branch_id, product_id, variant_id, location_id
)
SELECT
  -- ... fields
  (COALESCE(inv.available_quantity, 0) - COALESCE(res.reserved_quantity, 0)) AS available_quantity
FROM inventory inv
FULL OUTER JOIN active_reservations res ON (/* join conditions */);
```

**Status:** ✅ CORRECT for location-level tracking

**What It Returns:**

```
product_id | branch_id | location_id | quantity_on_hand | reserved_quantity | available_quantity
-----------|-----------|-------------|------------------|-------------------|-------------------
prod-123   | war-01    | A-01-01     | 50               | 10                | 40
prod-123   | war-01    | A-02-03     | 30               | 5                 | 25
prod-123   | war-01    | B-04-12     | 20               | 0                 | 20
```

**Problem:**

- Same as above - no warehouse-level aggregation
- Stock alerts system queries this view and gets **one row per location**
- Results in **duplicate alerts** (one per bin)

---

### 1.5 Stock Movements Table

**Current Schema:**

```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY,

  -- Organization & Branch
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),  -- ✅ NOT NULL

  -- Product
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),

  -- Locations (optional for branch-level movements)
  source_location_id UUID REFERENCES locations(id),
  destination_location_id UUID REFERENCES locations(id),

  -- Movement details
  movement_number TEXT UNIQUE NOT NULL,
  movement_type_code TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',

  -- ... other fields

  CONSTRAINT valid_locations CHECK (
    (source_location_id IS NOT NULL OR destination_location_id IS NOT NULL)
  )
);
```

**Status:** ✅ CORRECT

**What Works:**

- ✅ `branch_id` is NOT NULL - Every movement tied to a warehouse
- ✅ Locations are optional - Supports both warehouse-level and bin-level movements
- ✅ Proper constraints and foreign keys

**Example Movements:**

**Receipt (PZ) - Warehouse-level initially:**

```sql
{
  movement_type_code: "101",
  branch_id: "war-01",
  source_location_id: NULL,           -- Coming from outside
  destination_location_id: "RCV-01",  -- Goes to receiving bin
  quantity: 100
}
```

**Putaway - Bin-to-bin within warehouse:**

```sql
{
  movement_type_code: "303",  -- Intra-location transfer
  branch_id: "war-01",
  source_location_id: "RCV-01",    -- From receiving
  destination_location_id: "A-01",  -- To storage
  quantity: 100
}
```

**Inter-Branch Transfer (MM) - Warehouse-to-warehouse:**

```sql
-- OUT from Warsaw
{
  movement_type_code: "311",
  branch_id: "war-01",
  source_location_id: "A-01",
  destination_location_id: NULL,
  quantity: -50
}

-- IN to Poznań
{
  movement_type_code: "312",
  branch_id: "poz-01",
  source_location_id: NULL,
  destination_location_id: "POZ-RCV",
  quantity: 50
}
```

---

### 1.6 Stock Alerts Table

**Current Schema:**

```sql
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY,

  -- Organization & Branch
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID REFERENCES branches(id),        -- ⚠️ NULLABLE!

  -- Product
  product_id UUID NOT NULL REFERENCES products(id),
  product_variant_id UUID REFERENCES product_variants(id),
  location_id UUID REFERENCES locations(id),     -- ⚠️ NULLABLE!

  -- Stock Levels (snapshot at alert creation)
  current_stock DECIMAL(15,3) NOT NULL,     -- Available after reservations
  reorder_point DECIMAL(15,3) NOT NULL,
  available_stock DECIMAL(15,3) NOT NULL,
  quantity_on_hand DECIMAL(15,3),
  reserved_quantity DECIMAL(15,3),

  -- Suggested Replenishment
  suggested_order_quantity DECIMAL(15,3),
  suggested_packages DECIMAL(15,3),
  suggested_supplier_id UUID,
  calculation_method TEXT,

  -- Alert Classification
  alert_type TEXT NOT NULL,     -- 'low_stock', 'out_of_stock'
  severity TEXT NOT NULL,       -- 'info', 'warning', 'critical'

  -- Notification System
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'active',  -- 'active', 'resolved', 'acknowledged'

  -- ... other fields
);
```

**Status:** ⚠️ PARTIALLY CORRECT

**Problems:**

1. **`branch_id` is NULLABLE**
   - Should be NOT NULL (alerts always tied to a warehouse)

2. **Stores `location_id`**
   - This causes duplicate alerts (one per bin)
   - Should aggregate at warehouse level

---

### 1.7 Stock Alert Detection Function

**Current Implementation:**

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
BEGIN
  -- Find products below reorder point
  FOR product_record IN
    SELECT
      p.id as product_id,
      p.organization_id,
      p.reorder_point,          -- ❌ Global reorder point
      p.send_low_stock_alerts,
      pai.quantity_on_hand,
      pai.reserved_quantity,
      pai.available_quantity,   -- ✅ Per location
      pai.location_id,          -- ✅ Per location
      pai.branch_id
    FROM products p
    INNER JOIN product_available_inventory pai ON p.id = pai.product_id
    WHERE p.track_inventory = true
      AND p.reorder_point IS NOT NULL
      AND pai.available_quantity <= p.reorder_point  -- ❌ Comparing location stock to global reorder point
  LOOP
    -- Check for existing alert (per location)
    IF NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE product_id = product_record.product_id
        AND location_id = product_record.location_id  -- ❌ Checks per location
        AND status = 'active'
    ) THEN
      -- Create alert for this product/location
      INSERT INTO stock_alerts (
        organization_id,
        branch_id,
        product_id,
        location_id,       -- ❌ Stores location
        current_stock,     -- ❌ Stock from this location only
        reorder_point,     -- ❌ Global reorder point
        -- ...
      ) VALUES (...);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**Status:** ❌ INCORRECT

**What Happens:**

**Scenario:**

- Product: "Widget A"
- Global `reorder_point`: 100
- Warsaw warehouse has 3 bins:
  - Bin A-01: 40 units
  - Bin A-02: 35 units
  - Bin B-01: 30 units
- **Total in Warsaw: 105 units** (above reorder point!)

**Current Behavior:**

```
Query returns 3 rows:
- product_id=widget, location=A-01, available=40  → 40 < 100 → CREATE ALERT
- product_id=widget, location=A-02, available=35  → 35 < 100 → CREATE ALERT
- product_id=widget, location=B-01, available=30  → 30 < 100 → CREATE ALERT

Result: 3 alerts created ❌
```

**Correct Behavior Should Be:**

```
Aggregate stock across all bins in Warsaw warehouse:
- Total available: 105 units
- Reorder point: 100 units
- 105 > 100 → NO ALERT ✅

Result: 0 alerts created
```

---

### 1.8 Stock Reservations Table

**Current Schema:**

```sql
CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY,

  -- Organization & Branch
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),  -- ✅ NOT NULL

  -- Product & Location
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  location_id UUID NOT NULL REFERENCES locations(id),  -- ✅ NOT NULL

  -- Reservation details
  reservation_number TEXT UNIQUE NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  reserved_quantity DECIMAL(15,4) NOT NULL,
  released_quantity DECIMAL(15,4) NOT NULL,

  -- Reference (sales order, etc.)
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'active',

  -- ... other fields
);
```

**Status:** ✅ CORRECT

**What Works:**

- ✅ Per-location reservations (correct for warehouse operations)
- ✅ Branch context maintained
- ✅ Properly integrated with inventory views

**Note:**

- Reservations at location level are actually correct
- During order fulfillment, you pick from specific bins
- The issue is only with **reorder point thresholds** and **alerts**

---

## 2. Target Architecture

### 2.1 Proper Warehouse Hierarchy

```
Organization
  └── Branch (= Warehouse = Legal Stock Container)
       ├── Product Settings (per-warehouse reorder points)
       ├── Stock Totals (aggregated across all bins)
       └── Locations (= Bins/Shelves/Racks)
            ├── Location A-01 (physical stock here)
            ├── Location A-02 (physical stock here)
            └── Location B-01 (physical stock here)
```

### 2.2 Key Principles

| Concept           | Level         | Used For                                                              |
| ----------------- | ------------- | --------------------------------------------------------------------- |
| **Branch**        | Warehouse     | Legal documents (PZ, WZ, MM), stock totals, alerts, reorder decisions |
| **Location**      | Bin           | Picking, putaway, physical stock positioning                          |
| **Stock Total**   | Warehouse     | Sum of all bins in warehouse                                          |
| **Reorder Point** | Per-warehouse | Different thresholds per warehouse                                    |
| **Alert**         | Per-warehouse | One alert per product per warehouse                                   |
| **Reservation**   | Per-bin       | Reserve from specific location for picking                            |

### 2.3 Polish Accounting Compliance

**Documents are warehouse-level, not bin-level:**

- **PZ (Przyjęcie Zewnętrzne)** - Goods receipt → Warehouse receives, then distributed to bins
- **WZ (Wydanie Zewnętrzne)** - Goods issue → Picked from bins, issued from warehouse
- **MM (Przesunięcie Międzymagazynowe)** - Inter-warehouse transfer → Warehouse to warehouse
- **RW (Rozchód Wewnętrzny)** - Internal issue → From warehouse
- **PW (Przyjęcie Wewnętrzne)** - Internal receipt → To warehouse

**Bin movements are internal:**

- Moving from bin A-01 to bin A-02 within same warehouse = no document
- Just internal stock positioning

---

## 3. Migration Plan

### Phase 1: Foundation (Data Integrity)

**Objective:** Enforce that all locations belong to branches and create per-branch product settings.

#### 3.1 Fix Locations Table

**Migration:** `20251118000004_enforce_location_branch_ownership.sql`

```sql
-- Step 1: Backfill any NULL branch_id values
-- (This should not exist, but just in case)
UPDATE locations
SET branch_id = (
  SELECT id FROM branches
  WHERE organization_id = locations.organization_id
  LIMIT 1
)
WHERE branch_id IS NULL
  AND organization_id IS NOT NULL;

-- Step 2: Make branch_id NOT NULL
ALTER TABLE locations
ALTER COLUMN branch_id SET NOT NULL;

-- Step 3: Make organization_id NOT NULL
ALTER TABLE locations
ALTER COLUMN organization_id SET NOT NULL;

-- Step 4: Add comment
COMMENT ON COLUMN locations.branch_id IS
  'Every location (bin) must belong to a branch (warehouse).
   This enforces the hierarchy: Organization → Branch (Warehouse) → Location (Bin).';
```

**Impact:**

- ✅ Prevents orphaned locations
- ✅ Enforces warehouse → bin hierarchy
- ✅ Required for all subsequent changes

**Rollback:**

```sql
ALTER TABLE locations ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE locations ALTER COLUMN organization_id DROP NOT NULL;
```

---

#### 3.2 Create Product Branch Settings Table

**Migration:** `20251118000005_create_product_branch_settings.sql`

```sql
-- Create table for per-branch product settings
CREATE TABLE product_branch_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Inventory Settings (per-warehouse)
  reorder_point DECIMAL(15,3),
  max_stock_level DECIMAL(15,3),
  min_stock_level DECIMAL(15,3),
  reorder_quantity DECIMAL(15,3),
  reorder_calculation_method TEXT
    CHECK (reorder_calculation_method IN ('fixed', 'min_max', 'auto')),

  -- Warehouse-specific preferences
  track_inventory BOOLEAN DEFAULT true,
  send_low_stock_alerts BOOLEAN DEFAULT false,
  lead_time_days INTEGER,

  -- Optional: Default receiving location in this warehouse
  preferred_receiving_location_id UUID REFERENCES locations(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(product_id, branch_id),

  -- Ensure preferred location belongs to this branch
  CONSTRAINT valid_receiving_location CHECK (
    preferred_receiving_location_id IS NULL OR
    EXISTS (
      SELECT 1 FROM locations
      WHERE id = preferred_receiving_location_id
        AND branch_id = product_branch_settings.branch_id
    )
  )
);

-- Indexes
CREATE INDEX idx_product_branch_settings_product
  ON product_branch_settings(product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_product_branch_settings_branch
  ON product_branch_settings(branch_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_product_branch_settings_reorder
  ON product_branch_settings(product_id, branch_id, reorder_point)
  WHERE reorder_point IS NOT NULL
    AND track_inventory = true
    AND deleted_at IS NULL;

-- Auto-update timestamp
CREATE TRIGGER trg_product_branch_settings_updated_at
  BEFORE UPDATE ON product_branch_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE product_branch_settings IS
  'Per-warehouse inventory settings for products.

   Each warehouse (branch) can have different reorder points, max levels, and lead times
   for the same product based on local demand, capacity, and supply chain considerations.

   Example:
   - Warsaw warehouse: reorder_point = 100, max_stock_level = 500
   - Poznań warehouse: reorder_point = 300, max_stock_level = 1000';

COMMENT ON COLUMN product_branch_settings.reorder_point IS
  'Minimum stock level that triggers low stock alert for THIS warehouse.
   When warehouse stock falls below this point, an alert is created and a purchase order may be suggested.';
```

**Impact:**

- ✅ Allows different reorder points per warehouse
- ✅ Supports multi-warehouse operations
- ✅ Foundation for correct alert system

---

#### 3.3 Migrate Existing Reorder Points

**Migration:** `20251118000006_migrate_reorder_points_to_branches.sql`

```sql
-- Migrate existing product reorder points to ALL branches
INSERT INTO product_branch_settings (
  product_id,
  branch_id,
  organization_id,
  reorder_point,
  max_stock_level,
  min_stock_level,
  reorder_quantity,
  reorder_calculation_method,
  track_inventory,
  send_low_stock_alerts,
  lead_time_days
)
SELECT
  p.id as product_id,
  b.id as branch_id,
  p.organization_id,
  p.reorder_point,
  p.max_stock_level,
  p.min_stock_level,
  p.reorder_quantity,
  p.reorder_calculation_method,
  p.track_inventory,
  p.send_low_stock_alerts,
  p.lead_time_days
FROM products p
CROSS JOIN branches b
WHERE p.organization_id = b.organization_id
  AND p.deleted_at IS NULL
  AND b.deleted_at IS NULL
  AND (
    p.reorder_point IS NOT NULL OR
    p.max_stock_level IS NOT NULL OR
    p.reorder_quantity IS NOT NULL
  )
ON CONFLICT (product_id, branch_id) DO NOTHING;

-- Log the migration
DO $$
DECLARE
  v_settings_created INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_settings_created
  FROM product_branch_settings;

  RAISE NOTICE '=== Reorder Points Migration Complete ===';
  RAISE NOTICE 'Created % product-branch setting records', v_settings_created;
  RAISE NOTICE 'Each product now has settings for each warehouse';
  RAISE NOTICE '==========================================';
END $$;

-- Add comment to products table fields (deprecation notice)
COMMENT ON COLUMN products.reorder_point IS
  'DEPRECATED: Use product_branch_settings.reorder_point instead.
   This field is kept for backward compatibility but should not be used for new features.
   Different warehouses need different reorder points.';

COMMENT ON COLUMN products.max_stock_level IS
  'DEPRECATED: Use product_branch_settings.max_stock_level instead.';

COMMENT ON COLUMN products.reorder_quantity IS
  'DEPRECATED: Use product_branch_settings.reorder_quantity instead.';
```

**Impact:**

- ✅ Migrates existing data to new structure
- ✅ Maintains backward compatibility
- ✅ Each warehouse gets same initial settings (can be customized later)

---

### Phase 2: Core Views (Stock Calculation)

**Objective:** Create warehouse-level stock aggregation views.

#### 3.4 Create Warehouse-Level Inventory Views

**Migration:** `20251118000007_create_branch_level_inventory_views.sql`

```sql
-- =====================================================
-- View 1: Stock Inventory by Branch (Warehouse Level)
-- =====================================================

CREATE OR REPLACE VIEW stock_inventory_by_branch AS
SELECT
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id,

  -- Aggregate stock across ALL locations in this branch
  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.quantity
    WHEN sm.source_location_id IS NOT NULL THEN -sm.quantity
    ELSE 0
  END) as quantity_on_hand,

  -- Count of distinct locations holding this product
  COUNT(DISTINCT COALESCE(sm.destination_location_id, sm.source_location_id)) as locations_count,

  -- Metadata
  MAX(sm.occurred_at) as last_movement_at,
  COUNT(*) as total_movements

FROM stock_movements sm
INNER JOIN movement_types mt ON sm.movement_type_code = mt.code AND mt.deleted_at IS NULL
WHERE sm.status IN ('approved', 'completed')
  AND sm.deleted_at IS NULL
GROUP BY
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id;

-- =====================================================
-- View 2: Product Available Inventory by Branch
-- =====================================================

CREATE OR REPLACE VIEW product_available_inventory_by_branch AS
WITH branch_inventory AS (
  SELECT
    organization_id,
    branch_id,
    product_id,
    variant_id,
    quantity_on_hand,
    locations_count,
    last_movement_at
  FROM stock_inventory_by_branch
),
branch_reservations AS (
  SELECT
    organization_id,
    branch_id,
    product_id,
    variant_id,
    SUM(reserved_quantity - released_quantity) AS reserved_quantity,
    COUNT(*) as active_reservations_count
  FROM stock_reservations
  WHERE status IN ('active', 'partial')
    AND deleted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  GROUP BY organization_id, branch_id, product_id, variant_id
)
SELECT
  COALESCE(inv.product_id, res.product_id) AS product_id,
  COALESCE(inv.variant_id, res.variant_id) AS variant_id,
  COALESCE(inv.organization_id, res.organization_id) AS organization_id,
  COALESCE(inv.branch_id, res.branch_id) AS branch_id,

  -- Stock levels (warehouse totals)
  COALESCE(inv.quantity_on_hand, 0)::DECIMAL AS quantity_on_hand,
  COALESCE(res.reserved_quantity, 0)::DECIMAL AS reserved_quantity,
  (COALESCE(inv.quantity_on_hand, 0) - COALESCE(res.reserved_quantity, 0))::DECIMAL AS available_quantity,

  -- Metadata
  inv.locations_count,
  res.active_reservations_count,
  inv.last_movement_at

FROM branch_inventory inv
FULL OUTER JOIN branch_reservations res
  ON inv.organization_id = res.organization_id
 AND inv.branch_id = res.branch_id
 AND inv.product_id = res.product_id
 AND inv.variant_id IS NOT DISTINCT FROM res.variant_id;

-- Comments
COMMENT ON VIEW stock_inventory_by_branch IS
  'Warehouse-level stock totals aggregated across all bins (locations) in each branch.

   Use this view for:
   - Reorder point decisions
   - Alert generation
   - Purchase order calculations
   - Inter-warehouse transfers
   - Warehouse capacity planning

   For bin-level operations (picking, putaway), use stock_inventory view instead.';

COMMENT ON VIEW product_available_inventory_by_branch IS
  'Warehouse-level available stock after subtracting reservations.

   This is the PRIMARY view for alert detection and replenishment decisions.

   Example:
   - Warsaw warehouse: 150 units on hand, 50 reserved, 100 available
   - If reorder_point = 120, an alert should be created (100 < 120)';

-- Log creation
DO $$
BEGIN
  RAISE NOTICE '=== Warehouse-Level Inventory Views Created ===';
  RAISE NOTICE 'Created: stock_inventory_by_branch';
  RAISE NOTICE 'Created: product_available_inventory_by_branch';
  RAISE NOTICE 'These views aggregate stock at the warehouse (branch) level';
  RAISE NOTICE '==============================================';
END $$;
```

**Impact:**

- ✅ Provides warehouse-level stock totals
- ✅ Keeps existing location-level views for bin operations
- ✅ Foundation for correct alert detection

**Example Output:**

**Old View (per location):**

```
product_id | branch_id | location_id | available_quantity
-----------|-----------|-------------|-------------------
prod-123   | war-01    | A-01        | 40
prod-123   | war-01    | A-02        | 35
prod-123   | war-01    | B-01        | 30
```

**New View (per warehouse):**

```
product_id | branch_id | quantity_on_hand | reserved_quantity | available_quantity | locations_count
-----------|-----------|------------------|-------------------|--------------------|-----------------
prod-123   | war-01    | 105              | 0                 | 105                | 3
```

---

### Phase 3: Alerts System (Critical Fix)

**Objective:** Fix alert system to work at warehouse level with per-warehouse reorder points.

#### 3.5 Fix Stock Alerts Table and Function

**Migration:** `20251118000008_fix_alerts_branch_level.sql`

```sql
-- =====================================================
-- Step 1: Make branch_id NOT NULL in stock_alerts
-- =====================================================

-- Backfill any NULL branch_id from location
UPDATE stock_alerts sa
SET branch_id = l.branch_id
FROM locations l
WHERE sa.location_id = l.id
  AND sa.branch_id IS NULL;

-- Make NOT NULL
ALTER TABLE stock_alerts
ALTER COLUMN branch_id SET NOT NULL;

-- =====================================================
-- Step 2: Drop and recreate alert detection function
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
    AND sa.variant_id IS NOT DISTINCT FROM inv.variant_id
    AND sa.status = 'active'
    AND (p_organization_id IS NULL OR sa.organization_id = p_organization_id);

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- STEP 2: Auto-resolve alerts where stock returned to normal
  UPDATE stock_alerts sa
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolution_notes = 'Auto-resolved: warehouse stock level returned above reorder point'
  FROM product_available_inventory_by_branch inv
  INNER JOIN product_branch_settings pbs
    ON inv.product_id = pbs.product_id
   AND inv.branch_id = pbs.branch_id
  WHERE sa.product_id = inv.product_id
    AND sa.branch_id = inv.branch_id
    AND sa.variant_id IS NOT DISTINCT FROM inv.variant_id
    AND sa.status = 'active'
    AND inv.available_quantity > pbs.reorder_point
    AND (p_organization_id IS NULL OR sa.organization_id = p_organization_id);

  GET DIAGNOSTICS resolved_count = ROW_COUNT;

  -- STEP 3: Find products below reorder point and create NEW alerts
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
    INNER JOIN product_branch_settings pbs ON p.id = pbs.product_id
    INNER JOIN product_available_inventory_by_branch inv
      ON p.id = inv.product_id
     AND pbs.branch_id = inv.branch_id
    WHERE pbs.track_inventory = true
      AND pbs.reorder_point IS NOT NULL
      AND pbs.reorder_point > 0
      AND p.deleted_at IS NULL
      AND pbs.deleted_at IS NULL
      AND inv.available_quantity <= pbs.reorder_point
      AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
  LOOP
    -- Check if alert already exists for this product/branch (prevent duplicates)
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

      -- Calculate suggested order quantity
      SELECT * INTO suggested_qty
      FROM calculate_order_quantity(
        product_branch_record.product_id,
        preferred_supplier,
        product_branch_record.branch_id  -- Pass branch context
      );

      -- Create alert (ONE per product per warehouse)
      INSERT INTO stock_alerts (
        organization_id,
        branch_id,
        product_id,
        location_id,  -- NULL - alert is warehouse-level
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
        NULL,  -- ✅ No specific location - warehouse-level alert
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

   Changes from previous version:
   - Uses product_branch_settings for warehouse-specific reorder points
   - Compares WAREHOUSE TOTAL stock (not bin-level) to reorder point
   - Creates ONE alert per product per warehouse (not per bin)
   - Sets location_id to NULL (alert is warehouse-level)

   Example:
   - Warsaw warehouse: 105 units total across 3 bins
   - Warsaw reorder_point: 100 units
   - 105 > 100 → NO alert created ✅

   - Poznań warehouse: 80 units total across 2 bins
   - Poznań reorder_point: 300 units
   - 80 < 300 → CREATE alert ✅';

-- =====================================================
-- Step 3: Update alert summary function
-- =====================================================

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
  affected_branches INTEGER
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
    COUNT(DISTINCT branch_id)::INTEGER as affected_branches
  FROM stock_alerts
  WHERE organization_id = p_organization_id
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 4: Add indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_stock_alerts_branch_product_active
  ON stock_alerts(branch_id, product_id, status)
  WHERE status = 'active';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '=== Stock Alerts System Fixed ===';
  RAISE NOTICE 'Alerts now work at WAREHOUSE level (not bin level)';
  RAISE NOTICE 'Uses per-branch reorder points from product_branch_settings';
  RAISE NOTICE 'Creates ONE alert per product per warehouse';
  RAISE NOTICE '=====================================';
END $$;
```

**Impact:**

- ✅ Fixes duplicate alert issue
- ✅ Uses per-warehouse reorder points
- ✅ Compares warehouse totals to thresholds
- ✅ One alert per product per warehouse

---

### Phase 4: Services & UI (Application Layer)

**Objective:** Update TypeScript types, services, and UI components.

#### 3.6 Update TypeScript Types

**File:** `src/modules/warehouse/types/product-branch-settings.ts` (NEW)

```typescript
/**
 * Per-Branch Product Settings
 * Allows different inventory thresholds per warehouse
 */

export type ReorderCalculationMethod = "fixed" | "min_max" | "auto";

export interface ProductBranchSettings {
  id: string;
  product_id: string;
  branch_id: string;
  organization_id: string;

  // Inventory thresholds (per-warehouse)
  reorder_point: number | null;
  max_stock_level: number | null;
  min_stock_level: number | null;
  reorder_quantity: number | null;
  reorder_calculation_method: ReorderCalculationMethod | null;

  // Warehouse preferences
  track_inventory: boolean;
  send_low_stock_alerts: boolean;
  lead_time_days: number | null;

  // Optional default location
  preferred_receiving_location_id: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateProductBranchSettingsData {
  product_id: string;
  branch_id: string;
  reorder_point?: number;
  max_stock_level?: number;
  min_stock_level?: number;
  reorder_quantity?: number;
  reorder_calculation_method?: ReorderCalculationMethod;
  track_inventory?: boolean;
  send_low_stock_alerts?: boolean;
  lead_time_days?: number;
  preferred_receiving_location_id?: string;
}

export interface UpdateProductBranchSettingsData {
  reorder_point?: number;
  max_stock_level?: number;
  min_stock_level?: number;
  reorder_quantity?: number;
  reorder_calculation_method?: ReorderCalculationMethod;
  track_inventory?: boolean;
  send_low_stock_alerts?: boolean;
  lead_time_days?: number;
  preferred_receiving_location_id?: string;
}
```

**File:** `src/modules/warehouse/types/stock-alerts.ts` (UPDATE)

```typescript
export interface StockAlert {
  id: string;
  organization_id: string;
  branch_id: string; // ✅ NOT NULL now
  product_id: string;
  product_variant_id: string | null;
  location_id: string | null; // ✅ NULL for warehouse-level alerts

  // Stock levels (warehouse totals)
  current_stock: number;
  reorder_point: number;
  available_stock: number;
  quantity_on_hand: number | null;
  reserved_quantity: number | null;

  // ... rest unchanged
}
```

#### 3.7 Create Product Branch Settings Service

**File:** `src/modules/warehouse/api/product-branch-settings-service.ts` (NEW)

```typescript
import { createClient } from "@/utils/supabase/client";
import type {
  ProductBranchSettings,
  CreateProductBranchSettingsData,
  UpdateProductBranchSettingsData,
} from "../types/product-branch-settings";

export const productBranchSettingsService = {
  /**
   * Get settings for a product in a specific branch
   */
  async getSettings(productId: string, branchId: string): Promise<ProductBranchSettings | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("product_branch_settings")
      .select("*")
      .eq("product_id", productId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching product branch settings:", error);
      return null;
    }

    return data;
  },

  /**
   * Get all branch settings for a product
   */
  async getSettingsForProduct(productId: string): Promise<ProductBranchSettings[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("product_branch_settings")
      .select("*")
      .eq("product_id", productId)
      .is("deleted_at", null);

    if (error) {
      console.error("Error fetching product branch settings:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Create or update settings for a product in a branch
   */
  async upsertSettings(
    data: CreateProductBranchSettingsData
  ): Promise<ProductBranchSettings | null> {
    const supabase = createClient();

    const { data: result, error } = await supabase
      .from("product_branch_settings")
      .upsert({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error upserting product branch settings:", error);
      throw error;
    }

    return result;
  },

  /**
   * Update settings for a product in a branch
   */
  async updateSettings(
    productId: string,
    branchId: string,
    updates: UpdateProductBranchSettingsData
  ): Promise<ProductBranchSettings | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("product_branch_settings")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("Error updating product branch settings:", error);
      throw error;
    }

    return data;
  },

  /**
   * Delete settings (soft delete)
   */
  async deleteSettings(productId: string, branchId: string): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
      .from("product_branch_settings")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("product_id", productId)
      .eq("branch_id", branchId);

    if (error) {
      console.error("Error deleting product branch settings:", error);
      return false;
    }

    return true;
  },
};
```

#### 3.8 Update Alerts UI

**File:** `src/app/[locale]/dashboard/warehouse/alerts/page.tsx` (UPDATE)

Remove "Location" column and add "Branch" information:

```typescript
// Update table headers
<TableHead>Branch</TableHead>
<TableHead>Product</TableHead>
<TableHead className="text-right">On Hand</TableHead>
<TableHead className="text-right">Reserved</TableHead>
<TableHead className="text-right">Available</TableHead>
<TableHead className="text-right">Reorder Point</TableHead>
// ... remove Location column

// Update table cells
<TableCell>
  {alert.branch?.name || "N/A"}
</TableCell>
<TableCell>
  <div>
    <p className="font-medium">{alert.product?.name}</p>
    {alert.product_variant && (
      <p className="text-sm text-muted-foreground">
        {alert.product_variant.name}
      </p>
    )}
  </div>
</TableCell>
// ... rest of cells
```

---

## 4. Implementation Steps

### Step-by-Step Execution Plan

#### Week 1: Foundation

**Day 1-2: Phase 1 Migrations**

1. ✅ Apply migration `20251118000004_enforce_location_branch_ownership.sql`
2. ✅ Verify all locations have branch_id
3. ✅ Apply migration `20251118000005_create_product_branch_settings.sql`
4. ✅ Apply migration `20251118000006_migrate_reorder_points_to_branches.sql`
5. ✅ Run `npm run supabase:gen:types`
6. ✅ Verify data integrity

**Day 3-4: Phase 2 Views** 7. ✅ Apply migration `20251118000007_create_branch_level_inventory_views.sql` 8. ✅ Test new views with sample queries 9. ✅ Verify stock aggregation is correct

**Day 5: Phase 3 Alerts** 10. ✅ Apply migration `20251118000008_fix_alerts_branch_level.sql` 11. ✅ Run stock check manually to verify 12. ✅ Check that duplicate alerts are gone

#### Week 2: Application Layer

**Day 1-2: TypeScript Types** 13. ✅ Create `product-branch-settings.ts` types file 14. ✅ Update `stock-alerts.ts` types 15. ✅ Run `npm run type-check`

**Day 3: Services** 16. ✅ Create `product-branch-settings-service.ts` 17. ✅ Update alert service to use branch-level data 18. ✅ Test services in development

**Day 4-5: UI Updates** 19. ✅ Update alerts page UI 20. ✅ Create branch settings management UI 21. ✅ Update product form to show per-branch settings 22. ✅ Run `npm run lint` and `npm run format`

#### Week 3: Testing & Deployment

**Day 1-3: Testing** 23. ✅ Test alert creation with different scenarios 24. ✅ Test stock calculations 25. ✅ Test inter-branch transfers 26. ✅ Test purchase order generation

**Day 4: Documentation** 27. ✅ Update CLAUDE.md with new architecture 28. ✅ Document branch settings UI 29. ✅ Create user guide for multi-warehouse

**Day 5: Deployment** 30. ✅ Deploy to production 31. ✅ Monitor for issues 32. ✅ Gather user feedback

---

## 5. Testing Checklist

### 5.1 Data Integrity Tests

- [ ] All locations have `branch_id` NOT NULL
- [ ] All locations have `organization_id` NOT NULL
- [ ] All products have settings for all branches
- [ ] No orphaned product_branch_settings
- [ ] Reorder points migrated correctly

### 5.2 Stock Calculation Tests

**Scenario: Product in Multiple Bins**

- [ ] Product in 3 bins: 40, 35, 30 units
- [ ] Branch view shows: 105 units total
- [ ] Location view shows: 3 separate rows
- [ ] Both views match database

**Scenario: Reservations**

- [ ] 100 units on hand, 20 reserved
- [ ] Branch view shows: 80 available
- [ ] Can create reservation for max 80 units
- [ ] Cannot reserve more than available

### 5.3 Alert System Tests

**Scenario: Stock Above Reorder Point**

- [ ] Total stock: 105 units
- [ ] Reorder point: 100 units
- [ ] Run stock check
- [ ] NO alert created ✅

**Scenario: Stock Below Reorder Point**

- [ ] Total stock: 80 units
- [ ] Reorder point: 100 units
- [ ] Run stock check
- [ ] ONE alert created ✅
- [ ] Alert has branch_id
- [ ] Alert has NULL location_id
- [ ] Alert shows warehouse total

**Scenario: Multiple Warehouses**

- [ ] Warsaw: 80 units, reorder: 100 → Alert
- [ ] Poznań: 350 units, reorder: 300 → No alert
- [ ] 1 alert for Warsaw only
- [ ] 0 alerts for Poznań

**Scenario: Alert Resolution**

- [ ] Alert exists for 80 units
- [ ] Receive 50 units → total: 130
- [ ] Run stock check
- [ ] Alert marked as resolved ✅

### 5.4 Multi-Warehouse Tests

**Scenario: Different Reorder Points**

- [ ] Product A in Warsaw: reorder = 100
- [ ] Product A in Poznań: reorder = 300
- [ ] Settings saved correctly
- [ ] Alerts use correct thresholds

**Scenario: Inter-Branch Transfer**

- [ ] Transfer 50 units Warsaw → Poznań
- [ ] Warsaw stock decreases by 50
- [ ] Poznań stock increases by 50
- [ ] Alerts recalculated for both

### 5.5 UI Tests

- [ ] Alerts page shows branch name
- [ ] Alerts page shows warehouse totals
- [ ] No duplicate alerts visible
- [ ] Branch settings form works
- [ ] Can edit reorder points per warehouse
- [ ] Stock check button works
- [ ] Real-time updates work

---

## 6. Rollback Plan

### If Issues Arise

**Phase 3 Rollback (Alerts):**

```sql
-- Restore old function (from backup)
-- Revert stock_alerts.branch_id to nullable
ALTER TABLE stock_alerts ALTER COLUMN branch_id DROP NOT NULL;
```

**Phase 2 Rollback (Views):**

```sql
-- Drop new views
DROP VIEW IF EXISTS product_available_inventory_by_branch;
DROP VIEW IF EXISTS stock_inventory_by_branch;
```

**Phase 1 Rollback (Foundation):**

```sql
-- Revert locations constraints
ALTER TABLE locations ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE locations ALTER COLUMN organization_id DROP NOT NULL;

-- Keep product_branch_settings table (data migration already done)
-- Just don't use it in application
```

### Data Backup

Before any migration:

```bash
# Export current state
npm run supabase:db:dump > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use Supabase dashboard to create snapshot
```

---

## 7. Success Criteria

### Must Have (P0)

- ✅ All locations have branch_id NOT NULL
- ✅ Product branch settings table exists and populated
- ✅ Branch-level inventory views created
- ✅ Alert system creates ONE alert per product per warehouse
- ✅ Alerts use per-warehouse reorder points
- ✅ No duplicate alerts

### Should Have (P1)

- ✅ UI shows warehouse totals clearly
- ✅ Branch settings management interface
- ✅ Alert summary includes branch breakdown
- ✅ Stock reports show per-warehouse data

### Nice to Have (P2)

- ⏳ Warehouse capacity tracking
- ⏳ Inter-warehouse reorder automation
- ⏳ Branch-specific supplier preferences
- ⏳ Warehouse transfer workflows

---

## 8. References

### Related Documents

- `/docs/warehouse/INVENTORY_REPLENISHMENT_SYSTEM_PLAN.md` - Phase 3 alerts implementation
- `/CLAUDE.md` - Project architecture overview
- Polish warehouse compliance requirements (PZ, WZ, MM documents)

### Database Schema Files

- `/supabase/migrations/20240601100000_initial_schema_squashed.sql` - Branches table
- `/supabase/migrations/20251024120000_create_stock_movements_system.sql` - Stock movements
- `/supabase/migrations/20251117120002_phase3_stock_alerts.sql` - Current alerts (broken)

### Key Files to Update

**Migrations:**

- 4 new migration files (20251118000004 through 20251118000008)

**TypeScript Types:**

- `/src/modules/warehouse/types/product-branch-settings.ts` (NEW)
- `/src/modules/warehouse/types/stock-alerts.ts` (UPDATE)
- `/supabase/types/types.ts` (auto-generated after migrations)

**Services:**

- `/src/modules/warehouse/api/product-branch-settings-service.ts` (NEW)
- `/src/modules/warehouse/services/stock-alerts-service.ts` (UPDATE)
- `/src/app/actions/warehouse/stock-alerts-actions.ts` (UPDATE)

**UI Components:**

- `/src/app/[locale]/dashboard/warehouse/alerts/page.tsx` (UPDATE)
- `/src/modules/warehouse/products/components/create-product-dialog.tsx` (UPDATE - add branch settings tab)

---

## 9. Conclusion

This refactoring addresses a **critical architectural flaw** that prevents the system from functioning correctly as a multi-warehouse management system compliant with Polish accounting requirements.

**Key Changes:**

1. **Enforced hierarchy:** Organization → Branch (Warehouse) → Location (Bin)
2. **Per-warehouse settings:** Different reorder points for different warehouses
3. **Warehouse-level alerts:** One alert per product per warehouse, not per bin
4. **Correct stock aggregation:** Warehouse totals vs bin-level details

**Impact:**

- ✅ Fixes duplicate alerts
- ✅ Enables multi-warehouse operations
- ✅ Polish accounting compliance
- ✅ Accurate purchase order suggestions
- ✅ Scalable architecture

**Timeline:** 3 weeks (1 week migrations, 1 week code, 1 week testing)

**Risk Level:** Medium (breaking changes, but well-planned with rollback)

**Recommendation:** PROCEED with implementation following the phased approach.
