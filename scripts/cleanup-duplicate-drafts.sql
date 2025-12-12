-- Cleanup script for duplicate delivery drafts
-- This script removes draft stock_movements that have corresponding completed deliveries
-- Run this via Supabase SQL editor or using: npx supabase db query --file scripts/cleanup-duplicate-drafts.sql

-- First, let's see what we have
SELECT
  sm.reference_id,
  sm.status,
  COUNT(*) as movement_count,
  STRING_AGG(sm.movement_number, ', ') as movement_numbers
FROM stock_movements sm
WHERE sm.movement_type_code = '101' -- Goods Receipt from PO
  AND sm.reference_id IS NOT NULL
GROUP BY sm.reference_id, sm.status
HAVING COUNT(*) > 1
ORDER BY sm.reference_id;

-- Now delete draft movements where a completed movement exists for the same reference_id
DELETE FROM stock_movements
WHERE id IN (
  SELECT sm_draft.id
  FROM stock_movements sm_draft
  WHERE sm_draft.movement_type_code = '101'
    AND sm_draft.status = 'draft'
    AND EXISTS (
      -- Check if there's a completed/approved movement with the same reference_id
      SELECT 1
      FROM stock_movements sm_complete
      WHERE sm_complete.movement_type_code = '101'
        AND sm_complete.reference_id = sm_draft.reference_id
        AND sm_complete.status IN ('completed', 'approved')
    )
);

-- Verify cleanup - this should show only unique reference_ids now
SELECT
  sm.reference_id,
  sm.status,
  COUNT(*) as movement_count
FROM stock_movements sm
WHERE sm.movement_type_code = '101'
  AND sm.reference_id IS NOT NULL
GROUP BY sm.reference_id, sm.status
ORDER BY sm.reference_id;
