-- =====================================================
-- Phase 1: Enforce Location-Branch Ownership
-- =====================================================
-- This migration enforces that all locations MUST belong to a branch.
--
-- Background:
-- - Locations represent bins/shelves/racks inside warehouses
-- - Branches represent physical warehouses
-- - Every bin must belong to a warehouse (data integrity)
--
-- Changes:
-- 1. Backfill any NULL branch_id values (shouldn't exist)
-- 2. Make branch_id NOT NULL
-- 3. Make organization_id NOT NULL
--
-- Migration ID: 20251118000004
-- Phase: 1 - Foundation
-- =====================================================

-- Step 1: Backfill NULL organization_id from branch
DO $$
DECLARE
  v_null_org_count INTEGER;
  v_backfilled_org INTEGER := 0;
BEGIN
  -- Count locations without organization_id
  SELECT COUNT(*) INTO v_null_org_count
  FROM locations
  WHERE organization_id IS NULL;

  IF v_null_org_count > 0 THEN
    RAISE NOTICE 'Found % locations without organization_id. Attempting to backfill from branch...', v_null_org_count;

    -- Backfill organization_id from branch
    UPDATE locations l
    SET organization_id = b.organization_id
    FROM branches b
    WHERE l.branch_id = b.id
      AND l.organization_id IS NULL;

    GET DIAGNOSTICS v_backfilled_org = ROW_COUNT;
    RAISE NOTICE 'Backfilled % locations with organization_id from branch', v_backfilled_org;

    -- Check if any locations still have NULL organization_id
    SELECT COUNT(*) INTO v_null_org_count
    FROM locations
    WHERE organization_id IS NULL;

    IF v_null_org_count > 0 THEN
      RAISE WARNING 'WARNING: % locations still have NULL organization_id after backfill.', v_null_org_count;

      -- Last resort: assign to first organization
      UPDATE locations
      SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
      WHERE organization_id IS NULL;

      GET DIAGNOSTICS v_backfilled_org = ROW_COUNT;
      RAISE NOTICE 'Assigned % orphaned locations to first organization', v_backfilled_org;
    END IF;
  ELSE
    RAISE NOTICE 'All locations already have organization_id. No backfill needed.';
  END IF;
END $$;

-- Step 2: Backfill any NULL branch_id values
DO $$
DECLARE
  v_null_locations INTEGER;
  v_backfilled INTEGER := 0;
BEGIN
  -- Count locations without branch_id
  SELECT COUNT(*) INTO v_null_locations
  FROM locations
  WHERE branch_id IS NULL;

  IF v_null_locations > 0 THEN
    RAISE NOTICE 'Found % locations without branch_id. Attempting to backfill...', v_null_locations;

    -- Backfill by assigning to first branch in same organization
    UPDATE locations
    SET branch_id = (
      SELECT b.id FROM branches b
      WHERE b.organization_id = locations.organization_id
        AND b.deleted_at IS NULL
      ORDER BY b.created_at
      LIMIT 1
    )
    WHERE branch_id IS NULL
      AND organization_id IS NOT NULL;

    GET DIAGNOSTICS v_backfilled = ROW_COUNT;
    RAISE NOTICE 'Backfilled % locations with branch_id', v_backfilled;

    -- Check if any locations still have NULL branch_id
    SELECT COUNT(*) INTO v_null_locations
    FROM locations
    WHERE branch_id IS NULL;

    IF v_null_locations > 0 THEN
      RAISE WARNING 'WARNING: % locations still have NULL branch_id after backfill. These may be orphaned records.', v_null_locations;
    END IF;
  ELSE
    RAISE NOTICE 'All locations already have branch_id. No backfill needed.';
  END IF;
END $$;

-- Step 3: Make organization_id NOT NULL
ALTER TABLE locations
ALTER COLUMN organization_id SET NOT NULL;

-- Step 4: Make branch_id NOT NULL
ALTER TABLE locations
ALTER COLUMN branch_id SET NOT NULL;

-- Step 6: Add comments
COMMENT ON COLUMN locations.branch_id IS
  'Branch (warehouse) that this location belongs to.
   REQUIRED: Every location (bin/shelf/rack) must belong to a branch (warehouse).
   This enforces the hierarchy: Organization → Branch (Warehouse) → Location (Bin).';

COMMENT ON COLUMN locations.organization_id IS
  'Organization that owns this location.
   REQUIRED: For multi-tenancy and data isolation.
   Must match the organization_id of the parent branch.';

-- Log the changes
DO $$
DECLARE
  v_total_locations INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_locations FROM locations WHERE deleted_at IS NULL;

  RAISE NOTICE '=== Location-Branch Ownership Enforced ===';
  RAISE NOTICE 'Total active locations: %', v_total_locations;
  RAISE NOTICE 'All locations now have branch_id NOT NULL';
  RAISE NOTICE 'All locations now have organization_id NOT NULL';
  RAISE NOTICE 'Hierarchy enforced: Organization → Branch → Location';
  RAISE NOTICE '==========================================';
END $$;
