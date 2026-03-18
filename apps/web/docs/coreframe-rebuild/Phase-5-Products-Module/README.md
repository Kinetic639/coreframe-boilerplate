# Phase 5: Products Module (Vertical Slice)

**Status:** ⚪ NOT STARTED
**Duration:** ~15 hours estimated
**Priority:** 🟡 HIGH
**Overall Progress:** 0%

---

## 📊 Progress Tracker

| Task                        | Status         | Duration | Deliverables        | Tests | Completion |
| --------------------------- | -------------- | -------- | ------------------- | ----- | ---------- |
| 5.1 Products Database & RLS | ⚪ Not Started | 3h       | Migration, Policies | 0/25  | 0%         |
| 5.2 Products Service Layer  | ⚪ Not Started | 3h       | Service + Tests     | 0/35  | 0%         |
| 5.3 Products Server Actions | ⚪ Not Started | 2h       | Actions + Tests     | 0/25  | 0%         |
| 5.4 Products React Query    | ⚪ Not Started | 2h       | Hooks + Tests       | 0/20  | 0%         |
| 5.5 Products UI Components  | ⚪ Not Started | 5h       | Pages + Components  | 0/15  | 0%         |

**Total:** 0/15 hours | 0/120 tests | 0% complete

---

## 🎯 Phase Goal

Build complete Products CRUD as a **vertical slice proof** that the entire 6-layer architecture works end-to-end. This validates:

- RLS policies enforce security
- Service layer handles business logic
- Server actions validate and authorize
- React Query caches and mutates
- UI components render and interact
- Tests cover all layers

**Prerequisites:**

- ✅ V2 architecture complete - Complete
- ⚪ RLS policies (Phase 1) - Required
- ⚪ UI primitives (Phase 2) - Required

---

## Task 5.1: Products Database & RLS (3 hours) ⚪

### 5.1.1 Products Schema Review (1 hour)

**Tasks:**

1. **Review Existing Schema** (30 min)
   - [ ] Check existing `products` table structure
   - [ ] Check existing `product_variants` table
   - [ ] Check existing `product_inventory_data` table
   - [ ] Check existing `product_ecommerce_data` table
   - [ ] Verify org/branch scoping columns exist

2. **Create Migration if Needed** (30 min)
   - [ ] `supabase/migrations/YYYYMMDDHHMMSS_products_schema_v2.sql`
   - [ ] Add missing columns (if any)
   - [ ] Add org/branch foreign keys (if missing)
   - [ ] Add deleted_at for soft delete (if missing)

**Checklist:**

- [ ] Schema reviewed
- [ ] Migration created (if needed)
- [ ] All scoping columns exist

### 5.1.2 Products RLS Policies (2 hours)

**Migration:** `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_products.sql`

**Enable RLS:**

```sql
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_inventory_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ecommerce_data ENABLE ROW LEVEL SECURITY;
```

**Create Policies:**

```sql
-- SELECT: Users can view products in their org
CREATE POLICY "products_select_org" ON public.products
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT private.get_user_orgs(auth.uid()))
  );

-- INSERT: Users with warehouse.products.create permission
CREATE POLICY "products_insert_permission" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT private.get_user_orgs(auth.uid()))
    AND public.authorize(auth.uid(), 'warehouse.products.create', 'branch', branch_id::text)
  );

-- UPDATE: Users with warehouse.products.update permission
CREATE POLICY "products_update_permission" ON public.products
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT private.get_user_orgs(auth.uid()))
    AND public.authorize(auth.uid(), 'warehouse.products.update', 'branch', branch_id::text)
  );

-- DELETE: Users with warehouse.products.delete permission
CREATE POLICY "products_delete_permission" ON public.products
  FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT private.get_user_orgs(auth.uid()))
    AND public.authorize(auth.uid(), 'warehouse.products.delete', 'branch', branch_id::text)
  );
```

**Similar policies for related tables:**

- product_variants (linked to products)
- product_inventory_data (org scoped)
- product_ecommerce_data (org scoped)

**pgTAP Tests:** `supabase/tests/005_rls_products.sql`

```sql
-- Test org isolation
BEGIN;
SELECT plan(10);

-- Test user can view own org products
SELECT ok(
  (SELECT count(*) FROM products WHERE organization_id = 'org1') > 0,
  'User can view products in their org'
);

-- Test user cannot view other org products
SELECT is(
  (SELECT count(*) FROM products WHERE organization_id = 'org2'),
  0,
  'User cannot view products from other orgs'
);

-- Test permission enforcement
-- More tests...

SELECT * FROM finish();
ROLLBACK;
```

**Performance Indexes:**

```sql
CREATE INDEX IF NOT EXISTS idx_products_org_branch ON public.products(organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_products_org_deleted ON public.products(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products USING gin(to_tsvector('english', name || ' ' || description));
```

**Checklist:**

- [ ] RLS enabled on 4 tables
- [ ] Policies created (16 total)
- [ ] pgTAP tests written (10 tests)
- [ ] Performance indexes added
- [ ] Manual testing complete

### Definition of Done ✅

- [ ] Products schema finalized
- [ ] RLS policies enforce permissions
- [ ] 25 pgTAP tests passing
- [ ] Cross-tenant access prevented
- [ ] Performance indexes in place

---

## Task 5.2: Products Service Layer (3 hours) ⚪

### 5.2.1 ProductsService Implementation (2 hours)

**File:** `src/server/services/products.service.ts`

**Methods:**

```typescript
class ProductsService {
  /**
   * List products with filtering
   */
  static async list(organizationId: string, filters?: ProductFilters): Promise<Product[]> {
    // 1. Build query with org scope
    // 2. Apply filters (category, status, search)
    // 3. Apply pagination
    // 4. Return products with variants
  }

  /**
   * Get single product by ID
   */
  static async getById(productId: string, organizationId: string): Promise<Product | null> {
    // 1. Query with org scope
    // 2. Include variants, inventory, ecommerce data
    // 3. Return product or null
  }

  /**
   * Create new product
   */
  static async create(
    input: CreateProductInput,
    organizationId: string,
    branchId: string
  ): Promise<Product> {
    // 1. Validate business rules
    //    - SKU uniqueness within org
    //    - Price >= 0
    //    - Name not empty
    // 2. Insert product record
    // 3. Insert default variant
    // 4. Insert inventory data
    // 5. Return created product
  }

  /**
   * Update existing product
   */
  static async update(
    productId: string,
    input: UpdateProductInput,
    organizationId: string
  ): Promise<Product> {
    // 1. Validate product exists and org owns it
    // 2. Validate business rules
    // 3. Update product record
    // 4. Update related data if provided
    // 5. Return updated product
  }

  /**
   * Soft delete product
   */
  static async delete(productId: string, organizationId: string): Promise<void> {
    // 1. Validate product exists
    // 2. Check for dependencies (orders, movements)
    // 3. Soft delete (set deleted_at)
  }

  /**
   * Full-text search products
   */
  static async search(query: string, organizationId: string): Promise<Product[]> {
    // 1. Use PostgreSQL full-text search
    // 2. Search name, description, SKU
    // 3. Rank by relevance
    // 4. Return top 20 results
  }
}
```

**Business Rules to Enforce:**

- SKU must be unique within organization
- Price must be >= 0
- Name must be 1-200 characters
- Cannot delete product with active orders
- Cannot modify archived products

**Checklist:**

- [ ] ProductsService created
- [ ] All 6 methods implemented
- [ ] Business rules enforced
- [ ] Error handling implemented
- [ ] TypeScript types defined

### 5.2.2 ProductsService Tests (1 hour)

**File:** `src/server/services/__tests__/products.service.test.ts`

**Test Categories:**

```typescript
describe("ProductsService", () => {
  describe("list", () => {
    it("should list products for organization", async () => {});
    it("should apply filters correctly", async () => {});
    it("should paginate results", async () => {});
    it("should not return products from other orgs", async () => {});
  });

  describe("getById", () => {
    it("should get product by ID", async () => {});
    it("should include variants and inventory", async () => {});
    it("should return null for non-existent product", async () => {});
    it("should not return products from other orgs", async () => {});
  });

  describe("create", () => {
    it("should create product with valid input", async () => {});
    it("should reject duplicate SKU", async () => {});
    it("should reject negative price", async () => {});
    it("should reject empty name", async () => {});
    it("should create default variant", async () => {});
  });

  describe("update", () => {
    it("should update product with valid input", async () => {});
    it("should reject non-existent product", async () => {});
    it("should reject cross-org update", async () => {});
    it("should validate business rules", async () => {});
  });

  describe("delete", () => {
    it("should soft delete product", async () => {});
    it("should reject delete with dependencies", async () => {});
    it("should reject cross-org delete", async () => {});
  });

  describe("search", () => {
    it("should search by name", async () => {});
    it("should search by SKU", async () => {});
    it("should rank by relevance", async () => {});
    it("should scope to organization", async () => {});
  });
});
```

**Target:** 35 tests, 80%+ coverage

**Checklist:**

- [ ] Test file created
- [ ] All CRUD operations tested
- [ ] Business rules tested
- [ ] Error handling tested
- [ ] 80%+ coverage achieved

### Definition of Done ✅

- [ ] ProductsService with 6 methods
- [ ] Business logic enforced
- [ ] 35 tests passing
- [ ] 80%+ test coverage
- [ ] Org scoping in all queries

---

## Task 5.3: Products Server Actions (2 hours) ⚪

### 5.3.1 Server Actions Implementation (1 hour)

**File:** `src/app/[locale]/dashboard/warehouse/products/_actions.ts`

**Zod Schemas:**

```typescript
import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  sku: z.string().min(3).max(50),
  price: z.number().min(0),
  category: z.string().optional(),
  unit: z.string().default("pcs"),
});

export const updateProductSchema = createProductSchema.partial();

export const productFiltersSchema = z.object({
  category: z.string().optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});
```

**Actions:**

```typescript
"use server";

export async function getProducts(filters?: unknown): Promise<ActionResponse<Product[]>> {
  try {
    // 1. Load context
    const context = await loadDashboardContextV2();
    if (!context.user) {
      return { success: false, error: "Authentication required", code: "AUTH_REQUIRED" };
    }

    // 2. Validate filters
    const validFilters = productFiltersSchema.parse(filters);

    // 3. Call service
    const products = await ProductsService.list(context.activeOrgId, validFilters);

    return { success: true, data: products };
  } catch (error) {
    return { success: false, error: "Failed to fetch products", code: "FETCH_ERROR" };
  }
}

export async function getProduct(productId: string): Promise<ActionResponse<Product>> {
  // Similar pattern: load context, validate, call service
}

export async function createProduct(input: unknown): Promise<ActionResponse<Product>> {
  try {
    // 1. Load context
    const context = await loadDashboardContextV2();
    if (!context.user) {
      return { success: false, error: "Authentication required", code: "AUTH_REQUIRED" };
    }

    // 2. Check permission
    const hasPermission = context.permissions.allow.some(
      (p) => p === "warehouse.products.create" || p.startsWith("warehouse.*")
    );
    if (!hasPermission) {
      return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    // 3. Validate input
    const validInput = createProductSchema.parse(input);

    // 4. Call service
    const product = await ProductsService.create(
      validInput,
      context.activeOrgId,
      context.activeBranchId
    );

    return { success: true, data: product };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Validation failed", code: "VALIDATION_ERROR" };
    }
    return { success: false, error: "Failed to create product", code: "CREATE_ERROR" };
  }
}

export async function updateProduct(
  productId: string,
  input: unknown
): Promise<ActionResponse<Product>> {
  // Similar pattern with warehouse.products.update permission
}

export async function deleteProduct(productId: string): Promise<ActionResponse> {
  // Similar pattern with warehouse.products.delete permission
}

export async function searchProducts(query: string): Promise<ActionResponse<Product[]>> {
  // Search action (read permission)
}
```

**Checklist:**

- [ ] 6 server actions created
- [ ] Zod schemas defined
- [ ] Auth checks implemented
- [ ] Permission checks implemented
- [ ] Error handling complete

### 5.3.2 Server Actions Tests (1 hour)

**File:** `src/app/[locale]/dashboard/warehouse/products/__tests__/_actions.test.ts`

**Test Coverage:**

- Auth validation (no user → error)
- Permission validation (no permission → denied)
- Input validation (invalid input → validation error)
- Success cases (valid input → success)
- Error handling (service error → handled)

**Target:** 25 tests, 70%+ coverage

**Checklist:**

- [ ] Test file created
- [ ] Auth tests passing
- [ ] Permission tests passing
- [ ] Validation tests passing
- [ ] 25 tests passing

### Definition of Done ✅

- [ ] 6 server actions implemented
- [ ] Zod validation working
- [ ] Auth/permission checks enforced
- [ ] 25 tests passing
- [ ] 70%+ test coverage

---

## Task 5.4: Products React Query Hooks (2 hours) ⚪

### 5.4.1 Query Hooks Implementation (1 hour)

**File:** `src/lib/hooks/queries/v2/products-queries.ts`

**Hooks:**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/app/[locale]/dashboard/warehouse/products/_actions";

// Query keys
export const productsKeys = {
  all: ["v2", "products"] as const,
  lists: () => [...productsKeys.all, "list"] as const,
  list: (filters: ProductFilters) => [...productsKeys.lists(), filters] as const,
  details: () => [...productsKeys.all, "detail"] as const,
  detail: (id: string) => [...productsKeys.details(), id] as const,
};

// List products with filters
export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: productsKeys.list(filters || {}),
    queryFn: async () => {
      const result = await getProducts(filters);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

// Get single product
export function useProduct(productId: string) {
  return useQuery({
    queryKey: productsKeys.detail(productId),
    queryFn: async () => {
      const result = await getProduct(productId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!productId,
  });
}

// Create product mutation
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const result = await createProduct(input);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all product lists
      queryClient.invalidateQueries({ queryKey: productsKeys.lists() });
    },
  });
}

// Update product mutation
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, input }: { productId: string; input: UpdateProductInput }) => {
      const result = await updateProduct(productId, input);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate lists and specific product
      queryClient.invalidateQueries({ queryKey: productsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: productsKeys.detail(data.id) });
    },
  });
}

// Delete product mutation
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const result = await deleteProduct(productId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      // Invalidate all product lists
      queryClient.invalidateQueries({ queryKey: productsKeys.lists() });
    },
  });
}
```

**Checklist:**

- [ ] 6 hooks created
- [ ] Query keys properly structured
- [ ] Cache invalidation correct
- [ ] Error handling implemented

### 5.4.2 Hook Tests (1 hour)

**File:** `src/lib/hooks/queries/v2/__tests__/products-queries.test.tsx`

**Test Coverage:**

- Query hooks fetch data correctly
- Mutation hooks call actions
- Cache invalidation works
- Error states handled
- Loading states work

**Target:** 20 tests, 70%+ coverage

**Checklist:**

- [ ] Test file created
- [ ] All hooks tested
- [ ] Cache tests passing
- [ ] 20 tests passing

### Definition of Done ✅

- [ ] 6 React Query hooks
- [ ] Cache strategy correct
- [ ] 20 tests passing
- [ ] 70%+ test coverage

---

## Task 5.5: Products UI Components (5 hours) ⚪

### 5.5.1 Products List Page (2 hours)

**File:** `src/app/[locale]/dashboard/warehouse/products/page.tsx`

**Server Component:**

```typescript
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { ProductsListClient } from "./_components/products-list-client";

export default async function ProductsPage() {
  const context = await loadDashboardContextV2();

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        actions={[
          {
            label: "Create Product",
            onClick: () => {}, // Handled in client
            permission: "warehouse.products.create",
          },
        ]}
      />
      <ProductsListClient initialContext={context} />
    </div>
  );
}
```

**Client Component:** `_components/products-list-client.tsx`

```typescript
"use client";

export function ProductsListClient({ initialContext }: { initialContext: DashboardContext }) {
  const [filters, setFilters] = useState<ProductFilters>({});
  const { data: products, isLoading } = useProducts(filters);
  const { can } = usePermissions();

  return (
    <div>
      {/* Filters */}
      <ProductFilters filters={filters} onChange={setFilters} />

      {/* Data Table */}
      <DataTable
        columns={[
          { key: "name", label: "Name", sortable: true },
          { key: "sku", label: "SKU", sortable: true },
          { key: "price", label: "Price", sortable: true },
          { key: "category", label: "Category", filterable: true },
          { key: "actions", label: "Actions" },
        ]}
        data={products}
        loading={isLoading}
        onRowClick={(product) => setSelectedProduct(product)}
      />

      {/* Create/Edit Dialog */}
      {can("warehouse.products.create") && (
        <CreateProductDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      )}
    </div>
  );
}
```

**Checklist:**

- [ ] Server component created
- [ ] Client component created
- [ ] DataTable integrated
- [ ] Filters working
- [ ] Pagination working
- [ ] Mobile responsive

### 5.5.2 Create/Edit Product Dialog (2 hours)

**File:** `_components/create-product-dialog.tsx`

**Features:**

- [ ] Form with all product fields
- [ ] Validation with Zod
- [ ] Image upload (optional)
- [ ] Loading/success/error states
- [ ] Reusable for create and edit

**Implementation:**

```typescript
"use client";

export function CreateProductDialog({ open, onOpenChange, productId }: CreateProductDialogProps) {
  const { mutate: createProduct, isPending } = useCreateProduct();
  const { mutate: updateProduct } = useUpdateProduct();

  const form = useForm({
    resolver: zodResolver(createProductSchema),
  });

  const onSubmit = (data: CreateProductInput) => {
    if (productId) {
      updateProduct({ productId, input: data }, {
        onSuccess: () => {
          toast.success("Product updated successfully");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to update product");
        },
      });
    } else {
      createProduct(data, {
        onSuccess: () => {
          toast.success("Product created successfully");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to create product");
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{productId ? "Edit Product" : "Create Product"}</DialogTitle>
        </DialogHeader>
        <FormWrapper onSubmit={form.handleSubmit(onSubmit)}>
          <FormField name="name" label="Product Name" control={form.control} />
          <FormField name="sku" label="SKU" control={form.control} />
          <FormField name="price" label="Price" type="number" control={form.control} />
          <FormField name="description" label="Description" type="textarea" control={form.control} />
          {/* More fields */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : productId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </FormWrapper>
      </DialogContent>
    </Dialog>
  );
}
```

**Checklist:**

- [ ] Dialog component created
- [ ] Form with validation
- [ ] Create/edit modes
- [ ] Loading states
- [ ] Error handling
- [ ] Toast notifications

### 5.5.3 Product Detail View (1 hour)

**File:** `_components/product-detail-dialog.tsx`

**Features:**

- [ ] Display all product info
- [ ] Show variants, inventory
- [ ] Actions (edit, delete, duplicate)
- [ ] Permission-based actions

**Checklist:**

- [ ] Detail view created
- [ ] All info displays
- [ ] Actions working
- [ ] Permission gating

### 5.5.4 Component Tests (15 tests)

**Files:**

- `__tests__/products-list-client.test.tsx`
- `__tests__/create-product-dialog.test.tsx`
- `__tests__/product-detail-dialog.test.tsx`

**Test Coverage:**

- Components render
- User interactions work
- Permission gating works
- Loading/error states display

**Checklist:**

- [ ] Test files created
- [ ] 15 tests passing
- [ ] 60%+ coverage

### Definition of Done ✅

- [ ] Products page functional
- [ ] CRUD operations work
- [ ] Permission gating enforced
- [ ] Mobile responsive
- [ ] 15 component tests passing
- [ ] No console errors

---

## 📈 Success Metrics

- [ ] **Products CRUD complete** - All operations working
- [ ] **RLS policies enforced** - Cross-tenant access prevented
- [ ] **Permission gating working** - Only authorized users see actions
- [ ] **120+ tests passing** - All layers tested
- [ ] **Mobile responsive** - Works on all devices
- [ ] **Performance good** - Page load < 2s, queries < 500ms

---

## 🔄 Next Steps

After Phase 5 completion:

- Move to Phase 6: Performance & Testing
- Optimize database queries and indexes
- Add E2E tests with Playwright
- Prepare for production deployment

---

**Last Updated:** 2026-01-27
**Status:** ⚪ Not Started
**Requires:** Phase 1 (RLS), Phase 2 (UI Primitives)
**Next Task:** 5.1 Products Database & RLS
