# Phase 6: Performance & Testing

**Status:** ⚪ NOT STARTED
**Duration:** ~8 hours estimated
**Priority:** 🟢 MEDIUM
**Overall Progress:** 0%

---

## 📊 Progress Tracker

| Task                         | Status         | Duration | Deliverables        | Tests | Completion |
| ---------------------------- | -------------- | -------- | ------------------- | ----- | ---------- |
| 6.1 Performance Optimization | ⚪ Not Started | 4h       | Indexes, Benchmarks | 0/15  | 0%         |
| 6.2 Testing & Quality        | ⚪ Not Started | 4h       | Integration + E2E   | 0/35  | 0%         |

**Total:** 0/8 hours | 0/50 tests | 0% complete

---

## 🎯 Phase Goal

Optimize application performance and add comprehensive testing (integration + E2E) to ensure production readiness.

**Key Objectives:**

- Database query optimization with proper indexes
- React Query cache optimization
- SSR optimization for faster page loads
- Integration test suite for critical flows
- E2E test suite with Playwright
- CI/CD integration for automated testing

**Prerequisites:**

- ✅ V2 architecture complete
- ✅ At least one complete feature (Products module)
- ⚪ All previous phases complete

---

## Task 6.1: Performance Optimization (4 hours) ⚪

### 6.1.1 Database Performance (2 hours)

**Tasks:**

1. **Index Optimization** (1 hour)

**Missing Indexes to Add:**

```sql
-- Migration: YYYYMMDDHHMMSS_add_performance_indexes.sql

-- User role assignments (permission loading)
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_org
  ON public.user_role_assignments(user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_scope
  ON public.user_role_assignments(user_id, scope, scope_id);

-- User permission overrides (permission loading)
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_scope
  ON public.user_permission_overrides(user_id, scope, scope_id);

-- Branches (org loading)
CREATE INDEX IF NOT EXISTS idx_branches_org_deleted
  ON public.branches(organization_id, deleted_at);

-- Products (filtering and search)
CREATE INDEX IF NOT EXISTS idx_products_org_branch
  ON public.products(organization_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products(organization_id, category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_search
  ON public.products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_org_status
  ON public.products(organization_id, status)
  WHERE deleted_at IS NULL;
```

**Checklist:**

- [ ] Migration created
- [ ] All indexes added
- [ ] No duplicate indexes

2. **Query Optimization** (1 hour)

**Tasks:**

- [ ] Run EXPLAIN ANALYZE on all service layer queries
- [ ] Identify N+1 query patterns
- [ ] Optimize slow queries (target: < 200ms)
- [ ] Add database query logging for dev

**Slow Query Candidates:**

```sql
-- Permission loading (target: < 200ms)
EXPLAIN ANALYZE
SELECT * FROM user_role_assignments
WHERE user_id = '...' AND organization_id = '...';

-- Product listing (target: < 500ms)
EXPLAIN ANALYZE
SELECT * FROM products
WHERE organization_id = '...' AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;
```

**Benchmark Results Template:**

```markdown
# Performance Benchmarks

## Permission Loading

- Before: 450ms
- After: 120ms
- Improvement: 73%

## Product Listing (20 items)

- Before: 850ms
- After: 380ms
- Improvement: 55%

## Dashboard Context Loading

- Before: 620ms
- After: 180ms
- Improvement: 71%
```

**Checklist:**

- [ ] All queries analyzed
- [ ] Slow queries identified
- [ ] Optimizations applied
- [ ] Benchmarks documented

### 6.1.2 React Query Optimization (1 hour)

**Tasks:**

1. **Cache Configuration** (30 min)

**File:** `src/lib/react-query/query-client.ts`

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Optimize stale time based on data type
      staleTime: 5 * 60 * 1000, // 5 minutes default
      gcTime: 10 * 60 * 1000, // 10 minutes cache time
      retry: 1,
      refetchOnWindowFocus: false, // Reduce unnecessary refetches
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Per-query stale time overrides
export const queryOptions = {
  // Rarely changes
  permissions: { staleTime: 10 * 60 * 1000 }, // 10 minutes
  organizations: { staleTime: 15 * 60 * 1000 }, // 15 minutes

  // Changes frequently
  products: { staleTime: 2 * 60 * 1000 }, // 2 minutes
  notifications: { staleTime: 30 * 1000 }, // 30 seconds
};
```

**Checklist:**

- [ ] staleTime optimized per query type
- [ ] gcTime configured
- [ ] Refetch settings tuned

2. **Prefetching** (30 min)

**Add Prefetching for Common Flows:**

```typescript
// Prefetch products when hovering warehouse menu
export function useProductsPrefetch() {
  const queryClient = useQueryClient();

  const prefetchProducts = () => {
    queryClient.prefetchQuery({
      queryKey: productsKeys.lists(),
      queryFn: () => getProducts(),
    });
  };

  return { prefetchProducts };
}
```

**Locations to Add Prefetching:**

- [ ] Warehouse menu hover → Products
- [ ] Organization menu hover → Org settings
- [ ] User menu hover → Profile

**Checklist:**

- [ ] Prefetch hooks created
- [ ] Implemented in navigation
- [ ] Measured cache hit improvement

### 6.1.3 SSR Optimization (1 hour)

**Tasks:**

1. **HydrationBoundary for Critical Data** (30 min)

**Pattern:**

```typescript
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

export default async function ProductsPage() {
  const context = await loadDashboardContextV2();
  const queryClient = new QueryClient();

  // Prefetch critical data server-side
  await queryClient.prefetchQuery({
    queryKey: productsKeys.lists(),
    queryFn: () => ProductsService.list(context.activeOrgId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductsListClient />
    </HydrationBoundary>
  );
}
```

**Pages to Optimize:**

- [ ] Dashboard home
- [ ] Products list
- [ ] Organization settings

**Checklist:**

- [ ] HydrationBoundary added to critical pages
- [ ] Data prefetched server-side
- [ ] Client hydration working

2. **Core Web Vitals Measurement** (30 min)

**Add Web Vitals Reporting:**

```typescript
// src/app/web-vitals.ts
"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    console.log(metric);
    // Send to analytics
  });
}
```

**Measure:**

- [ ] TTFB (Time to First Byte) - Target: < 600ms
- [ ] FCP (First Contentful Paint) - Target: < 1.8s
- [ ] LCP (Largest Contentful Paint) - Target: < 2.5s
- [ ] CLS (Cumulative Layout Shift) - Target: < 0.1
- [ ] FID (First Input Delay) - Target: < 100ms

**Checklist:**

- [ ] Web Vitals tracking added
- [ ] Lighthouse audit run (target: > 90)
- [ ] Performance metrics documented

### Definition of Done ✅

- [ ] All indexes added
- [ ] Slow queries optimized (< 200ms)
- [ ] React Query cache tuned
- [ ] Prefetching implemented
- [ ] SSR optimization complete
- [ ] Lighthouse score > 90
- [ ] Performance benchmarks documented

---

## Task 6.2: Testing & Quality (4 hours) ⚪

### 6.2.1 Integration Tests (2 hours)

**Goal:** Test critical user flows end-to-end using Vitest + MSW

**Setup:**

- [ ] MSW handlers for all API endpoints
- [ ] Test utilities for auth/context mocking
- [ ] Database fixtures for test data

**Critical Flows to Test:**

1. **User Registration → Login → Profile** (30 min)

**File:** `src/__tests__/integration/auth-flow.test.ts`

```typescript
describe("Auth Flow Integration", () => {
  it("should complete full registration flow", async () => {
    // 1. Register user
    const { user } = await authService.register({
      email: "test@example.com",
      password: "SecurePass123!",
    });
    expect(user).toBeDefined();

    // 2. Login
    const session = await authService.login({
      email: "test@example.com",
      password: "SecurePass123!",
    });
    expect(session.access_token).toBeDefined();

    // 3. Load user context
    const context = await loadUserContextServer(user.id);
    expect(context.user.email).toBe("test@example.com");

    // 4. Update profile
    const updated = await userService.updateProfile(user.id, {
      name: "Test User",
    });
    expect(updated.name).toBe("Test User");
  });
});
```

2. **Org Creation → Branch → Users** (30 min)

**File:** `src/__tests__/integration/org-flow.test.ts`

```typescript
describe("Organization Flow Integration", () => {
  it("should create org, branch, and invite user", async () => {
    // 1. Create organization
    const org = await organizationService.create(
      {
        name: "Test Org",
        slug: "test-org",
      },
      userId
    );
    expect(org).toBeDefined();

    // 2. Create branch
    const branch = await branchService.create(
      {
        name: "Main Branch",
        organization_id: org.id,
      },
      org.id
    );
    expect(branch).toBeDefined();

    // 3. Invite user
    const invitation = await invitationService.create(
      "user@example.com",
      org.id,
      "branch_admin",
      userId
    );
    expect(invitation.status).toBe("pending");

    // 4. Accept invitation
    await invitationService.accept(invitation.token, newUserId);
    const members = await organizationService.getMembers(org.id);
    expect(members).toHaveLength(2);
  });
});
```

3. **Products CRUD with Permissions** (1 hour)

**File:** `src/__tests__/integration/products-flow.test.ts`

```typescript
describe("Products Flow Integration", () => {
  it("should enforce permissions for product CRUD", async () => {
    // Setup: User with warehouse.products.* permission
    const context = await setupTestContext({
      permissions: ["warehouse.products.create", "warehouse.products.update"],
    });

    // 1. Create product (should succeed)
    const product = await productsService.create(
      {
        name: "Test Product",
        sku: "TEST-001",
        price: 99.99,
      },
      context.activeOrgId,
      context.activeBranchId
    );
    expect(product).toBeDefined();

    // 2. Update product (should succeed)
    const updated = await productsService.update(
      product.id,
      {
        price: 89.99,
      },
      context.activeOrgId
    );
    expect(updated.price).toBe(89.99);

    // 3. Delete product (should fail - no permission)
    await expect(productsService.delete(product.id, context.activeOrgId)).rejects.toThrow(
      "Permission denied"
    );

    // 4. Test cross-tenant access (should fail)
    const otherContext = await setupTestContext({ orgId: "other-org" });
    await expect(productsService.getById(product.id, otherContext.activeOrgId)).resolves.toBeNull();
  });
});
```

**Checklist:**

- [ ] Auth flow tests (5 tests)
- [ ] Org flow tests (8 tests)
- [ ] Products flow tests (12 tests)
- [ ] Permission enforcement tests (10 tests)
- [ ] Total: 35 integration tests passing

### 6.2.2 E2E Tests with Playwright (2 hours)

**Setup Playwright:**

```bash
npm install -D @playwright/test
npx playwright install
```

**Config:** `playwright.config.ts`

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

**E2E Test Suites:**

1. **Auth Flows** (30 min)

**File:** `e2e/auth.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should login successfully", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/dashboard");
    await expect(page.locator("text=Welcome")).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="email"]', "invalid@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=Invalid credentials")).toBeVisible();
  });
});
```

2. **Organization Management** (30 min)

**File:** `e2e/organization.spec.ts`

```typescript
test.describe("Organization Management", () => {
  test("should create and edit organization", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/organization/settings");

    // Edit org name
    await page.fill('input[name="name"]', "Updated Org Name");
    await page.click('button:has-text("Save")');

    await expect(page.locator("text=Organization updated")).toBeVisible();
  });
});
```

3. **Products CRUD** (30 min)

**File:** `e2e/products.spec.ts`

```typescript
test.describe("Products", () => {
  test("should create, edit, and delete product", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/warehouse/products");

    // Create product
    await page.click('button:has-text("Create Product")');
    await page.fill('input[name="name"]', "Test Product");
    await page.fill('input[name="sku"]', "TEST-001");
    await page.fill('input[name="price"]', "99.99");
    await page.click('button:has-text("Create")');

    await expect(page.locator("text=Product created")).toBeVisible();
    await expect(page.locator("text=Test Product")).toBeVisible();

    // Edit product
    await page.click('button[aria-label="Edit Product"]');
    await page.fill('input[name="price"]', "89.99");
    await page.click('button:has-text("Update")');

    await expect(page.locator("text=Product updated")).toBeVisible();

    // Delete product
    await page.click('button[aria-label="Delete Product"]');
    await page.click('button:has-text("Confirm")');

    await expect(page.locator("text=Product deleted")).toBeVisible();
  });
});
```

4. **Permission Gating** (30 min)

**File:** `e2e/permissions.spec.ts`

```typescript
test.describe("Permission Gating", () => {
  test("should hide actions without permission", async ({ page }) => {
    await loginAsViewer(page); // User with read-only permissions
    await page.goto("/dashboard/warehouse/products");

    // Create button should not be visible
    await expect(page.locator('button:has-text("Create Product")')).not.toBeVisible();

    // Delete buttons should not be visible
    await expect(page.locator('button[aria-label="Delete Product"]')).not.toBeVisible();
  });

  test("should show error when attempting unauthorized action", async ({ page }) => {
    await loginAsViewer(page);

    // Try to access admin page directly
    await page.goto("/dashboard/organization/settings");

    await expect(page.locator("text=Permission denied")).toBeVisible();
  });
});
```

**Checklist:**

- [ ] Playwright setup complete
- [ ] Auth E2E tests (5 tests)
- [ ] Org management E2E tests (3 tests)
- [ ] Products CRUD E2E tests (4 tests)
- [ ] Permission gating E2E tests (3 tests)
- [ ] Total: 15 E2E tests passing

### 6.2.3 CI/CD Integration (30 min)

**GitHub Actions Workflow:**

**File:** `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run type check
        run: npm run type-check

      - name: Run lint
        run: npm run lint

      - name: Run unit tests
        run: npm test

      - name: Run build
        run: npm run build

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: playwright-report/
```

**Checklist:**

- [ ] GitHub Actions workflow created
- [ ] All tests run in CI
- [ ] Test results uploaded
- [ ] Status badge added to README

### Definition of Done ✅

- [ ] Integration tests passing (35 tests)
- [ ] E2E tests passing (15 tests)
- [ ] CI/CD configured
- [ ] All tests run on push/PR
- [ ] Critical paths covered
- [ ] Test coverage > 70% overall

---

## 📈 Success Metrics

- [ ] **Page load < 2s** - All pages load fast
- [ ] **Permission load < 200ms** - Permission system optimized
- [ ] **Lighthouse > 90** - Performance, accessibility, SEO
- [ ] **50+ tests passing** - Integration + E2E coverage
- [ ] **CI/CD integrated** - Automated testing on all PRs
- [ ] **No console warnings** - Clean production build
- [ ] **Performance documented** - Benchmarks and improvements tracked

---

## 🔄 Next Steps

After Phase 6 completion:

- **Dashboard V2 rebuild is COMPLETE** 🎉
- Deploy to production
- Monitor performance and errors
- Gather user feedback
- Plan additional features

---

## 📚 Performance Documentation

Create comprehensive performance documentation:

**File:** `docs/coreframe-rebuild/PERFORMANCE_REPORT.md`

**Contents:**

- Benchmark results (before/after)
- Query optimization details
- React Query cache strategy
- SSR optimization techniques
- Core Web Vitals measurements
- Lighthouse audit results
- Recommendations for future improvements

---

**Last Updated:** 2026-01-27
**Status:** ⚪ Not Started
**Requires:** All previous phases complete
**Next Task:** 6.1 Performance Optimization
