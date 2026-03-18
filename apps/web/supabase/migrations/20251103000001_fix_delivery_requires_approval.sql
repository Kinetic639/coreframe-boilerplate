-- =============================================
-- Fix: Enable approval requirement for deliveries (type 101)
--
-- Problem: Deliveries (movement type 101 - GR from PO) were created with
-- requires_approval = false, causing them to bypass the receiving workflow
-- and update stock immediately.
--
-- Solution: Set requires_approval = true for type 101 so deliveries:
-- 1. Are created in 'pending' status
-- 2. Can be received via the receiving workflow
-- 3. Don't update stock until receiving is complete
-- =============================================

DO $$
BEGIN
  -- Update movement type 101 to require approval
  UPDATE movement_types
  SET
    requires_approval = true,
    updated_at = NOW()
  WHERE code = '101';

  RAISE NOTICE 'Movement type 101 (GR from PO) now requires approval';
  RAISE NOTICE 'Deliveries will be created in pending status and require receiving workflow';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
