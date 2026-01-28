# Coreframe Dashboard V2 Rebuild

**Last Updated:** 2026-01-28
**Status:** 🟢 Phase 1 (RLS & Security) - 85% Complete (Gates A/B/C Pass, 85 pgTAP Tests)

---

## 📊 OVERALL PROGRESS TRACKER

### Summary: 60% Complete (Foundation + Auth + RLS Security)

| Phase       | Focus                 | Status           | Progress | Tests   | Duration | Priority                       |
| ----------- | --------------------- | ---------------- | -------- | ------- | -------- | ------------------------------ |
| **Phase 0** | Foundation            | ✅ Complete      | 100%     | 372/372 | 10h      | 🔴 Critical                    |
| **Phase 1** | RLS & Security        | 🟢 Near Complete | 85%      | 85/85   | ~15h     | 🟡 Gate D benchmarks remaining |
| **Phase 2** | UI Primitives         | ⚪ Not Started   | 0%       | 0/60    | ~12h     | 🔴 Critical                    |
| **Phase 3** | User Management       | ⚪ Not Started   | 0%       | 0/80    | ~10h     | 🟡 High                        |
| **Phase 4** | Org Management        | ⚪ Not Started   | 0%       | 0/140   | ~10h     | 🟡 High                        |
| **Phase 5** | Products Module       | ⚪ Not Started   | 0%       | 0/120   | ~15h     | 🟡 High                        |
| **Phase 6** | Performance & Testing | ⚪ Not Started   | 0%       | 0/50    | ~8h      | 🟢 Medium                      |

**Total:** ~80 hours | **Completed:** ~47 hours (59%) | **Remaining:** ~33 hours (41%)

### Current Sprint

**Active Phase:** Phase 1 - RLS & Security (85% complete)
**Current Task:** Gate D formal performance benchmarks + documentation
**Status:** ✅ Gates A/B/C passing, 85 pgTAP tests pass, all RLS policies operational
**Next Milestone:** Complete Gate D benchmarks, then start Phase 2

---

## 📖 Quick Start

### For Developers

1. **Check Progress Tracker** (above) - See current phase and status
2. **Review Architectural Principles** (below) - Understand non-negotiable rules
3. **Go to Phase Folder** - Find detailed step-by-step tasks
4. **Follow 6-Layer Checklist** - Implement each feature properly
5. **Update Progress** - Mark tasks complete in phase README
6. **Run Quality Gates** - Ensure type-check, lint, build, test pass

### For Project Managers

- **Overall Progress:** 60% complete (Foundation + Auth + RLS Security)
- **Current Phase:** [Phase 1: RLS & Security](./Phase-1-RLS-Security/README.md) - 85% complete (85 pgTAP tests passing)
- **Remaining:** Gate D performance benchmarks + security audit documentation
- **Timeline:** ~33 hours remaining of ~80 hour estimate
- **Risk:** Low - RLS fully operational, all attack scenarios blocked

### For Code Reviewers

- **Principles:** Review [Non-Negotiable Principles](#-non-negotiable-architectural-principles) below
- **Checklist:** Use [6-Layer Implementation Checklist](#-6-layer-implementation-checklist) below
- **Quality:** Verify all tests pass, no TypeScript/lint errors

---

## 🏗️ NON-NEGOTIABLE ARCHITECTURAL PRINCIPLES

These principles MUST be followed in every feature implementation. No exceptions.

### 1. SSR-First (Server Components by Default)

✅ **CORRECT:**

```typescript
// Pages are Server Components
export default async function ProductsPage() {
  const context = await loadDashboardContextV2();
  return <ClientProductsView initialData={context} />;
}

// Client components receive server data
"use client";
export function ClientProductsView({ initialData }) {
  const { data } = useProducts(initialData); // React Query
  return <DataTable data={data} />;
}
```

❌ **INCORRECT:**

```typescript
"use client"; // at page level
export default function ProductsPage() {
  const { data } = useProducts(); // client-side fetch
}
```

**Rules:**

- Pages MUST be Server Components
- Load context server-side with `loadDashboardContextV2()`
- Pass initial data to client components
- Client components use React Query for mutations

### 2. Security in Depth (4 Layers - ALL Required)

```
Layer 1: Database RLS Policies → Row-level security
Layer 2: Service Layer → Org/branch scoping in queries
Layer 3: Server Actions → Auth + permission checks
Layer 4: Client Components → Role-based rendering
```

✅ **CORRECT:**

```typescript
// UI check + Server action + Service + RLS
function DeleteButton() {
  const { can } = usePermissions();
  if (!can("products.delete")) return null; // Layer 4

  return <Button onClick={() => deleteProductAction(id)} />;
}

// Server action
export async function deleteProductAction(productId: string) {
  const { user } = await loadUserContextServer(); // Layer 3
  if (!user) return { success: false, code: "AUTH_REQUIRED" };

  const hasPermission = await checkPermission(user.id, "products.delete");
  if (!hasPermission) return { success: false, code: "PERMISSION_DENIED" };

  return await ProductsService.delete(productId, user.orgId); // Layer 2 + 1
}
```

❌ **INCORRECT:**

```typescript
// Only UI check - SECURITY ISSUE!
function DeleteButton() {
  const { can } = usePermissions();
  if (!can("products.delete")) return null;
  return <Button onClick={() => deleteProduct()} />; // Direct call - NO SERVER ACTION
}
```

### 3. Data Flow (One Direction Only)

```
Database → Service → Server Action → React Query → Component

❌ NEVER: Component → Supabase Client → Database
✅ ALWAYS: Component → React Query → Server Action → Service → Database
```

✅ **CORRECT:**

```typescript
"use client";
function ProductsList() {
  const { data: products } = useProductsQuery(); // React Query
  return <Table data={products} />;
}

function useProductsQuery() {
  return useQuery({
    queryKey: ["v2", "products"],
    queryFn: async () => {
      const result = await getProductsAction(); // Server action
      if (!result.success) throw new Error(result.error);
      return result.data;
    }
  });
}
```

❌ **INCORRECT:**

```typescript
"use client";
function ProductsList() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    supabase.from("products").select().then(({data}) => setProducts(data)); // Direct Supabase
  }, []);

  return <Table data={products} />;
}
```

### 4. Multi-Tenant by Default

✅ **ALWAYS include organization_id filter:**

```typescript
class ProductsService {
  static async getProducts(organizationId: string) {
    return await supabase.from("products").select().eq("organization_id", organizationId); // Required!
  }
}
```

❌ **NEVER query without org filter - SECURITY ISSUE:**

```typescript
class ProductsService {
  static async getProducts() {
    return await supabase.from("products").select(); // BAD!
  }
}
```

**Rules:**

- EVERY query MUST filter by `organization_id`
- EVERY mutation MUST validate org ownership
- EVERY service method accepts `orgId` parameter
- Branch scoping is optional (use when needed)

### 5. Type Safety End-to-End

```
Database Types (Supabase generated)
  → Service Layer (uses DB types)
  → Server Action (validates with Zod, returns typed response)
  → React Query Hook (typed query)
  → Component (typed props)
```

✅ **CORRECT:**

```typescript
// Database types (auto-generated)
import type { Database } from "@/supabase/types/types";
type Product = Database["public"]["Tables"]["products"]["Row"];

// Zod schema for validation
const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(3),
  price: z.number().min(0),
});

// Server action (validates + types response)
export async function createProductAction(input: unknown): Promise<ActionResponse<Product>> {
  const validated = createProductSchema.parse(input);
  const product = await ProductsService.create(validated);
  return { success: true, data: product };
}
```

❌ **INCORRECT:**

```typescript
// No types, no validation
export async function createProductAction(input: any) {
  const product = await supabase.from("products").insert(input);
  return product;
}
```

### 6. Single Source of Truth (Service Layer)

✅ **Business logic in service:**

```typescript
class ProductsService {
  static async createProduct(data: CreateProductInput, orgId: string) {
    // Validate business rules
    if (data.price < 0) throw new Error("Price cannot be negative");
    if (!data.sku || data.sku.length < 3) throw new Error("SKU too short");

    // Execute database operation
    const { data: product, error } = await supabase
      .from("products")
      .insert({ ...data, organization_id: orgId })
      .select()
      .single();

    if (error) throw error;
    return product;
  }
}
```

❌ **INCORRECT - Business logic scattered:**

```typescript
// In server action
export async function createProductAction(data) {
  if (data.price < 0) throw new Error(...); // NO! Goes in service
  const { data: product } = await supabase.from("products").insert(data);
  return product;
}

// In component
function CreateProductForm() {
  const onSubmit = (data) => {
    if (data.price < 0) { // NO! Goes in service
      setError("Price cannot be negative");
      return;
    }
    createProduct(data);
  };
}
```

---

## 🔧 6-LAYER IMPLEMENTATION CHECKLIST

Use this checklist for EVERY new feature:

### Layer 1: Database

- [ ] Migration created and applied
- [ ] RLS policies enabled
- [ ] Indexes added for performance
- [ ] pgTAP tests passing
- [ ] Org/branch scoping columns exist

### Layer 2: Service

- [ ] Service class created
- [ ] All methods accept `organizationId`
- [ ] Business rules enforced
- [ ] Error handling implemented
- [ ] Unit tests 80%+ coverage

### Layer 3: Server Actions

- [ ] Actions in `_actions.ts` file
- [ ] Zod schemas for validation
- [ ] Auth check (loadAppContextServer)
- [ ] Permission check
- [ ] Return typed `ActionResponse`
- [ ] Action tests 70%+ coverage

### Layer 4: React Query

- [ ] Query hooks created
- [ ] Mutation hooks created
- [ ] Proper queryKey structure
- [ ] Cache invalidation correct
- [ ] Hook tests 70%+ coverage

### Layer 5: UI

- [ ] Server component loads context
- [ ] Client component uses hooks
- [ ] Permission-based rendering
- [ ] Loading/error/empty states
- [ ] Mobile responsive
- [ ] Component tests 60%+ coverage

### Layer 6: Quality Assurance

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] `npm test` all passing
- [ ] Manual testing complete
- [ ] No console errors/warnings

---

## 📂 PHASE-SPECIFIC IMPLEMENTATION PLANS

Detailed step-by-step implementation plans for each phase:

### ✅ Phase 0: Foundation (COMPLETE)

**Folder:** [Phase-0-Foundation/](./Phase-0-Foundation/)
**Status:** 100% complete - 372 tests passing
**What Was Built:**

- V2 Stores (User, App, UI) - NO Supabase imports
- V2 Loaders - Deterministic context resolution
- Permission System - Wildcard + deny-first
- Test Infrastructure - Vitest + MSW
- Auth System - Password reset, email delivery

### 🟢 Phase 1: RLS & Security (85% - Gates A/B/C PASSING)

**Folder:** [Phase-1-RLS-Security/](./Phase-1-RLS-Security/)
**Duration:** ~15 hours (~12h complete)
**Priority:** 🟡 HIGH - Gate D benchmarks + documentation remaining

**Completed:**

- ✅ 48+ RLS policies deployed across all permission and organization tables
- ✅ FORCE RLS on 6 critical tables
- ✅ 5 SECURITY DEFINER helper functions (including 3 new ones that bypass FORCE RLS)
- ✅ Permission compiler with 3 functions + 4 compilation triggers
- ✅ Enterprise hardening (constraints, validation, soft-delete protection)
- ✅ 85 pgTAP tests passing across 12 test files
- ✅ 10 security attack scenarios blocked (cross-tenant isolation verified)
- ✅ 10 integration flow tests (bootstrap, invite, role management, cross-org)
- ✅ All critical blockers resolved (naming mismatch, FORCE RLS recursion, table GRANTs)

**Remaining:**

- ⚠️ Gate D formal performance benchmarks (EXPLAIN ANALYZE with realistic dataset)
- ⚠️ Security audit report document
- ⚠️ Performance benchmarks document

### ⚪ Phase 2: UI Primitives (NOT STARTED)

**Folder:** [Phase-2-UI-Primitives/](./Phase-2-UI-Primitives/)
**Duration:** ~12 hours
**Priority:** 🔴 CRITICAL - Blocks Phases 3-5

**What to Build:**

- DataTable component with sorting/filtering/pagination
- Card components (Stats, Info, List, Empty State)
- Chart components (Line, Bar, Pie, Stats)
- Form components (Wrapper, Fields, Patterns)
- Layout components (Page Header, Status Bar, Navigation)
- Feedback components (Loading, Error, Toast, Confirmation)
- 36 total components with 60+ tests

**Blocks:** All feature development in Phases 3-5

### ⚪ Phase 3: User Management (NOT STARTED)

**Folder:** [Phase-3-User-Management/](./Phase-3-User-Management/)
**Duration:** ~10 hours
**Priority:** 🟡 HIGH

**Features:**

- User profile management (edit, avatar upload, security)
- User invitation system (invite, accept, resend, cancel)
- User list & management (DataTable, filters, role assignment)
- 6 pages, 14 server actions, 80 tests

### ⚪ Phase 4: Org Management (NOT STARTED)

**Folder:** [Phase-4-Org-Management/](./Phase-4-Org-Management/)
**Duration:** ~10 hours
**Priority:** 🟡 HIGH

**Features:**

- Organization settings (profile, logo, billing)
- Branch management (create, edit, delete, users)
- Roles & permissions UI (view roles, permission overrides)
- 6 pages, 14 server actions, 140 tests

### ⚪ Phase 5: Products Module (NOT STARTED)

**Folder:** [Phase-5-Products-Module/](./Phase-5-Products-Module/)
**Duration:** ~15 hours
**Priority:** 🟡 HIGH

**Goal:** Vertical slice proof - Complete Products CRUD with all 6 layers

**What to Build:**

- Database: RLS policies + indexes
- Service: ProductsService with 6 methods
- Server Actions: 6 actions with validation
- React Query: 6 hooks with caching
- UI: Products list, create/edit dialog, detail view
- Tests: 120 tests across all layers

**Proves:** Entire architecture works end-to-end

### ⚪ Phase 6: Performance & Testing (NOT STARTED)

**Folder:** [Phase-6-Performance-Testing/](./Phase-6-Performance-Testing/)
**Duration:** ~8 hours
**Priority:** 🟢 MEDIUM

**Optimization:**

- Database performance (indexes, query optimization)
- React Query optimization (cache tuning, prefetching)
- SSR optimization (HydrationBoundary, Core Web Vitals)
- Target: Page load < 2s, Lighthouse > 90

**Testing:**

- Integration tests (35 tests) - Auth, Org, Products flows
- E2E tests with Playwright (15 tests) - Critical paths
- CI/CD integration (GitHub Actions)

---

## 🚨 CRITICAL BLOCKERS

### 1. ~~RLS Not Enabled~~ ✅ RESOLVED

- **Impact:** ~~Major security vulnerability~~ **RESOLVED** - RLS fully operational
- **Status:** 85% complete (85 pgTAP tests passing, Gates A/B/C pass)
- **What was done:** 48+ RLS policies, FORCE RLS on 6 tables, 5 helper functions, 16 fix migrations
- **Remaining:** Gate D formal benchmarks + documentation
- **Risk:** Low - all security attack scenarios blocked, cross-tenant isolation verified

### 2. UI Primitives Incomplete 🟡 HIGH

- **Impact:** Cannot build features efficiently, code duplication
- **Status:** 0% complete
- **Solution:** Complete [Phase 2](./Phase-2-UI-Primitives/README.md) (12 hours)
- **Priority:** HIGH - Blocks Phase 3-5 development
- **Risk:** Inconsistent UI, slower development

---

## 🎯 SUCCESS CRITERIA

The rebuild is complete when ALL of these are achieved:

### Phase Completion

- [x] Phase 0: Foundation complete (372 tests)
- [x] Phase 1: RLS on all tables + security testing (85 pgTAP tests, Gates A/B/C pass) - Gate D benchmarks remaining
- [ ] Phase 2: 36 UI components + documentation
- [ ] Phase 3: User management complete
- [ ] Phase 4: Org/branch management complete
- [ ] Phase 5: Products module as vertical slice proof
- [ ] Phase 6: Performance optimized + E2E tests

### Quality Gates

- [ ] 600+ tests passing
- [ ] 0 TypeScript errors
- [ ] 0 ESLint errors
- [ ] Build succeeds
- [ ] Lighthouse score > 90
- [ ] Page load < 2s
- [ ] Permission load < 200ms

### Production Ready

- [x] RLS enabled on all tables (48+ policies, FORCE RLS on 6 critical tables)
- [x] Security testing complete (85 pgTAP tests, 10 attack scenarios blocked)
- [x] No cross-tenant data leaks (verified by security attack tests)
- [ ] All features mobile responsive
- [ ] E2E tests passing
- [ ] CI/CD pipeline configured
- [ ] Production deployment successful

---

## 📚 DOCUMENTATION & RESOURCES

### Phase Documentation

- [Phase 0: Foundation](./Phase-0-Foundation/README.md) ✅ COMPLETE
- [Phase 1: RLS & Security](./Phase-1-RLS-Security/README.md) 🟢 85% COMPLETE (85 pgTAP tests)
- [Phase 2: UI Primitives](./Phase-2-UI-Primitives/README.md) ⚪ NOT STARTED
- [Phase 3: User Management](./Phase-3-User-Management/README.md) ⚪ NOT STARTED
- [Phase 4: Org Management](./Phase-4-Org-Management/README.md) ⚪ NOT STARTED
- [Phase 5: Products Module](./Phase-5-Products-Module/README.md) ⚪ NOT STARTED
- [Phase 6: Performance & Testing](./Phase-6-Performance-Testing/README.md) ⚪ NOT STARTED

### Implementation Guides

- [Architecture Overview](../guides/01-architecture-overview.md)
- [Security Patterns](../guides/13-security-patterns.md)
- [SSR Hydration](../guides/12-ssr-hydration.md)
- [Database Migrations](../guides/11-database-migrations.md)
- [Testing Guide](../guides/15-testing.md)

### Code Examples

- V2 Stores: `src/lib/stores/v2/`
- V2 Loaders: `src/server/loaders/v2/`
- Permission System: `src/lib/hooks/v2/use-permissions.ts`
- Service Example: `src/server/services/permission.service.ts`
- Action Example: `src/app/actions/v2/permissions.ts`

### External Resources

- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [React Query Docs](https://tanstack.com/query/latest)
- [Next.js App Router](https://nextjs.org/docs/app)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

## 🏗️ ARCHITECTURE OVERVIEW

### 6-Layer Architecture

```
1. Database Layer (Supabase + RLS policies)
2. Service Layer (business logic + org scoping)
3. Server Actions (auth + permission checks + Zod validation)
4. React Query (client-side caching + mutations)
5. UI Components (server components + client hooks)
6. Quality Assurance (tests + type safety + quality gates)
```

### Data Flow Diagram

```
User Interaction
      ↓
[UI Component] (Layer 5)
      ↓
[React Query Hook] (Layer 4)
      ↓
[Server Action] (Layer 3)
      ↓
[Service Method] (Layer 2)
      ↓
[Database + RLS] (Layer 1)
      ↓
Data Returned
```

---

## 💡 WHY THIS STRUCTURE?

### Previous State (Before Reorganization)

- 7+ planning documents scattered across folders
- Overlapping information and conflicting timelines
- Hard to track progress
- Confusion about what to work on next
- No clear definition of "done"

### Current State (After Reorganization)

- **Single README** - All important information in one place
- **Phase-Specific Folders** - Detailed step-by-step plans
- **Clear Progress Tracking** - Both overall and per-phase
- **No Duplication** - Each piece of information in one place
- **Easy Navigation** - Quick start guides for different roles

### Benefits

✅ Always know what to work on next
✅ Clear definition of done per phase
✅ Easy progress tracking
✅ Detailed step-by-step guidance
✅ No confusion about priorities
✅ Single source of truth for planning

---

## 🔄 CHANGE LOG

### 2026-01-28 - Phase 1 RLS Security Implementation Complete

- **Deployed:** 48+ RLS policies across all permission and organization tables
- **Created:** 3 new SECURITY DEFINER helper functions (`is_org_creator`, `has_org_role`, `has_any_org_role`)
- **Resolved:** FORCE RLS infinite recursion via SECURITY DEFINER functions that bypass FORCE RLS
- **Resolved:** Helper function naming mismatch (`is_org_member`/`has_permission` wrappers created)
- **Resolved:** Table-level GRANT issue (INSERT/UPDATE/DELETE on user_role_assignments)
- **Applied:** 16 fix migrations to resolve all RLS policy issues
- **Testing:** 85 pgTAP tests passing across 12 test files
- **Gates:** A (Invariants) ✅, B (Attack Scenarios) ✅, C (Flow Tests) ✅, D (Performance) 🟡 partial
- **Remaining:** Gate D formal benchmarks + security audit documentation

### 2026-01-27 - v2.0 Combined Master Plan + README

- **Combined:** MASTER_PLAN.md and README.md into single README.md
- **Progress Tracker:** Moved to top of document
- **Phase Details:** Moved to individual phase folders
- **Result:** One file for all critical information

### 2026-01-27 - Phase-Specific READMEs

- **Created:** Individual README files for each phase (0-6)
- **Detailed Plans:** Step-by-step implementation guides
- **Benefits:** Easier to navigate, clear separation of concerns

### 2026-01-27 - Master Plan Created

- **Consolidated:** 7+ planning documents into one
- **Archived:** Old planning documents
- **Added:** Progress tracker and architectural principles

### 2026-01-19 - Foundation Complete

- V2 stores, loaders, permission system implemented
- 372 tests passing
- Auth system complete

---

## 🚀 NEXT IMMEDIATE STEPS

### Finish Phase 1: Gate D Benchmarks + Documentation

**Priority 1: Gate D Performance Benchmarks** (~1.5 hours)

- Run EXPLAIN ANALYZE on RLS-critical queries with realistic dataset
- Document query plans, index usage, and timing results
- Create `PERFORMANCE_BENCHMARKS.md`

**Priority 2: Security Audit Report** (~1 hour)

- Document all 85 test results and their security implications
- Document the 10 attack scenarios and how they're blocked
- Create `SECURITY_AUDIT_REPORT.md`

### Then: Start Phase 2 (UI Primitives)

Phase 1 Gates A/B/C are passing and all security infrastructure is operational. Move to [Phase 2](./Phase-2-UI-Primitives/README.md) to build the component library. Gate D benchmarks can be completed in parallel.

---

## 📞 GETTING HELP

### For Questions About:

- **Architecture** - Review [Non-Negotiable Principles](#-non-negotiable-architectural-principles)
- **Implementation** - Check phase-specific README in phase folders
- **Testing** - See [Testing Guide](../guides/15-testing.md)
- **Security** - Review [Security Patterns](../guides/13-security-patterns.md)

### For Blockers:

- **RLS Not Working** - Check [Phase 1 README](./Phase-1-RLS-Security/README.md)
- **Permission Issues** - Review permission system in Phase 0
- **Build Errors** - Run quality gates: type-check, lint, test

---

**This is the single source of truth for the Dashboard V2 rebuild.**
**Detailed implementation steps are in phase-specific folders.**
**All archived documents are in [archives/](./archives/) folder.**

**Last Updated:** 2026-01-28
**Status:** 🟢 Phase 1 Near Complete - Gates A/B/C Passing (85 pgTAP tests)
**Next Milestone:** Gate D benchmarks + documentation, then Phase 2
