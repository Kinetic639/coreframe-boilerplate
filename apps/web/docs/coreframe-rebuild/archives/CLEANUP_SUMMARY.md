# Hooks and Actions Cleanup Summary

**Date:** 2026-01-17
**Session:** Dashboard V2 Code Organization

## Overview

Successfully cleaned up and reorganized hooks and actions folders to support incremental V2 migration while maintaining backward compatibility with legacy dashboard-old components.

## Hooks Cleanup

### Actions Taken

1. ✅ **Moved use-debounce.ts** - From `src/hooks/` to `src/lib/hooks/`
2. ✅ **Updated 1 import** - supplier-filters.tsx now uses `@/lib/hooks/use-debounce`
3. ✅ **Verified all V2 hooks** - Confirmed no duplicates created
4. ✅ **Type-check passed** - 0 errors after cleanup

### Current Hooks Structure

```
src/
├── hooks/                              # LEGACY V1 - Used by dashboard-old
│   ├── queries/useActivities.ts       # ⚠️ Keep - used by ActivityFeed
│   ├── use-chat-users.ts              # ⚠️ Keep - used by ChatList
│   ├── useActivityLogger.ts           # ⚠️ Keep - used by test pages
│   ├── useCurrentPath.ts              # ⚠️ Keep - used by Sidebar
│   ├── useOrganizationInvitations.ts  # ⚠️ Keep - used by InvitationManagement
│   ├── useOrganizationUsers.ts        # ⚠️ Keep - used by org users list
│   ├── usePermissions.ts              # ⚠️ Keep - used by RoleAssignmentDialog
│   ├── useRoles.ts                    # ⚠️ Keep - used by InvitationFormDialog
│   └── useUserDetail.ts               # ⚠️ Keep - used by user detail page
│
└── lib/hooks/                          # MODERN - Current hooks
    ├── queries/v2/
    │   └── use-branch-permissions-query.ts  # ✅ V2 React Query hook
    ├── v2/
    │   └── use-permissions.ts         # ✅ V2 client-side permission checks
    ├── use-debounce.ts                # ✅ MOVED from src/hooks/
    ├── use-mobile.tsx
    ├── use-locations.ts
    ├── use-subscription.ts
    ├── use-supabase-upload.ts
    └── [other utility hooks...]
```

### Key Findings

- **No Duplicate V2 Hooks** - `use-permissions.ts` and `use-branch-permissions-query.ts` are complementary, not duplicates
- **All V2 Hooks Properly Organized** - Permission checking and fetching hooks correctly placed in v2 folders
- **Legacy Hooks Must Stay** - All 9 hooks in `src/hooks/` actively used by dashboard-old

### Files Modified

1. ✅ Moved: `src/hooks/use-debounce.ts` → `src/lib/hooks/use-debounce.ts`
2. ✅ Updated: `src/modules/warehouse/suppliers/components/supplier-filters.tsx`

**Documentation:** [docs/coreframe-rebuild/HOOKS_CLEANUP_ANALYSIS.md](HOOKS_CLEANUP_ANALYSIS.md)

---

## Actions Cleanup

### Actions Taken

1. ✅ **Created 3 new folders** - v2/, shared/, \_debug/
2. ✅ **Moved 9 files** - permissions.ts, changeBranch.ts, 7 debug/test files
3. ✅ **Deleted duplicate auth folder** - Removed unused `src/app/actions/auth/`
4. ✅ **Updated 13 imports** - All components now use correct paths
5. ✅ **Type-check passed** - 0 errors after reorganization
6. ✅ **Tests fixed** - actions.test.ts mock hoisting issue resolved

### Final Actions Structure

```
src/app/actions/
├── v2/                                 # V2-SPECIFIC ACTIONS
│   ├── index.ts                       # Exports all V2 actions
│   └── permissions.ts                 # getBranchPermissions()
│
├── shared/                             # SHARED (used by both V1 and V2)
│   ├── index.ts                       # Exports all shared actions
│   └── changeBranch.ts                # changeBranch()
│
├── _debug/                             # DEBUG/TEST ACTIONS (7 files)
│   ├── debug-app-context.ts
│   ├── debug-jwt-token.ts
│   ├── debug-user-context.ts
│   ├── test-logo-access.ts
│   ├── test-permissions.ts
│   ├── test-roles.ts
│   └── test-service-role.ts
│
├── roles/                              # LEGACY V1
│   ├── index.ts
│   └── role-management.ts
│
├── users/                              # LEGACY V1 (7 files)
│   └── [user action files...]
│
├── warehouse/                          # LEGACY V1 (28 files)
│   └── [warehouse action files...]
│
├── announcements-actions.ts           # LEGACY V1
├── branches.ts                         # LEGACY V1
├── invitations-server.ts              # LEGACY V1
├── invitations.ts                     # LEGACY V1
├── news-actions.ts                    # LEGACY V1
└── index.ts                            # UPDATED - Exports v2, shared, users, roles

src/app/[locale]/
└── actions.ts                          # Auth actions (working version kept)
```

### Files Modified

**Moved:**

1. `src/app/[locale]/dashboard-v2/_actions/permissions.ts` → `src/app/actions/v2/permissions.ts`
2. `src/app/actions/changeBranch.ts` → `src/app/actions/shared/changeBranch.ts`
3. 7 debug/test files → `src/app/actions/_debug/`

**Deleted:**

1. `src/app/actions/auth/` folder (duplicate, unused)
2. `src/app/[locale]/dashboard-v2/_actions/` folder (empty after move)

**Imports Updated (13 files):**

1. ✅ `src/hooks/queries/v2/use-branch-permissions-query.ts`
2. ✅ `src/components/v2/layout/branch-switcher.tsx`
3. ✅ `src/components/Dashboard/CompactBranchSelector.tsx`
4. ✅ `src/components/Dashboard/header/BranchSelector.tsx`
5. ✅ `src/components/Dashboard/header/DashboardHeader.tsx`
6. ✅ `src/components/auth/ForgotPasswordForm.tsx`
7. ✅ `src/components/auth/SignInForm.tsx`
8. ✅ `src/components/auth/SignUpForm.tsx`
9. ✅ `src/components/debug/LogoDebug.tsx`
10. ✅ `src/components/debug/ServiceRoleTest.tsx`
11. ✅ `src/components/debug/PermissionTestComponent.tsx`
12. ✅ `src/app/[locale]/test-roles/page.tsx`
13. ✅ `src/app/actions/index.ts`

**Tests Fixed:**

- ✅ Fixed vitest mock hoisting issue in `src/app/[locale]/__tests__/actions.test.ts`
- ✅ All 17 auth action tests passing

**Documentation:** [docs/coreframe-rebuild/ACTIONS_CLEANUP_ANALYSIS.md](ACTIONS_CLEANUP_ANALYSIS.md)

---

## Verification Results

### Type Safety

- ✅ **Type-check**: `npm run type-check` - **0 errors**
- ✅ **All imports resolved**: No broken module references
- ✅ **TypeScript strict mode**: All files passing

### Testing

- ✅ **Auth actions tests**: 17/17 passing
- ✅ **Overall test suite**: 266 tests passing
- ✅ **Test files**: 16/16 passing

### Code Quality

- ✅ **Folder structure**: Clean separation of V1, V2, shared, and debug
- ✅ **No duplicates**: Single source of truth for all code
- ✅ **Documentation**: Comprehensive analysis documents created

---

## Benefits Achieved

### Immediate Benefits

1. **Clear V2 Separation** - All V2 hooks and actions in dedicated v2/ folders
2. **Shared Code Identified** - Actions used by both versions clearly marked
3. **Debug Code Isolated** - Test/debug files in \_debug/ folder (not exported)
4. **No Duplicates** - Removed conflicting auth actions folder
5. **Better Organization** - Logical folder structure for incremental migration

### Long-term Benefits

1. **Easy Future Cleanup** - Legacy code clearly marked for removal
2. **Scalable V2 Development** - Clear patterns for adding new V2 code
3. **Reduced Confusion** - No more duplicate files with different implementations
4. **Maintainability** - Single source of truth for each feature
5. **Progressive Migration** - Can migrate dashboard-old incrementally

---

## Usage Guidelines

### Adding New V2 Hooks

1. Create in `src/lib/hooks/v2/[hook-name].ts` (for local hooks)
2. Create in `src/lib/hooks/queries/v2/[hook-name].ts` (for React Query hooks)
3. Import using `@/lib/hooks/v2/[hook-name]` or `@/lib/hooks/queries/v2/[hook-name]`

### Adding New V2 Actions

1. Create in `src/app/actions/v2/[action-name].ts`
2. Export from `src/app/actions/v2/index.ts`
3. Import using `@/app/actions/v2/[action-name]`

### Identifying Shared Code

When a V1 component needs to be used by V2:

**For Hooks:**

- Keep in `src/lib/hooks/` (modern location)
- Update V1 imports if needed

**For Actions:**

1. Move to `src/app/actions/shared/[action-name].ts`
2. Export from `src/app/actions/shared/index.ts`
3. Update imports in both V1 and V2 components

---

## Future Cleanup (When Removing dashboard-old)

### Hooks Cleanup

When dashboard-old is fully migrated:

1. Delete entire `src/hooks/` folder (all 9 legacy hooks)
2. Keep only `src/lib/hooks/` with V2 hooks

### Actions Cleanup

When dashboard-old is fully migrated:

1. Delete legacy action folders:
   - `src/app/actions/roles/`
   - `src/app/actions/users/`
   - `src/app/actions/warehouse/`
   - `src/app/actions/announcements-actions.ts`
   - `src/app/actions/branches.ts`
   - `src/app/actions/invitations*.ts`
   - `src/app/actions/news-actions.ts`

2. Keep only:
   - `src/app/actions/v2/` ✅
   - `src/app/actions/shared/` ✅
   - `src/app/actions/_debug/` ✅
   - `src/app/[locale]/actions.ts` (auth) ✅

3. Final structure will be minimal and V2-focused

---

## Summary

This cleanup successfully established a clear separation between V1 (legacy) and V2 (modern) code while maintaining full backward compatibility. The reorganization makes it easy to:

- Identify what code is V2-ready
- Find shared code used by both versions
- Add new V2 features following established patterns
- Incrementally migrate dashboard-old components
- Clean up legacy code when ready

All changes are verified with type-check and tests, ensuring zero regressions while improving code organization for the V2 migration effort.
