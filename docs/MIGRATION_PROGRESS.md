# Migration Progress Report

## Overview

This document tracks the progress of migrating the coreframe-boilerplate application to the new SSR-first architecture with React Query, server-side services, and co-located server actions.

**Started:** December 2, 2025  
**Target Completion:** 3-4 weeks

---

## Week 1: Foundation + Warehouse Module

### ✅ Days 1-2: Foundation (COMPLETED)

**Created Files:**

1. `src/server/schemas/common.ts` - Common Zod schemas for pagination, filters, sorting
2. `src/lib/utils/assert-auth.ts` - Authentication helpers (`assertAuth`, `getUserContext`)
3. `src/app/providers.tsx` - Already configured with React Query (verified)

**Status:** ✅ All foundation files created and type-checked successfully

---

### ✅ Day 3: Products Module Migration (COMPLETED)

#### Created Files:

**1. Schema (`src/server/schemas/products.schema.ts`)**

- Input validation schemas for creating/updating products
- Product filters schema with pagination
- Barcode schemas
- Type exports for TypeScript

**2. Service (`src/server/services/products.service.ts`)**

- Migrated from `src/modules/warehouse/api/products-service.ts`
- All methods converted to static methods
- Server-side Supabase client (no more client-side calls)
- Methods:
  - `getProducts()` - List with filters and pagination
  - `getProductById()` - Single product with details
  - `createProduct()` - Create new product
  - `updateProduct()` - Update existing product
  - `deleteProduct()` - Soft delete
  - `permanentlyDeleteProduct()` - Hard delete
  - `addBarcode()`, `removeBarcode()`, `setPrimaryBarcode()`, `getProductBarcodes()`

**3. Server Actions (`src/app/[locale]/dashboard/warehouse/products/_actions.ts`)**

- Co-located with the products route (following Next.js best practices)
- Direct auth checks using `getUserContext()` (no middleware)
- Zod validation before service calls
- Error handling with proper logging
- 10 server action functions matching all service methods

**4. React Query Hooks (`src/lib/hooks/queries/use-products.ts`)**

- `useProducts()` - Query hook for product list
- `useProduct()` - Query hook for single product
- `useCreateProduct()` - Mutation hook with cache invalidation
- `useUpdateProduct()` - Mutation hook with cache invalidation
- `useDeleteProduct()` - Mutation hook for soft delete
- `usePermanentlyDeleteProduct()` - Mutation hook for hard delete
- `useProductBarcodes()` - Query hook for product barcodes
- `useAddBarcode()`, `useRemoveBarcode()`, `useSetPrimaryBarcode()` - Barcode mutations
- All mutations include toast notifications (react-toastify)
- Proper cache invalidation after mutations

**Status:** ✅ All files created and type-checked successfully

---

### 🔄 Remaining Tasks for Week 1

#### Days 4-5: Complete Warehouse Module Migration

**22 services to migrate:**

1. ✅ products-service.ts (DONE)
2. ⏳ stock-movements-service.ts
3. ⏳ locations-service.ts (PRIORITY)
4. ⏳ suppliers-service.ts
5. ⏳ inventory-service.ts
6. ⏳ categories-service.ts
7. ⏳ units-service.ts
8. ⏳ movement-types-service.ts
9. ⏳ movement-validation-service.ts
10. ⏳ reservations-service.ts
11. ⏳ purchase-orders-service.ts
12. ⏳ sales-orders-service.ts
13. ⏳ receipt-service.ts
14. ⏳ product-branch-settings-service.ts
15. ⏳ product-groups-service.ts
16. ⏳ product-suppliers-service.ts
17. ⏳ variant-generation-service.ts
18. ⏳ option-groups-service.ts
19. ⏳ custom-fields-service.ts
20. ⏳ inter-warehouse-transfer-service.ts
21. ⏳ template-service.ts
22. ⏳ context-service.ts

**Additional Services:**

- ⏳ packaging-service.ts
- ⏳ replenishment-service.ts
- ⏳ stock-alerts-service.ts

**Priority Order:**

1. Locations (core inventory management)
2. Stock Movements (core transactions)
3. Suppliers (purchasing)
4. Inventory (stock tracking)
5. Categories & Units (supporting data)
6. Others as needed

---

## Week 2: Teams, Organization, News (PENDING)

- Teams/Contacts module
- Organization module
- News module

---

## Week 3: Support, Cleanup, SSR Optimization (PENDING)

- Support module
- Remove useSimpleSWR
- Remove client-side Supabase calls
- Delete old API folders
- Add SSR prefetching
- Optimize React Query config

---

## Week 4: Testing, Documentation, Final Polish (PENDING)

- Setup Playwright
- Write integration tests
- Update CLAUDE.md
- Create developer guide
- Performance audit
- Security audit

---

## Architecture Compliance Checklist

### ✅ Implemented Correctly:

- [x] React Query installed and configured
- [x] Common schemas for pagination and filters
- [x] `assertAuth()` helper (no middleware)
- [x] `getUserContext()` helper
- [x] Flat services structure (`src/server/services/`)
- [x] Co-located server actions with routes
- [x] Minimal Zod schemas (input validation only)
- [x] Static service methods (no instances)
- [x] Server-side Supabase client only in services
- [x] React Query hooks with proper cache invalidation
- [x] Toast notifications using react-toastify

### ⏳ To Be Verified:

- [ ] All components updated to use new hooks
- [ ] Old service files removed
- [ ] No client-side Supabase calls (except auth)
- [ ] SSR prefetching working
- [ ] Type safety end-to-end

---

## Files Created So Far

```
src/
├── server/
│   ├── schemas/
│   │   ├── common.ts                    ✅ Created
│   │   └── products.schema.ts           ✅ Created
│   └── services/
│       └── products.service.ts          ✅ Created
├── lib/
│   ├── utils/
│   │   └── assert-auth.ts               ✅ Created
│   └── hooks/
│       └── queries/
│           └── use-products.ts          ✅ Created
└── app/
    └── [locale]/
        └── dashboard/
            └── warehouse/
                └── products/
                    └── _actions.ts      ✅ Created
```

---

## Next Steps

1. **Migrate Locations Service** (highest priority for inventory management)
2. **Migrate Stock Movements Service** (core transaction system)
3. **Update Products Components** to use new hooks
4. **Test Products CRUD** operations end-to-end
5. **Continue with remaining warehouse services**

---

## Notes & Decisions

1. **Type Imports:** Using relative path `../../../supabase/types/types` instead of `@/supabase/types/types` due to tsconfig path mapping pointing to `src/utils/supabase/*`

2. **User Context:** Currently using placeholder values for `userRole` and `permissions` in `getUserContext()`. These will be fetched from database when needed for authorization.

3. **AppContext Refactoring:** Per review feedback, AppContext cleanup (removing business data like locations, suppliers, organizationUsers) is deferred to backlog (Issue #76) until after main migration is complete.

4. **Migration Strategy:** Big bang per module (not gradual) - each module is fully migrated before moving to the next.

5. **Service Pattern:** All services use static methods for simplicity. No service instances needed.

---

## Success Metrics (To Be Measured)

- **Code Reduction:** Target 95% duplication eliminated
- **Type Safety:** 100% end-to-end
- **SSR:** All pages server-rendered
- **Developer Speed:** <15 min per new endpoint
- **Bug Reduction:** 50% fewer auth/validation bugs

---

**Last Updated:** December 2, 2025  
**Status:** Week 1 Day 3 Complete - Products Module Migrated Successfully
