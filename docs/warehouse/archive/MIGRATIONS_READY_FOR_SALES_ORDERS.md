# Sales Orders & Reservations - Migrations Ready

**Date:** November 12, 2024
**Status:** Ready to Apply
**Last Updated:** Fixed UUID generation function

---

## Summary

All database migrations for Sales Orders and Stock Reservations are complete and ready to apply. These migrations follow best practices:

- ✅ **No CASCADE deletes** - All foreign keys use `ON DELETE RESTRICT` to rely on soft delete
- ✅ **No RLS policies** - RLS will be implemented later as requested
- ✅ **Soft delete pattern** - Uses `deleted_at` for data retention
- ✅ **Auto-numbering** - Order numbers (SO-YYYY-#####) and reservation numbers (RSV-YYYY-#####)
- ✅ **Auto-calculation** - Order totals calculated automatically via triggers and generated columns

---

## Migration Files

### 1. Sales Orders Migration

**File:** `supabase/migrations/20251112120000_create_sales_orders.sql`

**Creates:**

- `sales_orders` table - Order headers with customer, delivery, and financial information
- `sales_order_items` table - Line items with auto-calculated totals (subtotal, tax, line_total)
- `generate_sales_order_number()` function - Auto-generates SO-YYYY-##### format
- `update_sales_order_totals()` function - Updates order totals when items change
- Triggers for auto-numbering and total calculation
- Indexes for performance

**Key Features:**

- Order workflow: draft → pending → confirmed → processing → fulfilled → cancelled
- Denormalized customer data for walk-in customers
- Delivery address tracking
- Shipping cost and discounts
- Generated columns for automatic calculation
- Soft delete with `deleted_at`

**Foreign Keys (All RESTRICT):**

- `organization_id` → organizations(id) ON DELETE RESTRICT
- `branch_id` → branches(id) ON DELETE RESTRICT
- `customer_id` → business_accounts(id) ON DELETE RESTRICT
- `product_id` → products(id) ON DELETE RESTRICT
- `product_variant_id` → product_variants(id) ON DELETE RESTRICT
- `reservation_id` → stock_reservations(id) ON DELETE RESTRICT
- `location_id` → locations(id) ON DELETE RESTRICT

---

### 2. Stock Reservations Enhancement Migration

**File:** `supabase/migrations/20251112120001_enhance_stock_reservations_for_sales_orders.sql`

**Creates/Enhances:**

- Adds `sales_order_id` and `sales_order_item_id` to `stock_reservations` table
- Adds `priority` field for allocation priority
- Adds `auto_release` field for automatic release on fulfillment
- `product_available_inventory` view - Real-time calculation of available stock
- `check_product_availability()` function - Validates if sufficient stock is available
- `generate_reservation_number()` function - Auto-generates RSV-YYYY-##### format
- `create_sales_order_reservation()` function - Creates reservation with availability check
- `release_reservation()` function - Releases stock (partial or full)
- `cancel_reservation()` function - Cancels active reservations
- `expire_old_reservations()` function - Marks expired reservations (requires cron setup)
- Indexes for sales order lookups

**Key Features:**

- Available inventory calculation: `on_hand - reserved = available`
- Automatic reservation creation on order confirmation
- Partial release support for partial fulfillments
- Expiry date tracking with auto-expiry function
- Priority-based allocation when stock is low
- Integration with sales order workflow

**Foreign Keys Added (All RESTRICT):**

- `sales_order_id` → sales_orders(id) ON DELETE RESTRICT
- `sales_order_item_id` → sales_order_items(id) ON DELETE RESTRICT

---

## How to Apply Migrations

### Step 1: Apply migrations to Supabase

```bash
npm run supabase:migration:up
```

This will apply both migrations in sequence:

1. `20251112120000_create_sales_orders.sql`
2. `20251112120001_enhance_stock_reservations_for_sales_orders.sql`

### Step 2: Generate TypeScript types

```bash
npm run supabase:gen:types
```

This will update `supabase/types/types.ts` with the new table definitions.

### Step 3: Verify migrations

Check migration status:

```bash
npx supabase db status
```

Expected output:

```
✅ 20251112120000_create_sales_orders.sql
✅ 20251112120001_enhance_stock_reservations_for_sales_orders.sql
```

---

## Database Tables Created

### sales_orders

- **Purpose:** Customer sales order headers
- **Rows:** 0 (empty, ready for data)
- **Indexes:** 7 indexes (org, branch, customer, status, date, number, deleted)
- **Triggers:** Auto-numbering, total calculation

### sales_order_items

- **Purpose:** Line items for sales orders
- **Rows:** 0 (empty, ready for data)
- **Indexes:** 5 indexes (order, product, variant, reservation, location)
- **Generated Columns:** subtotal, discount_amount, tax_amount, line_total

### stock_reservations (enhanced)

- **Purpose:** Stock reservations for sales orders
- **New Columns:** sales_order_id, sales_order_item_id, priority, auto_release
- **New Indexes:** sales_order, sales_order_item

---

## Database Views Created

### product_available_inventory

- **Purpose:** Real-time available stock calculation
- **Formula:** `quantity_on_hand - reserved_quantity = available_quantity`
- **Filters:** Only active reservations, non-expired, not soft-deleted
- **Usage:** Check before creating reservations or fulfilling orders

---

## Database Functions Created

### Order Management

1. `generate_sales_order_number()` - Auto-generate SO-2024-00001 format
2. `update_sales_order_totals()` - Update order totals when items change

### Reservation Management

3. `generate_reservation_number()` - Auto-generate RSV-2024-00001 format
4. `check_product_availability()` - Validate stock availability
5. `create_sales_order_reservation()` - Create reservation with checks
6. `release_reservation()` - Release reserved stock
7. `cancel_reservation()` - Cancel active reservations
8. `expire_old_reservations()` - Expire old reservations (cron job)

---

## Next Steps (Implementation)

After applying migrations and generating types:

### Phase 1: Sales Orders Module (3-4 days)

1. ✅ Database migration (COMPLETED)
2. ⏳ TypeScript types (`src/modules/warehouse/types/sales-orders.ts`)
3. ⏳ Service layer (`src/modules/warehouse/api/sales-orders-service.ts`)
4. ⏳ UI components (list, create, edit, details pages)
5. ⏳ Server actions for CRUD operations
6. ⏳ Routing and navigation

### Phase 2: Stock Reservations (3-4 days)

1. ✅ Database migration (COMPLETED)
2. ⏳ TypeScript types update (`src/modules/warehouse/types/reservations.ts`)
3. ⏳ Service layer (`src/modules/warehouse/api/reservations-service.ts`)
4. ⏳ Auto-reserve logic (trigger on order confirmation)
5. ⏳ UI components (list, manual reserve, availability indicators)
6. ⏳ Integration with order workflow
7. ⏳ Cron job setup for expiring reservations

---

## Testing Checklist

After applying migrations:

- [ ] Migrations applied successfully
- [ ] TypeScript types generated
- [ ] No type errors in existing code
- [ ] Can create sales order manually via SQL
- [ ] Order number auto-generated (SO-2024-00001)
- [ ] Order totals calculated automatically
- [ ] Can create reservation manually via SQL
- [ ] Reservation number auto-generated (RSV-2024-00001)
- [ ] Available inventory view returns correct data
- [ ] Functions can be called via SQL

**Test SQL:**

```sql
-- Test creating a sales order
INSERT INTO sales_orders (organization_id, customer_name, status)
VALUES ('your-org-id', 'Test Customer', 'draft')
RETURNING id, order_number;

-- Test creating a reservation
SELECT create_sales_order_reservation(
  'order-id'::uuid,
  'order-item-id'::uuid,
  'product-id'::uuid,
  NULL,
  'location-id'::uuid,
  5.0,
  'org-id'::uuid,
  'branch-id'::uuid,
  'user-id'::uuid,
  NULL
);

-- Test checking availability
SELECT * FROM check_product_availability(
  'product-id'::uuid,
  NULL,
  'location-id'::uuid,
  10.0
);

-- Test available inventory view
SELECT * FROM product_available_inventory
WHERE organization_id = 'your-org-id'
LIMIT 10;
```

---

## Important Notes

### Soft Delete Pattern

- All tables use `deleted_at` for soft deletes
- All foreign keys use `ON DELETE RESTRICT`
- Indexes include `WHERE deleted_at IS NULL` for active records
- Never use hard deletes in application code

### RLS Policies

- **Not implemented yet** - Will be added later
- Tables are currently accessible without RLS
- **Do not deploy to production** without RLS

### Cron Jobs

- `expire_old_reservations()` function requires cron setup
- Recommended: Run every hour or daily depending on business needs
- Setup via Supabase dashboard or pg_cron extension

### Reserved Quantity Calculation

The `product_available_inventory` view only counts reservations that are:

- Status: `active` or `partial`
- Not expired: `expires_at IS NULL OR expires_at > NOW()`
- Not soft deleted: `deleted_at IS NULL`

---

## Documentation References

- **Implementation Plan:** [SALES_ORDERS_AND_RESERVATIONS_PLAN.md](./SALES_ORDERS_AND_RESERVATIONS_PLAN.md)
- **Overall Roadmap:** [REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md](./REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md)
- **Technical Spec:** [STOCK_MOVEMENTS_SPECIFICATION.md](./STOCK_MOVEMENTS_SPECIFICATION.md)
- **Warehouse README:** [README.md](./README.md)

---

**Status:** ✅ Ready to apply migrations
**Next Action:** Run `npm run supabase:migration:up` and `npm run supabase:gen:types`
