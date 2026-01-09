# Dashboard V2 Progress Tracker

**Last Updated:** 2026-01-08
**Current Phase:** Foundation
**Overall Status:** 🟡 Planned

---

## Quick Overview

| Phase                | Status         | Progress | Started | Completed | Notes                             |
| -------------------- | -------------- | -------- | ------- | --------- | --------------------------------- |
| **Foundation**       | 🟡 Planned     | 0%       | -       | -         | V2 stores + route structure       |
| **React Query**      | ⚪ Not Started | 0%       | -       | -         | Data fetching layer (optional)    |
| **UI Primitives**    | ⚪ Not Started | 0%       | -       | -         | Reusable components               |
| **First Module**     | ⚪ Not Started | 0%       | -       | -         | Warehouse home (proof of concept) |
| **Module Migration** | ⚪ Not Started | 0%       | -       | -         | Rebuild features incrementally    |
| **Cleanup**          | ⚪ Not Started | 0%       | -       | -         | Delete legacy, update routes      |

**Legend:**

- ✅ Complete
- 🔵 In Progress
- 🟡 Planned
- ⚪ Not Started
- ❌ Blocked

---

## Phase 1: Foundation

**Goal:** Create v2 stores and dashboard route structure
**Duration:** 2-3 hours
**Status:** 🟡 Planned
**Priority:** 🔴 Critical (blocks all other phases)

### Tasks

| Task                             | Status | Assignee | Notes                           |
| -------------------------------- | ------ | -------- | ------------------------------- |
| **Store: User Store V2**         | ⚪     | -        | Thin identity + auth store      |
| **Store: App Store V2**          | ⚪     | -        | Thin org/branch selection store |
| **Store: UI Store V2**           | ⚪     | -        | Persisted UI preferences        |
| **Test: user-store.test.ts**     | ⚪     | -        | 3 tests                         |
| **Test: app-store.test.ts**      | ⚪     | -        | 5 tests                         |
| **Route: Dashboard V2 Layout**   | ⚪     | -        | Server layout + auth            |
| **Route: Dashboard V2 Provider** | ⚪     | -        | Client provider + hydration     |
| **Page: Home Page (POC)**        | ⚪     | -        | Proof of concept                |
| **Docs: Architecture Guide**     | ⚪     | -        | Document v2 patterns            |

### Deliverables

#### Code

- [ ] `src/lib/stores/v2/user-store.ts` (~60 lines - NO fetching, dumb container)
- [ ] `src/lib/stores/v2/app-store.ts` (~90 lines - NO subscription, normalizes org `id`)
- [ ] `src/lib/stores/v2/ui-store.ts` (~30 lines)
- [ ] `src/lib/stores/v2/__tests__/user-store.test.ts` (4 tests minimum)
- [ ] `src/lib/stores/v2/__tests__/app-store.test.ts` (6 tests minimum)
- [ ] `src/app/[locale]/(dashboard-v2)/layout.tsx`
- [ ] `src/app/[locale]/(dashboard-v2)/_providers.tsx` (with QueryClient initialization)
- [ ] `src/app/[locale]/(dashboard-v2)/_components/permissions-sync.tsx`
- [ ] `src/app/[locale]/(dashboard-v2)/start/page.tsx`
- [ ] `src/lib/hooks/queries/v2/use-branch-permissions-query.ts`
- [ ] Server action: `getBranchPermissions(orgId, branchId)` returns `{ permissions: string[] }`

#### Documentation

- [ ] V2 architecture patterns documented
- [ ] Store usage examples
- [ ] Migration guide for building v2 modules

### Definition of Done

**V2 Stores:**

- [ ] All v2 stores have NO Supabase imports
- [ ] All v2 stores have NO data fetching methods
- [ ] Stores use `hydrateFromServer()` pattern
- [ ] User store includes `setPermissions(permissions)` method (NO fetching)
- [ ] App store does NOT include `subscription` field
- [ ] 10 new tests passing (4 user + 6 app)

**Required Tests (10 minimum):**

**User Store (4 tests):**

- [ ] `hydrateFromServer()` replaces arrays (no merge)
- [ ] `hydrateFromServer(null)` sets `isLoaded=true`
- [ ] `clear()` resets `isLoaded=false`
- [ ] `setPermissions()` replaces array (no merge)

**App Store (6 tests):**

- [ ] `hydrateFromServer()` replaces arrays (no merge)
- [ ] `hydrateFromServer(null)` sets `isLoaded=true`
- [ ] `clear()` resets `isLoaded=false`
- [ ] `setActiveBranch()` does not mutate `branches` or `modules` arrays
- [ ] `setActiveBranch(invalidId)` sets `activeBranch=null`
- [ ] App store does NOT contain `subscription` field

**Test Focus:**

- ✅ Test deterministic state updates (no fetching)
- ✅ Test array replacement (not merge)
- ✅ Test edge cases (null, invalid IDs)
- ❌ Do NOT test permission fetching (that's in React Query, not store)

**Dashboard V2 Route:**

- [ ] Page accessible at `/en/dashboard-v2/start`
- [ ] Shows user context (email, roles, permissions)
- [ ] Shows app context (org, branch, modules)
- [ ] Server loaders hydrate stores correctly
- [ ] Routing strategy documented (direct URL, feature flag, or gradual rollout)

**Quality Gates:**

- [ ] `pnpm test:run` - All tests green (98/98 - 88 existing + 10 new)
- [ ] `pnpm type-check` - No TypeScript errors
- [ ] `pnpm lint` - No linting errors
- [ ] Legacy dashboard untouched and working

**Security:**

- [ ] All React Query hooks use browser client (`@/utils/supabase/client`)
- [ ] Server action `getBranchPermissions` returns `{ permissions: string[] }` (strict contract)
- [ ] PermissionsSync component bridges React Query → Zustand (always updates, including empty arrays)
- [ ] PermissionsSync only runs when `orgId && branchId` are both set
- [ ] Documentation notes that permissions are UI gating only
- [ ] All queries respect org/branch scoping
- [ ] All queries use "v2" prefix in query keys (prevents collision)
- [ ] QueryClient created once per provider with `useState(() => new QueryClient())`
- [ ] Clear stores + optionally query cache on logout

---

## Phase 2: React Query Infrastructure

**Goal:** Create data fetching layer for heavy data
**Duration:** 1-2 hours
**Status:** ⚪ Not Started
**Priority:** 🟡 Medium (can defer to module phases)

### Tasks

| Task                                  | Status | Assignee | Notes                                 |
| ------------------------------------- | ------ | -------- | ------------------------------------- |
| **Hook: useLocationsQueryV2**         | ⚪     | -        | Query + invalidation                  |
| **Hook: useSuppliersQueryV2**         | ⚪     | -        | Query + invalidation                  |
| **Hook: useOrganizationUsersQueryV2** | ⚪     | -        | Query + invalidation                  |
| **Hook: useBranchPermissionsQueryV2** | ⚪     | -        | Permission fetching via server action |
| **Component: PermissionsSync**        | ⚪     | -        | Syncs query → store                   |
| **Wrapper: useLocationsV2**           | ⚪     | -        | Clean API for v2 components           |
| **Wrapper: useSuppliersV2**           | ⚪     | -        | Clean API for v2 components           |
| **Wrapper: useOrganizationUsersV2**   | ⚪     | -        | Clean API for v2 components           |

### Deliverables

#### Code

- [ ] `src/lib/hooks/queries/v2/use-locations-query.ts`
- [ ] `src/lib/hooks/queries/v2/use-suppliers-query.ts`
- [ ] `src/lib/hooks/queries/v2/use-organization-users-query.ts`
- [ ] `src/lib/hooks/queries/v2/use-branch-permissions-query.ts` (already in Phase 1)
- [ ] `src/app/[locale]/(dashboard-v2)/_components/permissions-sync.tsx` (already in Phase 1)
- [ ] `src/lib/hooks/v2/use-locations-v2.ts` (wrapper)
- [ ] `src/lib/hooks/v2/use-suppliers-v2.ts` (wrapper)
- [ ] `src/lib/hooks/v2/use-organization-users-v2.ts` (wrapper)

### Definition of Done

**Query Hooks:**

- [ ] All queries use React Query with "v2" query key prefix
- [ ] Proper caching with staleTime (5 min)
- [ ] All hooks use browser client (`@/utils/supabase/client`)
- [ ] Loading/error states handled (errors logged, toasts in components)
- [ ] Permission query uses server action (not direct Supabase call)

**Sync Components:**

- [ ] PermissionsSync component bridges useBranchPermissionsQueryV2 → useUserStoreV2.setPermissions
- [ ] Integrated into dashboard-v2 \_providers.tsx
- [ ] Automatically syncs on branch switch

**Wrapper Hooks:**

- [ ] V2 naming (useLocationsV2, useSuppliersV2, etc.) or in v2/ subfolder
- [ ] Use v2 app store for context
- [ ] Use query hooks internally
- [ ] NO mixed mode (never import legacy + v2 in same component)

**Note:** This phase can be done incrementally as modules are built. Stable hook APIs for V2 components. Legacy remains unchanged.

---

## Phase 3: UI Primitives

**Goal:** Create reusable UI components for v2
**Duration:** 4-6 hours
**Status:** ⚪ Not Started
**Priority:** 🔵 High (needed for all modules)

### Tasks

| Task                            | Status | Assignee | Notes                   |
| ------------------------------- | ------ | -------- | ----------------------- |
| **Component: Sidebar**          | ⚪     | -        | Uses useUiStoreV2       |
| **Component: Page Header**      | ⚪     | -        | Breadcrumbs, actions    |
| **Component: DataTable**        | ⚪     | -        | shadcn/ui table wrapper |
| **Component: Form Wrapper**     | ⚪     | -        | react-hook-form + zod   |
| **Component: Card Layouts**     | ⚪     | -        | Stats, widgets, etc     |
| **Component: Loading States**   | ⚪     | -        | Skeletons, spinners     |
| **Component: Error Boundaries** | ⚪     | -        | Error handling UI       |

### Deliverables

#### Code

- [ ] `src/components/v2/layout/sidebar.tsx`
- [ ] `src/components/v2/layout/page-header.tsx`
- [ ] `src/components/v2/data/data-table.tsx`
- [ ] `src/components/v2/forms/form-wrapper.tsx`
- [ ] `src/components/v2/cards/` (multiple card types)
- [ ] `src/components/v2/feedback/loading-states.tsx`
- [ ] `src/components/v2/feedback/error-boundary.tsx`

#### Documentation

- [ ] Component usage examples
- [ ] Storybook stories (optional)
- [ ] Design patterns guide

### Definition of Done

**Components:**

- [x] All use v2 stores
- [x] Fully typed with TypeScript
- [x] Accessible (ARIA labels, keyboard nav)
- [x] Responsive (mobile-first)
- [x] Consistent styling (Tailwind + shadcn/ui)

**Quality:**

- [x] Used in at least 2 modules
- [x] Component tests passing
- [x] No console warnings/errors

---

## Phase 4: First Module (Warehouse Home)

**Goal:** Build complete feature in v2 to prove stack works
**Duration:** 4-6 hours
**Status:** ⚪ Not Started
**Priority:** 🔵 High (validates entire approach)

### Tasks

| Task                        | Status | Assignee | Notes                    |
| --------------------------- | ------ | -------- | ------------------------ |
| **Route: Warehouse Layout** | ⚪     | -        | Nested route structure   |
| **Page: Warehouse Home**    | ⚪     | -        | Dashboard with stats     |
| **Card: Stock Summary**     | ⚪     | -        | Total products, value    |
| **Card: Low Stock Alerts**  | ⚪     | -        | Query + display          |
| **Card: Recent Movements**  | ⚪     | -        | Query + table            |
| **Card: Quick Actions**     | ⚪     | -        | Navigation buttons       |
| **Navigation: Module Menu** | ⚪     | -        | Products, locations, etc |

### Deliverables

#### Code

- [ ] `src/app/[locale]/(dashboard-v2)/warehouse/layout.tsx`
- [ ] `src/app/[locale]/(dashboard-v2)/warehouse/page.tsx`
- [ ] `src/app/[locale]/(dashboard-v2)/warehouse/_components/` (cards, widgets)
- [ ] React Query hooks for warehouse stats

#### Documentation

- [ ] Warehouse module architecture
- [ ] Data flow diagrams
- [ ] Component hierarchy

### Definition of Done

**Functionality:**

- [x] Page renders correctly
- [x] All stats cards display real data
- [x] React Query hooks fetch data
- [x] Navigation works
- [x] Responsive on mobile

**Quality:**

- [x] No TypeScript errors
- [x] No console warnings
- [x] Loading states work
- [x] Error handling works
- [x] Performance acceptable (<1s load)

---

## Phase 5: Module Migration

**Goal:** Rebuild features one module at a time
**Duration:** Varies by module
**Status:** ⚪ Not Started
**Priority:** 🟢 Medium (incremental)

### Module List

| Module                    | Priority    | Complexity | Status | Progress | Notes                      |
| ------------------------- | ----------- | ---------- | ------ | -------- | -------------------------- |
| **Warehouse - Products**  | 🔴 High     | Medium     | ⚪     | 0%       | List, create, edit, delete |
| **Warehouse - Locations** | 🔴 High     | High       | ⚪     | 0%       | Tree structure, QR codes   |
| **Warehouse - Movements** | 🔵 Medium   | High       | ⚪     | 0%       | SAP-style movement types   |
| **Warehouse - Suppliers** | 🔵 Medium   | Low        | ⚪     | 0%       | CRUD operations            |
| **Warehouse - Audits**    | 🟡 Low      | Medium     | ⚪     | 0%       | Audit flow, reports        |
| **Teams**                 | 🟡 Low      | Low        | ⚪     | 0%       | Chat, kanban, calendar     |
| **Organization**          | 🟡 Low      | Low        | ⚪     | 0%       | Settings, users, roles     |
| **Support**               | 🟢 Very Low | Low        | ⚪     | 0%       | Help, FAQ, contact         |

### Definition of Done (Per Module)

**Code:**

- [x] All pages/components migrated
- [x] React Query hooks for data
- [x] Server actions for mutations
- [x] Tests passing

**Quality:**

- [x] Feature parity with legacy
- [x] No regressions
- [x] Performance equal or better
- [x] User acceptance testing passed

**Cleanup:**

- [x] Legacy module documented as deprecated
- [x] Users redirected to v2 if accessing legacy
- [x] Legacy code marked for deletion

---

## Phase 6: Cleanup & Launch

**Goal:** Delete legacy, finalize v2, launch to production
**Duration:** 2-4 hours
**Status:** ⚪ Not Started
**Priority:** 🔴 Critical (final phase)

### Tasks

| Task                        | Status | Assignee | Notes                              |
| --------------------------- | ------ | -------- | ---------------------------------- |
| **Delete Legacy Dashboard** | ⚪     | -        | Remove `/dashboard/*` routes       |
| **Rename V2 Routes**        | ⚪     | -        | `/dashboard-v2/*` → `/dashboard/*` |
| **Delete Old Stores**       | ⚪     | -        | Remove legacy app-store            |
| **Update Navigation**       | ⚪     | -        | Remove v2 prefix                   |
| **Delete Dead Code**        | ⚪     | -        | Clean up unused files              |
| **Update Documentation**    | ⚪     | -        | Finalize guides                    |
| **Performance Testing**     | ⚪     | -        | Benchmark before launch            |
| **User Acceptance**         | ⚪     | -        | Final testing                      |

### Definition of Done

**Cleanup:**

- [x] All legacy dashboard code deleted
- [x] Routes renamed (no `/dashboard-v2` prefix)
- [x] Old stores deleted
- [x] Dead code removed
- [x] Bundle size optimized

**Quality:**

- [x] All tests passing
- [x] No TypeScript errors
- [x] No linting errors
- [x] Lighthouse score >90
- [x] No console errors

**Launch:**

- [x] User acceptance testing complete
- [x] Performance benchmarks met
- [x] Documentation finalized
- [x] Changelog updated
- [x] Deployed to production

---

## Metrics Dashboard

### Code Quality

| Metric              | Current | Target | Status |
| ------------------- | ------- | ------ | ------ |
| **Total Tests**     | 88      | 150+   | 🔵     |
| **V2 Store Tests**  | 0       | 10     | ⚪     |
| **Component Tests** | 0       | 30+    | ⚪     |
| **Type Coverage**   | 100%    | 100%   | ✅     |
| **Lint Errors**     | 0       | 0      | ✅     |

### Architecture Compliance

| Principle                         | Status | Notes                          |
| --------------------------------- | ------ | ------------------------------ |
| **Thin Stores (Dumb Containers)** | ⚪     | V2 stores not created yet      |
| **React Query for Data**          | ⚪     | Query hooks not created yet    |
| **NO Store Fetching**             | ⚪     | V2 stores will enforce         |
| **Server Hydration**              | ⚪     | Provider pattern planned       |
| **PermissionsSync Pattern**       | ⚪     | Sync component planned         |
| **V2 Query Key Prefix**           | ⚪     | Will prevent legacy collision  |
| **NO Mixed Mode**                 | ⚪     | Will enforce strict separation |
| **Type Safety**                   | ✅     | Already enforced               |

### Performance

| Metric           | Legacy | V2 Target | Status |
| ---------------- | ------ | --------- | ------ |
| **Initial Load** | ~2s    | <1s       | ⚪     |
| **Route Change** | ~500ms | <200ms    | ⚪     |
| **Bundle Size**  | ~800kb | <600kb    | ⚪     |
| **Lighthouse**   | ~75    | >90       | ⚪     |

---

## Risk Register

| Risk                   | Severity    | Probability | Mitigation                                | Owner |
| ---------------------- | ----------- | ----------- | ----------------------------------------- | ----- |
| **Breaking Legacy**    | 🔴 Critical | 🟢 Low      | V2 route isolation                        | -     |
| **Missing Features**   | 🟡 High     | 🟡 Medium   | Reference legacy for requirements         | -     |
| **Performance Issues** | 🟡 High     | 🟢 Low      | React Query caching + testing             | -     |
| **User Confusion**     | 🟡 High     | 🟡 Medium   | Clear communication, gradual rollout      | -     |
| **Timeline Slip**      | 🟢 Low      | 🟡 Medium   | Incremental delivery, prioritize features | -     |

---

## Timeline Estimates

### Optimistic (Full Focus)

- **Phase 1:** 2 hours
- **Phase 2:** 1 hour (optional)
- **Phase 3:** 4 hours
- **Phase 4:** 4 hours
- **Phase 5:** 40 hours (8 hours per module × 5 modules)
- **Phase 6:** 2 hours

**Total:** ~53 hours (~1.5 weeks full-time)

### Realistic (Part-Time)

- **Phase 1:** 1 day
- **Phase 2:** 0.5 day (optional)
- **Phase 3:** 2 days
- **Phase 4:** 2 days
- **Phase 5:** 15 days (3 days per module × 5 modules)
- **Phase 6:** 1 day

**Total:** ~21 days (~4 weeks part-time)

### Conservative (Interruptions)

- **Phase 1:** 2 days
- **Phase 2:** 1 day (optional)
- **Phase 3:** 4 days
- **Phase 4:** 4 days
- **Phase 5:** 30 days (6 days per module × 5 modules)
- **Phase 6:** 2 days

**Total:** ~43 days (~2 months)

---

## Weekly Progress Log

### Week 1: 2026-01-08 to 2026-01-14

**Status:** 🟡 Planning
**Progress:** 0% → TBD

**Completed:**

- [ ] Planning documents created

**Blocked:**

- None

**Next Week:**

- [ ] Start Phase 1 (Foundation)

---

## Communication Plan

### Stakeholder Updates

**Frequency:** Weekly
**Format:** Progress summary + demo
**Audience:** Team, stakeholders

**Template:**

```
Week of [Date]:
- Completed: [Phase/Tasks]
- In Progress: [Current work]
- Next Week: [Planned work]
- Blockers: [Issues]
- Demo: [Link to v2 route]
```

### User Communication

**Milestone Updates:**

- After Phase 1: "New architecture foundation complete"
- After Phase 4: "First feature live in v2 (beta)"
- During Phase 5: "New features rolling out weekly"
- Before Phase 6: "Final migration - please test!"

---

## Resources

**Documentation:**

- [DASHBOARD_V2_PLAN.md](./DASHBOARD_V2_PLAN.md) - Overall plan
- [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) - Phase 1 progress
- [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - Phase 1 details

**Code:**

- `/src/lib/stores/v2/` - V2 stores
- `/src/app/[locale]/(dashboard-v2)/` - V2 routes
- `/src/lib/hooks/queries/v2/` - React Query hooks

**External:**

- [React Query Docs](https://tanstack.com/query/latest)
- [Zustand Docs](https://docs.pmnd.rs/zustand)
- [Next.js App Router](https://nextjs.org/docs/app)

---

**Last Updated:** 2026-01-08
**Next Review:** After Phase 1 completion
**Updated By:** Claude Code
