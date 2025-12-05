# Fetching Architecture Migration Plan

## 3-4 Week SSR-First Implementation (REVISED)

---

## Executive Summary

**Mission:** Eliminate scattered fetches, enforce SSR-first architecture, achieve 100% type safety with centralized services and React Query.

**Timeline:** 3-4 weeks (not 6)
**Approach:** Big bang per module (not gradual)
**Structure:** Backend-first (`src/server/services/`) with flat structure
**Client State:** React Query only (remove custom SWR)

**Key Revisions Applied:**

1. ❌ No middleware wrappers - Direct auth checks in actions
2. ✅ Actions co-located with routes, not global `/actions` folder
3. ✅ Flat services structure (no deep nesting)
4. ✅ Minimal Zod schemas (input validation only)
5. ✅ Direct service calls for SSR prefetching (not server actions)

---

## Core Architecture Principles

### The Golden Rule: SSR-First Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  Server Components (RSC)                                │
│  ✅ Initial render with prefetched data                 │
│  ✅ Direct server action calls                          │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Client Components                                      │
│  ✅ React Query hooks (refetch, cache, optimistic)      │
│  ✅ Call server actions ONLY                            │
│  ❌ NEVER call Supabase directly                        │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Server Actions ("use server")                          │
│  ✅ Direct auth checks (no middleware)                  │
│  ✅ Zod validation                                      │
│  ✅ Delegate to services                                │
│  ✅ Co-located with routes                              │
│  ❌ NO business logic here                              │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Service Layer (src/server/services/)                   │
│  ✅ All Supabase queries                                │
│  ✅ Business logic                                      │
│  ✅ Data transformations                                │
│  ✅ Server-only code                                    │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Database (Supabase)                                    │
│  ✅ RLS policies enforce security                       │
│  ✅ Row-level permissions                               │
└─────────────────────────────────────────────────────────┘
```

### SSR Safety Guarantee

**✅ SAFE (SSR preserved):**

```typescript
// Client component
const { data } = useProducts(); // calls server action

// Server action (co-located with route)
// src/app/(dashboard)/warehouse/products/_actions.ts
("use server");
import { createClient } from "@/utils/supabase/server";
import { ProductsService } from "@/server/services/products.service";

export async function getProducts(filters: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Validate with Zod, then call service
  return await ProductsService.getProducts(supabase, user.id, filters);
}

// Service (flat structure)
// src/server/services/products.service.ts
export class ProductsService {
  static async getProducts(supabase, userId, filters) {
    return supabase.from("products").select("*").eq("user_id", userId);
  }
}
```

**❌ UNSAFE (breaks SSR, exposes DB):**

```typescript
// Client component - DON'T DO THIS!
const supabase = createClient(); // browser client
const { data } = await supabase.from("products").select("*"); // NO!
```

---

## New File Structure (Backend-First)

```
src/
├── server/                          ← NEW: All backend logic
│   ├── services/                   ← FLAT STRUCTURE (no deep nesting)
│   │   ├── products.service.ts
│   │   ├── movements.service.ts
│   │   ├── locations.service.ts
│   │   ├── suppliers.service.ts
│   │   ├── inventory.service.ts
│   │   ├── news.service.ts
│   │   ├── teams.service.ts
│   │   ├── contacts.service.ts
│   │   └── organization.service.ts
│   └── schemas/                    ← Zod schemas (input validation only)
│       ├── common.ts               ← Pagination, filters
│       ├── products.schema.ts
│       ├── movements.schema.ts
│       ├── news.schema.ts
│       └── teams.schema.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts              ← Browser client (auth only)
│   │   └── server.ts              ← Server client (data access)
│   └── hooks/
│       └── queries/                ← React Query hooks
│           ├── use-products.ts
│           ├── use-movements.ts
│           ├── use-news.ts
│           └── use-teams.ts
└── app/
    └── [locale]/
        └── (dashboard)/
            ├── warehouse/
            │   └── products/
            │       ├── _actions.ts        ← Server actions (co-located!)
            │       ├── page.tsx
            │       └── products-table.tsx
            ├── news/
            │   ├── _actions.ts
            │   └── page.tsx
            └── teams/
                ├── _actions.ts
                └── page.tsx

TO DELETE:
- src/modules/warehouse/api/        → Move to src/server/services/ (flat)
- src/lib/hooks/use-simple-swr.ts   → Replace with React Query
- src/app/actions/                  → Move to route folders as _actions.ts
- All direct Supabase calls in components
```

---

## 3-4 Week Implementation Timeline

### **Week 1: Foundation + Warehouse Module**

**Days 1-2: Foundation**

1. **Install/Configure React Query**

   ```bash
   npm install @tanstack/react-query @tanstack/react-query-devtools
   ```

2. **Create Common Schemas** (minimal - input validation only)
   - `src/server/schemas/common.ts` (pagination, filters)

3. **Setup React Query Provider**
   - Configure in `src/app/providers.tsx`
   - Add devtools for development

4. **Create Helper Utilities** (optional)
   - `src/lib/utils/assert-auth.ts` (simple auth helper)
   - `src/lib/utils/get-user-context.ts` (org/branch helper)

**Days 3-5: Warehouse Module (Big Bang)**

5. **Create Warehouse Schemas** (input validation only)
   - `src/server/schemas/products.schema.ts`
   - `src/server/schemas/movements.schema.ts`

6. **Migrate Services to FLAT structure** (move from `src/modules/warehouse/api/`)
   - `src/server/services/products.service.ts`
   - `src/server/services/movements.service.ts`
   - `src/server/services/locations.service.ts`
   - `src/server/services/suppliers.service.ts`
   - `src/server/services/inventory.service.ts`

7. **Create Server Actions (co-located with routes)**
   - `src/app/[locale]/(dashboard)/warehouse/products/_actions.ts`
   - `src/app/[locale]/(dashboard)/warehouse/movements/_actions.ts`
   - `src/app/[locale]/(dashboard)/warehouse/inventory/_actions.ts`

8. **Create React Query Hooks (flat structure)**
   - `src/lib/hooks/queries/use-products.ts`
   - `src/lib/hooks/queries/use-movements.ts`
   - `src/lib/hooks/queries/use-inventory.ts`

9. **Update Warehouse Components**
   - Replace all direct fetches with React Query hooks
   - Remove old service imports
   - Test SSR with direct service calls (not server actions)

10. **Delete Old Files**
    - `src/modules/warehouse/api/*` (entire folder)
    - `src/app/actions/warehouse/*` (if exists)

**End of Week 1:**

- ✅ Warehouse fully migrated
- ✅ Foundation utilities in place
- ✅ Pattern proven and tested
- ✅ ~60% of codebase complexity handled

---

### **Week 2: Teams, Organization, News**

**Days 1-2: Teams/Contacts Module**

1. **Create Schemas**
   - `src/server/schemas/teams.ts`
   - `src/server/schemas/contacts.ts`

2. **Migrate Services**
   - `src/server/services/teams.service.ts`
   - `src/server/services/contacts.service.ts`

3. **Create Server Actions**
   - `src/app/actions/teams.ts`
   - `src/app/actions/contacts.ts`

4. **Create React Query Hooks**
   - `src/lib/hooks/queries/use-teams.ts`
   - `src/lib/hooks/queries/use-contacts.ts`

5. **Update Components**
   - Chat components
   - Team member lists
   - Contact management

**Days 3-4: Organization Module**

6. **Create Schemas**
   - `src/server/schemas/organization.ts`
   - `src/server/schemas/branches.ts`

7. **Migrate Services**
   - `src/server/services/organization.service.ts`
   - `src/server/services/branches.service.ts`

8. **Create Server Actions**
   - `src/app/actions/organization.ts`

9. **Create React Query Hooks**
   - `src/lib/hooks/queries/use-organization.ts`

10. **Update Components**
    - Organization settings
    - Branch management

**Day 5: News Module**

11. **Create Schemas**
    - `src/server/schemas/news.ts`

12. **Migrate Service**
    - `src/server/services/news.service.ts`

13. **Create Server Actions**
    - `src/app/actions/news.ts`

14. **Create React Query Hooks**
    - `src/lib/hooks/queries/use-news.ts`

15. **Update Components**
    - News feed
    - News creation dialog

**End of Week 2:**

- ✅ All major modules migrated
- ✅ Old patterns completely removed
- ✅ Single source of truth for all data

---

### **Week 3: Support, Cleanup, SSR Optimization**

**Days 1-2: Support Module**

1. **Create Schemas**
   - `src/server/schemas/support.ts`

2. **Migrate Service**
   - `src/server/services/support.service.ts`

3. **Create Server Actions**
   - `src/app/actions/support.ts`

4. **Create React Query Hooks**
   - `src/lib/hooks/queries/use-support.ts`

**Days 3-4: Cleanup**

5. **Remove Custom SWR**
   - Delete `src/lib/hooks/use-simple-swr.ts`
   - Find all usages: `grep -r "useSimpleSWR" src/`
   - Replace with React Query equivalents

6. **Remove Client-Side Supabase Calls**
   - Find: `grep -r "createClient()" src/app/ src/components/`
   - Replace with server actions
   - Keep only auth-related calls (login, logout, password reset)

7. **Delete Old API Folders**
   - `src/modules/*/api/` (all remaining)
   - Update imports across codebase

8. **Lint and Fix**
   ```bash
   npm run type-check
   npm run lint
   npm run format
   ```

**Day 5: SSR Optimization**

9. **Add Server-Side Prefetching**
   - Warehouse dashboard page
   - News feed
   - Team members page

10. **Configure React Query Optimizations**
    - Stale time configuration
    - Cache time tuning
    - Devtools setup

**End of Week 3:**

- ✅ All modules migrated
- ✅ Old code removed
- ✅ SSR optimized
- ✅ Single architecture

---

### **Week 4: Testing, Documentation, Final Polish**

**Days 1-2: Integration Testing**

1. **Setup Playwright**

   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Write Critical Flow Tests**
   - Login flow
   - Create warehouse movement
   - Create product
   - Create news post
   - Team member invitation

3. **Service Layer Unit Tests (optional)**
   - Products service
   - Movements service

**Days 3-4: Documentation**

4. **Update CLAUDE.md**
   - Document new architecture
   - Provide code examples
   - Migration guide for future features

5. **Create Developer Guide**
   - How to add new endpoints
   - React Query patterns
   - Server action patterns
   - Schema validation examples

6. **Code Comments**
   - Document complex services
   - Explain RLS patterns
   - Note security considerations

**Day 5: Performance & Security Audit**

7. **Performance Check**
   - Run Lighthouse on key pages
   - Check bundle size
   - Verify SSR is working
   - Test cache hit rates

8. **Security Audit**
   - Verify no client-side Supabase queries (except auth)
   - Check RLS policies
   - Test permission validation
   - Review error messages (no data leaks)

9. **Final Regression Test**
   - Test all modules end-to-end
   - Verify RBAC works
   - Test multi-tenancy (org/branch switching)

**End of Week 4:**

- ✅ Fully tested
- ✅ Documented
- ✅ Production-ready
- ✅ Team trained

---

## Foundation Files (Create First)

### 1. `src/server/schemas/common.ts`

```typescript
import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const uuidSchema = z.string().uuid();

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const sortSchema = z.object({
  field: z.string(),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export type DateRange = z.infer<typeof dateRangeSchema>;
export type Sort = z.infer<typeof sortSchema>;
```

### 2. Optional Helper: `src/lib/utils/assert-auth.ts`

```typescript
import { createClient } from "@/utils/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

/**
 * Simple auth helper (no middleware).
 * Returns user + supabase client or throws.
 */
export async function assertAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { user, supabase };
}

/**
 * Get user + organization context.
 */
export async function getUserContext() {
  const { user, supabase } = await assertAuth();
  const appContext = await loadAppContextServer();

  if (!appContext?.activeOrgId) {
    throw new Error("No organization context");
  }

  return {
    user,
    supabase,
    organizationId: appContext.activeOrgId,
    branchId: appContext.activeBranchId,
    userRole: appContext.userRole || "user",
    permissions: appContext.userPermissions || [],
  };
}
```

### 3. Update `src/app/providers.tsx`

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

---

## Example: Complete Products Module Migration

### Schema: `src/server/schemas/products.schema.ts` (input validation only)

```typescript
import { z } from "zod";
import { paginationSchema } from "./common";

// Only for CREATE/UPDATE inputs
export const createProductSchema = z.object({
  name: z.string().min(2).max(100),
  sku: z.string().min(1).max(50),
  barcode: z.string().nullable(),
  unit_id: z.string().uuid(),
});

export const updateProductSchema = createProductSchema.partial();

// Filter schemas
export const productFiltersSchema = paginationSchema.extend({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilters = z.infer<typeof productFiltersSchema>;
```

### Service: `src/server/services/products.service.ts` (FLAT structure)

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaginatedResult } from "@/server/utils/response";
import type { Database } from "@/supabase/types/types";
import type { ProductFilters, CreateProductInput } from "@/server/schemas/warehouse/products";

type Product = Database["public"]["Tables"]["products"]["Row"];

export class ProductsService {
  static async getProducts(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    filters: ProductFilters
  ): Promise<PaginatedResult<Product>> {
    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId);

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    return {
      items: data || [],
      total: count || 0,
      page: filters.page,
      pageSize: filters.pageSize,
      hasMore: count ? from + filters.pageSize < count : false,
    };
  }

  static async createProduct(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    userId: string,
    input: CreateProductInput
  ): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert({
        ...input,
        organization_id: organizationId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
```

### Server Action: `src/app/[locale]/(dashboard)/warehouse/products/_actions.ts` (co-located!)

```typescript
"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { productFiltersSchema, createProductSchema } from "@/server/schemas/products.schema";
import { ProductsService } from "@/server/services/products.service";

/**
 * Get paginated products.
 * No middleware - direct auth check.
 */
export async function getProducts(filters: unknown) {
  // Simple auth + context (no middleware wrapper)
  const ctx = await getUserContext();

  // Validate input
  const validatedFilters = productFiltersSchema.parse(filters);

  // Call service
  return await ProductsService.getProducts(ctx.supabase, ctx.organizationId, validatedFilters);
}

/**
 * Create product.
 */
export async function createProduct(input: unknown) {
  const ctx = await getUserContext();
  const validatedInput = createProductSchema.parse(input);

  return await ProductsService.createProduct(
    ctx.supabase,
    ctx.organizationId,
    ctx.user.id,
    validatedInput
  );
}
```

### React Query Hook: `src/lib/hooks/queries/use-products.ts` (FLAT structure)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { getProducts, createProduct } from "@/app/[locale]/(dashboard)/warehouse/products/_actions";
import type { ProductFilters, CreateProductInput } from "@/server/schemas/products.schema";

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: async () => {
      const result = await getProducts(filters || {});
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const result = await createProduct(input);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create product");
    },
  });
}
```

### Component Usage:

```typescript
"use client";

import { useProducts, useCreateProduct } from "@/lib/hooks/queries/warehouse/use-products";

export function ProductsPage() {
  const { data, isLoading } = useProducts({ page: 1, pageSize: 20 });
  const createMutation = useCreateProduct();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Products ({data?.total})</h1>
      {data?.items.map((product) => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

### SSR Prefetching (Server Component):

```typescript
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { ProductsService } from "@/server/services/products.service";
import { getUserContext } from "@/lib/utils/assert-auth";
import { ProductsPage } from "./products-page";

export default async function ProductsServerPage() {
  const queryClient = new QueryClient();

  // CORRECTION #5: Call service directly, NOT server action
  const ctx = await getUserContext();
  const data = await ProductsService.getProducts(
    ctx.supabase,
    ctx.organizationId,
    { page: 1, pageSize: 20 }
  );

  // Hydrate React Query with direct data
  queryClient.setQueryData(["products", { page: 1, pageSize: 20 }], data);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductsPage />
    </HydrationBoundary>
  );
}
```

**Why this is better:**

- Faster (no server action overhead)
- Cleaner logs
- Direct service call in SSR context

---

## Commands & Validation

### Find Commands

```bash
# Find client-side Supabase calls
grep -r "createClient()" src/app/ src/components/ src/modules/

# Find custom SWR usage
grep -r "useSimpleSWR" src/

# Find direct fetch calls
grep -r "fetch(" src/app/ src/components/

# Find all server actions
find src/app/actions -name "*.ts" -type f

# Find old service files
find src/modules -name "*service.ts" -type f
```

### Validation Script: `scripts/validate-architecture.sh`

```bash
#!/bin/bash

echo "🔍 Validating architecture..."

# Check for client-side Supabase calls
CLIENT_SUPABASE=$(grep -r "from \"@/utils/supabase/client\"" src/app src/components src/modules | grep -v "auth" | grep -v ".test." || true)
if [ -n "$CLIENT_SUPABASE" ]; then
  echo "❌ Found client-side Supabase calls:"
  echo "$CLIENT_SUPABASE"
  exit 1
fi

# Check for useSimpleSWR
SIMPLE_SWR=$(grep -r "useSimpleSWR" src/ || true)
if [ -n "$SIMPLE_SWR" ]; then
  echo "❌ Found deprecated useSimpleSWR:"
  echo "$SIMPLE_SWR"
  exit 1
fi

echo "✅ Architecture validation passed!"
```

---

## Migration Checklists

### Week 1 Checklist

- [ ] Install React Query + devtools
- [ ] Create foundation utilities (4 files)
- [ ] Create common schemas
- [ ] Update providers with QueryClient
- [ ] Create warehouse schemas (5 files)
- [ ] Migrate warehouse services (5 files)
- [ ] Create warehouse actions (5 files)
- [ ] Create warehouse hooks (5 files)
- [ ] Update warehouse components
- [ ] Delete old warehouse API folder

### Week 2 Checklist

- [ ] Migrate teams/contacts module
- [ ] Migrate organization module
- [ ] Migrate news module
- [ ] Test all migrated modules

### Week 3 Checklist

- [ ] Migrate support module
- [ ] Remove useSimpleSWR
- [ ] Remove client-side Supabase calls
- [ ] Delete old API folders
- [ ] Add SSR prefetching
- [ ] Optimize React Query config

### Week 4 Checklist

- [ ] Setup Playwright
- [ ] Write integration tests (5 flows)
- [ ] Update CLAUDE.md
- [ ] Create developer guide
- [ ] Performance audit
- [ ] Security audit
- [ ] Final regression test

---

## Success Metrics

- **Code Reduction:** 95% duplication eliminated
- **Type Safety:** 100% end-to-end
- **SSR:** All pages server-rendered
- **Developer Speed:** <15 min per new endpoint
- **Bug Reduction:** 50% fewer auth/validation bugs

---

## Summary of 5 Critical Corrections Applied

### ❗ Correction #1: No Middleware Wrappers

**Before:** Complex `withAuth` and `withContext` middleware decorators
**After:** Simple `getUserContext()` helper called directly in actions

**Why:** Simpler, faster, clearer stack traces, easier debugging

### ❗ Correction #2: Co-located Actions

**Before:** `src/app/actions/warehouse/products.ts` (global folder)
**After:** `src/app/[locale]/(dashboard)/warehouse/products/_actions.ts` (co-located)

**Why:** Next.js best practice, faster development, natural organization

### ❗ Correction #3: Flat Services Structure

**Before:** `src/server/services/warehouse/products.service.ts` (nested)
**After:** `src/server/services/products.service.ts` (flat)

**Why:** Simpler imports, faster searching, matches production patterns

### ❗ Correction #4: Minimal Zod Schemas

**Before:** Schemas for everything (products, filters, pagination, rows)
**After:** Schemas only for input validation (create, update, filters)

**Why:** DB types already exist from Supabase, avoid overengineering

### ❗ Correction #5: Direct Service Calls for SSR

**Before:** `queryClient.prefetchQuery({ queryFn: () => getProducts() })`
**After:** Direct service call + `queryClient.setQueryData()`

**Why:** Faster SSR, no server action overhead, cleaner logs

---

## Ready to Start?

1. Install React Query
2. Create foundation files (Week 1, Days 1-2)
   - `src/server/schemas/common.ts`
   - `src/lib/utils/assert-auth.ts`
   - Update `src/app/providers.tsx`
3. Migrate warehouse module with corrected patterns
4. Roll out to other modules

Let's build! 🚀
