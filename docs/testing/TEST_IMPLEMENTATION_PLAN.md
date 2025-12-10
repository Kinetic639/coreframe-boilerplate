# Test Implementation Plan - Coreframe Boilerplate

**Version**: 2.0 (Revised)
**Created**: 2025-12-10
**Status**: Aligned with Active Refactor
**Approach**: Incremental milestones, not mega-plan

---

## ⚠️ CRITICAL: Read This First

**DO NOT START TESTING YET**

This plan is aligned with your ongoing AppContext refactor. Testing before the refactor completes will result in:

- ❌ Immediate test rewrites
- ❌ Wasted engineering time
- ❌ Inconsistent test coverage
- ❌ False confidence in broken architecture

**Correct Order**:

1. ✅ Complete AppContext refactor
2. ✅ Finalize AppContextSpec
3. ✅ Freeze RLS contract
4. ✅ Freeze service signatures
5. ➡️ **THEN** start testing

---

## Quick Navigation

- [Executive Summary](#executive-summary)
- [Current State Assessment](#current-state-assessment)
- [Testing Philosophy](#testing-philosophy)
- [Milestone 1: Foundation (Post-Refactor)](#milestone-1-foundation-post-refactor)
- [Milestone 2: Core Business Logic](#milestone-2-core-business-logic)
- [Milestone 3: User-Facing Features](#milestone-3-user-facing-features)
- [Testing Commands](#testing-commands)
- [Success Metrics](#success-metrics)

---

## Executive Summary

### What Changed From V1.0

| Issue                | V1.0 Problem                   | V2.0 Solution                                                  |
| -------------------- | ------------------------------ | -------------------------------------------------------------- |
| **Environment**      | Referenced Happy-DOM           | ✅ Corrected to jsdom (default) + node override                |
| **Timeline**         | Unrealistic 15 weeks           | ✅ 3 incremental milestones                                    |
| **Refactor**         | Tests AppStore before refactor | ✅ Tests AFTER AppContext refactor complete                    |
| **Dependency Order** | Some violations                | ✅ Strict: AppContext → Auth → Services → Actions → Hooks → UI |
| **Scope**            | Tests every file               | ✅ Tests features/behaviors, not implementation                |
| **Integration**      | 15-20 integration tests        | ✅ Minimal, critical workflows only                            |
| **Realism**          | Assumes stable codebase        | ✅ Aligned with active migration                               |

### Current Reality

✅ **Testing Infrastructure**: Production-ready (Vitest, MSW, Testing Library, harnesses)
⚠️ **Codebase State**: In active refactor (AppContext, RLS, permissions)
❌ **Production Tests**: Zero (only 2 example tests)

**Key Insight**: You cannot build a comprehensive test suite while the foundation is shifting.

---

## Current State Assessment

### What's Complete ✅

- Vitest 4.0.15 with TypeScript strict mode
- Testing Library (React, DOM, User Event)
- MSW with Supabase handlers
- **jsdom** environment (default) + node override
- Supabase client mocks with 8 error helpers
- Server action mocking utilities
- AppContext harness (Zustand + SSR)
- React Query harness with cache control
- Automatic mock cleanup

### What's In Progress ⚠️

- AppContext refactor (removing business data, splitting responsibilities)
- AppContextSpec creation
- `loadAppContextServer` simplification
- RLS policy finalization
- Service signature stabilization

### What's Blocking Testing 🚫

Until these are frozen, tests will break:

1. AppContext structure
2. loadAppContextServer data sources
3. Permission system contracts
4. Service method signatures
5. RLS policy behavior

---

## Testing Philosophy

### Test Features, Not Files

❌ **Wrong Approach**:

- Test every internal helper
- Test implementation details
- Aim for 100% line coverage

✅ **Correct Approach**:

- Test public APIs and user-facing behavior
- Test critical business rules
- Aim for 80% behavioral coverage

### Test Pyramid (Correct Ratios)

```
        /\
       /  \   E2E (5% - optional)
      /____\
     /      \  Integration (15% - minimal)
    /________\
   /          \ Unit (80% - majority)
  /__________\
```

### Environment Usage

| Test Type      | Environment       | Annotation                 |
| -------------- | ----------------- | -------------------------- |
| Services       | `node`            | `@vitest-environment node` |
| Server Actions | `node`            | `@vitest-environment node` |
| SSR Context    | `node`            | `@vitest-environment node` |
| Components     | `jsdom`           | (default, no annotation)   |
| Hooks          | `jsdom`           | (default, no annotation)   |
| Pure Utils     | `node` or `jsdom` | Context-dependent          |

---

## Milestone 1: Foundation (Post-Refactor)

**Prerequisites**: AppContext refactor complete, AppContextSpec finalized

**Duration**: 1-2 weeks (single engineer)

**Coverage Target**: 50% (foundation only)

---

### Phase 0: Verify Refactor Complete

**Before writing ANY tests, verify**:

```bash
# 1. AppContextSpec exists and is finalized
ls src/lib/api/app-context-spec.ts

# 2. loadAppContextServer is stable
git log --oneline src/lib/api/load-app-context-server.ts | head -5
# Should show no recent changes

# 3. RLS policies are frozen
# Check with database team

# 4. Service signatures are stable
git log --oneline src/server/services/ | head -10
# Should show no major refactors in progress
```

**If ANY of these are unstable** ➡️ STOP. Wait for refactor completion.

---

### 1.1 Auth Utilities (Days 1-2)

**Location**: `src/utils/auth/`

**Why First**: Zero dependencies, used everywhere

**Test Files**:

```
src/utils/auth/__tests__/getUserRolesFromJWT.test.ts [@vitest-environment node]
src/utils/auth/__tests__/hasMatchingRole.test.ts [@vitest-environment node]
src/utils/auth/__tests__/getRolesClient.test.ts [jsdom]
src/utils/auth/__tests__/getRolesServer.test.ts [@vitest-environment node]
```

**Critical Tests**:

- JWT parsing (valid, expired, malformed)
- Role extraction with organization scope
- Role matching (exact, wildcard)
- Token refresh handling (**NEW** - missed in V1.0)

**Example**:

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { getUserRolesFromJWT } from "../getUserRolesFromJWT";

describe("getUserRolesFromJWT", () => {
  it("extracts roles from valid JWT", () => {
    const jwt = createMockJWT({ roles: ["admin", "user"] });
    const roles = getUserRolesFromJWT(jwt);

    expect(roles).toEqual(["admin", "user"]);
  });

  it("handles expired JWT gracefully", () => {
    const jwt = createExpiredJWT();
    const roles = getUserRolesFromJWT(jwt);

    expect(roles).toEqual([]);
  });

  it("filters by organization scope", () => {
    const jwt = createMockJWT({
      roles: [
        { name: "admin", org_id: "org-1" },
        { name: "user", org_id: "org-2" },
      ],
    });

    const roles = getUserRolesFromJWT(jwt, { orgId: "org-1" });

    expect(roles).toEqual(["admin"]);
  });
});
```

**Blocks**: Permission system, server actions, all RBAC

---

### 1.2 Supabase Client (Days 2-3)

**Location**: `src/utils/supabase/`

**Test Files**:

```
src/utils/supabase/__tests__/client.test.ts [jsdom]
src/utils/supabase/__tests__/server.test.ts [@vitest-environment node]
```

**Critical Tests**:

- Client creation with correct config
- Singleton pattern
- Cookie-based auth (server)
- Session refresh
- Environment variable validation

**Blocks**: All database operations

---

### 1.3 NEW AppContext (SSR + Client) (Days 3-5)

**⚠️ WAIT**: Only test AFTER refactor complete

**Location**:

- `src/lib/api/load-app-context-server.ts` (SSR)
- `src/lib/stores/app-store.ts` (Client)

**Test Files**:

```
src/lib/api/__tests__/load-app-context-server.test.ts [@vitest-environment node]
src/lib/stores/__tests__/app-store.test.ts [jsdom]
```

**SSR Tests** (`@vitest-environment node`):

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { loadAppContextServer } from "../load-app-context-server";
import { createMockSupabaseClient, mockAuthError } from "@/test/setup-supabase-mocks";

describe("loadAppContextServer", () => {
  describe("authentication", () => {
    it("handles unauthenticated user", async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getUser().mockResolvedValue(mockAuthError());

      await expect(loadAppContextServer()).rejects.toThrow(/unauthenticated/);
    });

    it("loads context for valid session", async () => {
      const context = await loadAppContextServer();

      expect(context).toHaveProperty("activeOrg");
      expect(context).toHaveProperty("activeBranch");
      expect(context).toHaveProperty("availableBranches");
    });
  });

  describe("organization detection", () => {
    it("uses user preference as priority 1", async () => {
      // Mock user preferences with org_id
      const context = await loadAppContextServer();

      expect(context.activeOrgId).toBe("preferred-org-id");
    });

    it("falls back to JWT roles when no preference", async () => {
      // Mock no preferences, but JWT has role with org_id
      const context = await loadAppContextServer();

      expect(context.activeOrgId).toBeTruthy();
    });

    it("falls back to owned orgs as last resort", async () => {
      // Mock no preferences, no JWT roles, but user owns orgs
      const context = await loadAppContextServer();

      expect(context.activeOrgId).toBeTruthy();
    });
  });

  describe("branch switching", () => {
    it("loads active branch data", async () => {
      const context = await loadAppContextServer();

      expect(context.activeBranch).toBeDefined();
      expect(context.activeBranchId).toBe(context.activeBranch?.id);
    });

    it("defaults to first branch when none specified", async () => {
      const context = await loadAppContextServer();

      expect(context.availableBranches).toHaveLength.greaterThan(0);
      expect(context.activeBranchId).toBe(context.availableBranches[0].id);
    });
  });

  describe("React cache behavior", () => {
    it("deduplicates calls within render cycle", async () => {
      const spy = vi.spyOn(mockSupabase, "from");

      await Promise.all([loadAppContextServer(), loadAppContextServer(), loadAppContextServer()]);

      // Should only call database once due to React cache()
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
```

**Client Store Tests** (`jsdom`):

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../app-store";

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.getState().clear();
  });

  describe("SSR hydration", () => {
    it("initializes with empty state", () => {
      const state = useAppStore.getState();

      expect(state.isLoaded).toBe(false);
      expect(state.activeOrg).toBeNull();
      expect(state.activeBranch).toBeNull();
    });

    it("hydrates from SSR context", () => {
      const mockContext = createMockAppContext();

      useAppStore.getState().setContext(mockContext);

      const state = useAppStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.activeOrg).toEqual(mockContext.activeOrg);
    });
  });

  describe("branch switching", () => {
    it("switches active branch", () => {
      const mockContext = createMockAppContext({
        availableBranches: [
          { id: "branch-1", name: "Branch 1" },
          { id: "branch-2", name: "Branch 2" },
        ],
        activeBranchId: "branch-1",
      });

      useAppStore.getState().setContext(mockContext);
      useAppStore.getState().setActiveBranch("branch-2");

      expect(useAppStore.getState().activeBranchId).toBe("branch-2");
    });

    it("invalidates branch-specific data on switch", () => {
      // Test that locations/suppliers are cleared when branch changes
      useAppStore.getState().setContext(createMockAppContext());
      useAppStore.getState().setActiveBranch("new-branch");

      expect(useAppStore.getState().locations).toEqual([]);
    });
  });

  describe("organization switching", () => {
    it("triggers full context reload", () => {
      // **NEW** - missed in V1.0
      const reloadSpy = vi.fn();

      useAppStore.getState().setContext(createMockAppContext());
      // Simulate org switch - should trigger reload

      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
```

**Blocks**: Everything

---

### 1.4 Permission System (Days 5-7)

**Location**: `src/hooks/usePermissions.ts`

**Test File**: `src/hooks/__tests__/usePermissions.test.ts` [jsdom]

**Critical Tests** (**Enhanced from V1.0**):

- Fetches permissions on mount
- `hasPermission()` checker
- Nested permission paths
- **Permission cache invalidation** (**NEW**)
- **Role change triggers refetch** (**NEW**)
- **Org switch → permission reload** (**NEW**)

**Example**:

```typescript
import { renderWithAppContext } from '@/test/harnesses/app-context-harness'
import { waitFor, screen } from '@testing-library/react'

describe('usePermissions', () => {
  it('reloads permissions on organization switch', async () => {
    const { rerender } = renderWithAppContext(<TestComponent />, {
      appContext: { activeOrgId: 'org-1' }
    })

    await waitFor(() => {
      expect(screen.getByText(/org-1 permissions/i)).toBeInTheDocument()
    })

    // Switch organization
    rerender(<TestComponent />, {
      appContext: { activeOrgId: 'org-2' }
    })

    await waitFor(() => {
      expect(screen.getByText(/org-2 permissions/i)).toBeInTheDocument()
    })
  })

  it('invalidates cache on role change', async () => {
    // **NEW** - critical for permission system
    const { queryClient } = renderWithReactQuery(<TestComponent />)

    // Simulate role change
    await updateUserRole('admin')

    // Verify permission cache invalidated
    expect(queryClient.getQueryState(['permissions'])?.isInvalidated).toBe(true)
  })
})
```

**Blocks**: All RBAC, permission-gated UI

---

### Milestone 1 Complete ✅

**At this point you have**:

- ✅ Auth system validated
- ✅ AppContext (SSR + Client) tested
- ✅ Permission system tested
- ✅ Foundation stable

**Coverage**: ~50% (foundation only)

**Ready for**: Milestone 2 (Business Logic)

---

## Milestone 2: Core Business Logic

**Prerequisites**: Milestone 1 complete, service signatures frozen

**Duration**: 2-3 weeks (single engineer)

**Coverage Target**: 70% (foundation + services)

---

### 2.1 Test Services by Dependency (Bottom-Up)

**Correct Order** (leaf → root):

```
1. Movement Types (no deps)
2. Categories (no deps)
3. Units (no deps)
   ↓
4. Products (depends on: Categories, Units)
5. Product Variants (depends on: Products)
   ↓
6. Locations (no deps)
   ↓
7. Movement Validation (depends on: Products, Movement Types, Locations)
   ↓
8. Stock Movements (depends on: Movement Validation, Products, Locations)
   ↓
9. Reservations (depends on: Stock Movements)
10. Transfers (depends on: Stock Movements, Reservations)
```

**⚠️ Do NOT test services before domain logic is frozen**

If warehouse movement logic is still being refined ➡️ WAIT

---

### Service Test Pattern

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ProductsService } from "../products.service";
import {
  createMockSupabaseClient,
  mockRLSError,
  mockUniqueConstraintError,
  mockForeignKeyError,
} from "@/test/setup-supabase-mocks";

describe("ProductsService", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  describe("createProduct", () => {
    it("creates product successfully", async () => {
      mockSupabase
        .from()
        .insert()
        .select()
        .single()
        .mockResolvedValue({
          data: { id: "product-1", name: "Test" },
          error: null,
        });

      const result = await ProductsService.createProduct(mockSupabase, "org-id", {
        name: "Test",
        sku: "SKU-1",
      });

      expect(result.success).toBe(true);
    });

    it("handles RLS violation", async () => {
      mockSupabase.from().insert().mockResolvedValue(mockRLSError());

      const result = await ProductsService.createProduct(mockSupabase, "org-id", {
        name: "Test",
        sku: "SKU-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("permission");
    });

    it("handles unique constraint (duplicate SKU)", async () => {
      mockSupabase.from().insert().mockResolvedValue(mockUniqueConstraintError("products_sku_key"));

      const result = await ProductsService.createProduct(mockSupabase, "org-id", {
        name: "Test",
        sku: "EXISTING-SKU",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("handles foreign key error (invalid category)", async () => {
      mockSupabase
        .from()
        .insert()
        .mockResolvedValue(mockForeignKeyError("products_category_id_fkey"));

      const result = await ProductsService.createProduct(mockSupabase, "org-id", {
        name: "Test",
        sku: "SKU-1",
        category_id: "invalid",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("category");
    });
  });

  describe("getProducts (read operation)", () => {
    it("filters by organization", async () => {
      const result = await ProductsService.getProducts(mockSupabase, "org-123", {});

      // Verify org filter applied
      expect(mockSupabase.from).toHaveBeenCalledWith("products");
      expect(mockSupabase.from().eq).toHaveBeenCalledWith("organization_id", "org-123");
    });

    it("paginates results", async () => {
      const result = await ProductsService.getProducts(mockSupabase, "org-id", {
        page: 2,
        limit: 20,
      });

      expect(mockSupabase.from().limit).toHaveBeenCalledWith(20);
      expect(mockSupabase.from().offset).toHaveBeenCalledWith(20);
    });
  });
});
```

---

### 2.2 Server Actions (After Services Stable)

**Environment**: `@vitest-environment node`

**Test Pattern**:

```typescript
/**
 * @vitest-environment node
 */
import { vi } from "vitest";
import { createProductAction } from "../warehouse/products";
import { createMockSupabaseClient } from "@/test/setup-supabase-mocks";

vi.mock("@/utils/supabase/server", () => ({
  createClient: () => createMockSupabaseClient(),
}));

describe("createProductAction", () => {
  it("validates input before calling service", async () => {
    const result = await createProductAction({
      name: "", // Invalid
      sku: "SKU-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("required");
  });

  it("requires authentication", async () => {
    mockSupabase.auth.getUser().mockResolvedValue(mockAuthError());

    const result = await createProductAction({
      name: "Product",
      sku: "SKU-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("authentication");
  });

  it("enforces permissions", async () => {
    // Mock user without 'warehouse.products.create' permission
    const result = await createProductAction({
      name: "Product",
      sku: "SKU-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("permission");
  });

  it("creates product when valid", async () => {
    const result = await createProductAction({
      name: "Valid Product",
      sku: "SKU-001",
      organizationId: "org-123",
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("id");
  });
});
```

**Test only critical actions** (20-30 files, not 40+):

- Product CRUD
- Movement create/approve
- Delivery process
- Transfer workflows

---

### Milestone 2 Complete ✅

**At this point you have**:

- ✅ All critical services tested
- ✅ Server actions validated
- ✅ Business rules enforced

**Coverage**: ~70% (foundation + business logic)

**Ready for**: Milestone 3 (User-Facing)

---

## Milestone 3: User-Facing Features

**Prerequisites**: Milestone 2 complete

**Duration**: 2-3 weeks (single engineer)

**Coverage Target**: 80% (comprehensive)

---

### 3.1 React Query Hooks

**Environment**: `jsdom` (default)

**Test Pattern**:

```typescript
import { renderWithReactQuery } from '@/test/harnesses/react-query-harness'
import { mockServerAction } from '@/test/server-action-mocks'
import { waitFor, screen } from '@testing-library/react'

describe('useProducts', () => {
  it('fetches products on mount', async () => {
    mockServerAction('@/app/actions/warehouse/get-products', 'getProducts', {
      products: [{ id: '1', name: 'Product 1' }],
      total: 1
    })

    function TestComponent() {
      const { data, isLoading } = useProducts()
      if (isLoading) return <div>Loading...</div>
      return <div>{data?.products[0].name}</div>
    }

    renderWithReactQuery(<TestComponent />)

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument()
    })
  })

  it('uses correct cache key', () => {
    const { queryClient } = renderWithReactQuery(<TestComponent />)

    // Verify cache key structure
    const data = queryClient.getQueryData(['products', { orgId: 'org-123' }])
    expect(data).toBeDefined()
  })
})
```

**Test only critical hooks** (10-12, not 19+):

- useProducts
- useStockMovements
- useInventory
- usePermissions
- useAppContext

---

### 3.2 Components (Behavior, Not Implementation)

**Environment**: `jsdom` (default)

**Test user-facing behavior**:

```typescript
import { renderWithAppContext } from '@/test/harnesses/app-context-harness'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('CreateMovementDialog', () => {
  it('submits form successfully', async () => {
    const user = userEvent.setup()
    mockServerAction('@/app/actions/warehouse/create-movement', 'createMovement', {
      id: 'movement-1'
    })

    renderWithAppContext(<CreateMovementDialog open={true} />)

    // User actions
    await user.click(screen.getByLabelText(/movement type/i))
    await user.click(screen.getByText(/101 - receipt/i))
    await user.type(screen.getByLabelText(/quantity/i), '10')
    await user.click(screen.getByRole('button', { name: /create/i }))

    // Verify outcome
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument()
    })
  })

  it('shows validation errors', async () => {
    const user = userEvent.setup()
    renderWithAppContext(<CreateMovementDialog open={true} />)

    // Submit without filling
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(screen.getByText(/required/i)).toBeInTheDocument()
  })
})
```

**Test only critical components** (20-30, not 60+):

- Movement dialogs
- Product forms
- Stock displays
- Permission gates

---

### 3.3 Integration Tests (Minimal!)

**⚠️ Limit to 3-5 critical workflows**

**Why minimal**: Integration tests are expensive and fragile.

**Critical workflows only**:

1. **Stock receipt workflow** (highest priority)

```typescript
describe("Stock Receipt Workflow", () => {
  it("receives stock and updates inventory", async () => {
    // 1. Create product
    const product = await createTestProduct();

    // 2. Create location
    const location = await createTestLocation();

    // 3. Receive 10 units
    await createMovement({
      type_code: 101,
      product_id: product.id,
      destination_location_id: location.id,
      quantity: 10,
    });

    // 4. Verify inventory
    const inventory = await getInventory({ product_id: product.id });
    expect(inventory.available_quantity).toBe(10);
  });
});
```

2. **Permission-gated access** (security critical)
3. **Branch switching** (multi-tenancy critical)

**That's it.** 3 integration tests maximum.

---

### Milestone 3 Complete ✅

**At this point you have**:

- ✅ Foundation tested (50%)
- ✅ Business logic tested (70%)
- ✅ User-facing features tested (80%)
- ✅ Critical workflows validated

**Coverage**: ~80% (comprehensive)

**Ready for**: RLS simulation (optional)

---

## RLS Simulation (Optional Phase)

**When**: After all other tests pass consistently

**Purpose**: Validate error handling for RLS denials

**Approach**: Add RLS error scenarios to existing tests

```typescript
describe("ProductsService RLS", () => {
  it("handles 403 RLS on insert", async () => {
    mockSupabase.from().insert().mockResolvedValue(mockRLSError());

    const result = await ProductsService.createProduct(mockSupabase, "org-id", data);

    expect(result.success).toBe(false);
    expect(result.error).toContain("permission");
  });
});
```

**Use MSW for component tests**:

```typescript
describe('ProductList RLS', () => {
  it('shows permission denied on 403', async () => {
    server.use(
      http.get('*/rest/v1/products*', () => {
        return HttpResponse.json(
          { message: 'RLS violation', code: 'PGRST301' },
          { status: 403 }
        )
      })
    )

    renderWithAppContext(<ProductList />)

    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument()
    })
  })
})
```

---

## Testing Commands

### Basic Commands

```bash
# Run all tests
pnpm test:run

# Run in watch mode
pnpm test

# Run with UI
pnpm test:ui

# Run with coverage
pnpm test:coverage

# Run specific file
pnpm test:run src/server/services/__tests__/products.service.test.ts
```

### Development Workflow

```bash
# 1. Verify refactor complete
git log --oneline src/lib/api/load-app-context-server.ts | head -3

# 2. Start with foundation
pnpm test src/utils/auth/__tests__/

# 3. Progressive testing
pnpm test:run -- --coverage

# 4. Check coverage
open coverage/index.html
```

---

## Success Metrics

### Progressive Coverage Targets

| Milestone   | Coverage               | Timeframe     |
| ----------- | ---------------------- | ------------- |
| Milestone 1 | 50% (foundation)       | 1-2 weeks     |
| Milestone 2 | 70% (+ business logic) | 2-3 weeks     |
| Milestone 3 | 80% (+ user features)  | 2-3 weeks     |
| **Total**   | **80%**                | **5-8 weeks** |

### Quality Gates

- ✅ All tests pass before PR merge
- ✅ No decrease in coverage
- ✅ Critical paths at 100% (auth, permissions, stock movements)
- ✅ RLS errors handled gracefully

---

## FAQ

### Q: Can I start testing now?

**A**: Only if:

1. ✅ AppContext refactor is complete
2. ✅ AppContextSpec is finalized
3. ✅ RLS policies are frozen
4. ✅ Service signatures are stable

If **any** of these are false ➡️ **WAIT**

### Q: Why not test everything?

**A**: Testing implementation details leads to:

- ❌ Brittle tests (break on refactor)
- ❌ Maintenance burden
- ❌ False confidence

Test behaviors, not implementation.

### Q: What about E2E tests?

**A**: Optional. Only add after:

1. Unit tests stable
2. Integration tests passing
3. Manual QA validates critical paths

Use Playwright if needed, but prioritize unit tests.

### Q: Can I test during migration?

**A**: No. Testing unstable code wastes time.

**Correct order**:

1. Complete migration
2. Stabilize architecture
3. Write tests

---

## Next Steps

**Immediate** (Right Now):

1. ✅ Verify AppContext refactor status
2. ✅ Read AppContextSpec (once it exists)
3. ✅ Review this plan with team

**Short-Term** (This Week):

1. ⏳ Wait for refactor completion
2. ⏳ Freeze RLS policies
3. ⏳ Freeze service signatures

**Once Ready** (Start Testing):

1. ➡️ Milestone 1, Phase 1.1: Auth Utilities
2. ➡️ Follow dependency order strictly
3. ➡️ Track coverage weekly

---

**Questions?** See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for testing patterns.

**Important**: This is a living document. Update as architecture stabilizes.
