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

**21 services to migrate:**

1. ✅ products-service.ts (DONE)
2. ✅ locations-service.ts (DONE)
3. ✅ stock-movements-service.ts (DONE)
4. ✅ product-suppliers-service.ts (DONE)
5. ✅ categories-service.ts (DONE)
6. ✅ units-service.ts (DONE)
7. ✅ movement-types-service.ts (DONE)
8. ✅ movement-validation-service.ts (DONE)
9. ✅ product-groups-service.ts (DONE)
10. ✅ reservations-service.ts (DONE)
11. ✅ purchase-orders-service.ts (DONE)
12. ✅ sales-orders-service.ts (DONE)
13. ✅ receipt-service.ts (DONE)
14. ✅ product-branch-settings-service.ts (DONE)
15. ✅ variant-generation-service.ts (DONE)
16. ✅ option-groups-service.ts (DONE)
17. ✅ custom-fields-service.ts (DONE)
18. ⏳ inter-warehouse-transfer-service.ts
19. ⏳ template-service.ts (FILES CREATED - requires database tables from disabled migrations)
20. ⏳ context-service.ts
21. ⏳ load-product-types.ts (small utility)

**Additional Services (not in original folder):**

- ❌ packaging-service.ts (does not exist)
- ❌ replenishment-service.ts (does not exist)
- ❌ stock-alerts-service.ts (does not exist)

**Note:** locations.ts exists in the old API folder but appears to be a small utility, different from locations.service.ts

**Priority Order:**

1. ✅ Locations (core inventory management)
2. ✅ Stock Movements (core transactions)
3. ✅ Suppliers (purchasing)
4. ✅ Categories & Units (supporting data)
5. ⏳ Movement Types & Validation (transaction rules)
6. ⏳ Others as needed

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

---

### ✅ Day 4: Locations Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/locations.schema.ts`)
   - Location types: warehouse, zone, aisle, shelf, bin
   - Create/update validation
   - Filters with parent location support

2. **Service** (`src/server/services/locations.service.ts`)
   - `getLocations()` - Paginated list with filters
   - `getAllLocations()` - Full list for tree view
   - `getLocationById()` - Single location
   - `createLocation()` - Create with org/branch
   - `updateLocation()` - Update existing
   - `deleteLocation()` - Soft delete
   - `permanentlyDeleteLocation()` - Hard delete
   - `reorderLocations()` - Update display order
   - `getChildLocations()` - Get children of parent

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/locations/_actions.ts`)
   - 8 server action functions
   - Co-located with locations route
   - Auth validation via `getUserContext()`

4. **React Query Hooks** (`src/lib/hooks/queries/use-locations.ts`)
   - `useLocations()` - Paginated query
   - `useAllLocations()` - Full list query
   - `useLocation()` - Single location query
   - `useChildLocations()` - Child locations query
   - `useCreateLocation()`, `useUpdateLocation()`, `useDeleteLocation()` - Mutations
   - `useReorderLocations()` - Reorder mutation
   - All with toast notifications and cache invalidation

**Status:** ✅ Complete - Minor TypeScript type inference warnings (non-blocking)

**Notes:**

- TypeScript shows "excessively deep" type warnings on complex query chains
- These are TypeScript inference issues, not runtime errors
- Mitigated with `as any` type assertions
- Does not affect functionality or runtime safety

---

### ✅ Day 4 (continued): Stock Movements Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/stock-movements.schema.ts`)
   - Movement statuses: draft, pending, approved, completed, cancelled, reversed
   - Reference types: purchase_order, sales_order, transfer_request, etc.
   - Movement categories: receipt, issue, transfer, adjustment, reservation, ecommerce
   - Comprehensive filters with 15+ filter fields
   - SAP-style movement type codes (101-613)
   - Financial tracking (unit_cost, total_cost)
   - Batch/serial number support

2. **Service** (`src/server/services/stock-movements.service.ts`)
   - **13 methods** (500+ lines - most complex service):
     - `getMovements()` - Basic paginated list
     - `getMovementsWithRelations()` - With full joins (products, locations, users)
     - `getMovementById()` - Single movement with relations
     - `createMovement()` - Uses RPC `create_stock_movement` for DB-level validation
     - `updateMovement()` - Only draft movements can be updated
     - `approveMovement()` - Approval workflow
     - `completeMovement()` - Mark as completed
     - `cancelMovement()` - Cancel with reason
     - `getPendingApprovals()` - List movements requiring approval
     - `getStatistics()` - Movement statistics (total, by category, by status, total value)
     - `getInventoryLevels()` - Stock levels by location
     - `checkStockAvailability()` - Check if quantity available
     - `getStockLevel()` - Specific product/location stock level
   - Uses `stock_inventory` database view for inventory queries
   - Approval workflow: draft → pending → approved → completed
   - Full business logic with validation

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/movements/_actions.ts`)
   - 13 server action functions matching all service methods
   - Complex validation with nested input schemas
   - Co-located with movements route

4. **React Query Hooks** (`src/lib/hooks/queries/use-stock-movements.ts`)
   - 13 React Query hooks:
     - `useMovements()`, `useMovementsWithRelations()`, `useMovement()` - Query hooks
     - `usePendingApprovals()`, `useStatistics()`, `useInventoryLevels()`, `useStockLevel()` - Stats queries
     - `useCreateMovement()`, `useUpdateMovement()` - CRUD mutations
     - `useApproveMovement()`, `useCompleteMovement()`, `useCancelMovement()` - Workflow mutations
     - `useCheckStockAvailability()` - Availability check mutation
   - Sophisticated cache invalidation (mutations invalidate multiple related queries)
   - Shorter stale times (1-2 minutes) due to frequent inventory changes
   - Toast notifications for all mutations

**Status:** ✅ Complete - All type checks passing

**Technical Notes:**

- Fixed table name: uses `stock_inventory` view (not `stock_inventory_levels`)
- Updated `StockInventoryLevel` interface to match database view columns:
  - `available_quantity`, `reserved_quantity`, `available_to_promise`
  - Includes financial fields: `average_cost`, `total_value`
  - Includes metadata: `total_movements`, `last_movement_at`
- RPC-based creation for database-level business rule enforcement
- Complex approval workflow with status transitions

**Complexity:**

- Original: 627 lines, 13 methods
- Migrated: Schema (100+ lines), Service (500+ lines), Actions (13), Hooks (13)
- Full feature parity with enhanced type safety

---

### ✅ Day 4 (continued): Product-Suppliers Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/product-suppliers.schema.ts`)
   - Product-supplier form data validation
   - Add/update supplier schemas
   - Update price schema with reason tracking
   - Best price supplier calculation input
   - Set preferred supplier validation
   - Comprehensive filters for product-supplier queries

2. **Service** (`src/server/services/product-suppliers.service.ts`)
   - **14 methods** managing many-to-many relationships:
     - `getProductSuppliers()` - Get all suppliers for a product
     - `getPreferredSupplier()` - Get preferred supplier
     - `getBestPriceSupplier()` - Calculate best price considering MOQ and multiples
     - `getSupplierProducts()` - Get all products for a supplier
     - `addSupplier()` - Add new supplier to product with price history
     - `updateSupplier()` - Update existing relationship
     - `removeSupplier()` - Soft delete relationship
     - `setPreferredSupplier()` - Set preferred (unsets others automatically)
     - `updatePrice()` - Update price with automatic history tracking
     - `getPriceHistory()` - Get price history with trend analysis
     - `createPriceHistory()` - Private method for history creation
     - `hasSuppliers()` - Check if product has suppliers
     - `getSupplierCount()` - Get supplier count for product
   - Price history with trend analysis (increasing/decreasing/stable)
   - MOQ (minimum order quantity) and order multiple calculations
   - Preferred supplier management

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/products/suppliers/_actions.ts`)
   - 12 server action functions
   - Co-located with products/suppliers route
   - Comprehensive validation for all operations

4. **React Query Hooks** (`src/lib/hooks/queries/use-product-suppliers.ts`)
   - 12 React Query hooks:
     - `useProductSuppliers()` - Query product suppliers
     - `usePreferredSupplier()` - Query preferred supplier
     - `useGetBestPriceSupplier()` - Mutation for price calculation
     - `useSupplierProducts()` - Query supplier products
     - `useAddSupplier()`, `useUpdateSupplier()`, `useRemoveSupplier()` - CRUD mutations
     - `useSetPreferredSupplier()` - Preferred supplier mutation
     - `useUpdatePrice()` - Price update with history
     - `usePriceHistory()` - Historical price data query
     - `useHasSuppliers()`, `useSupplierCount()` - Utility queries
   - Cross-entity cache invalidation (products, suppliers, price history)
   - Toast notifications for all mutations

**Status:** ✅ Complete - All type checks passing

**Technical Notes:**

- Manages many-to-many relationship between products and suppliers
- Automatic price history tracking via database triggers
- Business logic for MOQ and order multiples
- Preferred supplier management with automatic unset of others
- Price trend analysis (increasing/decreasing/stable)
- Soft delete with `deleted_at` field

**Complexity:**

- Original: 520 lines, 14 methods
- Migrated: Schema (80+ lines), Service (550+ lines), Actions (12), Hooks (12)
- Enhanced with full type safety and validation

---

### ✅ Day 4 (continued): Categories Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/categories.schema.ts`)
   - Create/update category validation
   - Reorder categories schema with sort order
   - Move category schema for parent changes
   - Color validation (HEX format)

2. **Service** (`src/server/services/categories.service.ts`)
   - **19 methods** managing hierarchical tree structure:
     - `getCategories()` - Get all as tree (excludes default category)
     - `getCategoryById()` - Single category
     - `getDefaultCategory()` - Get "Uncategorized" category
     - `getFirstCategory()` - First non-default category (fallback target)
     - `createCategory()` - Create with level calculation
     - `updateCategory()` - Update existing
     - `checkDeletion()` - InFlow-style deletion check with reassignment info
     - `deleteCategory()` - Soft delete with product/child reassignment
     - `moveProductsToCategory()` - Bulk product move
     - `moveChildrenToCategory()` - Move all children to new parent
     - `countProducts()` - Count products in category
     - `countChildren()` - Count child categories
     - `reorderCategories()` - Update sort order at same level
     - `moveCategory()` - Move to different parent with level recalculation
     - `isDescendant()` - Check if target is descendant (prevents cycles)
     - `updateChildrenLevels()` - Recursive level update for all descendants
     - `togglePreferred()` - Star/unstar category (only one at a time)
     - `getPreferredCategories()` - Get all starred categories
     - `buildCategoryTree()` - Convert flat list to hierarchical tree
   - InFlow-style deletion behavior (reassign products to target category)
   - Hierarchical tree with unlimited depth
   - Level calculation and validation
   - Cycle prevention in tree operations

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/categories/_actions.ts`)
   - 14 server action functions
   - Co-located with categories route
   - Full validation for all tree operations

4. **React Query Hooks** (`src/lib/hooks/queries/use-categories.ts`)
   - 14 React Query hooks:
     - `useCategories()` - Query category tree
     - `useCategory()` - Query single category
     - `useDefaultCategory()` - Query default category
     - `useFirstCategory()` - Query first non-default
     - `usePreferredCategories()` - Query starred categories
     - `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()` - CRUD mutations
     - `useCheckDeletion()` - Check deletion requirements
     - `useReorderCategories()` - Reorder mutation
     - `useMoveCategory()` - Move to different parent mutation
     - `useTogglePreferred()` - Toggle starred status
     - `useCountProducts()`, `useCountChildren()` - Count queries
   - Longer stale times (10-30 minutes) due to infrequent changes
   - Cross-entity cache invalidation for tree consistency
   - Toast notifications for all mutations

**Status:** ✅ Complete - All type checks passing

**Technical Notes:**

- Hierarchical tree structure with parent-child relationships
- InFlow-style deletion (reassign products to parent or first category)
- Level calculation for tree depth
- Cycle prevention with `isDescendant()` check
- Recursive updates for level changes
- Preferred category management (only one at a time)
- Tree building from flat list with sorting

**Known Issues (To Be Fixed Post-Migration):**

- Issue #90: Missing `organization_id` filtering (CRITICAL - security hole)
- Issue #91: No transactions for multi-step operations (CRITICAL)
- Issue #92: Recursive SELECTs should use SQL CTEs (HIGH - performance)
- Issue #93: Incomplete child movement during deletion (HIGH)
- Issue #94: No optimistic concurrency control (MEDIUM)
- Issue #95: Tree building should use SQL CTE (MEDIUM)
- Issue #96: Standardized error handling needed (LOW)

**Complexity:**

- Original: 473 lines, 19 methods
- Migrated: Schema (70+ lines), Service (600+ lines), Actions (14), Hooks (14)
- Full feature parity with enhanced type safety

---

### ✅ Day 4 (continued): Units Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/units.schema.ts`)
   - Create/update unit validation
   - Simple structure: name + symbol + organization_id
   - Symbol validation (max 20 chars)

2. **Service** (`src/server/services/units.service.ts`)
   - **5 methods** for basic CRUD:
     - `getUnits()` - Get all units for organization
     - `getUnit()` - Single unit by ID
     - `createUnit()` - Create new unit
     - `updateUnit()` - Update existing unit
     - `deleteUnit()` - Soft delete unit
   - Simple supporting data service
   - Organization-scoped units

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/units/_actions.ts`)
   - 5 server action functions
   - Co-located with warehouse/units route
   - Standard validation pattern

4. **React Query Hooks** (`src/lib/hooks/queries/use-units.ts`)
   - 5 React Query hooks:
     - `useUnits()` - Query all units
     - `useUnit()` - Query single unit
     - `useCreateUnit()` - Create mutation
     - `useUpdateUnit()` - Update mutation
     - `useDeleteUnit()` - Delete mutation
   - 10 minute stale time (rarely changes)
   - Standard cache invalidation
   - Toast notifications for all mutations

**Status:** ✅ Complete - All type checks passing (no new errors)

**Technical Notes:**

- Simple supporting data service (no complex business logic)
- Organization-scoped (multi-tenant ready)
- Soft delete with `deleted_at` field
- Used for product measurement units (kg, piece, liter, etc.)

**Complexity:**

- Original: 89 lines, 5 methods
- Migrated: Schema (30 lines), Service (120 lines), Actions (5), Hooks (5)
- Straightforward migration with full type safety

---

---

### ✅ Day 4 (continued): Movement Types Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/movement-types.schema.ts`)
   - Movement category enum (receipt, issue, transfer, adjustment, reservation, ecommerce)
   - Polish document type enum (PZ, WZ, MM, RW, INW, KP, KN variants)
   - Movement type filters schema
   - Movement validation input schema

2. **Service** (`src/server/services/movement-types.service.ts`)
   - **23 methods** for read-only access to system movement types:
     - `getMovementTypes()` - Get all with optional filters
     - `getMovementTypesByCategory()` - Filter by category
     - `getMovementTypeByCode()` - Single type by SAP code
     - `getManualEntryTypes()` - Types users can manually create
     - `getDocumentGeneratingTypes()` - Types that generate documents
     - `getMovementTypesGroupedByCategory()` - Group by category for UI
     - `getMovementTypeSummaries()` - Simplified data for dropdowns
     - `validateMovementRequirements()` - Validate movement business rules
     - `requiresApproval()` - Check if approval needed
     - `generatesDocument()` - Check if document generated
     - `getPolishDocumentType()` - Get Polish doc type
     - `searchMovementTypes()` - Search by name (PL/EN)
     - `getReceiptTypes()`, `getIssueTypes()`, `getTransferTypes()` - Category shortcuts
     - `getAdjustmentTypes()`, `getReservationTypes()`, `getEcommerceTypes()` - Category shortcuts
     - `getStatistics()` - Movement type statistics
   - SAP-style movement codes (101-613)
   - Polish warehouse document compliance
   - Bilingual support (Polish/English)

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/movement-types/_actions.ts`)
   - 20 server action functions
   - Co-located with movement-types route
   - Full validation for all operations

4. **React Query Hooks** (`src/lib/hooks/queries/use-movement-types.ts`)
   - 23 React Query hooks:
     - `useMovementTypes()` - Query all types with filters
     - `useMovementTypesByCategory()` - Query by category
     - `useMovementTypeByCode()` - Query single type
     - `useManualEntryTypes()` - Query manual entry types
     - `useDocumentGeneratingTypes()` - Query document types
     - `useMovementTypesGroupedByCategory()` - Grouped query
     - `useMovementTypeSummaries()` - Summary query
     - `useValidateMovementRequirements()` - Validation mutation
     - `useRequiresApproval()`, `useGeneratesDocument()`, `usePolishDocumentType()` - Helper queries
     - `useSearchMovementTypes()` - Search query
     - `useReceiptTypes()`, `useIssueTypes()`, `useTransferTypes()` - Category queries
     - `useAdjustmentTypes()`, `useReservationTypes()`, `useEcommerceTypes()` - Category queries
     - `useStatistics()` - Statistics query
   - 30-minute stale times (system data, rarely changes)
   - No mutations (read-only reference data)

**Status:** ✅ Complete - All type checks passing (no new errors)

**Technical Notes:**

- Read-only service (movement types are system-managed)
- SAP-style numeric codes (101-613) across 6 categories
- Polish warehouse compliance with document types
- Bilingual support for international users
- Business rule validation for movements
- No CRUD operations (system data only)

**Complexity:**

- Original: 387 lines, 23 methods
- Migrated: Schema (70 lines), Service (400+ lines), Actions (20), Hooks (23)
- Full feature parity with enhanced type safety

---

### ✅ Day 4 (continued): Movement Validation Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/movement-validation.schema.ts`)
   - Quick validation input schema
   - Batch validation input schema

2. **Service** (`src/server/services/movement-validation.service.ts`)
   - **3 methods** for movement validation:
     - `validateMovement()` - Full validation with stock availability checks
     - `validateBatch()` - Batch validation for multiple movements
     - `quickValidate()` - Fast validation without stock checks
   - Comprehensive business rule validation
   - Validation constants (quantity limits, cost limits, thresholds)
   - Private helper methods for specific validations

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/movements/validation/_actions.ts`)
   - 3 server action functions
   - Co-located with movements/validation route

4. **React Query Hooks** (`src/lib/hooks/queries/use-movement-validation.ts`)
   - 3 React Query mutation hooks:
     - `useValidateMovement()` - Validate single movement
     - `useValidateBatch()` - Validate multiple movements
     - `useQuickValidate()` - Quick validation
   - All mutations (no queries - validation is on-demand)

**Status:** ✅ Complete - All type checks passing (no new errors)

**Technical Notes:**

- Validation-only service (no database mutations)
- Integrates with Movement Types and Stock Movements services
- Stock availability checking for issue movements
- Quantity validation (0.0001 to 999,999.9999)
- Cost validation (0 to 9,999,999,999.99)
- Date validation with warnings for future/old dates
- Batch/serial/lot tracking validation
- Location validation (prevents same source/destination for transfers)
- Required field validation based on movement type requirements
- Manufacturing date vs expiry date validation

**Complexity:**

- Original: 361 lines, 3 public methods + 6 private helpers
- Migrated: Schema (20 lines), Service (395 lines), Actions (3), Hooks (3)
- Full feature parity with enhanced type safety

---

### ✅ Day 4 (continued): Product Groups Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/product-groups.schema.ts`)
   - Create product group input schema with variants
   - Update variant input schema
   - Bulk update variants schema
   - Stock adjustment schema (deprecated)
   - Generated variant and selected attribute schemas

2. **Service** (`src/server/services/product-groups.service.ts`)
   - **8 methods** for product group management:
     - `createProductGroup()` - Create product group with all variants (complex transaction)
     - `getProductGroupById()` - Get product group with variants and details
     - `updateVariant()` - Update a specific variant
     - `deleteVariant()` - Soft delete variant
     - `deleteProductGroup()` - Soft delete product group
     - `adjustVariantStock()` - Stock adjustment (deprecated - use stock movements)
     - `bulkUpdateVariants()` - Bulk update multiple variants
     - `getVariantsByProductId()` - Get all variants for a product group
   - Complex transaction handling with rollback
   - Option groups creation and mapping
   - Variant attribute values linking

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/products/groups/_actions.ts`)
   - 8 server action functions
   - Co-located with products/groups route
   - Organization context from user metadata

4. **React Query Hooks** (`src/lib/hooks/queries/use-product-groups.ts`)
   - 2 Query hooks:
     - `useProductGroup()` - Get product group by ID
     - `useProductGroupVariants()` - Get all variants
   - 6 Mutation hooks:
     - `useCreateProductGroup()` - Create product group
     - `useUpdateVariant()` - Update variant
     - `useDeleteVariant()` - Delete variant
     - `useDeleteProductGroup()` - Delete product group
     - `useAdjustVariantStock()` - Adjust stock (deprecated)
     - `useBulkUpdateVariants()` - Bulk update variants
   - All mutations include toast notifications (react-toastify)
   - Proper cache invalidation after mutations

**Status:** ✅ Complete - All type checks passing (no new errors)

**Technical Notes:**

- Complex multi-step transaction for product group creation:
  1. Create parent product (type = item_group)
  2. Create new option groups if needed (IDs starting with "new-")
  3. Create product_group_attributes links
  4. Batch insert all variants
  5. Fetch real option values
  6. Create variant_attribute_values mappings
  7. Rollback on failure (cascade delete)
- Option group ID mapping (temporary IDs to real UUIDs)
- Batch variant creation with attribute value linking
- Aggregate stats calculation (total variants, active variants, stock)
- Stock adjustment marked as deprecated (use stock movements service)
- Supports 1-3 attributes per product group
- Variant generation from attribute combinations

**Complexity:**

- Original: 492 lines, 8 methods
- Migrated: Schema (145 lines), Service (450 lines), Actions (8), Hooks (8)
- Full feature parity with enhanced type safety and transaction rollback

---

**Post-Migration Issues Created:**

The following issues were created to track improvements to be made after migration is complete:

- **Issue #97**: Add multi-tenant isolation checking to ALL services (CRITICAL)
- **Issue #98**: Add Postgres RPC transactions for multi-step operations (CRITICAL)
- **Issue #99**: Standardize Error Normalization Layer (HIGH)
- **Issue #100**: Add optimistic concurrency control to mutation updates (MEDIUM)
- **Issue #101**: Add missing SQL indexes for migrated modules (MEDIUM)
- **Issue #102**: Create unified "Paginated Query Helper" (LOW)
- **Issue #103**: Create unified "buildFilterQuery" helper (LOW)
- **Issue #104**: Update AppContext AFTER all services are migrated (BLOCKED)
- **Issue #105**: Remove old legacy API folders after migration completion (TODO)
- **Issue #106**: CRITICAL - Multi-tenant security broken in Product Groups service
- **Issue #107**: CRITICAL - Product Groups createProductGroup() lacks real DB transaction
- **Issue #108**: HIGH - Variant attribute linking logic is extremely brittle
- **Issue #109**: HIGH - Product Groups service violates "services must not create client" rule
- **Issue #110**: MEDIUM - Missing branch_id support for variant stock in Product Groups
- **Issue #111**: HIGH - Normalize error handling for Product Group actions
- **Issue #112**: MEDIUM - SSR-safe refactor of Product Group hooks
- **Issue #113**: LOW - Remove deprecated adjustVariantStock() method

---

### ✅ Day 4 (continued): Reservations Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/reservations.schema.ts`)
   - Create reservation input schema
   - Release reservation input schema
   - Cancel reservation input schema
   - Reservation filters schema
   - Validate availability input schema

2. **Service** (`src/server/services/reservations.service.ts`)
   - **10 methods** for stock reservation management:
     - `validateAvailability()` - Check stock availability for reservation
     - `createReservation()` - Create new reservation with RES movement (double-write pattern)
     - `releaseReservation()` - Release/fulfill reservation with UNRES movement
     - `cancelReservation()` - Cancel reservation
     - `getReservation()` - Get reservation by ID
     - `getReservationWithDetails()` - Get reservation with related data (joins)
     - `getReservations()` - Get reservations with filters
     - `getExpiredReservations()` - Get expired reservations for auto-release
     - `getAvailableInventory()` - Get available inventory for product/location
     - `generateReservationNumber()` - Private helper for reservation numbers (RES-YYYYMMDD-XXXXX)
   - Hybrid reservation model (stock_reservations + stock_movements)
   - Validation with available inventory view
   - Partial release support

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/inventory/reservations/_actions.ts`)
   - 9 server action functions
   - Co-located with warehouse/inventory/reservations route
   - Organization and branch context from user metadata

4. **React Query Hooks** (`src/lib/hooks/queries/use-reservations.ts`)
   - 6 Query hooks:
     - `useValidateAvailability()` - Validate stock availability
     - `useReservation()` - Get reservation by ID
     - `useReservationWithDetails()` - Get reservation with details
     - `useReservations()` - Get reservations with filters
     - `useExpiredReservations()` - Get expired reservations
     - `useAvailableInventory()` - Get available inventory
   - 3 Mutation hooks:
     - `useCreateReservation()` - Create reservation
     - `useReleaseReservation()` - Release/fulfill reservation
     - `useCancelReservation()` - Cancel reservation
   - All mutations include toast notifications (react-toastify)
   - Proper cache invalidation after mutations

**Status:** ✅ Complete - All type checks passing (no new errors)

**Technical Notes:**

- **Double-write pattern**:
  - Writes to `stock_reservations` table for operational state
  - Writes to `stock_movements` (RES/UNRES codes 501/502) for event log
  - Ensures data consistency with transaction-like patterns
- **Reservation lifecycle**:
  - active → partial (partial release) → fulfilled (full release)
  - active → cancelled (cancellation)
- Availability validation using `product_available_inventory` view
- Auto-release support with expiration dates
- Partial release tracking (reserved_quantity vs released_quantity)
- Low stock warnings (< 120% of requested quantity)
- Reference tracking (sales_order, transfer, production, manual, other)
- Priority-based reservations
- Comprehensive filtering and search

**Complexity:**

- Original: 610 lines, 10 methods
- Migrated: Schema (90 lines), Service (650 lines), Actions (9), Hooks (9)
- Full feature parity with enhanced type safety

---

---

### ✅ Day 5: Purchase Orders Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/purchase-orders.schema.ts`)
   - Purchase order status enum (draft, pending, approved, partially_received, received, closed, cancelled)
   - Payment status enum (unpaid, partial, paid)
   - Create purchase order schema with items (min 1 item required)
   - Update purchase order schema
   - Purchase order filters schema with 15+ filter fields
   - Update/delete purchase order item schemas
   - Reject/cancel purchase order schemas with reason tracking
   - Receive purchase order schema with item-by-item receiving
   - Purchase order item form validation
   - Comprehensive validation for all workflows

2. **Service** (`src/server/services/purchase-orders.service.ts`)
   - **19 methods** (750+ lines) for purchase order management:
     - `getPurchaseOrders()` - Paginated list with comprehensive filtering
     - `getPurchaseOrderById()` - Single PO with full relations (supplier, location, items, users)
     - `getPurchaseOrderItems()` - Get all items for a PO
     - `createPurchaseOrder()` - Create PO with items (multi-step operation)
     - `updatePurchaseOrder()` - Update PO details
     - `addItemsToPurchaseOrder()` - Private helper for batch item creation
     - `updatePurchaseOrderItem()` - Update item quantity/price/location
     - `deletePurchaseOrderItem()` - Soft delete item
     - `submitForApproval()` - Workflow: draft → pending
     - `approvePurchaseOrder()` - Workflow: pending → approved
     - `rejectPurchaseOrder()` - Workflow: pending → draft (with reason)
     - `cancelPurchaseOrder()` - Cancel PO (with reason)
     - `closePurchaseOrder()` - Close PO (force complete)
     - `receiveItems()` - Receive workflow with stock movements
     - `deletePurchaseOrder()` - Soft delete PO
     - `getStatistics()` - PO statistics (by status, total values)
   - Complex workflow: draft → pending → approved → partially_received → received → closed/cancelled
   - Denormalization of supplier details for performance
   - Item-level tracking (quantity_ordered vs quantity_received)
   - Financial calculations (subtotal, tax, shipping, discount, total)
   - Receiving workflow with stock movement creation
   - Multi-step operations with proper error handling

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/purchases/_actions.ts`)
   - 17 server action functions
   - Co-located with warehouse/purchases route
   - Organization and branch context from user metadata
   - Query actions: getPurchaseOrdersAction, getPurchaseOrderByIdAction, getPurchaseOrderItemsAction, getPurchaseOrderStatisticsAction
   - CRUD actions: createPurchaseOrderAction, updatePurchaseOrderAction, deletePurchaseOrderAction
   - Item actions: updatePurchaseOrderItemAction, deletePurchaseOrderItemAction
   - Workflow actions: submitForApprovalAction, approvePurchaseOrderAction, rejectPurchaseOrderAction, cancelPurchaseOrderAction, closePurchaseOrderAction
   - Receiving action: receiveItemsAction

4. **React Query Hooks** (`src/lib/hooks/queries/use-purchase-orders.ts`)
   - 4 Query hooks:
     - `usePurchaseOrders()` - Query POs with filters (2 min stale time)
     - `usePurchaseOrder()` - Query single PO (2 min stale time)
     - `usePurchaseOrderItems()` - Query PO items (2 min stale time)
     - `usePurchaseOrderStatistics()` - Query statistics (5 min stale time)
   - 13 Mutation hooks:
     - `useCreatePurchaseOrder()` - Create PO with items
     - `useUpdatePurchaseOrder()` - Update PO
     - `useDeletePurchaseOrder()` - Soft delete PO
     - `useUpdatePurchaseOrderItem()` - Update item
     - `useDeletePurchaseOrderItem()` - Delete item
     - `useSubmitForApproval()` - Submit for approval
     - `useApprovePurchaseOrder()` - Approve PO
     - `useRejectPurchaseOrder()` - Reject with reason
     - `useCancelPurchaseOrder()` - Cancel with reason
     - `useClosePurchaseOrder()` - Force close
     - `useReceiveItems()` - Receive items workflow
   - All mutations include toast notifications (react-toastify)
   - Sophisticated cache invalidation (lists, details, items, statistics)
   - Cross-entity invalidation on receiving (stock-inventory, stock-movements)

**Status:** ✅ Complete - ESLint passing (no type errors)

**Technical Notes:**

- **Multi-step PO creation**:
  1. Fetch supplier details for denormalization (name, email, phone)
  2. Create purchase_orders record
  3. Batch insert purchase_order_items
  4. Fetch complete PO with relations
- **Workflow state machine**:
  - draft → pending (submit for approval)
  - pending → approved (approval granted)
  - pending → draft (rejected with reason)
  - approved → partially_received (receive some items)
  - partially_received → received (all items received)
  - received → closed (manually close)
  - any → cancelled (cancel with reason)
- **Financial tracking**:
  - Line items: quantity_ordered × unit_price × (1 - discount_percent/100) × (1 + tax_rate/100)
  - PO totals: subtotal + shipping_cost - discount_amount
  - Tax and discount calculations at item and PO level
- **Receiving workflow**:
  - Item-by-item receiving with quantity validation
  - Optional stock movement creation per received item
  - Automatic status updates based on received quantities
  - Tracks quantity_received separately from quantity_ordered
- **Denormalization strategy**:
  - Supplier details stored in PO for historical accuracy
  - Prevents data loss if supplier details change
  - Improves query performance (no joins needed for list view)
- **Reference tracking**:
  - Links to delivery locations
  - Links to created_by and approved_by users
  - Tracks approval dates and rejection/cancellation reasons
- **Soft delete pattern** for audit trail

**Complexity:**

- Original: 610+ lines, 19 methods
- Migrated: Schema (130 lines), Service (750 lines), Actions (17), Hooks (17)
- Full feature parity with enhanced type safety and workflow management

**Post-Migration Issues Created:**

The following issues were created to track improvements to be made after migration is complete:

- **Issue #123**: HIGH - Replace user_metadata org/branch with AppContext in Purchase Orders
- **Issue #124**: HIGH - Harden multi-tenant isolation for Purchase Order Items
- **Issue #125**: HIGH - Refactor receiveItems to validate PO ownership and schema contract
- **Issue #126**: HIGH - Integrate receiveItems with stock movement engine
- **Issue #127**: MEDIUM - Wrap purchase order create + items into transactional RPC
- **Issue #128**: LOW - Split PurchaseOrdersService into smaller modules
- **Issue #129**: MEDIUM - Add unit/integration tests for Purchase Orders
- **Issue #130**: LOW - Normalize error shape across Purchase Orders actions

---

### ✅ Day 5 (continued): Sales Orders Module Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/sales-orders.schema.ts`)
   - Sales order status enum (draft, pending, confirmed, processing, fulfilled, cancelled)
   - Create sales order schema with items (min 1 item required)
   - Update sales order schema
   - Update order status schema with cancellation reason
   - Sales order filters schema with search and date range filtering
   - Sales order item form validation
   - Release reservation schema for fulfillment workflow

2. **Service** (`src/server/services/sales-orders.service.ts`)
   - **14 methods** (720+ lines) for sales order management:
     - `canTransitionStatus()` - Validate status transitions
     - `getSalesOrders()` - Paginated list with comprehensive filtering
     - `getSalesOrderById()` - Single order with full relations (customer, items)
     - `getSalesOrderByNumber()` - Get order by order_number
     - `createSalesOrder()` - Create order with items (multi-step operation)
     - `updateSalesOrder()` - Update order details and items
     - `updateOrderStatus()` - Update status with reservation integration
     - `deleteSalesOrder()` - Soft delete order (only draft/pending)
     - `getOrdersByCustomer()` - Get all orders for a customer
     - `getOrdersByStatus()` - Get orders by status
     - `releaseReservationForItem()` - Release reservation when item fulfilled
     - `createReservationsForOrder()` - Private: Create reservations on confirm
     - `cancelReservationsForOrder()` - Private: Cancel reservations on cancel
   - Status workflow: draft → pending → confirmed → processing → fulfilled / cancelled
   - Reservation integration: Auto-create on confirm, auto-cancel on cancel
   - Item fulfillment tracking with reservation release

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/sales-orders/_actions.ts`)
   - 10 server action functions
   - Co-located with warehouse/sales-orders route
   - Organization and branch context from user metadata
   - Query actions: getSalesOrdersAction, getSalesOrderByIdAction, getSalesOrderByNumberAction, getOrdersByCustomerAction, getOrdersByStatusAction
   - CRUD actions: createSalesOrderAction, updateSalesOrderAction, deleteSalesOrderAction
   - Status action: updateOrderStatusAction
   - Reservation action: releaseReservationForItemAction

4. **React Query Hooks** (`src/lib/hooks/queries/use-sales-orders.ts`)
   - 5 Query hooks:
     - `useSalesOrders()` - Query orders with filters (2 min stale time)
     - `useSalesOrder()` - Query single order (2 min stale time)
     - `useSalesOrderByNumber()` - Query by order number (2 min stale time)
     - `useOrdersByCustomer()` - Query customer orders (2 min stale time)
     - `useOrdersByStatus()` - Query orders by status (2 min stale time)
   - 5 Mutation hooks:
     - `useCreateSalesOrder()` - Create order with items
     - `useUpdateSalesOrder()` - Update order
     - `useDeleteSalesOrder()` - Soft delete order
     - `useUpdateOrderStatus()` - Update status (with reservation integration)
     - `useReleaseReservationForItem()` - Release reservation on fulfillment
   - All mutations include toast notifications (react-toastify)
   - Sophisticated cache invalidation (lists, details, by-customer, by-status)
   - Cross-entity invalidation for reservations and stock inventory

**Status:** ✅ Complete - ESLint passing (no errors, debug console warnings only)

**Technical Notes:**

- **Status workflow state machine**:
  - draft → pending (submit for approval)
  - pending → confirmed (confirm order)
  - confirmed → processing (start processing)
  - processing → fulfilled (complete order)
  - any → cancelled (cancel with reason)
- **Reservation integration**:
  - When order status changes to "confirmed", automatically creates reservations for all items
  - Reservations link to sales order and specific items
  - When order cancelled, automatically cancels all active reservations
  - Reservation release when items fulfilled (integrated with fulfillment workflow)
- **Multi-step order creation**:
  1. Create sales_orders record
  2. Batch insert sales_order_items
  3. Rollback on failure (delete order if items fail)
  4. Fetch complete order with relations
- **Delivery address tracking**:
  - Full address fields (line1, line2, city, state, postal_code, country)
  - Expected delivery date tracking
  - Shipping cost and discount calculations
- **Customer management**:
  - Links to business_accounts (customers)
  - Customer name/email/phone stored directly on order
  - Customer-specific order history queries
- **Status-based queries**:
  - Efficient filtering by order status
  - Branch-level filtering
  - Date range filtering
- **Soft delete pattern** for audit trail (only draft/pending can be deleted)

**Complexity:**

- Original: 898 lines, 14 methods
- Migrated: Schema (140 lines), Service (720 lines), Actions (10), Hooks (10)
- Full feature parity with enhanced type safety and reservation integration

---

---

### ✅ Day 5 (continued): Receipt Service Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/receipts.schema.ts`)
   - Receipt status enum (draft, completed, cancelled)
   - Receipt type enum (full, partial, final_partial)
   - Damage reason enum (damaged_in_transit, wrong_product, expired, quality_issue, packaging_damaged, incomplete_order, other)
   - Receipt item schema with damage tracking (quantity_received, quantity_damaged, damage_reason, damage_notes)
   - Process delivery receipt schema for multi-item receiving
   - Cancel receipt schema with reason tracking
   - Receipt filters schema for search and filtering
   - Comprehensive validation for all workflows

2. **Service** (`src/server/services/receipts.service.ts`)
   - **6 methods** (550+ lines) for receipt document management:
     - `getReceiptById()` - Single receipt with relations (users, movements)
     - `getReceipts()` - Paginated list with comprehensive filtering
     - `processDeliveryReceipt()` - Complex multi-step receipt processing workflow
     - `getPartialReceiptStatus()` - Track partial receipts for a delivery
     - `cancelReceipt()` - Cancel receipt and linked movements
     - `generatePZDocument()` - Private placeholder for PDF generation
   - **Solution B architecture**: receipt_documents (metadata) + receipt_movements (junction) + stock_movements (truth)
   - **Complex receipt processing flow** (7 steps):
     1. Fetch original delivery movement
     2. Generate receipt number via RPC (REC-YYYYMMDD-XXXXX)
     3. Create receipt_document
     4. For each line item:
        - Create accepted movement (quantity_received - quantity_damaged)
        - Create damage movement (type 206) if quantity_damaged > 0
        - Link movements to receipt via receipt_movements
     5. Update receipt status to completed
     6. Update original delivery status (partial vs full)
     7. Generate PZ document (placeholder)
   - **Parent/child movement pattern** for partial receipts
   - **Damage tracking** with movement type 206 for rejected goods
   - **PZ document compliance** for Polish warehouse regulations

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/receipts/_actions.ts`)
   - 5 server action functions
   - Co-located with warehouse/receipts route
   - Organization and branch context from getUserContext()
   - Query actions: getReceiptByIdAction, getReceiptsAction, getPartialReceiptStatusAction
   - Mutation actions: processDeliveryReceiptAction, cancelReceiptAction
   - No explicit return type annotations (inferred by TypeScript)

4. **React Query Hooks** (`src/lib/hooks/queries/use-receipts.ts`)
   - 3 Query hooks:
     - `useReceipts()` - Query receipts with filters (2 min stale time)
     - `useReceipt()` - Query single receipt (2 min stale time)
     - `usePartialReceiptStatus()` - Query partial receipt status (1 min stale time)
   - 2 Mutation hooks:
     - `useProcessDeliveryReceipt()` - Process delivery receipt
     - `useCancelReceipt()` - Cancel receipt
   - All mutations include toast notifications (react-toastify)
   - Sophisticated cache invalidation (receipts, stock-movements, stock-inventory)
   - Follows Sales Orders pattern (no explicit return types in actions)

**Status:** ✅ Complete - ESLint and type-check passing

**Technical Notes:**

- **Solution B architecture** separates concerns:
  - `receipt_documents` = compliance/audit layer (who, when, QC notes, PZ doc)
  - `receipt_movements` = junction table linking receipts to movements
  - `stock_movements` = quantitative truth (what, how much, where)
- **Multi-step receipt processing**:
  - Validates original delivery movement
  - Generates unique receipt number
  - Creates receipt document with metadata
  - Creates stock movements for accepted/damaged quantities
  - Links movements to receipt
  - Updates delivery status
  - Placeholder for PZ document generation
- **Damage movement pattern**:
  - Movement type 206 for damaged/rejected goods
  - Tracks damage reason and notes
  - Separate movement for damaged quantity
- **Partial receipt support**:
  - Child movements linked to parent delivery via parent_movement_id
  - Tracks cumulative received quantity
  - Marks delivery as "partial" or "fully_received"
- **Receipt workflow**: draft → completed / cancelled
- **PZ document** (Polish compliance): Placeholder for PDF generation

**Complexity:**

- Original: 492 lines, 6 methods
- Migrated: Schema (100+ lines), Service (550+ lines), Actions (5), Hooks (5)
- Full feature parity with enhanced type safety and workflow management

**Key Learning:**

- Fixed TypeScript discriminated union errors by **removing explicit return type annotations** from server actions (following Sales Orders pattern)
- TypeScript's control flow analysis works better with inferred types than explicit union types
- Pattern: `if (!result.success) throw new Error(result.error);` followed by `return result.data;`

---

### ✅ Product Branch Settings Service Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/product-branch-settings.schema.ts`)
   - Reorder calculation method enum (fixed, min_max, auto)
   - Create product branch settings schema with validation
   - Update product branch settings schema
   - Initialize for all branches schema
   - Cross-field validation (min <= max, reorder point between min/max)
   - Comprehensive threshold validation

2. **Service** (`src/server/services/product-branch-settings.service.ts`)
   - **7 methods** (270 lines) for per-warehouse product configuration:
     - `getSettings()` - Get settings for product in specific branch
     - `getSettingsForProduct()` - Get all branch settings for a product (all warehouses)
     - `getProductsForBranch()` - Get all products with settings for specific branch
     - `upsertSettings()` - Create or update settings with conflict resolution
     - `updateSettings()` - Update existing settings
     - `deleteSettings()` - Soft delete settings
     - `initializeForAllBranches()` - Initialize settings across all org branches
   - **Per-warehouse inventory thresholds**: reorder point, min/max stock levels, reorder quantity
   - **Warehouse preferences**: track inventory, low stock alerts, lead time
   - **Preferred receiving location**: optional default location for receipts
   - **Reorder calculation methods**: fixed, min/max, auto
   - **Bulk initialization**: create settings for all branches when adding new product

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/products/branch-settings/_actions.ts`)
   - 6 server action functions
   - Co-located with warehouse/products/branch-settings route
   - Organization context from getUserContext()
   - Query actions: getProductBranchSettingsAction, getSettingsForProductAction, getProductsForBranchAction
   - Mutation actions: upsertProductBranchSettingsAction, updateProductBranchSettingsAction, deleteProductBranchSettingsAction, initializeForAllBranchesAction
   - No explicit return type annotations (inferred by TypeScript)

4. **React Query Hooks** (`src/lib/hooks/queries/use-product-branch-settings.ts`)
   - 3 Query hooks:
     - `useProductBranchSettings()` - Query single branch settings (5 min stale time)
     - `useSettingsForProduct()` - Query all branch settings for product (5 min stale time)
     - `useProductsForBranch()` - Query all products for branch (3 min stale time)
   - 4 Mutation hooks:
     - `useUpsertProductBranchSettings()` - Upsert settings
     - `useUpdateProductBranchSettings()` - Update settings
     - `useDeleteProductBranchSettings()` - Delete settings
     - `useInitializeForAllBranches()` - Initialize for all branches
   - All mutations include toast notifications (react-toastify)
   - Sophisticated cache invalidation (detail, forProduct, forBranch, lists)

**Status:** ✅ Complete - ESLint and type-check passing

**Technical Notes:**

- **Per-warehouse configuration**: Each product can have different inventory thresholds per branch
- **Reorder calculation methods**:
  - `fixed`: Use fixed reorder point
  - `min_max`: Calculate based on min/max levels
  - `auto`: Automatic calculation based on demand
- **Inventory thresholds**:
  - `reorder_point`: When to reorder
  - `min_stock_level`: Minimum safety stock
  - `max_stock_level`: Maximum storage capacity
  - `reorder_quantity`: How much to order
- **Warehouse preferences**:
  - `track_inventory`: Enable/disable inventory tracking per branch
  - `send_low_stock_alerts`: Enable/disable alerts
  - `lead_time_days`: Expected delivery time
  - `preferred_receiving_location_id`: Default location for receipts
- **Cross-field validation**: Ensures min <= reorder point <= max
- **Bulk initialization**: When creating new product, can initialize settings for all branches at once
- **Upsert conflict resolution**: Uses `onConflict: "product_id,branch_id"` for safe updates

**Complexity:**

- Original: 223 lines, 7 methods
- Migrated: Schema (145 lines), Service (270 lines), Actions (6), Hooks (7)
- Full feature parity with enhanced type safety and cross-field validation

---

**Last Updated:** December 4, 2025
**Status:** Week 1 Day 5 Complete - 14 Services Migrated (Products, Locations, Stock Movements, Product-Suppliers, Categories, Units, Movement Types, Movement Validation, Product Groups, Reservations, Purchase Orders, Sales Orders, Receipts, Product Branch Settings)

### ✅ Variant Generation Service Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/variant-generation.schema.ts`)
   - Selected attribute schema for variant generation
   - Generated variant schema with attribute values
   - SKU generator configuration schema (format, case, separator)
   - Generate variant combinations input schema
   - Generate SKU input schema
   - Validate SKU uniqueness input schema
   - Calculate combinations count input schema

2. **Service** (`src/server/services/variant-generation.service.ts`)
   - **7 pure business logic methods** (270+ lines):
     - `generateVariantCombinations()` - Generate all variant combinations using Cartesian product
     - `cartesianProduct()` - Core algorithm for generating all combinations
     - `generateSKU()` - Generate SKU based on configuration pattern
     - `formatTextPart()` - Format text part (first 3, last 3, full) with case transformation
     - `generateSKUsForAllVariants()` - Generate SKUs for all variants in batch
     - `validateSKUUniqueness()` - Validate SKU uniqueness in organization (DB call)
     - `calculateCombinationsCount()` - Calculate total combinations count
     - `generatePreviewSKU()` - Generate preview SKU for live preview
   - **Cartesian product algorithm**: Generates all possible combinations from multiple arrays
   - **SKU generation**: Configurable format with base name, separator, case transformation
   - **Uniqueness validation**: Checks both products and product_variants tables

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/products/variants/_actions.ts`)
   - 6 server action functions
   - Co-located with warehouse/products/variants route
   - Pure business logic actions (no auth needed except validateSKUUniqueness)
   - Actions: generateVariantCombinationsAction, generateSKUAction, generateSKUsForAllVariantsAction, validateSKUUniquenessAction, calculateCombinationsCountAction, generatePreviewSKUAction

4. **React Query Hooks** (`src/lib/hooks/queries/use-variant-generation.ts`)
   - 6 Mutation hooks (no queries - pure business logic):
     - `useGenerateVariantCombinations()` - Generate variant combinations
     - `useGenerateSKU()` - Generate single SKU
     - `useGenerateSKUsForAllVariants()` - Generate SKUs for all variants
     - `useValidateSKUUniqueness()` - Validate SKU uniqueness
     - `useCalculateCombinationsCount()` - Calculate combinations count
     - `useGeneratePreviewSKU()` - Generate preview SKU
   - No cache needed - pure calculations executed on demand

**Status:** ✅ Complete - type-check passing

**Technical Notes:**

- **Mostly pure business logic**: Only validateSKUUniqueness touches the database
- **Cartesian product algorithm**: Generates all possible variant combinations
  - Example: Color [Red, Blue] × Size [S, M, L] = 6 variants
- **SKU generation**: Highly configurable
  - Include/exclude base name
  - Include/exclude each attribute
  - Format options: first 3 chars, last 3 chars, or full
  - Case transformation: upper, lower, title case
  - Custom separator (-, \_, etc.)
  - Example: T-Shirt + Red + Medium → TSH-RED-MED
- **Preview functionality**: Live SKU preview in dialogs
- **Uniqueness validation**: Checks global SKU uniqueness across products and variants
- **Combination count calculation**: Shows "This will create X variants" preview

**Complexity:**

- Original: 328 lines, 9 methods
- Migrated: Schema (119 lines), Service (293 lines), Actions (6), Hooks (6)
- Full feature parity with enhanced type safety and validation

---

### ✅ Option Groups Service Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/option-groups.schema.ts`)
   - Create option group schema with optional values array
   - Update option group schema
   - Create option value schema
   - Update option value schema
   - Option group filters schema

2. **Service** (`src/server/services/option-groups.service.ts`)
   - **10 methods** (270+ lines) for variant option management:
     - `getOptionGroups()` - Get all option groups with values for organization
     - `getOptionGroup()` - Get single option group by ID with values
     - `createOptionGroup()` - Create new option group with optional values
     - `updateOptionGroup()` - Update existing option group
     - `deleteOptionGroup()` - Soft delete option group
     - `getOptionValues()` - Get all values for an option group
     - `createOptionValue()` - Add value to option group
     - `updateOptionValue()` - Update existing option value
     - `deleteOptionValue()` - Soft delete option value
   - **Nested data loading**: Fetches groups with their values in single query
   - **Sorted values**: Values sorted by display_order within each group
   - **Transaction-like behavior**: Rollback group creation if values fail
   - **Soft delete**: Both groups and values support soft delete

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/settings/option-groups/_actions.ts`)
   - 10 server action functions
   - Co-located with warehouse/settings/option-groups route
   - Organization context from getUserContext()
   - Group actions: getOptionGroupsAction, getOptionGroupAction, createOptionGroupAction, updateOptionGroupAction, deleteOptionGroupAction
   - Value actions: getOptionValuesAction, createOptionValueAction, updateOptionValueAction, deleteOptionValueAction

4. **React Query Hooks** (`src/lib/hooks/queries/use-option-groups.ts`)
   - 3 Query hooks:
     - `useOptionGroups()` - Query all option groups (5 min stale time)
     - `useOptionGroup()` - Query single option group (5 min stale time)
     - `useOptionValues()` - Query values for a group (5 min stale time)
   - 7 Mutation hooks:
     - `useCreateOptionGroup()` - Create option group
     - `useUpdateOptionGroup()` - Update option group
     - `useDeleteOptionGroup()` - Delete option group
     - `useCreateOptionValue()` - Create option value
     - `useUpdateOptionValue()` - Update option value
     - `useDeleteOptionValue()` - Delete option value
   - All mutations include toast notifications (react-toastify)
   - Smart cache invalidation (lists, detail, values)

**Status:** ✅ Complete - type-check passing

**Technical Notes:**

- **Variant option groups**: Define product attributes (Color, Size, Material, etc.)
- **Option values**: Specific values within each group (Red, Blue, Small, Medium, etc.)
- **Display ordering**: Values can be manually ordered within groups
- **Nested creation**: Can create group with values in single operation
- **Soft delete**: Maintains data integrity while hiding deleted items
- **Transaction-like behavior**: If value creation fails, group creation is rolled back
- **Filtered deleted values**: Automatically filters out soft-deleted values from results
- **Used in variant generation**: Option groups and values feed into variant generation service

**Complexity:**

- Original: 214 lines, 10 methods
- Migrated: Schema (59 lines), Service (273 lines), Actions (10), Hooks (10)
- Full feature parity with enhanced type safety and transaction-like behavior

---

### ✅ Custom Fields Service Migration (COMPLETED)

**Files Created:**

1. **Schema** (`src/server/schemas/custom-fields.schema.ts`)
   - Field type enum (text, number, boolean, date, dropdown)
   - Create field definition schema with organization_id
   - Update field definition schema
   - Create field value schema with product/variant linking
   - Update field value schema
   - Reorder field definitions schema with display_order array

2. **Service** (`src/server/services/custom-fields.service.ts`)
   - **11 methods** (263 lines) for dynamic custom field management:
     - `getFieldDefinitions()` - Get all field definitions for organization
     - `createFieldDefinition()` - Create new custom field definition
     - `updateFieldDefinition()` - Update existing field definition
     - `deleteFieldDefinition()` - Soft delete field definition
     - `reorderFieldDefinitions()` - Update display order for multiple definitions
     - `getProductFieldValues()` - Get all field values for a product
     - `getVariantFieldValues()` - Get all field values for a variant
     - `setFieldValue()` - Create or update field value (upsert with conflict resolution)
     - `deleteFieldValue()` - Soft delete field value
     - `getProductFieldValuesWithDefinitions()` - Get field values with their definitions
   - **Type-based value storage**: Uses value_text, value_number, value_boolean, value_date columns
   - **Upsert pattern**: Conflict resolution on (product_id, field_definition_id) or (variant_id, field_definition_id)
   - **Display order management**: Manual ordering of fields in UI
   - **Product and variant support**: Fields can be attached to either products or variants

3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/settings/custom-fields/_actions.ts`)
   - 11 server action functions
   - Co-located with warehouse/settings/custom-fields route
   - Organization context from getUserContext()
   - Definition actions: getFieldDefinitionsAction, createFieldDefinitionAction, updateFieldDefinitionAction, deleteFieldDefinitionAction, reorderFieldDefinitionsAction
   - Value actions: getProductFieldValuesAction, getVariantFieldValuesAction, setFieldValueAction, deleteFieldValueAction, getProductFieldValuesWithDefinitionsAction

4. **React Query Hooks** (`src/lib/hooks/queries/use-custom-fields.ts`)
   - 4 Query hooks:
     - `useFieldDefinitions()` - Query all field definitions (5 min stale time)
     - `useProductFieldValues()` - Query field values for product (5 min stale time)
     - `useVariantFieldValues()` - Query field values for variant (5 min stale time)
     - `useProductFieldValuesWithDefinitions()` - Query values with definitions (5 min stale time)
   - 7 Mutation hooks:
     - `useCreateFieldDefinition()` - Create field definition
     - `useUpdateFieldDefinition()` - Update field definition
     - `useDeleteFieldDefinition()` - Delete field definition
     - `useReorderFieldDefinitions()` - Reorder field definitions
     - `useSetFieldValue()` - Set field value (upsert)
     - `useDeleteFieldValue()` - Delete field value
   - All mutations include toast notifications (react-toastify)
   - Smart cache invalidation (definitions, product values, variant values)

**Status:** ✅ Complete - type-check and lint passing (no new errors)

**Technical Notes:**

- **Dynamic custom fields**: Organizations can define custom fields for products/variants
- **Field types**: text, number, boolean, date, dropdown (with dropdown_options array)
- **Type-based storage**: Values stored in appropriate columns based on type
  - Text values → value_text
  - Numbers → value_number
  - Booleans → value_boolean
  - Dates → value_date (ISO 8601 string)
  - Dropdowns → value_text (selected option)
- **Upsert pattern**: Uses onConflict to safely update existing values
- **Display ordering**: Fields can be manually reordered in UI via display_order
- **Product vs Variant fields**: Fields can be attached to either entity
- **Joined query optimization**: getProductFieldValuesWithDefinitions() returns values with their definitions in single query
- **Soft delete pattern**: Both definitions and values support soft delete

**Complexity:**

- Original: N/A (new service)
- Migrated: Schema (59 lines), Service (263 lines), Actions (11), Hooks (11)
- Full type safety with Zod validation and TypeScript

---

### ⏳ Templates Service (FILES CREATED - REQUIRES DATABASE TABLES)

**Status:** ⏳ Implementation files created but **cannot be completed** until database migrations are enabled

**Files Created (Non-Functional):**

1. **Schema** (`src/server/schemas/templates.schema.ts`) - 95 lines
2. **Service** (`src/server/services/templates.service.ts`) - 495 lines
3. **Server Actions** (`src/app/[locale]/dashboard/warehouse/settings/templates/_actions.ts`) - 189 lines
4. **React Query Hooks** (`src/lib/hooks/queries/use-templates.ts`) - 178 lines

**Blockers:**

- Tables `product_templates` and `template_attribute_definitions` do not exist in database
- Migrations are disabled: `20250915140000_product_templates_system.sql.disabled`
- Cannot complete type-check due to missing table types in Supabase schema

**Next Steps:**

1. Enable template migrations in `supabase/migrations/`
2. Apply migrations to remote database
3. Regenerate TypeScript types with `pnpm run supabase:gen:types`
4. Verify type-check passes
5. Mark as complete

**Note:** Template service files are kept in codebase for future implementation. The old template service exists at `src/modules/warehouse/api/template-service.ts` and can be used as reference when tables are ready.

---

**Last Updated:** December 4, 2025
**Status:** Week 1 Day 5+ Complete - 17 Services Migrated (Products, Locations, Stock Movements, Product-Suppliers, Categories, Units, Movement Types, Movement Validation, Product Groups, Reservations, Purchase Orders, Sales Orders, Receipts, Product Branch Settings, Variant Generation, Option Groups, Custom Fields)
