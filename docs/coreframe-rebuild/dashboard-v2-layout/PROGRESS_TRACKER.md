# Dashboard V2 Layout - Progress Tracker

**Created**: 2026-01-17
**Phase**: Dashboard V2 UI Layer
**Status**: ⚪ Not Started
**Overall Progress**: 0%

---

## Quick Overview

| Task                          | Status         | Progress | Lines | Notes                        |
| ----------------------------- | -------------- | -------- | ----- | ---------------------------- |
| **Permission Server Action**  | ⚪ Not Started | 0%       | ~40   | getBranchPermissions()       |
| **Permission Query Hook**     | ⚪ Not Started | 0%       | ~30   | useBranchPermissionsQuery()  |
| **PermissionsSync Component** | ⚪ Not Started | 0%       | ~30   | React Query → Zustand bridge |
| **Dashboard V2 Providers**    | ⚪ Not Started | 0%       | ~45   | Hydration + QueryClient      |
| **Branch Switcher**           | ⚪ Not Started | 0%       | ~80   | Calls changeBranch action    |
| **Sidebar V2**                | ⚪ Not Started | 0%       | ~90   | Navigation with modules      |
| **Page Header V2**            | ⚪ Not Started | 0%       | ~60   | Breadcrumbs + actions        |
| **Dashboard V2 Layout**       | ⚪ Not Started | 0%       | ~50   | Server layout                |
| **Start Page**                | ⚪ Not Started | 0%       | ~80   | Proof of concept             |

**Legend**:

- ✅ Complete
- 🔵 In Progress
- ⚪ Not Started
- ❌ Blocked

---

## Task 1: Permission Server Action

**File**: `src/app/[locale]/dashboard-v2/_actions/permissions.ts`
**Status**: ⚪ Not Started
**Estimated Lines**: ~40
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

**File**: `src/lib/hooks/queries/v2/use-branch-permissions-query.ts`
**Status**: ⚪ Not Started
**Estimated Lines**: ~30
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

**File**: `src/app/[locale]/(dashboard-v2)/_components/permissions-sync.tsx`
**Status**: ⚪ Not Started
**Estimated Lines**: ~30
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

**File**: `src/app/[locale]/(dashboard-v2)/_providers.tsx`
**Status**: ⚪ Not Started
**Estimated Lines**: ~45
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
**Status**: ⚪ Not Started
**Estimated Lines**: ~80
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
**Status**: ⚪ Not Started
**Estimated Lines**: ~90
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
**Status**: ⚪ Not Started
**Estimated Lines**: ~60
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

**File**: `src/app/[locale]/(dashboard-v2)/layout.tsx`
**Status**: ⚪ Not Started
**Estimated Lines**: ~50
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

**File**: `src/app/[locale]/(dashboard-v2)/start/page.tsx`
**Status**: ⚪ Not Started
**Estimated Lines**: ~80
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

### SSR Hydration

- [ ] Server loads context via loadDashboardContextV2()
- [ ] Stores hydrated on client mount (isLoaded=true)
- [ ] No hydration mismatch console errors
- [ ] activeBranchId and activeOrgId populated correctly

### Permission Sync

- [ ] Permissions loaded on initial mount
- [ ] Permissions refetch when branch changes
- [ ] Empty arrays synced correctly (no stale state)
- [ ] Query key includes orgId + branchId

### Branch Switching

- [ ] setActiveBranch() updates Zustand state
- [ ] React Query detects change and refetches
- [ ] PermissionsSync updates user store
- [ ] Database preference persisted via changeBranch
- [ ] Toast shows success/error messages

### V2 Isolation

- [ ] No V1 imports in V2 components
- [ ] V2 stores are only state source
- [ ] usePermissions hook works correctly
- [ ] No mixed mode (V1 + V2 in same file)

### Security

- [ ] Server action validates session
- [ ] PermissionService called server-side only
- [ ] RLS applies to all queries
- [ ] Permissions are UI gating only (documented)

### Performance

- [ ] QueryClient created once per provider
- [ ] staleTime prevents excessive refetches
- [ ] Zustand selectors optimized (no unnecessary re-renders)
- [ ] Page loads in <1s

---

## Quality Gates

### Before Marking Complete

- [ ] `npm run type-check` - No TypeScript errors
- [ ] `npm run lint` - No linting errors
- [ ] `npm run build` - Build succeeds
- [ ] Manual testing complete (all checklist items)
- [ ] `/en/dashboard-v2/start` accessible and functional

### Code Quality

- [ ] All files follow existing V2 patterns
- [ ] Proper error handling
- [ ] Toast notifications use react-toastify
- [ ] Components use shadcn/ui where applicable
- [ ] No console errors in browser

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

✅ **Code Complete**:

- [ ] All 9 files created
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Build succeeds

✅ **Functionality Working**:

- [ ] `/en/dashboard-v2/start` accessible
- [ ] Context loads server-side
- [ ] Stores hydrate on client
- [ ] Branch switching works
- [ ] Permissions update on switch
- [ ] Sidebar navigation works
- [ ] No console errors

✅ **Verification Passed**:

- [ ] All checklist items ✅
- [ ] Manual testing complete
- [ ] Performance acceptable (<1s load)

✅ **Documentation**:

- [ ] This progress tracker updated
- [ ] DASHBOARD_V2_PROGRESS.md updated
- [ ] Implementation notes documented

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

**Last Updated**: 2026-01-17
**Status**: ⚪ Ready to Start
**Next Action**: Implement Task 1 (Permission Server Action)
