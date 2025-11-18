# Warehouse Architecture Refactoring - Migration Application Guide

**Date:** November 18, 2024
**Status:** Ready for Application
**Migrations:** 5 files created

---

## Overview

This guide walks you through applying the warehouse architecture refactoring migrations in the correct order.

### Migrations Created

1. `20251118000004_enforce_location_branch_ownership.sql` - Make locations belong to branches
2. `20251118000005_create_product_branch_settings.sql` - Create per-warehouse settings table
3. `20251118000006_migrate_reorder_points_to_branches.sql` - Migrate existing data
4. `20251118000007_create_branch_level_inventory_views.sql` - Create warehouse-level views
5. `20251118000008_fix_alerts_branch_level.sql` - Fix alert system

---

## Pre-Application Checklist

Before applying migrations, verify:

- [ ] You have a recent database backup
- [ ] You're in the correct environment (development/staging first!)
- [ ] No users are actively using the system (if production)
- [ ] Supabase CLI is properly configured and linked

### Verify Current State

```bash
# Check current migrations status
npm run supabase:migration:list

# Check database connection
npm run supabase:db:status
```

---

## Step-by-Step Application

### Step 1: Apply All Migrations

```bash
npm run supabase:migration:up
```

**Expected Output:**

```
Applying migration 20251118000004_enforce_location_branch_ownership.sql...
  ✓ All locations now have branch_id NOT NULL
  ✓ Hierarchy enforced: Organization → Branch → Location

Applying migration 20251118000005_create_product_branch_settings.sql...
  ✓ Table: product_branch_settings created
  ✓ Purpose: Per-warehouse inventory thresholds

Applying migration 20251118000006_migrate_reorder_points_to_branches.sql...
  ✓ Reorder Points Migration Complete
  ✓ Settings created: [count]
  ✓ Products with settings: [count]

Applying migration 20251118000007_create_branch_level_inventory_views.sql...
  ✓ Created: stock_inventory_by_branch
  ✓ Created: product_available_inventory_by_branch
  ✓ Created: branch_stock_summary

Applying migration 20251118000008_fix_alerts_branch_level.sql...
  ✓ Stock Alerts System Fixed
  ✓ Alerts now work at WAREHOUSE level
```

**If You See Errors:**

- **Error about NULL values:** Check the backfill logic in migration 20251118000004
- **Error about duplicate keys:** Verify no duplicate product-branch combinations exist
- **Error about missing columns:** Ensure previous migrations completed successfully

### Step 2: Generate TypeScript Types

```bash
npm run supabase:gen:types
```

**Expected Output:**

```
Generating types from remote database...
✓ Types generated: supabase/types/types.ts

New types added:
  - product_branch_settings table
  - stock_inventory_by_branch view
  - product_available_inventory_by_branch view
  - branch_stock_summary view
```

### Step 3: Verify Migrations

Run these SQL queries to verify everything worked:

```sql
-- 1. Check all locations have branch_id
SELECT COUNT(*) as total_locations,
       COUNT(branch_id) as with_branch,
       COUNT(*) - COUNT(branch_id) as without_branch
FROM locations
WHERE deleted_at IS NULL;
-- Should show: without_branch = 0

-- 2. Check product_branch_settings created
SELECT COUNT(*) as settings_count,
       COUNT(DISTINCT product_id) as products_count,
       COUNT(DISTINCT branch_id) as branches_count
FROM product_branch_settings
WHERE deleted_at IS NULL;
-- Should show: settings_count > 0

-- 3. Test warehouse-level inventory view
SELECT branch_id,
       COUNT(DISTINCT product_id) as products,
       SUM(quantity_on_hand) as total_stock
FROM stock_inventory_by_branch
GROUP BY branch_id;
-- Should show warehouse totals

-- 4. Test alert summary
SELECT * FROM get_alert_summary(
  (SELECT id FROM organizations LIMIT 1)
);
-- Should show affected_branches and affected_products
```

### Step 4: Run Stock Check to Refresh Alerts

```sql
-- Run the fixed alert detection function
SELECT * FROM check_stock_levels_and_alert();
```

**Expected Output:**

```
alerts_created | alerts_resolved | alerts_updated | notifications_pending
---------------|-----------------|----------------|----------------------
       5       |       12        |       3        |          2
```

This will:

- Create new warehouse-level alerts (if stock below threshold)
- Resolve old bin-level alerts (replaced with warehouse-level)
- Update existing alerts with current stock levels

---

## Post-Migration Verification

### Test 1: Check for Duplicate Alerts

```sql
-- Should return 0 rows (no duplicates)
SELECT product_id, branch_id, COUNT(*) as alert_count
FROM stock_alerts
WHERE status = 'active'
  AND deleted_at IS NULL
GROUP BY product_id, branch_id
HAVING COUNT(*) > 1;
```

### Test 2: Verify Alert Stock Values

```sql
-- Compare alert stock values to actual warehouse stock
SELECT
  sa.product_id,
  sa.branch_id,
  sa.current_stock as alert_stock,
  inv.available_quantity as actual_stock,
  sa.reorder_point,
  CASE
    WHEN sa.current_stock = inv.available_quantity THEN '✓ Match'
    ELSE '✗ Mismatch'
  END as status
FROM stock_alerts sa
JOIN product_available_inventory_by_branch inv
  ON sa.product_id = inv.product_id
 AND sa.branch_id = inv.branch_id
WHERE sa.status = 'active'
  AND sa.deleted_at IS NULL
ORDER BY status DESC, sa.product_id;
```

### Test 3: Verify Per-Branch Settings

```sql
-- Check that same product has different settings per branch
SELECT
  p.name as product_name,
  b.name as branch_name,
  pbs.reorder_point,
  pbs.max_stock_level
FROM product_branch_settings pbs
JOIN products p ON pbs.product_id = p.id
JOIN branches b ON pbs.branch_id = b.id
WHERE pbs.deleted_at IS NULL
ORDER BY p.name, b.name
LIMIT 20;
```

---

## Rollback Instructions (If Needed)

If you encounter critical issues, rollback in **reverse order**:

### Option 1: Rollback All Migrations

```bash
# Rollback the last 5 migrations
npm run supabase:db:reset
```

⚠️ **WARNING:** This will reset your entire database to the last migration before these changes!

### Option 2: Manual Rollback (Safer)

```sql
-- 1. Revert alerts function (use old version from backup)
-- 2. Drop new views
DROP VIEW IF EXISTS branch_stock_summary;
DROP VIEW IF EXISTS product_available_inventory_by_branch;
DROP VIEW IF EXISTS stock_inventory_by_branch;

-- 3. Keep product_branch_settings table (data migration already done)
-- Just don't use it in the application

-- 4. Revert location constraints
ALTER TABLE locations ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE locations ALTER COLUMN organization_id DROP NOT NULL;

-- 5. Revert alert constraints
ALTER TABLE stock_alerts ALTER COLUMN branch_id DROP NOT NULL;
```

---

## Expected System Changes

After successful migration:

### What Changed ✅

1. **Locations Table:**
   - `branch_id` is now NOT NULL (every bin belongs to a warehouse)
   - `organization_id` is now NOT NULL (multi-tenancy enforced)

2. **New Table: product_branch_settings**
   - Stores per-warehouse reorder points
   - Each warehouse can have different thresholds

3. **New Views:**
   - `stock_inventory_by_branch` - Warehouse-level stock totals
   - `product_available_inventory_by_branch` - Warehouse available stock
   - `branch_stock_summary` - High-level warehouse statistics

4. **Alerts System:**
   - Creates ONE alert per product per warehouse (not per bin)
   - Uses per-warehouse reorder points
   - `location_id` set to NULL (warehouse-level alerts)
   - `branch_id` is now NOT NULL

5. **Functions Updated:**
   - `check_stock_levels_and_alert()` - Uses warehouse totals
   - `calculate_order_quantity()` - Accepts branch_id parameter
   - `get_alert_summary()` - Shows affected branches/products

### What Stayed the Same ✅

1. **Original Views:**
   - `stock_inventory` - Still shows bin-level stock (for picking/putaway)
   - `product_available_inventory` - Still shows bin-level available stock

2. **Stock Movements:**
   - No changes to stock_movements table
   - Still supports bin-level operations

3. **Reservations:**
   - No changes to stock_reservations table
   - Still per-location (correct for picking)

4. **Products Table:**
   - Original reorder_point fields DEPRECATED but kept
   - No breaking changes to existing queries (backward compatible)

---

## Next Steps After Migration

Once migrations are successfully applied:

1. **Test Alerts UI:**
   - Navigate to `/dashboard/warehouse/alerts`
   - Verify no duplicate alerts
   - Check that warehouse totals are displayed

2. **Update Application Code:**
   - Proceed with Phase 4 (Services & UI updates)
   - See main refactoring document for code changes

3. **User Communication:**
   - Inform users about per-warehouse settings
   - Provide training on new branch settings UI (when ready)

4. **Monitor Performance:**
   - Watch for slow queries on new views
   - Check index usage with `EXPLAIN ANALYZE`

---

## Troubleshooting

### Issue: "cannot change return type of existing function"

**Solution:** Migration 20251118000008 includes `DROP FUNCTION` first. If this fails:

```sql
DROP FUNCTION IF EXISTS check_stock_levels_and_alert(UUID);
DROP FUNCTION IF EXISTS calculate_order_quantity(UUID, UUID);
```

### Issue: "column branch_id cannot be set to NOT NULL"

**Cause:** Some locations don't have branch_id

**Solution:** Run the backfill script manually:

```sql
UPDATE locations
SET branch_id = (
  SELECT id FROM branches
  WHERE organization_id = locations.organization_id
  LIMIT 1
)
WHERE branch_id IS NULL;
```

### Issue: "duplicate key value violates unique constraint"

**Cause:** Trying to create duplicate product-branch settings

**Solution:** Check for existing records:

```sql
SELECT product_id, branch_id, COUNT(*)
FROM product_branch_settings
GROUP BY product_id, branch_id
HAVING COUNT(*) > 1;
```

---

## Success Criteria

Migration is successful when:

- ✅ All 5 migrations applied without errors
- ✅ TypeScript types generated successfully
- ✅ All locations have `branch_id` NOT NULL
- ✅ `product_branch_settings` table populated
- ✅ New views return data
- ✅ Alert function runs without errors
- ✅ No duplicate alerts exist
- ✅ Alert stock values match warehouse totals

---

## Support

If you encounter issues:

1. Check migration logs for error messages
2. Verify database state with verification queries above
3. Review the main refactoring document for context
4. Consider rollback if critical issues arise

---

**Ready to proceed?**

Run: `npm run supabase:migration:up`
