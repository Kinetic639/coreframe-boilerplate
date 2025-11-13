-- =============================================
-- Add Reservation Movement Types (RES/UNRES)
-- Created: 2024-11-13
-- Purpose: Add logical movement types for reservation event log
-- =============================================

-- =============================================
-- STEP 1: Ensure movement_categories enum exists
-- =============================================

DO $$
BEGIN
  -- Check if enum type exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_category') THEN
    CREATE TYPE movement_category AS ENUM ('physical', 'logical', 'adjustment');
    RAISE NOTICE 'Created movement_category enum';
  END IF;
END $$;

-- =============================================
-- STEP 2: Add category column to stock_movements
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'category'
  ) THEN
    ALTER TABLE stock_movements
    ADD COLUMN category movement_category DEFAULT 'physical';

    RAISE NOTICE 'Added category column to stock_movements';
  END IF;
END $$;

-- =============================================
-- STEP 3: Insert RES/UNRES movement types
-- =============================================

-- Insert Reservation Created (RES) - 501
INSERT INTO movement_types (
  code,
  category,
  name,
  name_pl,
  name_en,
  affects_stock,
  requires_approval,
  generates_document,
  allows_manual_entry,
  cost_impact,
  is_system
)
VALUES (
  '501',
  'reservation',
  'Reservation Created',
  'Utworzono Rezerwację',
  'Reservation Created',
  0, -- Does NOT affect physical stock (neutral)
  false,
  false,
  true,
  'neutral',
  false
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_pl = EXCLUDED.name_pl,
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  affects_stock = EXCLUDED.affects_stock,
  cost_impact = EXCLUDED.cost_impact;

-- Insert Reservation Released (UNRES) - 502
INSERT INTO movement_types (
  code,
  category,
  name,
  name_pl,
  name_en,
  affects_stock,
  requires_approval,
  generates_document,
  allows_manual_entry,
  cost_impact,
  is_system
)
VALUES (
  '502',
  'reservation',
  'Reservation Released',
  'Zwolniono Rezerwację',
  'Reservation Released',
  0, -- Does NOT affect physical stock (neutral)
  false,
  false,
  true,
  'neutral',
  false
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_pl = EXCLUDED.name_pl,
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  affects_stock = EXCLUDED.affects_stock,
  cost_impact = EXCLUDED.cost_impact;

DO $$
BEGIN
  RAISE NOTICE 'Inserted/Updated movement types 501 (RES) and 502 (UNRES)';
END $$;

-- =============================================
-- STEP 4: Update existing movements to set category
-- =============================================

-- Note: stock_movements.category is TEXT, not enum
-- Set category for all existing movements based on movement type
UPDATE stock_movements
SET category = CASE
  -- Logical movements (reservations)
  WHEN movement_type_code IN ('501', '502') THEN 'reservation'
  -- Adjustment movements
  WHEN movement_type_code IN ('401', '402', '403', '404', '405', '406', '407', '408', '409', '410', '411') THEN 'adjustment'
  -- Physical movements (receipts, issues, transfers) - keep existing category
  ELSE category
END
WHERE movement_type_code IN ('501', '502', '401', '402', '403', '404', '405', '406', '407', '408', '409', '410', '411');

-- =============================================
-- STEP 5: Create indexes for performance
-- =============================================

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_stock_movements_category
ON stock_movements(category) WHERE deleted_at IS NULL;

-- Index for reservation movements (using source/destination location)
CREATE INDEX IF NOT EXISTS idx_stock_movements_reservation_types
ON stock_movements(movement_type_code, product_id, source_location_id, destination_location_id)
WHERE movement_type_code IN ('501', '502') AND deleted_at IS NULL;

-- =============================================
-- STEP 6: Update stock_inventory view to exclude logical movements
-- =============================================

-- Drop existing view
DROP VIEW IF EXISTS stock_inventory CASCADE;

-- Recreate view excluding logical movements (category = 'reservation')
CREATE OR REPLACE VIEW stock_inventory AS
SELECT
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id,
  COALESCE(sm.destination_location_id, sm.source_location_id) as location_id,

  -- Available quantity (destination = +, source = -)
  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.quantity
    WHEN sm.source_location_id IS NOT NULL THEN -sm.quantity
    ELSE 0
  END) as available_quantity,

  -- Reserved quantity (placeholder - calculated from stock_reservations)
  0 as reserved_quantity,

  -- Available to promise (same as available for now)
  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.quantity
    WHEN sm.source_location_id IS NOT NULL THEN -sm.quantity
    ELSE 0
  END) as available_to_promise,

  -- Value calculations
  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.total_cost
    WHEN sm.source_location_id IS NOT NULL THEN -sm.total_cost
    ELSE 0
  END) as total_value,

  -- Average cost
  AVG(CASE WHEN sm.unit_cost > 0 THEN sm.unit_cost END) as average_cost,

  -- Metadata
  MAX(sm.updated_at) as last_movement_at,
  COUNT(*) as total_movements

FROM stock_movements sm
INNER JOIN movement_types mt ON sm.movement_type_code = mt.code
WHERE sm.status IN ('approved', 'completed')
  AND sm.deleted_at IS NULL
  AND mt.category != 'reservation'  -- EXCLUDE logical reservation movements
GROUP BY
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id,
  COALESCE(sm.destination_location_id, sm.source_location_id);

COMMENT ON VIEW stock_inventory IS 'Real-time inventory calculated from physical movements only (excludes logical reservation movements)';

-- =============================================
-- STEP 7: Recreate product_available_inventory view
-- =============================================

-- This view was created in previous migration, recreate it to use updated stock_inventory
DROP VIEW IF EXISTS product_available_inventory;

CREATE OR REPLACE VIEW product_available_inventory AS
WITH inventory AS (
  SELECT
    organization_id,
    branch_id,
    product_id,
    variant_id,
    location_id,
    available_quantity,
    total_value,
    average_cost,
    last_movement_at,
    total_movements
  FROM stock_inventory
),
active_reservations AS (
  SELECT
    organization_id,
    branch_id,
    product_id,
    variant_id,
    location_id,
    SUM(reserved_quantity - released_quantity) AS reserved_quantity,
    MAX(updated_at) AS last_reservation_at
  FROM stock_reservations
  WHERE status IN ('active', 'partial')
    AND deleted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  GROUP BY organization_id, branch_id, product_id, variant_id, location_id
)
SELECT
  COALESCE(inv.product_id, res.product_id) AS product_id,
  COALESCE(inv.variant_id, res.variant_id) AS variant_id,
  COALESCE(inv.location_id, res.location_id) AS location_id,
  COALESCE(inv.organization_id, res.organization_id) AS organization_id,
  COALESCE(inv.branch_id, res.branch_id) AS branch_id,
  COALESCE(inv.available_quantity, 0)::DECIMAL AS quantity_on_hand,
  COALESCE(res.reserved_quantity, 0)::DECIMAL AS reserved_quantity,
  (COALESCE(inv.available_quantity, 0)::DECIMAL - COALESCE(res.reserved_quantity, 0)::DECIMAL) AS available_quantity,
  inv.total_value,
  inv.average_cost,
  inv.last_movement_at,
  inv.total_movements,
  COALESCE(inv.last_movement_at, res.last_reservation_at, NOW()) AS updated_at
FROM inventory inv
FULL OUTER JOIN active_reservations res
  ON inv.organization_id = res.organization_id
 AND inv.branch_id = res.branch_id
 AND inv.product_id = res.product_id
 AND inv.location_id = res.location_id
 AND inv.variant_id IS NOT DISTINCT FROM res.variant_id;

COMMENT ON VIEW product_available_inventory IS 'Available inventory = on_hand (from physical movements) - reserved (from active reservations)';

-- =============================================
-- Migration Complete
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Reservation movement types added (501-RES, 502-UNRES)';
  RAISE NOTICE '📊 stock_inventory view updated to exclude logical movements';
  RAISE NOTICE '📦 product_available_inventory view recreated';
  RAISE NOTICE '🔍 Movement category column added for filtering';
  RAISE NOTICE '⚡ Indexes created for performance';
END $$;
