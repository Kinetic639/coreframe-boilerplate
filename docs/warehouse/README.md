# Warehouse Stock Movements Documentation

## 📖 Quick Navigation

### Active Documents

- **[REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md](REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md)** ⭐ **Current Roadmap**
  - Prioritized plan to complete remaining 60% of features
  - Detailed timelines and implementation steps (P1-P10)
  - **Use this for planning next development work**

- **[STOCK_MOVEMENTS_SPECIFICATION.md](STOCK_MOVEMENTS_SPECIFICATION.md)** - Technical Specification
  - Source of truth for movement types (31 codes: 101-613)
  - Database schema and Polish legal compliance
  - Business rules and validation logic
  - **Use this for technical reference**

### Historical Documents

- **[archive/](archive/)** - Completed phase summaries and old plans
  - PHASE_1_COMPLETION_SUMMARY.md (Movement types - Oct 24, 2024)
  - PHASE_2_IMPLEMENTATION_SUMMARY.md (Stock movements system - Oct 26, 2024)
  - STOCK_MOVEMENTS_IMPLEMENTATION_PLAN.md (Original detailed plan)

---

## 🎯 Current Implementation Status

**Overall Progress:** 40% Complete (as of November 2024)

### ✅ What Works Today

**Core Infrastructure (Phase 1 & 2 Complete)**

- ✅ 31 SAP-style movement types configured (codes 101-613)
- ✅ Stock movements database with full tracking
- ✅ Inventory calculation views (real-time stock levels)
- ✅ Movement approval workflow (pending → approved → completed)
- ✅ Soft delete with audit trail
- ✅ TypeScript types and service layer
- ✅ Basic UI (list, detail, create pages)

**Working Movement Types**

- ✅ **101:** Goods Receipt from Purchase Order (with basic delivery workflow)
- ✅ **201:** Goods Issue for Sales Order
- ✅ **401-403:** Inventory Adjustments (increase, decrease, revaluation)

**Database Tables**

- ✅ `movement_types` - 31 movement type definitions
- ✅ `stock_movements` - Movement transactions
- ✅ `stock_movement_items` - Line items with product/variant/quantity
- ✅ `stock_inventory` - Calculated inventory view
- ✅ `stock_reservations` - Reservation tracking (no UI yet)
- ✅ `receipt_documents` - Receipt document system (no PDF generation)
- ⚠️ Transfer tables exist but migrations are DISABLED

**Services & API**

- ✅ Movement types service
- ✅ Stock movements service (create, approve, complete)
- ✅ Movement validation service
- ✅ Receipt processing service
- ✅ Server actions with authentication

---

## ❌ What's Missing (60%)

### Critical Gaps (Blocks Production Use)

1. **🔴 No Stock Reservations UI** (Priority 1)
   - Tables exist but no user interface
   - Risk of overselling without reservation system
   - Estimated: 3-4 days

2. **🔴 No Automated Purchase Orders** (Priority 2)
   - Manual spreadsheet tracking still required
   - No low stock alerts or reorder automation
   - Estimated: 1.5 weeks

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

### Phase 1: Critical MVP (6 weeks)

1. **P1:** Stock Reservations (501-502) - 3-4 days ⭐⭐⭐⭐⭐
2. **P2:** Low Stock Alerts & Purchase Orders - 1.5 weeks ⭐⭐⭐⭐⭐
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

**Total Timeline:** 13-14 weeks to 100% completion

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

### Database Migrations

- **Movement Types:** `20251024043520_enhance_movement_types.sql`
- **Stock Movements:** `20251024120000_create_stock_movements_system.sql`
- **Soft Delete:** `20251026064408_add_soft_delete_to_movement_types.sql`
- **Receipts:** `20251103000000_add_receipt_documents_system.sql`

### Key Files

- Types: `/src/modules/warehouse/types/movement-types.ts`
- Service: `/src/modules/warehouse/api/stock-movements-service.ts`
- Validation: `/src/modules/warehouse/api/movement-validation-service.ts`
- Components: `/src/modules/warehouse/movements/components/`

---

## 🤝 Contributing

When working on stock movements:

1. Always check the current roadmap (REMAINING_MOVEMENTS)
2. Follow SAP-style movement type conventions
3. Maintain Polish legal compliance
4. Add comprehensive tests
5. Update documentation after completion

---

**Last Updated:** November 12, 2024
**Maintained By:** Development Team
**Questions?** See REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md or STOCK_MOVEMENTS_SPECIFICATION.md
