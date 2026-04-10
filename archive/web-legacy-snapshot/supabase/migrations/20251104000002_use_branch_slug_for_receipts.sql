-- ============================================
-- Migration: Use branch slug instead of code for receipt numbers
-- Removes the code column and updates generate_receipt_number() to use slug
-- ============================================

-- STEP 1: Drop the code column and its constraint
-- ============================================

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_code_org_unique;
ALTER TABLE branches DROP COLUMN IF EXISTS code;

-- STEP 2: Update generate_receipt_number() function to use slug
-- ============================================
-- New format: PZ/{branch_slug}/{year}/{month}/{sequence}
-- Example: PZ/main/2025/11/0001

CREATE OR REPLACE FUNCTION generate_receipt_number(
  p_organization_id UUID,
  p_branch_id UUID
)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch_slug VARCHAR(255);
  v_year VARCHAR(4);
  v_month VARCHAR(2);
  v_sequence INTEGER;
  v_receipt_number VARCHAR(50);
BEGIN
  -- Get branch slug
  SELECT slug INTO v_branch_slug
  FROM branches
  WHERE id = p_branch_id;

  IF v_branch_slug IS NULL THEN
    RAISE EXCEPTION 'Branch slug not found for branch_id: %', p_branch_id;
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
    AND receipt_number LIKE 'PZ/' || v_branch_slug || '/' || v_year || '/' || v_month || '/%';

  -- Format: PZ/{branch_slug}/2025/11/0001
  v_receipt_number := 'PZ/' || v_branch_slug || '/' || v_year || '/' || v_month || '/' || LPAD(v_sequence::TEXT, 4, '0');

  RETURN v_receipt_number;
END;
$$;

COMMENT ON FUNCTION generate_receipt_number IS
  'Generates sequential receipt numbers per org/branch/month using branch slug: PZ/{slug}/2025/11/0001';

-- STEP 3: Output migration info
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== Receipt Number Format Updated ===';
  RAISE NOTICE 'Now using branch slug instead of code column';
  RAISE NOTICE 'New format: PZ/{branch_slug}/{year}/{month}/{sequence}';
  RAISE NOTICE 'Example: PZ/main/2025/11/0001';
END $$;
