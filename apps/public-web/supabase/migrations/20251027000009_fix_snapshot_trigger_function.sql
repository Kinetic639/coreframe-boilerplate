-- =============================================
-- Fix trigger_refresh_stock_snapshot function to use correct location fields
-- The function was using location_id which no longer exists
-- Now it should use destination_location_id for receipts and source_location_id for issues
-- =============================================

CREATE OR REPLACE FUNCTION trigger_refresh_stock_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_location_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- For deletes, try destination first (for receipts), then source (for issues)
    v_location_id := COALESCE(OLD.destination_location_id, OLD.source_location_id);

    -- Only refresh if there's a location
    IF v_location_id IS NOT NULL THEN
      PERFORM refresh_stock_snapshot(
        OLD.organization_id,
        OLD.branch_id,
        v_location_id,
        OLD.product_id,
        OLD.variant_id
      );
    END IF;

    RETURN OLD;
  ELSE
    -- For inserts and updates
    -- Refresh for destination location (receipts, transfers-in)
    IF NEW.destination_location_id IS NOT NULL THEN
      PERFORM refresh_stock_snapshot(
        NEW.organization_id,
        NEW.branch_id,
        NEW.destination_location_id,
        NEW.product_id,
        NEW.variant_id
      );
    END IF;

    -- Also refresh for source location (issues, transfers-out)
    IF NEW.source_location_id IS NOT NULL THEN
      PERFORM refresh_stock_snapshot(
        NEW.organization_id,
        NEW.branch_id,
        NEW.source_location_id,
        NEW.product_id,
        NEW.variant_id
      );
    END IF;

    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function
COMMENT ON FUNCTION trigger_refresh_stock_snapshot IS
'Trigger function to refresh stock snapshots when movements are created/updated/deleted.
Handles both source_location_id (for issues) and destination_location_id (for receipts).
Allows movements without locations (snapshot refresh is skipped in those cases).';

-- Verify the function was updated
DO $$
BEGIN
  RAISE NOTICE 'trigger_refresh_stock_snapshot function updated successfully';
  RAISE NOTICE 'Function now uses source_location_id and destination_location_id';
  RAISE NOTICE 'Movements without locations will not trigger snapshot refresh';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
