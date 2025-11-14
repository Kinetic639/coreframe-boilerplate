# Warehouse Stock Movements Documentation

## 📖 Quick Navigation

### Active Documents

- **[REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md](REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md)** ⭐ **Overall Roadmap & Next Steps**
  - Prioritized plan to complete remaining features
  - Detailed timelines and implementation steps (P1-P10)
  - **Use this for long-term planning**

- **[STOCK_MOVEMENTS_SPECIFICATION.md](STOCK_MOVEMENTS_SPECIFICATION.md)** - Technical Specification
  - Source of truth for movement types (31 codes: 101-613)
  - Database schema and Polish legal compliance
  - Business rules and validation logic
  - **Use this for technical reference**

### Historical Documents

- **[archive/](archive/)** - Completed phase summaries and old plans
  - PHASE_1_COMPLETION_SUMMARY.md (Movement types - Oct 24, 2024)
  - PHASE_2_IMPLEMENTATION_SUMMARY.md (Stock movements system - Oct 26, 2024)
  - SALES_ORDERS_AND_RESERVATIONS_COMPLETION_SUMMARY.md (Sales orders & reservations - Nov 14, 2024) ✨ **NEW**
  - SALES_ORDERS_AND_RESERVATIONS_PLAN.md (Original implementation plan)
  - STOCK_MOVEMENTS_IMPLEMENTATION_PLAN.md (Original detailed plan)

---

## 🎯 Current Implementation Status

**Overall Progress:** 50% Complete (as of November 14, 2024)

### ✅ What Works Today

**Core Infrastructure (Phase 1 & 2 Complete)**

- ✅ 31 SAP-style movement types configured (codes 101-613)
- ✅ Stock movements database with full tracking
- ✅ Inventory calculation views (real-time stock levels)
- ✅ Movement approval workflow (pending → approved → completed)
- ✅ Soft delete with audit trail
- ✅ TypeScript types and service layer
- ✅ Full UI (list, detail, create pages)

**Working Movement Types**

- ✅ **101:** Goods Receipt from Purchase Order (with basic delivery workflow)
- ✅ **201:** Goods Issue for Sales Order (with fulfillment integration)
- ✅ **401-403:** Inventory Adjustments (increase, decrease, revaluation)
- ✅ **501-502:** Stock Reservations (reserve, unreserve) - hybrid model ✨ **NEW**

**Database Tables**

- ✅ `movement_types` - 31 movement type definitions
- ✅ `stock_movements` - Movement transactions with reservation events (501-502)
- ✅ `stock_movement_items` - Line items with product/variant/quantity
- ✅ `stock_inventory` - Calculated inventory view
- ✅ `stock_reservations` - Active reservation tracking (hybrid model) ✨ **NEW**
- ✅ `product_available_inventory` - Real-time available quantity view ✨ **NEW**
- ✅ `sales_orders` - Customer orders with status workflow ✨ **NEW**
- ✅ `sales_order_items` - Order line items with reservation links ✨ **NEW**
- ✅ `receipt_documents` - Receipt document system (no PDF generation)
- ⚠️ Transfer tables exist but migrations are DISABLED

**Services & API**

- ✅ Movement types service
- ✅ Stock movements service (create, approve, complete)
- ✅ Movement validation service
- ✅ Receipt processing service
- ✅ Sales orders service (full CRUD, status workflow, reservation integration) ✨ **NEW**
- ✅ Reservations service (hybrid model, availability validation) ✨ **NEW**
- ✅ Server actions with authentication

**UI Pages**

- ✅ `/dashboard/warehouse/movements` - Stock movements list and management
- ✅ `/dashboard/warehouse/inventory` - Real-time inventory dashboard
- ✅ `/dashboard/warehouse/sales-orders` - Sales orders list ✨ **NEW**
- ✅ `/dashboard/warehouse/sales-orders/new` - Create sales order ✨ **NEW**
- ✅ `/dashboard/warehouse/sales-orders/[id]` - Order details ✨ **NEW**

---

## ❌ What's Missing (50%)

### ✅ Recently Completed (November 14, 2024)

**Sales Orders & Reservations** - See [archive/SALES_ORDERS_AND_RESERVATIONS_COMPLETION_SUMMARY.md](archive/SALES_ORDERS_AND_RESERVATIONS_COMPLETION_SUMMARY.md)

- ✅ **Phase 1:** Sales Orders Module - Full UI and workflow
- ✅ **Phase 2:** Stock Reservations - Hybrid model with auto-reserve/release
- ✅ **Integration:** Real-time availability, overselling prevention
- ⏭️ **Phase 0:** Product-Supplier Integration - Skipped (not required yet)

**Key Features Delivered:**

- Sales order management with full lifecycle (draft → confirmed → fulfilled)
- Automatic stock reservation on order confirmation
- Overselling prevention through real-time availability calculation
- Reservation release on cancellation or fulfillment
- Available quantity displayed throughout the system: `available = on_hand - reserved`
- Product details page shows reserved quantities
- Sales order form validates availability before submission

### Critical Gaps (Blocks Production Use)

1. **🔴 No Automated Purchase Orders** (Priority 2 - NEXT UP ⭐⭐⭐⭐⭐)
   - Manual spreadsheet tracking still required
   - No low stock alerts or reorder automation
   - May need Phase 0 (product-suppliers) for advanced features
   - Estimated: 1.5 weeks

2. **🟡 No Product-Supplier Relationships** (Phase 0 - Optional for P2)
   - Products have basic supplier field only
   - Cannot track supplier SKU, pricing, lead times
   - May be needed for automated purchase orders
   - Estimated: 1-2 days

3. **🔴 No Warehouse Transfers** (Priority 3)
   - Transfer tables DISABLED in migrations
   - Cannot move stock between locations
   - Estimated: 2 weeks

4. **🔴 No PDF Document Generation** (Priority 4)
   - Cannot print legal warehouse documents (PZ, WZ, MM, etc.)
   - Polish legal requirement not met
   - Estimated: 1.5 weeks

5. **🔴 No Row-Level Security** (Priority 10)
   - RLS intentionally disabled for testing
   - **MUST BE IMPLEMENTED before production**
   - Estimated: 1 week

### Important Features (Needed for Full Operations)

- **Returns Processing** (102-103, 202-203) - Customer and supplier returns
- **Internal Operations** (105, 205, 206, 411) - Waste, cost center allocation, initial stock
- **Damage Tracking** - Integrated with receipt workflow

### Optional/Future Features

- **E-commerce Integration** (601-613) - Shopify, WooCommerce, Allegro sync
- **Production Movements** (104, 204) - Manufacturing tracking
- **JPK_MAG Export** - Polish tax office electronic reporting

---

## 🚀 Next Steps (Prioritized)

Follow the [REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md](REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md) roadmap:

### Phase 1: Critical MVP (4-5 weeks remaining)

1. ✅ **P1:** Stock Reservations (501-502) - COMPLETED ⭐⭐⭐⭐⭐
2. **P2:** Low Stock Alerts & Purchase Orders - 1.5 weeks ⭐⭐⭐⭐⭐ **← NEXT**
3. **P3:** Warehouse Transfers (301-312) - 2 weeks ⭐⭐⭐⭐⭐
4. **P4:** PDF Document Generation - 1.5 weeks ⭐⭐⭐⭐

### Phase 2: Full Operations (2 weeks)

5. **P5:** Returns & Reversals - 1 week ⭐⭐⭐⭐
6. **P6:** Internal Operations - 1 week ⭐⭐

### Phase 3: Advanced Features (3-4 weeks, optional)

7. **P7:** E-commerce Integration - 2-3 weeks ⭐⭐⭐
8. **P8:** Production Movements - 1 week ⭐⭐

### Phase 4: Pre-Production (2 weeks, mandatory)

9. **P9:** JPK_MAG Export - 1 week ⭐⭐⭐⭐⭐
10. **P10:** Row-Level Security - 1 week ⭐⭐⭐⭐⭐

**Total Timeline:** 11-12 weeks remaining to 100% completion

---

## 🏗️ Architecture Overview

### Movement Types Structure

The system uses SAP-style numeric movement type codes organized into 6 categories:

| Code Range  | Category     | Polish Doc | Examples                                          |
| ----------- | ------------ | ---------- | ------------------------------------------------- |
| **101-105** | Receipts     | PZ         | Goods receipt from PO, returns, production output |
| **201-206** | Issues       | WZ, RW     | Sales, returns to supplier, waste, damage         |
| **301-312** | Transfers    | MM         | Intra-location, inter-branch transfers            |
| **401-411** | Adjustments  | INW        | Stock corrections, quality reclassification       |
| **501-502** | Reservations | -          | Stock reservation, allocation                     |
| **601-613** | E-commerce   | -          | Shopify, WooCommerce, Allegro sync                |

### Movement Status Flow

```
draft → pending → approved → completed
                      ↓
                  cancelled
                      ↓
                  reversed
```

### Database Architecture

```
movement_types (31 types)
    ↓
stock_movements (header)
    ↓
stock_movement_items (line items)
    ↓
stock_inventory (calculated view)
    ↓
product_available_inventory (available = on_hand - reserved)
```

### Sales Orders & Reservations Flow

```
Sales Order Created (draft)
    ↓
Order Confirmed
    ↓
Create Reservations (stock_reservations)
    ↓
Write RES Movement (type 501)
    ↓
Available Quantity Updated (on_hand - reserved)
    ↓
Order Fulfilled
    ↓
Create Goods Issue (type 201)
    ↓
Release Reservations
    ↓
Write UNRES Movement (type 502)
```

---

## ⚠️ Important Notes

### Security Warning

- **RLS is currently DISABLED** on all warehouse tables
- This is intentional for testing purposes
- **DO NOT deploy to production without implementing RLS**
- See Priority 10 in roadmap

### Polish Legal Compliance

- System is designed for Polish legal requirements
- Document types mapped: PZ, WZ, MM, RW, KP, KN, INW
- JPK_MAG export not yet implemented
- PDF generation not yet implemented

### E-commerce Integration

- Movement types 601-613 are defined
- API integrations not yet built
- Bi-directional sync not implemented

### Hybrid Reservation Model

- **Operational State:** `stock_reservations` table (current active reservations)
- **Event Log:** `stock_movements` with types 501-502 (immutable audit trail)
- **Benefits:** Fast queries + complete history
- **Available Inventory:** Calculated in real-time via `product_available_inventory` view

---

## 📝 Development Workflow

### Before Starting New Work

1. Read [REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md](REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md)
2. Check current priority (P1-P10)
3. Review [STOCK_MOVEMENTS_SPECIFICATION.md](STOCK_MOVEMENTS_SPECIFICATION.md) for technical details
4. Check archive for context on completed phases

### When Completing a Feature

1. Update this README.md (move from "Missing" to "Working")
2. Update STOCK_MOVEMENTS_SPECIFICATION.md status section
3. Update REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md progress
4. Create completion summary document if major milestone

### Testing Checklist

- [ ] Database migrations applied
- [ ] TypeScript types updated
- [ ] Service layer tested
- [ ] UI components functional
- [ ] Validation rules enforced
- [ ] Server actions secured
- [ ] RLS policies configured (when enabled)
- [ ] Polish document mapping correct

---

## 📚 Additional Resources

### Related Modules

- **Products** - `/src/modules/warehouse/products/`
- **Locations** - `/src/modules/warehouse/locations/`
- **Suppliers** - `/src/modules/warehouse/suppliers/`
- **Clients** - `/src/modules/warehouse/clients/`
- **Sales Orders** - `/src/modules/warehouse/sales-orders/` ✨ **NEW**

### Database Migrations

- **Movement Types:** `20251024043520_enhance_movement_types.sql`
- **Stock Movements:** `20251024120000_create_stock_movements_system.sql`
- **Soft Delete:** `20251026064408_add_soft_delete_to_movement_types.sql`
- **Receipts:** `20251103000000_add_receipt_documents_system.sql`
- **Sales Orders:** `20251112120000_create_sales_orders.sql` ✨ **NEW**
- **Reservations:** `20251112120001_enhance_stock_reservations_for_sales_orders.sql` ✨ **NEW**

### Key Files

- Types: `/src/modules/warehouse/types/movement-types.ts`
- Types: `/src/modules/warehouse/types/sales-orders.ts` ✨ **NEW**
- Types: `/src/modules/warehouse/types/reservations.ts` ✨ **NEW**
- Service: `/src/modules/warehouse/api/stock-movements-service.ts`
- Service: `/src/modules/warehouse/api/sales-orders-service.ts` ✨ **NEW**
- Service: `/src/modules/warehouse/api/reservations-service.ts` ✨ **NEW**
- Validation: `/src/modules/warehouse/api/movement-validation-service.ts`
- Components: `/src/modules/warehouse/movements/components/`
- Components: `/src/modules/warehouse/sales-orders/components/` ✨ **NEW**

---

## 🤝 Contributing

When working on stock movements:

1. Always check the current roadmap (REMAINING_MOVEMENTS)
2. Follow SAP-style movement type conventions
3. Maintain Polish legal compliance
4. Add comprehensive tests
5. Update documentation after completion

---

**Last Updated:** November 14, 2024
**Maintained By:** Development Team
**Questions?** See REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md or STOCK_MOVEMENTS_SPECIFICATION.md
