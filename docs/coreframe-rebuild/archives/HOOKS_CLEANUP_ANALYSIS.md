# Hooks Folder Structure Analysis & Cleanup Plan

**Date:** 2026-01-17
**Context:** Dashboard V2 implementation revealed confusing hooks organization with duplicates and unused files

## Current State

### Folder Structure

```
src/
├── hooks/                              # ❌ LEGACY - Contains V1 hooks
│   ├── queries/
│   │   └── useActivities.ts           # UNUSED - No imports found
│   ├── use-chat-users.ts              # UNUSED - No imports found
│   ├── use-debounce.ts                # ✅ USED - supplier-filters.tsx
│   ├── useActivityLogger.ts           # UNUSED - No imports found
│   ├── useCurrentPath.ts              # UNUSED - No imports found
│   ├── useOrganizationInvitations.ts  # UNUSED - No imports found
│   ├── useOrganizationUsers.ts        # UNUSED - No imports found
│   ├── usePermissions.ts              # ❌ LEGACY V1 - Still used in org-management
│   ├── useRoles.ts                    # UNUSED - No imports found
│   └── useUserDetail.ts               # UNUSED - No imports found
│
└── lib/hooks/                          # ✅ MODERN - Contains current hooks
    ├── queries/
    │   └── v2/
    │       └── use-branch-permissions-query.ts  # ✅ V2 - React Query hook
    ├── v2/
    │   ├── use-permissions.ts         # ✅ V2 - Client-side permission checking
    │   └── __tests__/
    │       └── use-permissions.test.tsx
    ├── us-app-context.ts              # ⚠️ TYPO in filename (should be use-app-context.ts)
    ├── use-hydrated-value.ts
    ├── use-locations.ts
    ├── use-mobile.tsx
    ├── use-simple-swr.ts
    ├── use-subscription.ts
    ├── use-supabase-upload.ts
    ├── usePersistentAccordionList.ts
    └── usePersistentAccordionState.ts
```

## Key Findings

### 1. Permission Hooks - THREE Different Implementations

#### A. `src/hooks/usePermissions.ts` (LEGACY V1)

- **Lines:** 102
- **Purpose:** Fetches all permissions from API, manages permission overrides
- **Architecture:** Legacy pattern with useState/useEffect (no React Query)
- **Used By:**
  - `src/modules/organization-management/components/roles/RoleAssignmentDialog.tsx`
  - `src/modules/organization-management/components/roles/PermissionOverrideDialog.tsx`
- **Status:** ⚠️ **STILL IN USE** - Cannot delete yet, needs migration
- **Exports:**
  - `usePermissions()` - Fetches all permissions
  - `useUserPermissionOverrides(userId)` - Fetches user overrides
  - `useUserPermissions(userId)` - Combines permissions with overrides

#### B. `src/lib/hooks/v2/use-permissions.ts` (V2 CLIENT-SIDE)

- **Lines:** 165
- **Purpose:** Client-side permission checking using PermissionSnapshot from store
- **Architecture:** V2 pattern - reads from Zustand store, no server fetching
- **Used By:**
  - `src/app/[locale]/(dashboard-v2)/start/page.tsx`
  - Tests in `src/lib/hooks/v2/__tests__/use-permissions.test.tsx`
- **Status:** ✅ **CORRECT V2 IMPLEMENTATION**
- **Exports:**
  - `can(permission)` - Check single permission
  - `cannot(permission)` - Negation of can()
  - `canAny(permissions[])` - Check if user has ANY permission
  - `canAll(permissions[])` - Check if user has ALL permissions
  - `getSnapshot()` - Get current permission snapshot

#### C. `src/lib/hooks/queries/v2/use-branch-permissions-query.ts` (V2 REACT QUERY)

- **Lines:** 41
- **Purpose:** React Query hook to fetch permissions for org/branch context
- **Architecture:** V2 pattern - React Query with server action
- **Used By:**
  - `src/app/[locale]/(dashboard-v2)/_components/permissions-sync.tsx`
- **Status:** ✅ **CORRECT V2 IMPLEMENTATION** - Works together with use-permissions.ts
- **Exports:**
  - `useBranchPermissionsQuery({ orgId, branchId, enabled })`

**Relationship:** These are NOT duplicates:

- `use-branch-permissions-query.ts` fetches data → `PermissionsSync` → Updates Zustand store
- `use-permissions.ts` reads from Zustand store → Provides `can()`, `cannot()`, etc.
- They work together as part of V2 architecture

### 2. Legacy Hooks in `src/hooks/` (STILL IN USE - dashboard-old)

**CORRECTION:** Initial grep search was misleading - these hooks ARE used by `dashboard-old` components:

1. ⚠️ `queries/useActivities.ts` - Used by ActivityFeed, ActivityFilters, RecentActivitiesWidget
2. ⚠️ `use-chat-users.ts` - Used by ChatList component
3. ⚠️ `useActivityLogger.ts` - Used by test-activity page
4. ⚠️ `useCurrentPath.ts` - Used by SidebarInitializer, ModuleSection
5. ⚠️ `useOrganizationInvitations.ts` - Used by InvitationManagementView
6. ⚠️ `useOrganizationUsers.ts` - Used by organization users list page
7. ⚠️ `useRoles.ts` - Used by RoleAssignmentDialog, InvitationFormDialog
8. ⚠️ `useUserDetail.ts` - Used by user detail page

**Status:** Cannot delete - all are actively used by legacy `dashboard-old` components

### 3. Migrated Hooks

1. ✅ `use-debounce.ts` - **SUCCESSFULLY MOVED** to `src/lib/hooks/`
   - Import updated in `supplier-filters.tsx`
   - Old location removed
   - Type-check passed ✅

### 4. Hooks in `src/lib/hooks/` (CURRENT)

All hooks here are actively used except for potential filename typo:

- ⚠️ `us-app-context.ts` - Filename typo? Should be `use-app-context.ts`
  - Need to verify if this is intentional or a typo

## Cleanup Plan

### ✅ Phase 1: Reorganization (COMPLETED)

**Action Taken:**

```bash
# Moved use-debounce.ts to modern hooks folder
mv src/hooks/use-debounce.ts src/lib/hooks/use-debounce.ts
```

**Updated import in:**

- ✅ `src/modules/warehouse/suppliers/components/supplier-filters.tsx`
  - Changed: `@/hooks/use-debounce` → `@/lib/hooks/use-debounce`

**Verification:**

- ✅ Type-check passed with 0 errors
- ✅ Only one hook successfully migrated

### ❌ Phase 2: Attempted Mass Deletion (FAILED)

**Initial Plan:** Delete 8 "unused" hooks from `src/hooks/`

**Result:** All hooks are actually used by `dashboard-old` components

- Grep search was misleading (searched for imports like `from '@/hooks/...`)
- Actual usage found via type-check errors after deletion
- Had to restore all hooks via `git restore src/hooks/`

**Lesson Learned:** Always verify with type-check BEFORE deleting files

### ⏭️ Phase 3: Fix Filename Typo (SKIPPED)

`us-app-context.ts` is NOT a typo - file is actively used:

- Used by: `src/app/[locale]/dashboard-old/warehouse/audits/history/page.tsx`
- Exports: `useAppContext()` hook
- Keep as-is

### 🔮 Phase 4: Future Cleanup (Blocked - Requires dashboard-old Migration)

**Cannot delete - ALL hooks in `src/hooks/` are still in use by dashboard-old:**

- `queries/useActivities.ts`
- `use-chat-users.ts`
- `useActivityLogger.ts`
- `useCurrentPath.ts`
- `useOrganizationInvitations.ts`
- `useOrganizationUsers.ts`
- `usePermissions.ts`
- `useRoles.ts`
- `useUserDetail.ts`

**Future action:**

1. Migrate all `dashboard-old` components to Dashboard V2 architecture
2. Update components to use V2 hooks and patterns
3. Delete entire `src/hooks/` folder once migration complete
4. This is a large undertaking - not part of current scope

## V2 Hooks Verification

### ✅ All V2 hooks are properly organized:

1. **Permission checking (client-side):**
   - Location: `src/lib/hooks/v2/use-permissions.ts` ✅
   - Purpose: Client-side permission checks using Zustand store
   - Tests: `src/lib/hooks/v2/__tests__/use-permissions.test.tsx` ✅

2. **Permission fetching (React Query):**
   - Location: `src/lib/hooks/queries/v2/use-branch-permissions-query.ts` ✅
   - Purpose: Fetch permissions via React Query for org/branch context
   - Used by: PermissionsSync component ✅

**Architecture is correct:** No duplicates created, both hooks serve different purposes in V2 architecture.

## Naming Convention Analysis

### Current State - INCONSISTENT

```
src/hooks/                    # ❌ Mixed camelCase and kebab-case
├── use-chat-users.ts         # kebab-case
├── use-debounce.ts           # kebab-case
├── useActivityLogger.ts      # camelCase
├── useCurrentPath.ts         # camelCase
└── usePermissions.ts         # camelCase

src/lib/hooks/                # ✅ Mostly kebab-case (modern convention)
├── use-hydrated-value.ts     # kebab-case ✅
├── use-locations.ts          # kebab-case ✅
├── use-mobile.tsx            # kebab-case ✅
├── usePersistentAccordion*.ts # ❌ camelCase (inconsistent)
└── us-app-context.ts         # ❌ Missing "e" - typo?
```

### Recommendation

**Modern React convention:** Use kebab-case for hook filenames

- ✅ `use-permissions.ts`
- ❌ `usePermissions.ts`

**Reason:** Matches component naming convention and is easier to read

## Summary

### ✅ Completed Actions (This Session)

1. ✅ **Analyzed all hooks** in both `src/hooks/` and `src/lib/hooks/` folders
2. ✅ **Moved use-debounce.ts** from `src/hooks/` to `src/lib/hooks/`
3. ✅ **Updated import** in supplier-filters.tsx
4. ✅ **Verified us-app-context.ts** - NOT a typo, actively used
5. ✅ **Run type-check** - Passed with 0 errors
6. ✅ **Created comprehensive analysis** in this document

### ❌ Failed Actions (Reverted)

1. ❌ **Attempted to delete 8 hooks** - All are actually used by dashboard-old
2. ❌ **Grep search was misleading** - Type-check revealed actual usage
3. ✅ **Restored via git** - No permanent damage

### Current State - What's Where

**V2 Hooks (Correct Organization):**

- ✅ `src/lib/hooks/v2/use-permissions.ts` - Client-side permission checks
- ✅ `src/lib/hooks/queries/v2/use-branch-permissions-query.ts` - React Query fetching
- ✅ Both hooks work together (NOT duplicates)

**Modern Utility Hooks (src/lib/hooks/):**

- ✅ `use-debounce.ts` - **NEWLY MOVED** from src/hooks/
- ✅ `use-mobile.tsx`
- ✅ `use-locations.ts`
- ✅ `use-subscription.ts`
- ✅ `use-supabase-upload.ts`
- ✅ `use-hydrated-value.ts`
- ✅ `use-simple-swr.ts`
- ✅ `usePersistentAccordionList.ts`
- ✅ `usePersistentAccordionState.ts`
- ✅ `us-app-context.ts` (NOT a typo)

**Legacy Hooks (src/hooks/ - Still in Use):**

- ⚠️ ALL 9 hooks are actively used by dashboard-old components
- ⚠️ Cannot delete until dashboard-old is fully migrated to V2
- ⚠️ This includes usePermissions, useRoles, useActivities, etc.

### Key Findings

1. **No Duplicate V2 Hooks Created** ✅
   - `use-permissions.ts` (client checks) and `use-branch-permissions-query.ts` (fetching) are complementary
   - Both are correctly placed in V2 folders

2. **All New V2 Hooks Properly Organized** ✅
   - Permission checking hook: `src/lib/hooks/v2/use-permissions.ts` ✅
   - Permission query hook: `src/lib/hooks/queries/v2/use-branch-permissions-query.ts` ✅

3. **Legacy Hooks Cannot Be Deleted Yet** ⚠️
   - All hooks in `src/hooks/` are used by dashboard-old components
   - Deletion blocked until full V2 migration

### Future Work (Blocked)

**Requires Dashboard V2 Migration:**

1. Migrate all `dashboard-old` components to Dashboard V2
2. Update components to use V2 hooks and patterns
3. Delete entire `src/hooks/` folder
4. This is a large project - outside current scope

### Files Successfully Modified

1. ✅ Moved: `src/hooks/use-debounce.ts` → `src/lib/hooks/use-debounce.ts`
2. ✅ Updated: `src/modules/warehouse/suppliers/components/supplier-filters.tsx`
3. ✅ Created: `docs/coreframe-rebuild/HOOKS_CLEANUP_ANALYSIS.md` (this file)
