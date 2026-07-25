-- ============================================
-- Update Receipt Number Format
-- Changes receipt numbering from RCP-YYYY-NNN to PZ/BRANCH/YYYY/MM/NNNN
-- Format: PZ/MAG1/2025/10/0015
-- ============================================

-- ============================================
-- STEP 1: Add code field to branches table
-- ============================================

DO $$
BEGIN
  -- Add code column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'branches'
    AND column_name = 'code'
  ) THEN
    ALTER TABLE branches
    ADD COLUMN code VARCHAR(10);

    RAISE NOTICE 'Added code column to branches table';
  END IF;
END $$;

-- Set default codes for existing branches (MAG1, MAG2, etc.)
DO $$
DECLARE
  branch_record RECORD;
  branch_counter INTEGER := 1;
BEGIN
  -- Update existing branches that don't have a code
  FOR branch_record IN
    SELECT id FROM branches WHERE code IS NULL OR code = ''
    ORDER BY created_at
  LOOP
    UPDATE branches
    SET code = 'MAG' || branch_counter
    WHERE id = branch_record.id;

    branch_counter := branch_counter + 1;
  END LOOP;

  RAISE NOTICE 'Updated codes for existing branches';
END $$;

-- Make code NOT NULL after setting defaults
ALTER TABLE branches ALTER COLUMN code SET NOT NULL;

-- Add unique constraint on code per organization
ALTER TABLE branches ADD CONSTRAINT branches_code_org_unique UNIQUE (organization_id, code);

-- Add comment
COMMENT ON COLUMN branches.code IS
  'Short code for branch (e.g., MAG1, MAG2) used in document numbering';

-- ============================================
-- STEP 2: Update generate_receipt_number function
-- ============================================
-- New format: PZ/{branch_code}/{year}/{month}/{sequence}
-- Example: PZ/MAG1/2025/10/0015

CREATE OR REPLACE FUNCTION generate_receipt_number(
  p_organization_id UUID,
  p_branch_id UUID
)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch_code VARCHAR(10);
  v_year VARCHAR(4);
  v_month VARCHAR(2);
  v_sequence INTEGER;
  v_receipt_number VARCHAR(50);
BEGIN
  -- Get branch code
  SELECT code INTO v_branch_code
  FROM branches
  WHERE id = p_branch_id;

  IF v_branch_code IS NULL THEN
    RAISE EXCEPTION 'Branch code not found for branch_id: %', p_branch_id;
  END IF;

  -- Get current year and month
  v_year := EXTRACT(YEAR FROM NOW())::VARCHAR;
  v_month := LPAD(EXTRACT(MONTH FROM NOW())::VARCHAR, 2, '0');

  -- Get next sequence number for this org/branch/year/month
  -- Reset counter each month
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(receipt_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO v_sequence
  FROM receipt_documents
  WHERE organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND receipt_number LIKE 'PZ/' || v_branch_code || '/' || v_year || '/' || v_month || '/%';

  -- Format: PZ/MAG1/2025/10/0015
  v_receipt_number := 'PZ/' || v_branch_code || '/' || v_year || '/' || v_month || '/' || LPAD(v_sequence::TEXT, 4, '0');

  RETURN v_receipt_number;
END;
$$;

COMMENT ON FUNCTION generate_receipt_number IS
  'Generates sequential receipt numbers per org/branch/month: PZ/MAG1/2025/10/0015';

-- ============================================
-- STEP 3: Output migration info
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== Receipt Number Format Updated ===';
  RAISE NOTICE 'New format: PZ/{branch_code}/{year}/{month}/{sequence}';
  RAISE NOTICE 'Example: PZ/MAG1/2025/10/0015';
  RAISE NOTICE 'Counter resets monthly for cleaner organization';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- Migration Complete
-- ============================================
