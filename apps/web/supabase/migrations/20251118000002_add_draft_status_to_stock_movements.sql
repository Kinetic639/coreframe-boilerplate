-- =====================================================
-- Add Draft Status to Stock Movements
-- =====================================================
-- This migration adds 'draft' as a valid status for stock movements
-- to support draft delivery functionality.
--
-- Background: The save-draft-delivery functionality needs to create
-- stock movements with status='draft' but the CHECK constraint only
-- allowed: pending, approved, completed, cancelled, reversed
--
-- Migration ID: 20251118000002
-- Type: Schema Enhancement
-- =====================================================

-- Drop the existing status check constraint
ALTER TABLE stock_movements
DROP CONSTRAINT IF EXISTS stock_movements_status_check;

-- Add updated constraint with 'draft' status
ALTER TABLE stock_movements
ADD CONSTRAINT stock_movements_status_check
CHECK (status IN ('draft', 'pending', 'approved', 'completed', 'cancelled', 'reversed'));

-- Update column comment to document the new status
COMMENT ON COLUMN stock_movements.status IS
  'Current status of the stock movement.
   Allowed values:
   - draft: Saved but incomplete, not yet submitted (used for delivery wizard)
   - pending: Submitted and awaiting approval (if requires_approval=true)
   - approved: Approved and ready to execute
   - completed: Executed and inventory updated
   - cancelled: Cancelled before completion
   - reversed: Completed movement that was reversed';

-- Log the change
DO $$
BEGIN
  RAISE NOTICE '=== Stock Movements Status Updated ===';
  RAISE NOTICE 'Added "draft" status to stock_movements.status';
  RAISE NOTICE 'Valid statuses: draft, pending, approved, completed, cancelled, reversed';
  RAISE NOTICE '======================================';
END $$;
