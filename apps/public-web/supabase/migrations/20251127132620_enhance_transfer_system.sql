-- Enhanced Transfer System Migration
-- Date: 2025-11-27
-- Purpose: Enhance existing transfer tables with modern workflow requirements
-- Compatible with current database structure and warehouse system

-- ============================================================================
-- PART 1: Enhance transfer_requests table
-- ============================================================================

-- Add missing columns for modern workflow
ALTER TABLE transfer_requests
  ADD COLUMN IF NOT EXISTS transfer_number TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS expected_date DATE,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_method TEXT,
  ADD COLUMN IF NOT EXISTS carrier TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_by UUID,
  ADD COLUMN IF NOT EXISTS received_by UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add priority check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_priority_check'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_priority_check
      CHECK (priority IN ('normal', 'high', 'urgent'));
  END IF;
END $$;

-- Update status check constraint to include modern workflow states
ALTER TABLE transfer_requests
  DROP CONSTRAINT IF EXISTS transfer_requests_status_check;

ALTER TABLE transfer_requests
  ADD CONSTRAINT transfer_requests_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'in_transit', 'completed', 'cancelled', 'rejected'));

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- Organization FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_organization_id_fkey'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- From Branch FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_from_branch_id_fkey'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_from_branch_id_fkey
      FOREIGN KEY (from_branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
  END IF;

  -- To Branch FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_to_branch_id_fkey'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_to_branch_id_fkey
      FOREIGN KEY (to_branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
  END IF;

  -- Requested By FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_requested_by_fkey'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_requested_by_fkey
      FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Reviewed By FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_reviewed_by_fkey'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Approved By FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_approved_by_fkey'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Shipped By FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_shipped_by_fkey'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_shipped_by_fkey
      FOREIGN KEY (shipped_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Received By FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_received_by_fkey'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_received_by_fkey
      FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- PART 2: Fix transfer_request_items table structure
-- ============================================================================

-- Add product_id and variant_id (correct structure)
ALTER TABLE transfer_request_items
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS variant_id UUID,
  ADD COLUMN IF NOT EXISTS received_quantity NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS item_notes TEXT;

-- Add check constraint for received_quantity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_request_items_received_quantity_check'
  ) THEN
    ALTER TABLE transfer_request_items
      ADD CONSTRAINT transfer_request_items_received_quantity_check
      CHECK (received_quantity >= 0);
  END IF;
END $$;

-- Add check constraint for item_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_request_items_item_status_check'
  ) THEN
    ALTER TABLE transfer_request_items
      ADD CONSTRAINT transfer_request_items_item_status_check
      CHECK (item_status IN ('pending', 'in_transit', 'completed'));
  END IF;
END $$;

-- Add foreign keys for transfer_request_items
DO $$
BEGIN
  -- Product FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_request_items_product_id_fkey'
  ) THEN
    ALTER TABLE transfer_request_items
      ADD CONSTRAINT transfer_request_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;

  -- Variant FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_request_items_variant_id_fkey'
  ) THEN
    ALTER TABLE transfer_request_items
      ADD CONSTRAINT transfer_request_items_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT;
  END IF;

  -- From Location FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_request_items_from_location_id_fkey'
  ) THEN
    ALTER TABLE transfer_request_items
      ADD CONSTRAINT transfer_request_items_from_location_id_fkey
      FOREIGN KEY (from_location_id) REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;

  -- To Location FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_request_items_to_location_id_fkey'
  ) THEN
    ALTER TABLE transfer_request_items
      ADD CONSTRAINT transfer_request_items_to_location_id_fkey
      FOREIGN KEY (to_location_id) REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ============================================================================
-- PART 3: Add transfer_request_id to stock_movements
-- ============================================================================

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS transfer_request_id UUID;

-- Add FK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_transfer_request_id_fkey'
  ) THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT stock_movements_transfer_request_id_fkey
      FOREIGN KEY (transfer_request_id) REFERENCES transfer_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- PART 4: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transfer_requests_org_branch
  ON transfer_requests(organization_id, from_branch_id);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_status
  ON transfer_requests(status);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_expected_date
  ON transfer_requests(expected_date);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_transfer_number
  ON transfer_requests(transfer_number) WHERE transfer_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transfer_request_items_product
  ON transfer_request_items(product_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_transfer
  ON stock_movements(transfer_request_id) WHERE transfer_request_id IS NOT NULL;

-- ============================================================================
-- PART 5: Create function to auto-generate transfer numbers
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_transfer_number(
  p_org_id UUID,
  p_branch_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_seq_name TEXT;
  v_next_num INTEGER;
BEGIN
  v_year := TO_CHAR(p_date, 'YYYY');
  v_seq_name := format('seq_transfer_%s_%s', v_year, REPLACE(p_branch_id::TEXT, '-', '_'));

  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I', v_seq_name);
  EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next_num;

  RETURN format('TR-%s-%s', v_year, LPAD(v_next_num::TEXT, 6, '0'));
END;
$$;

-- ============================================================================
-- PART 6: Create trigger to auto-generate transfer number
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_generate_transfer_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.transfer_number IS NULL OR NEW.transfer_number = '' THEN
    NEW.transfer_number := generate_transfer_number(
      NEW.organization_id,
      NEW.from_branch_id,
      COALESCE(NEW.created_at::DATE, CURRENT_DATE)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_insert_transfer_request ON transfer_requests;

CREATE TRIGGER before_insert_transfer_request
  BEFORE INSERT ON transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_transfer_number();

-- ============================================================================
-- PART 7: Migrate existing data (if any)
-- ============================================================================

-- Update old status values to new workflow
UPDATE transfer_requests
SET status = CASE
  WHEN status = 'accepted' THEN 'approved'
  WHEN status NOT IN ('draft', 'pending', 'approved', 'in_transit', 'completed', 'cancelled', 'rejected')
    THEN 'pending'
  ELSE status
END
WHERE status IS NOT NULL;

-- Copy reviewed_by to approved_by for existing records
UPDATE transfer_requests
SET approved_by = reviewed_by,
    approved_at = reviewed_at
WHERE reviewed_by IS NOT NULL AND approved_by IS NULL;

-- Copy comment to notes for existing records
UPDATE transfer_requests
SET notes = comment
WHERE comment IS NOT NULL AND notes IS NULL;

-- Migrate product_variant_id to product_id if needed (temporary compatibility)
-- This will need to be run if there's existing data with product_variant_id
-- We'll handle this by finding the product_id from variant
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfer_request_items'
    AND column_name = 'product_variant_id'
  ) THEN
    -- Update product_id from variant's product_id
    UPDATE transfer_request_items tri
    SET product_id = pv.product_id,
        variant_id = tri.product_variant_id
    FROM product_variants pv
    WHERE tri.product_variant_id = pv.id
      AND tri.product_id IS NULL;

    -- For any remaining items without product_id, try to get from products table
    -- (in case they reference products directly, not variants)
    UPDATE transfer_request_items tri
    SET product_id = tri.product_variant_id
    WHERE tri.product_id IS NULL
      AND EXISTS (SELECT 1 FROM products p WHERE p.id = tri.product_variant_id);
  END IF;
END $$;

-- ============================================================================
-- PART 8: Add unique constraint for transfer numbers
-- ============================================================================

-- Only add if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfer_requests_transfer_number_unique'
  ) THEN
    ALTER TABLE transfer_requests
      ADD CONSTRAINT transfer_requests_transfer_number_unique
      UNIQUE (organization_id, from_branch_id, transfer_number);
  END IF;
END $$;

-- ============================================================================
-- PART 9: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE transfer_requests IS 'Warehouse transfer requests for moving stock between locations and branches';
COMMENT ON COLUMN transfer_requests.transfer_number IS 'Auto-generated transfer number (format: TR-YYYY-NNNNNN)';
COMMENT ON COLUMN transfer_requests.priority IS 'Transfer priority: normal, high, or urgent';
COMMENT ON COLUMN transfer_requests.status IS 'Transfer workflow status: draft → pending → approved → in_transit → completed';
COMMENT ON COLUMN transfer_requests.metadata IS 'Extensible JSONB field for additional transfer data';

COMMENT ON TABLE transfer_request_items IS 'Items in a transfer request with source and destination locations';
COMMENT ON COLUMN transfer_request_items.product_id IS 'Product being transferred (required)';
COMMENT ON COLUMN transfer_request_items.variant_id IS 'Optional product variant if applicable';
COMMENT ON COLUMN transfer_request_items.received_quantity IS 'Quantity actually received (may differ from requested)';
COMMENT ON COLUMN transfer_request_items.item_status IS 'Item-level status: pending, in_transit, completed';

COMMENT ON COLUMN stock_movements.transfer_request_id IS 'Link to transfer request (for movement types 301-312)';
