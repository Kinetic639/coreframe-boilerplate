-- =============================================
-- Fix trigger_refresh_stock_snapshot to support tables without destination/source location columns
-- This update ensures triggers on stock_reservations work correctly by handling location_id as well.
-- =============================================

CREATE OR REPLACE FUNCTION trigger_refresh_stock_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_record JSONB;
  v_location_ids UUID[];
  v_location_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record := to_jsonb(OLD);
  ELSE
    v_record := to_jsonb(NEW);
  END IF;

  v_location_ids := ARRAY(
    SELECT DISTINCT loc_id
    FROM unnest(ARRAY[
      NULLIF(v_record->>'destination_location_id', '')::uuid,
      NULLIF(v_record->>'source_location_id', '')::uuid,
      NULLIF(v_record->>'location_id', '')::uuid
    ]) AS loc_id
    WHERE loc_id IS NOT NULL
  );

  FOREACH v_location_id IN ARRAY v_location_ids LOOP
    IF TG_OP = 'DELETE' THEN
      PERFORM refresh_stock_snapshot(
        OLD.organization_id,
        OLD.branch_id,
        v_location_id,
        OLD.product_id,
        OLD.variant_id
      );
    ELSE
      PERFORM refresh_stock_snapshot(
        NEW.organization_id,
        NEW.branch_id,
        v_location_id,
        NEW.product_id,
        NEW.variant_id
      );
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION trigger_refresh_stock_snapshot IS
  'Refreshes stock snapshots for any table providing location context (supports stock_movements and stock_reservations).';

DO $$
BEGIN
  RAISE NOTICE 'trigger_refresh_stock_snapshot updated to support reservations table';
END $$;

-- =============================================
-- Migration Complete
-- =============================================
