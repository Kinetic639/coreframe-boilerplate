-- =====================================================
-- Phase 2: Create Branch-Level Inventory Views
-- =====================================================
-- This migration creates warehouse-level stock aggregation views.
--
-- Background:
-- - Existing views (stock_inventory, product_available_inventory) show per-LOCATION stock
-- - Alerts and reorder decisions need per-WAREHOUSE totals
-- - New views aggregate stock across all bins in each warehouse
--
-- Views Created:
-- 1. stock_inventory_by_branch - Warehouse-level stock totals
-- 2. product_available_inventory_by_branch - Warehouse-level available stock (after reservations)
--
-- Migration ID: 20251118000007
-- Phase: 2 - Core Views
-- =====================================================

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

  -- Count of distinct locations holding this product in this warehouse
  COUNT(DISTINCT COALESCE(sm.destination_location_id, sm.source_location_id)) as locations_count,

  -- Value metrics
  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.total_cost
    WHEN sm.source_location_id IS NOT NULL THEN -sm.total_cost
    ELSE 0
  END) as total_value,

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
    total_value,
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
    COUNT(*) as active_reservations_count,
    MAX(expires_at) as latest_reservation_expiry
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
  inv.total_value,
  res.active_reservations_count,
  res.latest_reservation_expiry,
  inv.last_movement_at

FROM branch_inventory inv
FULL OUTER JOIN branch_reservations res
  ON inv.organization_id = res.organization_id
 AND inv.branch_id = res.branch_id
 AND inv.product_id = res.product_id
 AND inv.variant_id IS NOT DISTINCT FROM res.variant_id;

-- =====================================================
-- View 3: Branch Stock Summary (for reporting)
-- =====================================================

CREATE OR REPLACE VIEW branch_stock_summary AS
SELECT
  b.id as branch_id,
  b.name as branch_name,
  b.organization_id,
  COUNT(DISTINCT inv.product_id) as total_products,
  COUNT(DISTINCT inv.variant_id) FILTER (WHERE inv.variant_id IS NOT NULL) as total_variants,
  SUM(inv.quantity_on_hand) as total_quantity_on_hand,
  SUM(inv.reserved_quantity) as total_reserved_quantity,
  SUM(inv.available_quantity) as total_available_quantity,
  SUM(inv.total_value) as total_inventory_value,
  AVG(inv.locations_count) as avg_locations_per_product,
  MAX(inv.last_movement_at) as last_movement_at
FROM branches b
LEFT JOIN product_available_inventory_by_branch inv ON b.id = inv.branch_id
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.name, b.organization_id;

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON VIEW stock_inventory_by_branch IS
  'Warehouse-level stock totals aggregated across all bins (locations) in each branch.

   Use this view for:
   - Reorder point decisions (compare warehouse total to threshold)
   - Alert generation (one alert per product per warehouse)
   - Purchase order calculations
   - Inter-warehouse transfer planning
   - Warehouse capacity analysis

   For bin-level operations (picking, putaway, cycle counting),
   use the stock_inventory view instead.

   Example:
   - Product "Widget A" in Warsaw warehouse
   - Location A-01: 40 units
   - Location A-02: 35 units
   - Location B-01: 30 units
   - This view shows: 105 units total (aggregated)';

COMMENT ON VIEW product_available_inventory_by_branch IS
  'Warehouse-level available stock after subtracting reservations.

   This is the PRIMARY view for:
   - Alert detection (compare available_quantity to reorder_point)
   - Replenishment decisions
   - Available-to-promise (ATP) calculations
   - Inter-warehouse allocation

   Formula: available_quantity = quantity_on_hand - reserved_quantity

   Example:
   - Warsaw warehouse:
     - 150 units on hand (across all bins)
     - 50 units reserved (for sales orders)
     - 100 units available
   - If reorder_point = 120, an alert should be created (100 < 120)

   This view is used by the check_stock_levels_and_alert() function.';

COMMENT ON VIEW branch_stock_summary IS
  'High-level inventory summary per warehouse.

   Use for:
   - Executive dashboards
   - Warehouse comparison reports
   - Inventory valuation by warehouse
   - Capacity utilization analysis

   Shows total products, quantities, values, and activity per warehouse.';

-- =====================================================
-- Create Indexes on Base Tables (if not exist)
-- =====================================================

-- These indexes improve performance of the aggregation views

CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_product_status
  ON stock_movements(branch_id, product_id, status)
  WHERE status IN ('approved', 'completed') AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_reservations_branch_product_status
  ON stock_reservations(branch_id, product_id, status)
  WHERE status IN ('active', 'partial') AND deleted_at IS NULL;

-- Log the creation
DO $$
DECLARE
  v_branches_count INTEGER;
  v_products_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_branches_count FROM branches WHERE deleted_at IS NULL;
  SELECT COUNT(DISTINCT product_id) INTO v_products_count FROM stock_inventory_by_branch;

  RAISE NOTICE '=== Warehouse-Level Inventory Views Created ===';
  RAISE NOTICE 'Created views:';
  RAISE NOTICE '  1. stock_inventory_by_branch';
  RAISE NOTICE '  2. product_available_inventory_by_branch';
  RAISE NOTICE '  3. branch_stock_summary';
  RAISE NOTICE '';
  RAISE NOTICE 'Coverage:';
  RAISE NOTICE '  - Branches: %', v_branches_count;
  RAISE NOTICE '  - Products with stock: %', v_products_count;
  RAISE NOTICE '';
  RAISE NOTICE 'These views aggregate stock at the WAREHOUSE level.';
  RAISE NOTICE 'Use for alerts, reorder decisions, and reporting.';
  RAISE NOTICE 'Bin-level views (stock_inventory) still available for operations.';
  RAISE NOTICE '===============================================';
END $$;
