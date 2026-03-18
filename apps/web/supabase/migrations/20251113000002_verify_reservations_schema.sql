-- =============================================
-- Verify Stock Reservations Schema
-- Created: 2024-11-13
-- Purpose: Ensure all required columns exist for hybrid reservation system
-- =============================================

-- =============================================
-- STEP 1: Verify stock_reservations table exists
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'stock_reservations'
  ) THEN
    RAISE EXCEPTION 'stock_reservations table does not exist. Run base migrations first.';
  END IF;
END $$;

-- =============================================
-- STEP 2: Ensure all required columns exist
-- =============================================

DO $$
BEGIN
  -- reservation_number (auto-generated)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'reservation_number'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN reservation_number TEXT UNIQUE;
    RAISE NOTICE 'Added reservation_number column';
  END IF;

  -- organization_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added organization_id column';
  END IF;

  -- branch_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added branch_id column';
  END IF;

  -- product_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added product_id column';
  END IF;

  -- variant_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'variant_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added variant_id column';
  END IF;

  -- location_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added location_id column';
  END IF;

  -- quantity (total quantity to reserve)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN quantity DECIMAL(15, 4) NOT NULL CHECK (quantity > 0);
    RAISE NOTICE 'Added quantity column';
  END IF;

  -- reserved_quantity (currently reserved)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'reserved_quantity'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN reserved_quantity DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0);
    RAISE NOTICE 'Added reserved_quantity column';
  END IF;

  -- released_quantity (fulfilled/released)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'released_quantity'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN released_quantity DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (released_quantity >= 0);
    RAISE NOTICE 'Added released_quantity column';
  END IF;

  -- reference_type (sales_order, work_order, vmi, audit, etc.)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN reference_type TEXT;
    RAISE NOTICE 'Added reference_type column';
  END IF;

  -- reference_id (UUID of source record)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN reference_id UUID;
    RAISE NOTICE 'Added reference_id column';
  END IF;

  -- reference_number (human-readable reference)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN reference_number TEXT;
    RAISE NOTICE 'Added reference_number column';
  END IF;

  -- sales_order_id (specific to sales orders)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'sales_order_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN sales_order_id UUID REFERENCES sales_orders(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added sales_order_id column';
  END IF;

  -- sales_order_item_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'sales_order_item_id'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added sales_order_item_id column';
  END IF;

  -- status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'status'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'partial', 'fulfilled', 'cancelled', 'expired'));
    RAISE NOTICE 'Added status column';
  END IF;

  -- priority
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'priority'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN priority INTEGER DEFAULT 0;
    RAISE NOTICE 'Added priority column';
  END IF;

  -- auto_release
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'auto_release'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN auto_release BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added auto_release column';
  END IF;

  -- expires_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN expires_at TIMESTAMPTZ;
    RAISE NOTICE 'Added expires_at column';
  END IF;

  -- fulfilled_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'fulfilled_at'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN fulfilled_at TIMESTAMPTZ;
    RAISE NOTICE 'Added fulfilled_at column';
  END IF;

  -- cancelled_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN cancelled_at TIMESTAMPTZ;
    RAISE NOTICE 'Added cancelled_at column';
  END IF;

  -- cancelled_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added cancelled_by column';
  END IF;

  -- cancellation_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN cancellation_reason TEXT;
    RAISE NOTICE 'Added cancellation_reason column';
  END IF;

  -- notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'notes'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN notes TEXT;
    RAISE NOTICE 'Added notes column';
  END IF;

  -- created_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added created_by column';
  END IF;

  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added created_at column';
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column';
  END IF;

  -- deleted_at (soft delete)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE stock_reservations
    ADD COLUMN deleted_at TIMESTAMPTZ;
    RAISE NOTICE 'Added deleted_at column';
  END IF;
END $$;

-- =============================================
-- STEP 3: Create indexes
-- =============================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_stock_reservations_organization
ON stock_reservations(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_location
ON stock_reservations(product_id, location_id, status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_reservations_sales_order
ON stock_reservations(sales_order_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_reservations_sales_order_item
ON stock_reservations(sales_order_item_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_reservations_reference
ON stock_reservations(reference_type, reference_id)
WHERE deleted_at IS NULL;

-- Status and expiration indexes
CREATE INDEX IF NOT EXISTS idx_stock_reservations_active
ON stock_reservations(status, expires_at)
WHERE deleted_at IS NULL AND status IN ('active', 'partial');

-- Note: Cannot use NOW() in index predicate (not immutable)
-- Query for expired reservations should filter at runtime:
-- WHERE deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at < NOW()
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expired
ON stock_reservations(expires_at)
WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

-- =============================================
-- Migration Complete
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Stock reservations schema verified';
  RAISE NOTICE '📦 All required columns present';
  RAISE NOTICE '🔍 Indexes created for performance';
  RAISE NOTICE '🔐 Foreign key constraints in place';
  RAISE NOTICE '♻️  Soft delete pattern enabled';
END $$;
