# Warehouse Stock Movements Documentation

## 📖 Quick Navigation

### 🎯 Current Status & Next Steps

- **[WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md](WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md)** ⭐ **START HERE** ✨ **UPDATED Nov 26, 2025**
  - **Overall completion: 65%**
  - Complete implementation status review
  - Critical blockers identified (transfers, PDFs, returns, RLS)
  - 4-week plan to production readiness
  - **Use this to understand what's done and what's next**

- **[REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md](REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md)** 📋 **Detailed Technical Roadmap**
  - Detailed implementation steps for each priority (P1-P10)
  - Technical specifications and code examples
  - Testing requirements and deliverables
  - **Use this when implementing specific features**

- **[FUTURE_ENHANCEMENTS.md](FUTURE_ENHANCEMENTS.md)** 💡 **Post-Production Features**
  - Advanced PDF Generation
  - Batch Purchase Orders
  - Supplier Analytics & Reporting
  - Mobile Warehouse App
  - E-commerce Integration Enhancements

- **[STOCK_MOVEMENTS_SPECIFICATION.md](STOCK_MOVEMENTS_SPECIFICATION.md)** - Technical Specification
  - Source of truth for movement types (31 codes: 101-613)
  - Database schema and Polish legal compliance
  - Business rules and validation logic
  - **Use this for technical reference**

### Historical Documents

- **[archive/](archive/)** - Completed phase summaries and old plans
  - PHASE_1_COMPLETION_SUMMARY.md (Movement types - Oct 24, 2024)
  - PHASE_2_IMPLEMENTATION_SUMMARY.md (Stock movements system - Oct 26, 2024)
  - SALES_ORDERS_AND_RESERVATIONS_COMPLETION_SUMMARY.md (Sales orders & reservations - Nov 14, 2024)
  - PURCHASE_ORDERS_COMPLETION_SUMMARY.md (Purchase orders & suppliers - Nov 16, 2024)
  - PURCHASE_ORDERS_AND_REORDER_IMPLEMENTATION_PLAN.md (Original plan)
  - SALES_ORDERS_AND_RESERVATIONS_PLAN.md (Original implementation plan)
  - STOCK_MOVEMENTS_IMPLEMENTATION_PLAN.md (Original detailed plan)
  - LOW_STOCK_MONITORING_IMPLEMENTATION_PLAN.md (Superseded by INVENTORY_REPLENISHMENT_SYSTEM_PLAN.md) ✨ **NEW**

---

## 🎯 Current Implementation Status

**Overall Progress:** 65% Complete (as of November 26, 2025)
**Status:** Operational for core functions, missing critical features for production

**See [WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md](WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md) for complete details.**

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
- ✅ `stock_reservations` - Active reservation tracking (hybrid model)
- ✅ `product_available_inventory` - Real-time available quantity view
- ✅ `sales_orders` - Customer orders with status workflow
- ✅ `sales_order_items` - Order line items with reservation links
- ✅ `product_suppliers` - Product-supplier relationships with pricing ✨ **NEW**
- ✅ `product_supplier_price_history` - Price change tracking ✨ **NEW**
- ✅ `purchase_orders` - Purchase orders with approval workflow ✨ **NEW**
- ✅ `purchase_order_items` - PO line items with receipt tracking ✨ **NEW**
- ✅ `receipt_documents` - Receipt document system (no PDF generation)
- ⚠️ Transfer tables exist but migrations are DISABLED

**Services & API**

- ✅ Movement types service
- ✅ Stock movements service (create, approve, complete)
- ✅ Movement validation service
- ✅ Receipt processing service
- ✅ Sales orders service (full CRUD, status workflow, reservation integration)
- ✅ Reservations service (hybrid model, availability validation)
- ✅ Product suppliers service (many-to-many relationships, pricing) ✨ **NEW**
- ✅ Purchase orders service (full CRUD, approval workflow, receipts) ✨ **NEW**
- ✅ Server actions with authentication

**UI Pages**

- ✅ `/dashboard/warehouse/movements` - Stock movements list and management
- ✅ `/dashboard/warehouse/inventory` - Real-time inventory dashboard
- ✅ `/dashboard/warehouse/sales-orders` - Sales orders list
- ✅ `/dashboard/warehouse/sales-orders/new` - Create sales order
- ✅ `/dashboard/warehouse/sales-orders/[id]` - Order details
- ✅ `/dashboard/warehouse/purchases` - Purchase orders list ✨ **NEW**
- ✅ `/dashboard/warehouse/purchases/new` - Create purchase order ✨ **NEW**
- ✅ `/dashboard/warehouse/purchases/[id]` - PO details with approval ✨ **NEW**

---

## ❌ What's Missing (50%)

### ✅ Recently Completed (November 14, 2024)

**Sales Orders & Reservations** - See [archive/SALES_ORDERS_AND_RESERVATIONS_COMPLETION_SUMMARY.md](archive/SALES_ORDERS_AND_RESERVATIONS_COMPLETION_SUMMARY.md)

- ✅ **Phase 1:** Sales Orders Module - Full UI and workflow
- ✅ **Phase 2:** Stock Reservations - Hybrid model with auto-reserve/release
- ✅ **Integration:** Real-time availability, overselling prevention

**Key Features Delivered:**

- Sales order management with full lifecycle (draft → confirmed → fulfilled)
- Automatic stock reservation on order confirmation
- Overselling prevention through real-time availability calculation
- Reservation release on cancellation or fulfillment
- Available quantity displayed throughout the system: `available = on_hand - reserved`
- Product details page shows reserved quantities
- Sales order form validates availability before submission

### ✅ Recently Completed (November 16, 2024)

**Purchase Orders & Product-Supplier Integration** - See [archive/PURCHASE_ORDERS_COMPLETION_SUMMARY.md](archive/PURCHASE_ORDERS_COMPLETION_SUMMARY.md)

- ✅ **Phase 0:** Product-Supplier Integration - Complete
- ✅ **Phase 2:** Purchase Orders Module - Complete

### ✅ Verified Complete (November 26, 2025) ✨ **NEW**

**Stock Alerts & Replenishment System** - See [WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md](WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md)

- ✅ **Per-warehouse product settings** (reorder points, min/max levels)
- ✅ **Automated stock alerts** with severity levels and status workflow
- ✅ **Alert dashboard** with metrics and suggested quantities
- ✅ **Warehouse-level monitoring** (branches = warehouses, locations = bins)
- ✅ **Integration with purchase orders** for replenishment

**Key Features Delivered:**

- Product-supplier many-to-many relationships with pricing/lead times
- Purchase order management with full lifecycle (draft → approved → received → closed)
- Automatic PO number generation and total calculation
- Item-level tracking with partial receipt support
- Cancellation tracking with reason display
- Product details integration showing pending PO quantities
- "Purchase Orders" tab in product details
- "Qty To be Invoiced" now functional with real data

### 🚨 Critical Gaps (Blocks Production Use)

**See [WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md](WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md) for complete gap analysis.**

1. **🔴 Warehouse Transfers** (Priority 1) - 2 weeks
   - Transfer tables DISABLED in migrations
   - Cannot move stock between locations/warehouses
   - Movement types 301-312 not functional

2. **🔴 PDF Document Generation** (Priority 2) - 1.5 weeks
   - Cannot print legal warehouse documents (PZ, WZ, MM, RW, INW, KP, KN)
   - Polish legal requirement not met
   - Documents ready but no PDF generation

3. **🔴 Returns & Reversals** (Priority 3) - 1 week
   - Cannot process customer returns
   - Cannot reverse movements
   - Movement types 102, 103, 202, 203 not functional

4. **🔴 Row-Level Security** (Priority 4) - 1 week
   - RLS intentionally disabled for testing
   - **MANDATORY before production deployment**
   - Security risk - no data isolation

### Important Features (Needed for Full Operations)

- **Returns Processing** (102-103, 202-203) - Customer and supplier returns
- **Internal Operations** (105, 205, 206, 411) - Waste, cost center allocation, initial stock
- **Damage Tracking** - Integrated with receipt workflow

### Optional/Future Features

- **E-commerce Integration** (601-613) - Shopify, WooCommerce, Allegro sync
- **Production Movements** (104, 204) - Manufacturing tracking
- **JPK_MAG Export** - Polish tax office electronic reporting

---

## 🚀 Next Steps (Immediate Actions)

**Full Roadmap:** [WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md](WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md)

### 🎯 Phase A: Critical MVP (4 weeks to production-ready)

1. 🚀 **Week 1: Warehouse Transfers** (Priority 1) **← START HERE**
   - Enable disabled migrations
   - Build transfer service and UI
   - Movement types: 301-312

2. **Weeks 2-3: PDF Document Generation** (Priority 2)
   - Install Puppeteer + Handlebars
   - Create 7 Polish document templates
   - Auto-generate on movement completion

3. **Week 4: Returns & Reversals** (Priority 3)
   - Returns processing (customer/supplier)
   - Movement reversals (102, 103, 202, 203)
   - Quality assessment workflow

### 🔒 Phase B: Security & Compliance (2 weeks before production)

4. **Week 5: Row-Level Security** (Priority 4 - MANDATORY)
   - Enable RLS on all tables
   - Create policies for org/branch isolation
   - Permission system implementation

5. **Week 6: JPK_MAG Export** (Priority 8)
   - Polish tax compliance
   - XML export per Ministry specification

### Phase 2: Full Operations (2 weeks)

5. **P5:** Returns & Reversals - 1 week ⭐⭐⭐⭐
6. **P6:** Internal Operations - 1 week ⭐⭐

### Phase 3: Advanced Features (3-4 weeks, optional)

7. **P7:** E-commerce Integration - 2-3 weeks ⭐⭐⭐
8. **P8:** Production Movements - 1 week ⭐⭐

### Phase 4: Pre-Production (2 weeks, mandatory)

9. **P9:** JPK_MAG Export - 1 week ⭐⭐⭐⭐⭐
10. **P10:** Row-Level Security - 1 week ⭐⭐⭐⭐⭐

**Total Timeline:**

- **4 weeks to production-ready** (Phase A - core operations)
- **6 weeks to fully secure and compliant** (Phase A + B)
- **7+ weeks to 100% complete** (all features)

**Post-Production Enhancements:** See [FUTURE_ENHANCEMENTS.md](FUTURE_ENHANCEMENTS.md) for features planned after initial release

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
3. **For P2 (Current):** Read [PURCHASE_ORDERS_AND_REORDER_IMPLEMENTATION_PLAN.md](PURCHASE_ORDERS_AND_REORDER_IMPLEMENTATION_PLAN.md)
4. Review [STOCK_MOVEMENTS_SPECIFICATION.md](STOCK_MOVEMENTS_SPECIFICATION.md) for technical details
5. Check archive for context on completed phases

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

**Last Updated:** November 26, 2025
**Status Document:** [WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md](WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md)
**Maintained By:** Development Team
**Questions?** See REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md or STOCK_MOVEMENTS_SPECIFICATION.md
