-- =============================================
-- Phase 2: Stock Movements System Migration
-- Creates comprehensive stock tracking with movements, reservations, and inventory
-- =============================================

-- ============================================
-- STEP 1: CREATE OR ALTER STOCK MOVEMENTS TABLE
-- ============================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Movement identification
  movement_number TEXT UNIQUE NOT NULL, -- Auto-generated: MM-2024-001234
  movement_type_code TEXT NOT NULL REFERENCES movement_types(code),
  category TEXT NOT NULL, -- Denormalized for performance

  -- Organization & Branch context (NO CASCADE - use soft delete instead)
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,

  -- Product & Variant
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,

  -- Locations
  source_location_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
  destination_location_id UUID REFERENCES locations(id) ON DELETE RESTRICT,

  -- Quantity & Units
  quantity DECIMAL(15, 4) NOT NULL CHECK (quantity != 0),
  unit_of_measure TEXT, -- kg, pcs, m, etc.

  -- Financial data
  unit_cost DECIMAL(15, 4),
  total_cost DECIMAL(15, 4),
  currency TEXT DEFAULT 'PLN',

  -- Reference document (PO, SO, Transfer Request, etc.)
  reference_type TEXT, -- 'purchase_order', 'sales_order', 'transfer_request', etc.
  reference_id UUID,
  reference_number TEXT,

  -- Status & Approval
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled', 'reversed')),
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  -- Tracking & Compliance
  batch_number TEXT,
  serial_number TEXT,
  lot_number TEXT,
  expiry_date DATE,
  manufacturing_date DATE,

  -- Document generation
  document_number TEXT, -- Generated Polish document number (PZ-001/2024, WZ-002/2024)
  document_generated_at TIMESTAMPTZ,
  document_url TEXT, -- URL to generated PDF

  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When the movement actually occurred
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- User tracking
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  cancelled_by UUID REFERENCES auth.users(id),

  -- Notes & Metadata
  notes TEXT,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}',

  -- Soft delete
  deleted_at TIMESTAMPTZ DEFAULT NULL,

  -- Constraints
  CONSTRAINT valid_locations CHECK (
    (source_location_id IS NOT NULL OR destination_location_id IS NOT NULL)
  ),
  CONSTRAINT valid_approval CHECK (
    (NOT requires_approval) OR
    (requires_approval AND status = 'pending') OR
    (requires_approval AND status IN ('approved', 'completed') AND approved_by IS NOT NULL)
  ),
  CONSTRAINT valid_costs CHECK (
    (unit_cost IS NULL AND total_cost IS NULL) OR
    (unit_cost >= 0 AND total_cost >= 0)
  )
);

-- Add missing columns if table already exists
DO $$
BEGIN
  -- Add movement_number column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='movement_number') THEN
    ALTER TABLE stock_movements ADD COLUMN movement_number TEXT UNIQUE NOT NULL DEFAULT 'TEMP-' || gen_random_uuid()::text;
  END IF;

  -- Add category column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='category') THEN
    ALTER TABLE stock_movements ADD COLUMN category TEXT NOT NULL DEFAULT 'receipt';
  END IF;

  -- Add status column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='status') THEN
    ALTER TABLE stock_movements ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_status_check
      CHECK (status IN ('pending', 'approved', 'completed', 'cancelled', 'reversed'));
  END IF;

  -- Add requires_approval column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='requires_approval') THEN
    ALTER TABLE stock_movements ADD COLUMN requires_approval BOOLEAN DEFAULT false;
  END IF;

  -- Add approval tracking columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='approved_by') THEN
    ALTER TABLE stock_movements ADD COLUMN approved_by UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='approved_at') THEN
    ALTER TABLE stock_movements ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  -- Add unit_of_measure column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='unit_of_measure') THEN
    ALTER TABLE stock_movements ADD COLUMN unit_of_measure TEXT;
  END IF;

  -- Add lot_number column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='lot_number') THEN
    ALTER TABLE stock_movements ADD COLUMN lot_number TEXT;
  END IF;

  -- Add manufacturing_date column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='manufacturing_date') THEN
    ALTER TABLE stock_movements ADD COLUMN manufacturing_date DATE;
  END IF;

  -- Add document_generated_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='document_generated_at') THEN
    ALTER TABLE stock_movements ADD COLUMN document_generated_at TIMESTAMPTZ;
  END IF;

  -- Add document_url column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='document_url') THEN
    ALTER TABLE stock_movements ADD COLUMN document_url TEXT;
  END IF;

  -- Add completed_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='completed_at') THEN
    ALTER TABLE stock_movements ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;

  -- Add cancelled_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='cancelled_at') THEN
    ALTER TABLE stock_movements ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;

  -- Add updated_by column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='updated_by') THEN
    ALTER TABLE stock_movements ADD COLUMN updated_by UUID REFERENCES auth.users(id);
  END IF;

  -- Add cancelled_by column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='cancelled_by') THEN
    ALTER TABLE stock_movements ADD COLUMN cancelled_by UUID REFERENCES auth.users(id);
  END IF;

  -- Add cancellation_reason column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='cancellation_reason') THEN
    ALTER TABLE stock_movements ADD COLUMN cancellation_reason TEXT;
  END IF;

  -- Add currency column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='currency') THEN
    ALTER TABLE stock_movements ADD COLUMN currency TEXT DEFAULT 'PLN';
  END IF;

  -- Add document_number column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='document_number') THEN
    ALTER TABLE stock_movements ADD COLUMN document_number TEXT;
  END IF;

  -- Add source_location_id column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='source_location_id') THEN
    ALTER TABLE stock_movements ADD COLUMN source_location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;

  -- Add destination_location_id column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='destination_location_id') THEN
    ALTER TABLE stock_movements ADD COLUMN destination_location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;

  -- Add reference_type column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='reference_type') THEN
    ALTER TABLE stock_movements ADD COLUMN reference_type TEXT;
  END IF;

  -- Add reference_id column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='reference_id') THEN
    ALTER TABLE stock_movements ADD COLUMN reference_id UUID;
  END IF;

  -- Add reference_number column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='reference_number') THEN
    ALTER TABLE stock_movements ADD COLUMN reference_number TEXT;
  END IF;

  -- Add occurred_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='occurred_at') THEN
    ALTER TABLE stock_movements ADD COLUMN occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- Add batch_number column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='batch_number') THEN
    ALTER TABLE stock_movements ADD COLUMN batch_number TEXT;
  END IF;

  -- Add serial_number column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='serial_number') THEN
    ALTER TABLE stock_movements ADD COLUMN serial_number TEXT;
  END IF;

  -- Add expiry_date column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='expiry_date') THEN
    ALTER TABLE stock_movements ADD COLUMN expiry_date DATE;
  END IF;

  -- Add notes column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='notes') THEN
    ALTER TABLE stock_movements ADD COLUMN notes TEXT;
  END IF;

  -- Add metadata column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='metadata') THEN
    ALTER TABLE stock_movements ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;

  -- Add created_by column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='created_by') THEN
    ALTER TABLE stock_movements ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;

  -- Add created_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='created_at') THEN
    ALTER TABLE stock_movements ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- Add updated_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='updated_at') THEN
    ALTER TABLE stock_movements ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add unit_cost column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='unit_cost') THEN
    ALTER TABLE stock_movements ADD COLUMN unit_cost DECIMAL(15, 4);
  END IF;

  -- Add total_cost column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='total_cost') THEN
    ALTER TABLE stock_movements ADD COLUMN total_cost DECIMAL(15, 4);
  END IF;

  -- Add quantity column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='quantity') THEN
    ALTER TABLE stock_movements ADD COLUMN quantity DECIMAL(15, 4) NOT NULL DEFAULT 0;
  END IF;

  -- Add deleted_at column if not exists (soft delete)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='deleted_at') THEN
    ALTER TABLE stock_movements ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_branch ON stock_movements(organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON stock_movements(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type_code);
CREATE INDEX IF NOT EXISTS idx_stock_movements_category ON stock_movements(category);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_occurred_at ON stock_movements(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_source_location ON stock_movements(source_location_id) WHERE source_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_dest_location ON stock_movements(destination_location_id) WHERE destination_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id) WHERE reference_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON stock_movements(batch_number) WHERE batch_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_serial ON stock_movements(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_number ON stock_movements(movement_number);
CREATE INDEX IF NOT EXISTS idx_stock_movements_deleted_at ON stock_movements(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- STEP 2: CREATE STOCK INVENTORY VIEW
-- ============================================

CREATE OR REPLACE VIEW stock_inventory AS
SELECT
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id,
  COALESCE(sm.destination_location_id, sm.source_location_id) as location_id,

  -- Current stock calculation
  SUM(CASE
    WHEN sm.destination_location_id IS NOT NULL THEN sm.quantity
    WHEN sm.source_location_id IS NOT NULL THEN -sm.quantity
    ELSE 0
  END) as available_quantity,

  -- Reserved quantity (from reservations table - to be created)
  0 as reserved_quantity,

  -- Available to promise
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
WHERE sm.status IN ('approved', 'completed')
  AND sm.deleted_at IS NULL  -- Exclude soft-deleted records
GROUP BY
  sm.organization_id,
  sm.branch_id,
  sm.product_id,
  sm.variant_id,
  COALESCE(sm.destination_location_id, sm.source_location_id);

-- ============================================
-- STEP 3: CREATE STOCK RESERVATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization & Branch context (NO CASCADE - use soft delete instead)
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,

  -- Product & Location
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,

  -- Reservation details
  reservation_number TEXT UNIQUE NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL CHECK (quantity > 0),
  reserved_quantity DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  released_quantity DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (released_quantity >= 0),

  -- Reference (usually sales order, transfer request, etc.)
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  reference_number TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partial', 'fulfilled', 'expired', 'cancelled')),

  -- Timestamps
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- User tracking
  created_by UUID REFERENCES auth.users(id),
  cancelled_by UUID REFERENCES auth.users(id),

  -- Notes
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Soft delete
  deleted_at TIMESTAMPTZ DEFAULT NULL,

  -- Constraints
  CONSTRAINT valid_quantities CHECK (
    reserved_quantity + released_quantity <= quantity
  )
);

-- Add missing columns to stock_reservations if not exist
DO $$
BEGIN
  -- Organization & Branch context columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='organization_id') THEN
    ALTER TABLE stock_reservations ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='branch_id') THEN
    ALTER TABLE stock_reservations ADD COLUMN branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT;
  END IF;

  -- Product & Location columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='product_id') THEN
    ALTER TABLE stock_reservations ADD COLUMN product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='variant_id') THEN
    ALTER TABLE stock_reservations ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='location_id') THEN
    ALTER TABLE stock_reservations ADD COLUMN location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;

  -- Reservation details
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='reservation_number') THEN
    ALTER TABLE stock_reservations ADD COLUMN reservation_number TEXT UNIQUE NOT NULL DEFAULT 'TEMP-' || gen_random_uuid()::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='quantity') THEN
    ALTER TABLE stock_reservations ADD COLUMN quantity DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='reserved_quantity') THEN
    ALTER TABLE stock_reservations ADD COLUMN reserved_quantity DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='released_quantity') THEN
    ALTER TABLE stock_reservations ADD COLUMN released_quantity DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (released_quantity >= 0);
  END IF;

  -- Reference columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='reference_type') THEN
    ALTER TABLE stock_reservations ADD COLUMN reference_type TEXT NOT NULL DEFAULT 'sales_order';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='reference_id') THEN
    ALTER TABLE stock_reservations ADD COLUMN reference_id UUID NOT NULL DEFAULT gen_random_uuid();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='reference_number') THEN
    ALTER TABLE stock_reservations ADD COLUMN reference_number TEXT;
  END IF;

  -- Status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='status') THEN
    ALTER TABLE stock_reservations ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE stock_reservations ADD CONSTRAINT stock_reservations_status_check
      CHECK (status IN ('active', 'partial', 'fulfilled', 'expired', 'cancelled'));
  END IF;

  -- Timestamp columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='reserved_at') THEN
    ALTER TABLE stock_reservations ADD COLUMN reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='expires_at') THEN
    ALTER TABLE stock_reservations ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='fulfilled_at') THEN
    ALTER TABLE stock_reservations ADD COLUMN fulfilled_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='cancelled_at') THEN
    ALTER TABLE stock_reservations ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='created_at') THEN
    ALTER TABLE stock_reservations ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='updated_at') THEN
    ALTER TABLE stock_reservations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- User tracking columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='created_by') THEN
    ALTER TABLE stock_reservations ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='cancelled_by') THEN
    ALTER TABLE stock_reservations ADD COLUMN cancelled_by UUID REFERENCES auth.users(id);
  END IF;

  -- Notes and metadata columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='notes') THEN
    ALTER TABLE stock_reservations ADD COLUMN notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='metadata') THEN
    ALTER TABLE stock_reservations ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;

  -- Soft delete column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_reservations' AND column_name='deleted_at') THEN
    ALTER TABLE stock_reservations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Indexes for reservations
CREATE INDEX IF NOT EXISTS idx_reservations_org_branch ON stock_reservations(organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_reservations_product ON stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_reservations_location ON stock_reservations(location_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON stock_reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_reference ON stock_reservations(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON stock_reservations(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_deleted_at ON stock_reservations(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- STEP 4: CREATE MOVEMENT NUMBER SEQUENCE
-- ============================================

CREATE SEQUENCE IF NOT EXISTS movement_number_seq START 1;

-- ============================================
-- STEP 5: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to generate movement number
CREATE OR REPLACE FUNCTION generate_movement_number(
  p_organization_id UUID,
  p_movement_type_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_sequence_number INTEGER;
  v_year TEXT;
  v_prefix TEXT;
BEGIN
  -- Get next sequence number
  v_sequence_number := nextval('movement_number_seq');
  v_year := TO_CHAR(NOW(), 'YYYY');

  -- Get prefix from movement type (MM for transfer, SM for others)
  IF p_movement_type_code IN ('301', '302', '303', '311', '312') THEN
    v_prefix := 'MM';
  ELSE
    v_prefix := 'SM';
  END IF;

  -- Format: MM-2024-001234
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_sequence_number::TEXT, 6, '0');
END;
$$;

-- Function to generate document number based on Polish document type
CREATE OR REPLACE FUNCTION generate_document_number(
  p_organization_id UUID,
  p_branch_id UUID,
  p_polish_doc_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_sequence INTEGER;
  v_year TEXT;
  v_month TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_month := TO_CHAR(NOW(), 'MM');

  -- Get next sequence for this document type, org, and year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(document_number FROM '(\d+)/' || v_year) AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM stock_movements
  WHERE organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND document_number LIKE p_polish_doc_type || '%/' || v_year;

  -- Format: PZ-001/2024 or WZ-001/10/2024 (with month)
  RETURN p_polish_doc_type || '-' || LPAD(v_sequence::TEXT, 3, '0') || '/' || v_month || '/' || v_year;
END;
$$;

-- Function to check stock availability
CREATE OR REPLACE FUNCTION check_stock_availability(
  p_product_id UUID,
  p_variant_id UUID,
  p_location_id UUID,
  p_quantity DECIMAL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT available_quantity >= p_quantity
      FROM stock_inventory
      WHERE product_id = p_product_id
        AND (p_variant_id IS NULL OR variant_id = p_variant_id)
        AND location_id = p_location_id
    ),
    false
  );
$$;

-- Function to get current stock level
CREATE OR REPLACE FUNCTION get_stock_level(
  p_product_id UUID,
  p_variant_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS DECIMAL
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(available_quantity), 0)
  FROM stock_inventory
  WHERE product_id = p_product_id
    AND (p_variant_id IS NULL OR variant_id = p_variant_id)
    AND (p_location_id IS NULL OR location_id = p_location_id)
    AND (p_organization_id IS NULL OR organization_id = p_organization_id)
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);
$$;

-- Function to create stock movement with validation
CREATE OR REPLACE FUNCTION create_stock_movement(
  p_movement_type_code TEXT,
  p_organization_id UUID,
  p_branch_id UUID,
  p_product_id UUID,
  p_quantity DECIMAL,
  p_source_location_id UUID DEFAULT NULL,
  p_destination_location_id UUID DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL,
  p_unit_cost DECIMAL DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement_id UUID;
  v_movement_number TEXT;
  v_movement_type RECORD;
  v_category TEXT;
  v_requires_approval BOOLEAN;
  v_total_cost DECIMAL;
BEGIN
  -- Get movement type details
  SELECT * INTO v_movement_type
  FROM movement_types
  WHERE code = p_movement_type_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement type % not found', p_movement_type_code;
  END IF;

  -- Validate requirements
  IF v_movement_type.requires_source_location AND p_source_location_id IS NULL THEN
    RAISE EXCEPTION 'Movement type % requires source location', p_movement_type_code;
  END IF;

  IF v_movement_type.requires_destination_location AND p_destination_location_id IS NULL THEN
    RAISE EXCEPTION 'Movement type % requires destination location', p_movement_type_code;
  END IF;

  -- Check stock availability for issue movements
  IF v_movement_type.category = 'issue' AND p_source_location_id IS NOT NULL THEN
    IF NOT check_stock_availability(p_product_id, p_variant_id, p_source_location_id, p_quantity) THEN
      RAISE EXCEPTION 'Insufficient stock at location';
    END IF;
  END IF;

  -- Generate movement number
  v_movement_number := generate_movement_number(p_organization_id, p_movement_type_code);

  -- Calculate total cost
  v_total_cost := CASE WHEN p_unit_cost IS NOT NULL THEN p_unit_cost * p_quantity ELSE NULL END;

  -- Insert movement
  INSERT INTO stock_movements (
    movement_number,
    movement_type_code,
    category,
    organization_id,
    branch_id,
    product_id,
    variant_id,
    source_location_id,
    destination_location_id,
    quantity,
    unit_cost,
    total_cost,
    reference_type,
    reference_id,
    requires_approval,
    status,
    occurred_at,
    created_by,
    notes
  ) VALUES (
    v_movement_number,
    p_movement_type_code,
    v_movement_type.category,
    p_organization_id,
    p_branch_id,
    p_product_id,
    p_variant_id,
    p_source_location_id,
    p_destination_location_id,
    p_quantity,
    p_unit_cost,
    v_total_cost,
    p_reference_type,
    p_reference_id,
    v_movement_type.requires_approval,
    CASE WHEN v_movement_type.requires_approval THEN 'pending' ELSE 'approved' END,
    p_occurred_at,
    p_created_by,
    p_notes
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

-- ============================================
-- STEP 6: CREATE TRIGGERS
-- ============================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stock_movements_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_stock_movements_updated_at
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_movements_timestamp();

-- Trigger to update reservations timestamp
CREATE TRIGGER trigger_stock_reservations_updated_at
  BEFORE UPDATE ON stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_movements_timestamp();

-- ============================================
-- STEP 7: RLS POLICIES (DISABLED - TO BE IMPLEMENTED LATER)
-- ============================================

-- NOTE: RLS and policies are intentionally disabled
-- They will be implemented in a separate migration after testing

-- Disable RLS for now
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies if they exist
DROP POLICY IF EXISTS stock_movements_org_isolation ON stock_movements;
DROP POLICY IF EXISTS stock_movements_branch_access ON stock_movements;
DROP POLICY IF EXISTS stock_reservations_org_isolation ON stock_reservations;
DROP POLICY IF EXISTS stock_reservations_branch_access ON stock_reservations;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Stock movements system created successfully';
  RAISE NOTICE 'Tables: stock_movements, stock_reservations';
  RAISE NOTICE 'Views: stock_inventory';
  RAISE NOTICE 'Functions: generate_movement_number, generate_document_number, check_stock_availability, get_stock_level, create_stock_movement';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
