# Dashboard V2 Layout - Progress Tracker

**Created**: 2026-01-17
**Updated**: 2026-01-18
**Phase**: Dashboard V2 UI Layer
**Status**: ✅ Code Complete (Pending Verification)
**Overall Progress**: 100% (Code) / 68% (Verified)

---

## Quick Overview

| Task                          | Status      | File Location                                                 | Notes                        |
| ----------------------------- | ----------- | ------------------------------------------------------------- | ---------------------------- |
| **Permission Server Action**  | ✅ Complete | `src/app/actions/v2/permissions.ts`                           | getBranchPermissions()       |
| **Permission Query Hook**     | ✅ Complete | `src/hooks/queries/v2/use-branch-permissions-query.ts`        | useBranchPermissionsQuery()  |
| **PermissionsSync Component** | ✅ Complete | `src/app/[locale]/dashboard/_components/permissions-sync.tsx` | React Query → Zustand bridge |
| **Dashboard V2 Providers**    | ✅ Complete | `src/app/[locale]/dashboard/_providers.tsx`                   | Hydration + QueryClient      |
| **Branch Switcher**           | ✅ Complete | `src/components/v2/layout/branch-switcher.tsx`                | Calls changeBranch action    |
| **Sidebar V2**                | ✅ Complete | `src/components/v2/layout/sidebar.tsx`                        | Navigation with modules      |
| **Page Header V2**            | ✅ Complete | `src/components/v2/layout/page-header.tsx`                    | Breadcrumbs + actions        |
| **Dashboard V2 Layout**       | ✅ Complete | `src/app/[locale]/dashboard/layout.tsx`                       | Server layout                |
| **Start Page**                | ✅ Complete | `src/app/[locale]/dashboard/start/page.tsx`                   | Proof of concept             |

**Legend**:

- ✅ Complete
- 🔵 In Progress
- ⚪ Not Started
- ❌ Blocked

**Note**: Files are located in `src/app/[locale]/dashboard/` (not `(dashboard-v2)` route group as originally planned).

---

## Task 1: Permission Server Action

**File**: `src/app/actions/v2/permissions.ts`
**Status**: ✅ Complete
**Actual Lines**: ~35
**Dependencies**: PermissionService (exists)

### Requirements

- [x] Server action with "use server" directive
- [x] getBranchPermissions(orgId, branchId) function
- [x] Returns `{ permissions: PermissionSnapshot }`
- [x] Calls PermissionService.getPermissionSnapshotForUser()
- [x] Handles no session (returns empty snapshot)
- [x] Error handling (returns empty snapshot on error)

### Testing

- [ ] Test with valid session returns permissions
- [ ] Test with no session returns empty snapshot
- [ ] Test with null branchId
- [ ] Test error handling

### Notes

Uses existing PermissionService from `src/server/services/permission.service.ts`

---

## Task 2: Permission Query Hook

**File**: `src/hooks/queries/v2/use-branch-permissions-query.ts`
**Status**: ✅ Complete
**Actual Lines**: ~40
**Dependencies**: Task 1 (permissions server action)

### Requirements

- [x] Client-side hook ("use client")
- [x] Query key: ["v2", "permissions", orgId, branchId]
- [x] Calls getBranchPermissions server action
- [x] Enabled only when orgId && branchId
- [x] staleTime: 5 minutes
- [x] refetchOnWindowFocus: false
- [x] Returns `{ permissions: PermissionSnapshot }`

### Testing

- [ ] Test query key changes trigger refetch
- [ ] Test enabled logic (only when both IDs present)
- [ ] Test staleTime configuration
- [ ] Test returns empty snapshot when orgId null

### Notes

Auto-refetches when activeBranchId changes (detected via query key)

---

## Task 3: PermissionsSync Component

**File**: `src/app/[locale]/dashboard/_components/permissions-sync.tsx`
**Status**: ✅ Complete
**Actual Lines**: ~30
**Dependencies**: Task 2 (permission query hook)

### Requirements

- [x] Client component ("use client")
- [x] Reads activeOrgId and activeBranchId from useAppStoreV2
- [x] Calls useBranchPermissionsQuery
- [x] useEffect syncs data to useUserStoreV2.setPermissionSnapshot
- [x] Always updates (including empty arrays)
- [x] Returns null (no UI)

### Testing

- [ ] Test syncs permissions when data arrives
- [ ] Test syncs empty arrays correctly
- [ ] Test only enabled when both IDs present
- [ ] Test updates Zustand store via setPermissionSnapshot

### Notes

Bridge between React Query and Zustand. No UI, pure sync logic.

---

## Task 4: Dashboard V2 Providers

**File**: `src/app/[locale]/dashboard/_providers.tsx`
**Status**: ✅ Complete
**Actual Lines**: ~50
**Dependencies**: Task 3 (PermissionsSync)

### Requirements

- [x] Client component ("use client")
- [x] Accepts context: DashboardContextV2 prop
- [x] Creates QueryClient via useState(() => new QueryClient())
- [x] Hydrates app + user stores in useEffect
- [x] Wraps children in QueryClientProvider
- [x] Includes PermissionsSync component
- [x] QueryClient config: staleTime 60s, refetchOnWindowFocus false

### Testing

- [ ] Test stores hydrated on mount
- [ ] Test QueryClient created with correct config
- [ ] Test PermissionsSync rendered
- [ ] Test re-hydration on context change

### Notes

Main provider component for V2 dashboard. Hydrates all stores from server context.

---

## Task 5: Branch Switcher

**File**: `src/components/v2/layout/branch-switcher.tsx`
**Status**: ✅ Complete
**Actual Lines**: ~100
**Dependencies**: useAppStoreV2, changeBranch action (exists)

### Requirements

- [x] Client component ("use client")
- [x] Uses shadcn/ui Popover + Command components
- [x] Displays current branch name
- [x] Lists availableBranches from useAppStoreV2
- [x] Calls changeBranch(branchId) server action
- [x] Calls setActiveBranch(branchId) after DB update
- [x] useTransition for pending state
- [x] Toast success/error messages (react-toastify)
- [x] Search/filter branches

### Testing

- [ ] Test displays current branch
- [ ] Test selecting branch calls changeBranch + setActiveBranch
- [ ] Test loading state during transition
- [ ] Test error handling with toast
- [ ] Test filters branches with search

### Notes

Uses existing `src/app/actions/changeBranch.ts` server action. Triggers permission refetch via setActiveBranch.

---

## Task 6: Sidebar V2

**File**: `src/components/v2/layout/sidebar.tsx`
**Status**: ✅ Complete
**Actual Lines**: ~120
**Dependencies**: Task 5 (BranchSwitcher)

### Requirements

- [x] Client component ("use client")
- [x] Uses shadcn/ui Sidebar component
- [x] Header: org name + BranchSwitcherV2
- [x] Content: module navigation from userModules
- [x] Icon map for module slugs
- [x] Active state detection via pathname
- [x] Footer: "V2 Dashboard" label
- [x] Links use next-intl Link component

### Testing

- [ ] Test renders modules from useAppStoreV2
- [ ] Test active state detection
- [ ] Test includes BranchSwitcherV2
- [ ] Test icon mapping
- [ ] Test navigation works

### Notes

Uses `useAppStoreV2().userModules` for navigation. Icons: Home, Package, Users, Settings, HelpCircle.

---

## Task 7: Page Header V2

**File**: `src/components/v2/layout/page-header.tsx`
**Status**: ✅ Complete
**Actual Lines**: ~65
**Dependencies**: None

### Requirements

- [x] Client component ("use client")
- [x] Props: title, description?, breadcrumbs?, actions?, className?
- [x] Breadcrumbs with home icon
- [x] Title + optional description
- [x] Actions slot (buttons, etc)
- [x] Responsive layout
- [x] Uses next-intl Link for breadcrumbs

### Testing

- [ ] Test renders title and description
- [ ] Test renders breadcrumbs with links
- [ ] Test renders actions slot
- [ ] Test responsive layout

### Notes

Reusable header component. Used in all V2 pages.

---

## Task 8: Dashboard V2 Layout

**File**: `src/app/[locale]/dashboard/layout.tsx`
**Status**: ✅ Complete
**Actual Lines**: ~55
**Dependencies**: Task 4 (Providers), Task 6 (Sidebar)

### Requirements

- [x] Server component (async function)
- [x] Calls loadDashboardContextV2()
- [x] Redirects to /sign-in if no context
- [x] Passes context to DashboardV2Providers
- [x] Uses shadcn/ui SidebarProvider
- [x] Renders SidebarV2
- [x] Main content area with responsive padding
- [x] Full height layout (h-screen)

### Testing

- [ ] Test redirects when no context
- [ ] Test passes context to providers
- [ ] Test renders sidebar and main content
- [ ] Test responsive padding works

### Notes

Server layout. Loads context, hydrates via providers. Entry point for all V2 routes.

---

## Task 9: Start Page (Proof of Concept)

**File**: `src/app/[locale]/dashboard/start/page.tsx`
**Status**: ✅ Complete
**Actual Lines**: ~100
**Dependencies**: Task 7 (PageHeader), Task 8 (Layout)

### Requirements

- [x] Client component ("use client")
- [x] Uses PageHeaderV2 with breadcrumbs
- [x] Card: App Context (displays all store values)
- [x] Card: User Context (displays user + permissions)
- [x] Card: Permission Checks (can() examples)
- [x] Uses shadcn/ui Card component
- [x] Font mono for data display
- [x] Responsive grid layout

### Testing

- [ ] Test page renders without errors
- [ ] Test displays app context
- [ ] Test displays user context
- [ ] Test permission checks work
- [ ] Test responsive layout

### Notes

Validates entire V2 stack. Shows all hydrated data. Navigate to `/en/dashboard-v2/start`.

---

## Verification Checklist

### SSR Hydration (Code Verified ✅)

- [x] Server loads context via loadDashboardContextV2()
- [x] Stores hydrated on client mount (isLoaded=true)
- [ ] No hydration mismatch console errors _(requires manual testing)_
- [x] activeBranchId and activeOrgId populated correctly

### Permission Sync (Code Verified ✅)

- [x] Permissions loaded on initial mount
- [x] Permissions refetch when branch changes
- [x] Empty arrays synced correctly (no stale state)
- [x] Query key includes orgId + branchId

### Branch Switching (Code Verified ✅)

- [x] setActiveBranch() updates Zustand state
- [x] React Query detects change and refetches
- [x] PermissionsSync updates user store
- [x] Database preference persisted via changeBranch
- [x] Toast shows success/error messages (react-toastify)

### V2 Isolation (Code Verified ✅)

- [x] No V1 imports in V2 components
- [x] V2 stores are only state source
- [x] usePermissions hook works correctly
- [x] No mixed mode (V1 + V2 in same file)

### Security (Partial - DB verification needed)

- [x] Server action validates session
- [x] PermissionService called server-side only
- [ ] RLS applies to all queries _(requires database verification)_
- [x] Permissions are UI gating only (documented)

### Performance (Partial - profiling needed)

- [x] QueryClient created once per provider
- [x] staleTime prevents excessive refetches
- [x] Zustand selectors optimized (no unnecessary re-renders)
- [ ] Page loads in <1s _(requires Lighthouse testing)_

---

## Quality Gates

### Before Marking Complete (Requires Running Commands)

- [ ] `npm run type-check` - No TypeScript errors
- [ ] `npm run lint` - No linting errors
- [ ] `npm run build` - Build succeeds
- [ ] Manual testing complete (all checklist items)
- [ ] `/en/dashboard/start` accessible and functional

### Code Quality (Code Verified ✅)

- [x] All files follow existing V2 patterns
- [x] Proper error handling
- [x] Toast notifications use react-toastify
- [x] Components use shadcn/ui where applicable
- [ ] No console errors in browser _(requires manual testing)_

---

## Timeline

**Estimated Time**: 3-4 hours total

| Task                              | Estimated Time | Cumulative       |
| --------------------------------- | -------------- | ---------------- |
| Task 1: Permission Server Action  | 20 min         | 20 min           |
| Task 2: Permission Query Hook     | 15 min         | 35 min           |
| Task 3: PermissionsSync Component | 15 min         | 50 min           |
| Task 4: Dashboard V2 Providers    | 20 min         | 70 min (1h 10m)  |
| Task 5: Branch Switcher           | 30 min         | 100 min (1h 40m) |
| Task 6: Sidebar V2                | 30 min         | 130 min (2h 10m) |
| Task 7: Page Header V2            | 20 min         | 150 min (2h 30m) |
| Task 8: Dashboard V2 Layout       | 20 min         | 170 min (2h 50m) |
| Task 9: Start Page                | 25 min         | 195 min (3h 15m) |
| Testing & Verification            | 30 min         | 225 min (3h 45m) |

---

## Definition of Done

Layout implementation is complete when:

✅ **Code Complete**: (DONE)

- [x] All 9 files created
- [ ] No TypeScript errors _(requires npm run type-check)_
- [ ] No linting errors _(requires npm run lint)_
- [ ] Build succeeds _(requires npm run build)_

🔵 **Functionality Working**: (Code Verified, Needs Manual Testing)

- [x] `/en/dashboard/start` accessible (code exists)
- [x] Context loads server-side (loadDashboardContextV2 implemented)
- [x] Stores hydrate on client (hydrateFromServer implemented)
- [x] Branch switching works (changeBranch + setActiveBranch implemented)
- [x] Permissions update on switch (PermissionsSync implemented)
- [x] Sidebar navigation works (SidebarV2 implemented)
- [ ] No console errors _(requires manual testing)_

🔵 **Verification Passed**: (68% Code Verified)

- [x] SSR Data Loading - 100% verified
- [x] Permission System - 100% verified
- [ ] Security/RLS - Requires database verification
- [ ] Performance - Requires Lighthouse testing

✅ **Documentation**: (DONE)

- [x] This progress tracker updated
- [x] DASHBOARD_V2_VERIFICATION_CHECKLIST.md created (155 items)
- [x] Implementation notes documented

---

## Next Steps After Completion

1. Update `DASHBOARD_V2_PROGRESS.md`:
   - Mark UI Layer as complete
   - Update metrics (lines of code, tests)
   - Update phase status

2. Build First V2 Module:
   - Warehouse home page
   - Use layout components we built
   - Validate entire stack end-to-end

3. Add React Query Hooks:
   - useLocationsQueryV2
   - useSuppliersQueryV2
   - useOrganizationUsersQueryV2

---

**Last Updated**: 2026-01-18
**Status**: ✅ Code Complete - Pending Final Verification
**Next Action**: Run `npm run type-check && npm run lint && npm run build` to verify builds

---

## Summary

All 9 implementation files have been created and verified from code review:

| Metric                 | Count               |
| ---------------------- | ------------------- |
| Files Created          | 9/9                 |
| Code Verified          | 68% (105/155 items) |
| Needs Manual Testing   | 50 items            |
| Needs DB Verification  | 8 items             |
| TypeScript Strict Mode | ❌ Disabled         |

**See**: [DASHBOARD_V2_VERIFICATION_CHECKLIST.md](../DASHBOARD_V2_VERIFICATION_CHECKLIST.md) for detailed 155-item checklist
