-- ============================================
-- RECEIPT DOCUMENTS SYSTEM (Solution B)
-- ============================================
-- This migration implements a lightweight receipt tracking system
-- that separates document metadata from movement mechanics.
--
-- Design Philosophy:
-- - stock_movements = atomic ledger of quantitative changes (single source of truth)
-- - receipt_documents = contextual header with legal/compliance metadata
-- - receipt_movements = junction table linking receipts to movements
--
-- This approach:
-- 1. Keeps movements table clean and focused
-- 2. Provides proper audit trail for receipts
-- 3. Supports Polish compliance (PZ documents)
-- 4. Scales to other document types (WZ, MM, etc.)
-- ============================================

-- ============================================
-- STEP 1: Add parent_movement_id for partial receipts
-- ============================================
-- Allows tracking parent-child relationships for split movements
-- Example: Original order of 100 units split into 2 receipts (60 + 40)

DO $$
BEGIN
  -- Add parent_movement_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'stock_movements'
    AND column_name = 'parent_movement_id'
  ) THEN
    ALTER TABLE stock_movements
    ADD COLUMN parent_movement_id UUID REFERENCES stock_movements(id) ON DELETE SET NULL;

    -- Add index for performance
    CREATE INDEX idx_stock_movements_parent ON stock_movements(parent_movement_id)
    WHERE parent_movement_id IS NOT NULL;

    -- Add comment
    COMMENT ON COLUMN stock_movements.parent_movement_id IS
      'Links child movements to parent movement for partial receipts, splits, or reversals';
  END IF;
END $$;

-- ============================================
-- STEP 2: Create receipt_documents table
-- ============================================
-- Stores metadata about receipt events (when goods physically arrive)
-- One receipt can cover multiple movements (e.g., partial receipts)

CREATE TABLE IF NOT EXISTS receipt_documents (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization & Branch
  organization_id UUID NOT NULL,
  branch_id UUID NOT NULL,

  -- Receipt Information
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  receipt_date TIMESTAMP NOT NULL DEFAULT NOW(),
  receipt_type VARCHAR(20) DEFAULT 'full',

  -- Status Workflow
  status VARCHAR(20) DEFAULT 'draft',

  -- People
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Polish Document Compliance (PZ)
  pz_document_number VARCHAR(50),
  pz_document_url TEXT,

  -- Quality Control
  quality_check_passed BOOLEAN DEFAULT true,
  quality_notes TEXT,
  receiving_notes TEXT,

  -- Summary Totals (denormalized for reporting)
  total_movements INTEGER DEFAULT 0,
  total_value DECIMAL(15,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Foreign Keys
  CONSTRAINT receipt_documents_org_fkey
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE CASCADE,

  CONSTRAINT receipt_documents_branch_fkey
    FOREIGN KEY (branch_id)
    REFERENCES branches(id)
    ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT valid_receipt_status
    CHECK (status IN ('draft', 'completed', 'cancelled')),

  CONSTRAINT valid_receipt_type
    CHECK (receipt_type IN ('full', 'partial', 'final_partial'))
);

-- Indexes for performance
CREATE INDEX idx_receipt_documents_org_branch
  ON receipt_documents(organization_id, branch_id);

CREATE INDEX idx_receipt_documents_date
  ON receipt_documents(receipt_date);

CREATE INDEX idx_receipt_documents_status
  ON receipt_documents(status);

CREATE INDEX idx_receipt_documents_number
  ON receipt_documents(receipt_number);

-- Comments
COMMENT ON TABLE receipt_documents IS
  'Stores metadata about receipt events when goods physically arrive. Links to stock_movements via receipt_movements junction table.';

COMMENT ON COLUMN receipt_documents.receipt_type IS
  'Type of receipt: full (complete delivery), partial (more to come), final_partial (last shipment)';

COMMENT ON COLUMN receipt_documents.pz_document_number IS
  'Polish PZ (Przyjęcie Zewnętrzne) document number for goods receipt';

COMMENT ON COLUMN receipt_documents.pz_document_url IS
  'URL to generated PZ document PDF in Supabase Storage';

-- ============================================
-- STEP 3: Create receipt_movements junction table
-- ============================================
-- Links receipt documents to stock movements (many-to-many)
-- One receipt can include multiple movements
-- One movement can be referenced by one receipt

CREATE TABLE IF NOT EXISTS receipt_movements (
  -- Composite Primary Key
  receipt_id UUID NOT NULL REFERENCES receipt_documents(id) ON DELETE CASCADE,
  movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (receipt_id, movement_id)
);

-- Indexes
CREATE INDEX idx_receipt_movements_receipt
  ON receipt_movements(receipt_id);

CREATE INDEX idx_receipt_movements_movement
  ON receipt_movements(movement_id);

-- Ensure one movement is only linked to one receipt
CREATE UNIQUE INDEX idx_receipt_movements_unique_movement
  ON receipt_movements(movement_id);

-- Comments
COMMENT ON TABLE receipt_movements IS
  'Junction table linking receipt documents to stock movements. Enforces one movement per receipt.';

-- ============================================
-- STEP 4: Create function to generate receipt numbers
-- ============================================
-- Generates unique receipt numbers: RCP-2025-001, RCP-2025-002, etc.

CREATE OR REPLACE FUNCTION generate_receipt_number(
  p_organization_id UUID,
  p_branch_id UUID
)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
AS $$
DECLARE
  v_year VARCHAR(4);
  v_sequence INTEGER;
  v_receipt_number VARCHAR(50);
BEGIN
  -- Get current year
  v_year := EXTRACT(YEAR FROM NOW())::VARCHAR;

  -- Get next sequence number for this org/branch/year
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(receipt_number FROM '\d+$') AS INTEGER
    )
  ), 0) + 1
  INTO v_sequence
  FROM receipt_documents
  WHERE organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND receipt_number LIKE 'RCP-' || v_year || '-%';

  -- Format: RCP-2025-001
  v_receipt_number := 'RCP-' || v_year || '-' || LPAD(v_sequence::TEXT, 3, '0');

  RETURN v_receipt_number;
END;
$$;

COMMENT ON FUNCTION generate_receipt_number IS
  'Generates sequential receipt numbers per organization/branch/year: RCP-2025-001';

-- ============================================
-- STEP 5: Create trigger to auto-generate receipt numbers
-- ============================================

CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := generate_receipt_number(
      NEW.organization_id,
      NEW.branch_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_receipt_number
  BEFORE INSERT ON receipt_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_receipt_number();

-- ============================================
-- STEP 6: Create trigger to update receipt totals
-- ============================================
-- Automatically updates total_movements and total_value when movements are linked

CREATE OR REPLACE FUNCTION update_receipt_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the receipt document totals
  UPDATE receipt_documents rd
  SET
    total_movements = (
      SELECT COUNT(*)
      FROM receipt_movements rm
      WHERE rm.receipt_id = rd.id
    ),
    total_value = (
      SELECT COALESCE(SUM(sm.total_cost), 0)
      FROM receipt_movements rm
      JOIN stock_movements sm ON sm.id = rm.movement_id
      WHERE rm.receipt_id = rd.id
    ),
    updated_at = NOW()
  WHERE rd.id = COALESCE(NEW.receipt_id, OLD.receipt_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_receipt_totals_insert
  AFTER INSERT ON receipt_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_totals();

CREATE TRIGGER trigger_update_receipt_totals_delete
  AFTER DELETE ON receipt_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_totals();

-- ============================================
-- STEP 7: Create view for receipt details with movements
-- ============================================
-- Convenient view joining receipts with their movements

CREATE OR REPLACE VIEW receipt_details AS
SELECT
  rd.id as receipt_id,
  rd.organization_id,
  rd.branch_id,
  rd.receipt_number,
  rd.receipt_date,
  rd.receipt_type,
  rd.status,
  rd.created_by,
  rd.received_by,
  rd.pz_document_number,
  rd.pz_document_url,
  rd.quality_check_passed,
  rd.quality_notes,
  rd.receiving_notes,
  rd.total_movements,
  rd.total_value,
  rd.created_at,
  rd.completed_at,

  -- Movement details
  sm.id as movement_id,
  sm.movement_number,
  sm.movement_type_code,
  sm.product_id,
  sm.variant_id,
  sm.quantity,
  sm.unit_of_measure as unit,
  sm.unit_cost,
  sm.total_cost,
  sm.source_location_id,
  sm.destination_location_id,
  sm.batch_number,
  sm.serial_number,
  sm.expiry_date,
  sm.status as movement_status,
  sm.parent_movement_id,

  -- User information
  creator.email as created_by_email,
  creator.first_name as created_by_first_name,
  creator.last_name as created_by_last_name,
  receiver.email as received_by_email,
  receiver.first_name as received_by_first_name,
  receiver.last_name as received_by_last_name

FROM receipt_documents rd
LEFT JOIN receipt_movements rm ON rm.receipt_id = rd.id
LEFT JOIN stock_movements sm ON sm.id = rm.movement_id
LEFT JOIN users creator ON creator.id = rd.created_by
LEFT JOIN users receiver ON receiver.id = rd.received_by;

COMMENT ON VIEW receipt_details IS
  'Denormalized view of receipts with their linked movements and user details';

-- ============================================
-- STEP 8: Enable Row Level Security (RLS)
-- ============================================
-- Note: RLS is currently disabled for testing
-- These policies should be enabled in production

-- Enable RLS (commented out for now - enable in production)
-- ALTER TABLE receipt_documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE receipt_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies (commented out - enable when RLS is enabled)
/*
-- Policy: Users can view receipts in their organization
CREATE POLICY receipt_documents_select_policy ON receipt_documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert receipts in their organization
CREATE POLICY receipt_documents_insert_policy ON receipt_documents
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update receipts in their organization
CREATE POLICY receipt_documents_update_policy ON receipt_documents
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete receipts in their organization
CREATE POLICY receipt_documents_delete_policy ON receipt_documents
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Similar policies for receipt_movements
CREATE POLICY receipt_movements_select_policy ON receipt_movements
  FOR SELECT
  USING (
    receipt_id IN (
      SELECT id FROM receipt_documents
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY receipt_movements_insert_policy ON receipt_movements
  FOR INSERT
  WITH CHECK (
    receipt_id IN (
      SELECT id FROM receipt_documents
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY receipt_movements_delete_policy ON receipt_movements
  FOR DELETE
  USING (
    receipt_id IN (
      SELECT id FROM receipt_documents
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid()
      )
    )
  );
*/

-- ============================================
-- STEP 9: Grant permissions
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON receipt_documents TO authenticated;
GRANT SELECT, INSERT, DELETE ON receipt_movements TO authenticated;
GRANT SELECT ON receipt_details TO authenticated;

-- ============================================
-- END OF MIGRATION
-- ============================================
