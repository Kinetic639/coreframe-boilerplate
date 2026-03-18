-- =====================================================
-- Add Detailed Stock Information to Alerts
-- =====================================================
-- This migration adds on-hand and reserved quantity fields
-- to stock_alerts for complete stock visibility
--
-- Migration ID: 20251118000001
-- Type: Schema Enhancement
-- =====================================================

-- Add new columns for detailed stock breakdown
ALTER TABLE stock_alerts
ADD COLUMN quantity_on_hand DECIMAL(15,3),
ADD COLUMN reserved_quantity DECIMAL(15,3);

-- Add column comments
COMMENT ON COLUMN stock_alerts.quantity_on_hand IS
  'Physical stock quantity at time of alert creation.
   Total units in warehouse before any reservations.';

COMMENT ON COLUMN stock_alerts.reserved_quantity IS
  'Reserved stock quantity at time of alert creation.
   Units allocated to sales orders or other reservations.';

-- Update the existing comments for clarity
COMMENT ON COLUMN stock_alerts.current_stock IS
  'Available stock (after reservations) at the time of alert creation.
   Formula: quantity_on_hand - reserved_quantity.
   This is the actual usable stock that triggered the alert.';

COMMENT ON COLUMN stock_alerts.available_stock IS
  'Available stock after reservations at alert creation time.
   Same as current_stock (kept for API compatibility).
   Formula: quantity_on_hand - reserved_quantity.';
