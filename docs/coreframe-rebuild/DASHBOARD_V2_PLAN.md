# Dashboard V2 Rebuild Plan

**Created:** 2026-01-08
**Status:** 🟡 Planned
**Approach:** Clean Slate - Build New, Freeze Legacy

---

## Executive Summary

This document outlines the strategy for building Dashboard V2 (`/dashboard-v2/*`) with clean architecture while **freezing the legacy dashboard** (`/dashboard/*`) without modifications.

### Why Dashboard V2?

**Problem:** Legacy app-store contains heavy data arrays and data fetching logic, violating proper state management principles.

**Solution:** Build new dashboard route with proper architecture from day 1:

- ✅ Thin Zustand stores (UI state only)
- ✅ React Query for heavy data (locations, suppliers, users)
- ✅ Server loaders for SSR snapshot
- ✅ Zero risk to existing functionality

### Key Architectural Decisions (Updated 2026-01-08)

**Based on external code review, the following critical decisions have been made:**

1. **❌ NO `subscription` field in App Store V2**
   - If needed: Use React Query (`useSubscriptionQuery`) or store minimal plan type only
   - Keeps store thin and focused

2. **✅ Branch-Aware Permission Model**
   - Permissions in Zustand are for CURRENT active branch only
   - Branch switching triggers permission refresh via server action
   - Prevents "stale permissions after branch switch" bugs

3. **✅ Standardized Supabase Client Usage**
   - All React Query hooks use browser client (`@/utils/supabase/client`)
   - Never use server client in query hooks (breaks in browser)
   - Consistent location: `src/lib/hooks/queries/v2/`

4. **✅ Security First**
   - Permissions are UI gating ONLY (show/hide buttons)
   - Server actions MUST validate permissions server-side
   - Assume RLS will be enabled (even if currently disabled)

5. **✅ Routing Strategy Defined**
   - Development: Direct URL access (`/en/dashboard-v2/start`)
   - Production: Gradual rollout with feature flag
   - Post-launch: Rename routes, delete legacy

6. **✅ Enhanced Test Coverage**
   - 10 tests minimum (4 user store + 6 app store)
   - Test array replacement (no merge)
   - Test branch switching edge cases
   - Test permission snapshot replacement via `setPermissions()`
   - Permission refresh behavior tested at query/sync layer (not in store)

---

## Architecture Principles

### Source of Truth Layers

```
DATABASE + RLS           ← Ultimate source of truth
       ↓
SERVER LOADERS          ← SSR snapshot (minimal data)
  ↓                       - loadUserContextServer()
  ↓                       - loadAppContextServer()
  ↓
REACT QUERY             ← Client-side cache (heavy data)
  ↓                       - useLocationsQuery(branchId)
  ↓                       - useSuppliersQuery(orgId)
  ↓                       - useOrganizationUsersQuery(orgId)
  ↓
ZUSTAND V2              ← Thin UI state ONLY
                          - activeOrgId, activeBranchId
                          - availableBranches, userModules
                          - permissions, isLoaded
```

### V2 Store Rules

**✅ What Belongs in Zustand:**

- Current selection IDs (`activeOrgId`, `activeBranchId`)
- Small lists from server (`availableBranches`, `userModules`)
- User identity snapshot (`user`, `preferences`, `roles`, `permissions`)
- UI flags (`isLoaded`, `sidebarOpen`, `theme`)

**❌ What Does NOT Belong in Zustand:**

- Heavy arrays (locations, suppliers, organizationUsers)
- Loading states (isLoadingLocations, isLoadingSuppliers)
- Data fetching methods (loadBranchData, loadOrganizationUsers)
- Supabase client imports
- ANY network calls or async operations

**✅ What Goes in React Query:**

- All heavy data arrays (per org/branch context)
- All permission fetching (via server actions)
- Automatic caching with stale time (5 minutes)
- Automatic refetching on window focus
- Optimistic updates for mutations

### Critical Architectural Rules

**1. ❌ NO Mixed Mode**

- Never import both legacy and v2 hooks/stores in same component
- Never import both legacy and v2 stores in same component
- Components are either 100% legacy OR 100% v2
- No bridging or "compatibility layers"

**2. ✅ Query Key Conventions**

- All v2 queries MUST use "v2" prefix: `["v2", "locations", branchId]`
- Prevents collision with legacy queries
- Consistent pattern across all hooks
- Example: `queryKey: ["v2", "permissions", orgId, branchId]`

**3. ✅ Zustand = Dumb Container**

- Stores NEVER fetch data (no Supabase, no server actions, no fetch)
- Stores ONLY have setter methods: `setPermissions(data)`, `setActiveBranch(id)`
- All data fetching happens in React Query
- Sync components bridge React Query → Zustand

**4. ✅ Error Handling Strategy**

- Base query hooks: Log errors, throw (no toasts)
- Components: Handle errors with toasts (prevents retry spam)
- Use error boundaries for catastrophic failures
- Deduplicate toasts to avoid spam

**5. ✅ V2 Naming Conventions**

- Stores: `useUserStoreV2`, `useAppStoreV2`, `useUiStoreV2`
- Query hooks: `useLocationsQueryV2`, `useBranchPermissionsQueryV2`
- Wrapper hooks: `useLocationsV2`, `useSuppliersV2` (or in `hooks/v2/` subfolder)
- Components: No v2 suffix needed if in v2 routes

### Security Model

**Database + RLS as Ultimate Source of Truth:**

Even though RLS may currently be disabled on some tables, **v2 architecture assumes RLS will be enabled**. All code must be written defensively:

- ✅ **Server actions MUST validate permissions** - Never trust client-side permissions
- ✅ **All queries MUST respect org/branch scoping** - Filter by `organization_id` and `branch_id`
- ✅ **Assume RLS will block unauthorized access** - Don't build workarounds
- ❌ **Never bypass security** - No service role keys in client code

**Permissions in Zustand are UI gating only.** They control what buttons/links are shown, but server actions are the actual security boundary.

---

## V2 Context Contract

**What Server Loaders Provide to V2:**

This section defines the exact shape of data that `loadUserContextServer()` and `loadAppContextServer()` must provide to Dashboard V2. This prevents type drift and ensures hydration works correctly.

### UserContext Snapshot (SSR)

```typescript
interface UserContextV2 {
  user: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  roles: JWTRole[]; // From JWT token
  permissions: string[]; // For CURRENT branch at SSR time
  preferences: {
    locale: string;
    theme: "light" | "dark" | "system";
  } | null;
}
```

**Notes:**

- `user` is minimal identity snapshot (not full profile)
- `permissions` are for the branch active at SSR time
- `preferences` can be null if not yet set

### AppContext Snapshot (SSR)

```typescript
interface AppContextV2 {
  activeOrgId: string | null;
  activeBranchId: string | null;
  activeOrg: {
    id: string; // Normalized from DB organization_id
    name: string;
    slug: string;
  } | null;
  availableBranches: Array<{
    branch_id: string;
    name: string;
    is_default: boolean;
  }>;
  userModules: Array<{
    module_id: string;
    name: string;
    icon: string;
    route: string;
  }>;
}
```

**Notes:**

- `activeOrg.id` is normalized from DB `organization_id` field
- `availableBranches` is minimal list (not full branch objects)
- `userModules` is minimal list (only fields needed for navigation)

### Loader Implementation Notes

**Normalization:**

- DB column `organization_id` → store field `id`
- DB column `branch_id` → keep as `branch_id` (used in queries)

**Fallbacks:**

- If no organization: redirect to onboarding
- If no branch: set `activeBranchId` to first available or default
- If no permissions: return empty array `[]`

**Server Loaders Already Exist:**

- `src/lib/api/load-app-context-server.ts`
- `src/lib/api/load-user-context-server.ts`

These loaders already return the correct minimal data. V2 just needs to ensure field normalization during hydration.

---

## V2 Stores Design

### 1. User Store V2 (`useUserStoreV2`)

**Purpose:** Hold minimal user identity + auth context

**State:**

```typescript
interface UserStoreV2State {
  user: UserV2 | null;
  preferences: UserPreferencesV2 | null;
  roles: JWTRole[];
  permissions: string[]; // Permissions for CURRENT active branch (UI gating only)
  isLoaded: boolean;
}
```

**Actions:**

- `hydrateFromServer(context)` - Set context from server loaders
- `setPermissions(permissions)` - Update permissions array (NO fetching)
- `clear()` - Reset to initial state

**Size:** ~60 lines
**Imports:** NO Supabase, NO data fetching, NO server actions
**Hydration:** From `loadUserContextServer()` only

**Permission Model (Branch-Aware):**

Permissions in Zustand are for the **current active branch only**. Zustand is a **dumb container** - it NEVER fetches data.

**Permission Refresh Flow:**

1. User switches branch → `useAppStoreV2.setActiveBranch(branchId)` is called
2. React Query hook `useBranchPermissionsQuery(orgId, branchId)` detects branch change
3. Query hook calls server action to fetch new permissions
4. `PermissionsSync` component reads query result and calls `useUserStoreV2.setPermissions(data)`
5. UI re-renders with new permissions

**Critical Separation:**

- ✅ **React Query** - Owns permission fetching (via server action)
- ✅ **Zustand** - Stores permission snapshot (dumb container)
- ✅ **PermissionsSync component** - Syncs query result into store
- ❌ **NO fetching in store** - Keeps store deterministic and testable

**Important:** Permissions are for **UI gating only**. Server actions MUST validate permissions server-side. Never trust client-side permissions for security.

---

### 2. App Store V2 (`useAppStoreV2`)

**Purpose:** Hold current org/branch selection + minimal app state

**State:**

```typescript
interface AppStoreV2State {
  activeOrgId: string | null;
  activeBranchId: string | null;
  activeOrg: { id: string; name: string; slug: string } | null; // Minimal snapshot (normalized from DB)
  activeBranch: BranchDataV2 | null;
  availableBranches: BranchDataV2[];
  userModules: LoadedUserModuleV2[];
  isLoaded: boolean;
}
```

**Actions:**

- `hydrateFromServer(context)` - Set context from server loaders (normalizes DB `organization_id` → `id`)
- `setActiveBranch(branchId)` - Update active branch ID (NO fetching, NO auto-loading)
- `clear()` - Reset to initial state

**Size:** ~90 lines
**Imports:** NO Supabase, NO data fetching
**Hydration:** From `loadAppContextServer()` only

**Key Changes from Legacy:**

- ❌ **Removed `subscription`** - If needed, use React Query (`useSubscriptionQuery`) or store only minimal plan type (`{ plan: "pro" | "free" }`)
- ✅ **Minimal `activeOrg`** - Only essential fields (id, name, slug), normalized from DB `organization_id` field
- ✅ **No auto-loading** - `setActiveBranch()` ONLY updates IDs

**Important:** When `setActiveBranch()` is called, it updates `activeBranchId`. React Query hooks detect this change via query keys and automatically refetch. `PermissionsSync` component then syncs the new permissions snapshot into the store. The store itself never triggers fetches.

---

### 3. UI Store V2 (`useUiStoreV2`)

**Purpose:** Hold UI preferences (persisted to localStorage)

**State:**

```typescript
interface UiStoreV2State {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: "light" | "dark" | "system";
}
```

**Actions:**

- `setSidebarOpen(open)`
- `setSidebarCollapsed(collapsed)`
- `setTheme(theme)`

**Size:** ~30 lines
**Persistence:** localStorage via zustand/middleware

---

## React Query Infrastructure

### Query Hooks Pattern

All heavy data fetching uses React Query hooks:

```typescript
// Example: useLocationsQueryV2 (or in v2/ subfolder)
// Location: src/lib/hooks/queries/v2/use-locations-query.ts
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client"; // IMPORTANT: Browser client only

export function useLocationsQueryV2(branchId: string | null) {
  return useQuery({
    queryKey: ["v2", "locations", branchId], // v2 prefix prevents collision
    queryFn: async () => {
      if (!branchId) return [];

      // Use BROWSER client (not server client)
      const supabase = createClient();

      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("branch_id", branchId)
        .is("deleted_at", null);

      if (error) {
        console.error("Error loading locations:", error);
        throw error; // Let component handle toast (avoid retry spam)
      }

      return data || [];
    },
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**Permission Refresh Query:**

```typescript
// Location: src/lib/hooks/queries/v2/use-branch-permissions-query.ts
import { useQuery } from "@tanstack/react-query";
import { getBranchPermissions } from "@/app/actions/permissions"; // Server action

/**
 * Server action contract:
 * - Returns: { permissions: string[] }
 * - Throws on unauthorized or error
 */
export function useBranchPermissionsQueryV2(orgId: string | null, branchId: string | null) {
  return useQuery({
    queryKey: ["v2", "permissions", orgId, branchId],
    queryFn: async () => {
      if (!orgId || !branchId) return [];

      // Server action validates permissions server-side and returns { permissions: string[] }
      const { permissions } = await getBranchPermissions(orgId, branchId);

      return permissions;
    },
    enabled: !!orgId && !!branchId, // Only fetch when both IDs are present
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**PermissionsSync Component Pattern:**

```typescript
// Location: src/app/[locale]/(dashboard-v2)/_components/permissions-sync.tsx
// OR: src/lib/providers/v2/permissions-sync.tsx
"use client";

import { useEffect } from "react";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useBranchPermissionsQueryV2 } from "@/lib/hooks/queries/v2/use-branch-permissions-query";

/**
 * Syncs permission query results into Zustand store.
 * Only runs when both orgId and branchId are present.
 * Always updates (including empty arrays) to prevent stale state.
 */
export function PermissionsSync() {
  const { activeOrgId, activeBranchId } = useAppStoreV2();
  const setPermissions = useUserStoreV2((state) => state.setPermissions);

  const { data: permissions } = useBranchPermissionsQueryV2(activeOrgId, activeBranchId);

  useEffect(() => {
    // Always set (including empty arrays), prevents stale permissions on branch switch
    setPermissions(permissions ?? []); // Sync query result into store
  }, [permissions, setPermissions]);

  return null; // No UI, just sync logic
}
```

**Usage in Layout:**

```typescript
// src/app/[locale]/(dashboard-v2)/_providers.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PermissionsSync } from "./_components/permissions-sync";

export function DashboardV2Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient once per provider instance (not per render)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <PermissionsSync /> {/* Syncs permissions into store */}
      {children}
    </QueryClientProvider>
  );
}
```

**Benefits:**

- ✅ Automatic caching per branch
- ✅ Automatic refetching on stale
- ✅ Loading/error states from React Query
- ✅ No Zustand pollution
- ✅ Permissions auto-refresh on branch switch

**Critical Rules:**

- ✅ **Always use browser client** - Import from `@/utils/supabase/client`
- ❌ **Never use server client** - Would break in browser context
- ✅ **All query hooks in `src/lib/hooks/queries/v2/`** - Consistent location
- ✅ **Query keys with "v2" prefix** - Prevents collision with legacy queries
- ✅ **Error handling in components** - Don't toast in base query hooks (retry spam)
- ✅ **Sync components bridge query → store** - React Query owns data, Zustand stores snapshot

### Hydration & Sync Ordering

**Precedence rules to prevent permission flicker and stale state:**

1. **Hydration (once on mount)**
   - Server loaders provide SSR snapshot
   - `_providers.tsx` hydrates both stores on mount
   - Permissions from loader are for current branch at SSR time

2. **PermissionsSync (reactive)**
   - Only runs when `activeOrgId && activeBranchId` are both set
   - Query is `enabled: !!orgId && !!branchId`
   - Always updates store (including empty arrays)
   - Prevents stale permissions on branch switch

3. **On logout/clear**
   - Call `useUserStoreV2.clear()` and `useAppStoreV2.clear()`
   - Optionally clear React Query cache: `queryClient.clear()`
   - Or remove specific queries: `queryClient.removeQueries({ queryKey: ["v2"] })`

**Why this matters:**

- Hydration sets initial state from SSR
- PermissionsSync refetches if branch changes client-side
- If org/branch becomes null (logout), query is disabled and store is cleared explicitly
- No "permission flicker" during transitions

### Convenience Wrapper Hooks

**Purpose:** Clean API for v2 components (NOT for backwards compatibility with legacy)

```typescript
// src/lib/hooks/v2/use-locations-v2.ts (or use-locations.ts in v2/ subfolder)
export function useLocationsV2() {
  const { activeBranchId } = useAppStoreV2();
  const { data, isLoading, error } = useLocationsQueryV2(activeBranchId);

  return {
    locations: data || [],
    isLoading,
    error,
  };
}

// Similarly: useSuppliersV2(), useOrganizationUsersV2()
```

**Naming Convention:**

- ✅ **Option 1: V2 suffix** - `useLocationsV2()`, `useSuppliersV2()`
- ✅ **Option 2: v2/ subfolder** - `hooks/v2/use-locations.ts`
- ❌ **Never without distinction** - Would collide with legacy hooks

**Important:** These wrappers are for **v2 components only**. Legacy dashboard uses legacy stores. **NO mixed mode** - never import both legacy and v2 hooks/stores in same component.

---

## Routing Strategy

### How Users Access V2

During development, v2 dashboard is accessible via:

**Option 1: Direct URL (Recommended for testing)**

- Users navigate to `/en/dashboard-v2/start` directly
- Add link in dev menu or settings page
- Easy for testing without affecting production users

**Option 2: Feature Flag**

```typescript
// Environment variable
NEXT_PUBLIC_DASHBOARD_V2_ENABLED = true;

// Or per-user preference in database
user_preferences.use_dashboard_v2 = true;
```

**Option 3: Gradual Rollout (Production)**

- Start with internal team only
- Add "Try new dashboard" button in legacy dashboard
- Track usage, gather feedback
- Gradually increase rollout percentage
- Eventually make v2 the default

**Post-Launch (Phase 6):**

- Rename routes: `/dashboard-v2/*` → `/dashboard/*`
- Redirect legacy `/dashboard/*` → new `/dashboard/*`
- Delete legacy code

---

## Dashboard V2 Route Structure

### File Structure

```
src/app/[locale]/(dashboard-v2)/
├── layout.tsx                 # Server layout (loads context)
├── _providers.tsx             # Client provider (hydrates stores)
├── start/
│   └── page.tsx              # Home page (proof of concept)
└── warehouse/                # Future: v2 warehouse module
    ├── products/
    ├── locations/
    └── movements/
```

### Server Layout (`layout.tsx`)

**Purpose:** Load context server-side, pass to client provider

**Key Points:**

- Uses existing `loadUserContextServer()` and `loadAppContextServer()`
- Redirects to login if not authenticated
- Redirects to onboarding if no organization
- Passes context as props to client provider

**No Changes Needed:** Server loaders already return correct minimal data!

---

### Client Provider (`_providers.tsx`)

**Purpose:** Hydrate v2 stores, provide React Query client

**Key Points:**

- Hydrates `useUserStoreV2` and `useAppStoreV2` on mount
- Provides QueryClientProvider with v2 config
- Clean separation: server loads, client hydrates
- NO data fetching in stores

---

### Home Page (`start/page.tsx`)

**Purpose:** Proof-of-concept page to validate v2 architecture

**Displays:**

- User context (email, roles, permissions count)
- App context (org, branch, modules)
- Architecture validation checklist

**Validates:**

- ✅ Server loaders work correctly
- ✅ V2 stores hydrate properly
- ✅ No data fetching in stores
- ✅ Clean architecture foundation

---

## Migration Strategy

### Phase 1: Foundation (Increment 7)

**Goal:** Create v2 stores + dashboard route

**Tasks:**

1. Create v2 stores (user, app, ui)
2. Create dashboard v2 route structure
3. Create proof-of-concept home page
4. Write tests for v2 stores (10 minimum)

**Deliverables:**

- 3 v2 store files (~180 lines total)
- 3 dashboard v2 route files
- 10 new tests (98 total passing)
- Working `/dashboard-v2/start` page

**Timeline:** 2-3 hours

**Gate Criteria:**

- ✅ V2 stores have NO Supabase imports
- ✅ V2 stores have NO data fetching methods
- ✅ `/dashboard-v2/start` page renders correctly
- ✅ All 10 tests passing (98/98 total)
- ✅ Legacy dashboard untouched

**Required Tests (10 minimum):**

**User Store (4 tests):**

1. `hydrateFromServer()` replaces arrays (no merge)
2. `hydrateFromServer(null)` sets `isLoaded=true`
3. `clear()` resets `isLoaded=false`
4. `setPermissions()` replaces array (no merge)

**App Store (6 tests):** 5. `hydrateFromServer()` replaces arrays (no merge) 6. `hydrateFromServer(null)` sets `isLoaded=true` 7. `clear()` resets `isLoaded=false` 8. `setActiveBranch()` does not mutate `branches` or `modules` arrays 9. `setActiveBranch(invalidId)` sets `activeBranch=null` 10. App store does NOT contain `subscription` field

**Test Focus:**

- ✅ Test deterministic state updates (no fetching)
- ✅ Test array replacement (not merge)
- ✅ Test edge cases (null, invalid IDs)
- ❌ Do NOT test permission fetching (that's in React Query, not store)

---

### Phase 2: React Query Hooks (Optional in Increment 7)

**Goal:** Create data fetching layer for heavy data

**Tasks:**

1. Create `useLocationsQueryV2(branchId)`
2. Create `useSuppliersQueryV2(orgId)`
3. Create `useOrganizationUsersQueryV2(orgId)`
4. Create `useBranchPermissionsQueryV2(orgId, branchId)`
5. Create `PermissionsSync` component
6. Create convenience wrapper hooks with V2 naming

**Deliverables:**

- 4 query hook files (locations, suppliers, users, permissions)
- 1 sync component (PermissionsSync)
- 3 wrapper hook files (useLocationsV2, useSuppliersV2, useOrganizationUsersV2)
- Stable hook APIs for V2 components. Legacy remains unchanged.

**Timeline:** 1-2 hours

**Note:** Can be deferred to when building actual v2 modules

---

### Phase 3: UI Primitives (Phase 4 of Original Plan)

**Goal:** Create reusable UI components for v2

**Tasks:**

1. Create sidebar component (uses `useUiStoreV2`)
2. Create page header pattern
3. Create DataTable wrapper
4. Create form patterns with react-hook-form

**Deliverables:**

- Sidebar component with v2 state
- Reusable page layouts
- Form components
- Data display components

**Timeline:** 4-6 hours

---

### Phase 4: First V2 Module (Warehouse Home)

**Goal:** Build first complete feature in v2 to prove stack works

**Tasks:**

1. Create `/dashboard-v2/warehouse/` route
2. Build home page with stats cards
3. Use React Query hooks for data
4. Add navigation, breadcrumbs

**Deliverables:**

- Working warehouse module in v2
- Stats cards with real data
- Complete vertical slice

**Timeline:** 4-6 hours

---

### Phase 5: Incremental Module Migration

**Goal:** Rebuild features one module at a time

**Strategy:**

- Pick highest-value or most-used features first
- Build in v2 with clean architecture
- Reference legacy for requirements
- Delete legacy module when v2 complete

**Module Order (Recommended):**

1. Warehouse Products (high value)
2. Warehouse Locations (dependencies)
3. Warehouse Movements (complex)
4. Teams Module
5. Organization Management
6. Support Module

---

## Benefits of V2 Approach

### 1. Zero Risk to Production

**Legacy dashboard completely untouched:**

- Users continue using `/dashboard/*` routes
- No breaking changes during development
- Easy rollback if needed (just switch routes)
- Can test v2 thoroughly before switching

### 2. Clean Architecture from Day 1

**No technical debt:**

- Build stores correctly from start
- No "we'll refactor later" compromises
- TDD-friendly (test only new code)
- Future-proof foundation

### 3. Incremental Development

**Build one module at a time:**

- Ship features as they're ready
- Get feedback early
- Adjust approach as you learn
- Maintain momentum

### 4. Clear Progress Tracking

**Visual progress:**

- Each v2 module = progress toward goal
- Easy to see what's left
- Motivating to see features working
- Clear definition of "done"

### 5. Team-Friendly

**Multiple developers can work in parallel:**

- Different modules = no conflicts
- Clear boundaries between v2 and legacy
- Easy to onboard new developers
- Documentation as you go

---

## Comparison: V2 vs Migration Approach

| Aspect         | V2 Approach                | Migration Approach         |
| -------------- | -------------------------- | -------------------------- |
| **Risk**       | ✅ Zero (legacy untouched) | ⚠️ High (breaking changes) |
| **Speed**      | ✅ Fast (no migration)     | ❌ Slow (migrate 94 files) |
| **Quality**    | ✅ Clean from day 1        | ⚠️ Half-migrated state     |
| **Testing**    | ✅ Test only new code      | ❌ Must test entire app    |
| **Rollback**   | ✅ Easy (switch routes)    | ❌ Hard (revert changes)   |
| **Clarity**    | ✅ Clear separation        | ⚠️ Mixed old/new           |
| **Motivation** | ✅ See progress quickly    | ❌ Long slog               |

---

## Next Steps

After completing Increment 7 (v2 stores + route), you have two options:

### Option A: Continue Phase 1 (Original Plan)

Complete remaining Phase 1 increments:

- Increment 8: Create `usePermissions()` hook for v2
- Increment 9: Vertical slice - List Organizations in v2

**Then** proceed to Phase 2 (RLS), Phase 3 (Feature Slice), etc.

### Option B: Jump to UI Rebuild (Recommended)

Skip to Phase 4 and start building real v2 modules:

1. Create v2 UI primitives (sidebar, layouts, forms)
2. Build first v2 module (warehouse home)
3. Build additional modules incrementally

**Why Option B:**

- Phase 1 is 90% complete
- Missing increments (8-9) can be built as needed
- Faster time-to-value: working UI sooner
- More motivating: see actual features

---

## Definition of Done

Dashboard V2 rebuild is complete when:

### Core Infrastructure

- [x] ✅ V2 stores created and tested
- [x] ✅ Dashboard v2 route structure created
- [ ] ✅ React Query hooks for heavy data
- [ ] ✅ UI primitives created
- [ ] ✅ Documentation complete

### Feature Parity

- [ ] ✅ All warehouse features rebuilt in v2
- [ ] ✅ All team features rebuilt in v2
- [ ] ✅ All org management features rebuilt in v2
- [ ] ✅ All support features rebuilt in v2

### Quality Gates

- [ ] ✅ All v2 tests passing
- [ ] ✅ No TypeScript errors
- [ ] ✅ No linting errors
- [ ] ✅ User acceptance testing complete
- [ ] ✅ Performance benchmarks met

### Cleanup

- [ ] ✅ Legacy dashboard deleted
- [ ] ✅ Route updated from `/dashboard-v2` to `/dashboard`
- [ ] ✅ Old stores removed
- [ ] ✅ Dead code eliminated
- [ ] ✅ Documentation updated

---

## Resources

**Related Documents:**

- [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) - Overall rebuild progress
- [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - Phase 1 details
- [DASHBOARD_V2_PROGRESS.md](./DASHBOARD_V2_PROGRESS.md) - V2-specific progress tracker

**Key Files:**

- `src/lib/stores/v2/` - V2 stores
- `src/app/[locale]/(dashboard-v2)/` - V2 routes
- `src/lib/hooks/queries/v2/` - React Query hooks

**Reference:**

- [React Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [Zustand Best Practices](https://docs.pmnd.rs/zustand/guides/practice-with-no-store-actions)
- [Next.js App Router](https://nextjs.org/docs/app)

---

**Last Updated:** 2026-01-08
**Next Review:** After Increment 7 completion
