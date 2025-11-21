-- =====================================================
-- Fix Existing Stock Alerts - Current Stock Field
-- =====================================================
-- This migration updates existing stock_alerts records to ensure
-- current_stock field contains available_quantity (not quantity_on_hand)
--
-- Background: The initial implementation incorrectly stored quantity_on_hand
-- in the current_stock field. This migration corrects existing data.
--
-- Migration ID: 20251118000000
-- Type: Data Migration (Fix)
-- =====================================================

-- Update existing alerts to use available_stock value for current_stock
-- This ensures historical data is consistent with the corrected logic
UPDATE stock_alerts
SET current_stock = available_stock
WHERE current_stock != available_stock;

-- Add a comment explaining what current_stock represents
COMMENT ON COLUMN stock_alerts.current_stock IS
  'Available stock (after reservations) at the time of alert creation.
   This is the actual usable stock that triggered the alert.
   Same value as available_stock field (both represent available_quantity from inventory).';

COMMENT ON COLUMN stock_alerts.available_stock IS
  'Available stock after reservations at alert creation time.
   Duplicates current_stock for API compatibility and clarity.
   Both fields represent: quantity_on_hand - reserved_quantity.';
