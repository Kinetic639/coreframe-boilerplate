# RBAC System Fixes & Enhancements - Summary

**Date:** 2026-01-07
**Phase:** Phase 1 - Post-Increment 6
**Duration:** ~3 hours
**Status:** ✅ Complete

## Overview

After completing Increment 6 (loadAppContextServer refactoring), we conducted a comprehensive review of the RBAC system with external consultation (ChatGPT analysis). This review uncovered critical design flaws and security issues that were addressed through additional implementation work.

## Problems Discovered

### 1. Global Override Representation (Critical Security Issue)

**Problem:** The `user_permission_overrides` table had `scope_id uuid NOT NULL`, making it impossible to represent global overrides properly. Code attempted to use `scope_id="global"` (string) which violated the UUID constraint.

**Impact:** Global overrides couldn't exist in the database, breaking the intended permission precedence system.

### 2. Permission Override Query Filter (Security Issue)

**Problem:** Override query used `and(scope.eq.global)` which is brittle and may not work correctly with PostgREST. Additionally, the filter didn't properly handle NULL scope_id for global overrides.

**Impact:** Could lead to incorrect permission calculations or query failures.

### 3. Non-Deterministic Override Precedence

**Problem:** When multiple overrides existed at the same precedence level (e.g., two org-level overrides), the sort order was non-deterministic.

**Impact:** Unpredictable permission results, making debugging difficult and breaking reproducibility.

### 4. Missing Loader Fixes from Previous Review

**Problem:** Several fixes suggested in earlier code reviews were not fully implemented:

- activeBranchId mismatch in loadAppContextServer
- Missing deterministic ordering for org fallback
- Non-minimal field selection in organization profile query

**Impact:** Inconsistent state, non-deterministic behavior, unnecessary database load.

## Solutions Implemented

### Migration 1: Fix RBAC Scope Support

**File:** `supabase/migrations/20260107145249_fix_rbac_scope_support.sql`

**Changes:**

1. Added `scope_type` column to `roles` table
   - Values: 'org', 'branch', or 'both'
   - Declares intended assignment scope for each role
   - Prevents accidental misassignment of roles

2. Added validation trigger `validate_role_assignment_scope()`
   - Enforces that role assignments match the role's intended scope_type
   - Prevents org-scoped roles from being assigned at branch level (and vice versa)

3. Improved `get_permissions_for_roles` RPC
   - Added DISTINCT to eliminate duplicate permission slugs
   - Added ORDER BY for deterministic results
   - Prevents permission duplication in final arrays

**Applied:** ✅ Successfully via `mcp__supabase__apply_migration`

### Migration 2: Fix Permission Overrides Global Scope

**File:** `supabase/migrations/fix_permission_overrides_global_scope.sql`

**Changes:**

1. Made `scope_id` nullable
   - Global overrides: `scope_id = NULL`
   - Org overrides: `scope_id = org_id` (UUID)
   - Branch overrides: `scope_id = branch_id` (UUID)

2. Added unique constraint
   - Prevents duplicate overrides for same (user, permission, scope, scope_id)
   - Index name: `user_permission_overrides_uniq`
   - Filters out soft-deleted rows

3. Added CHECK constraint `user_permission_overrides_scope_id_required`
   - Enforces: `scope='global' => scope_id IS NULL`
   - Enforces: `scope IN ('org','branch') => scope_id IS NOT NULL`
   - Database-level validation prevents invalid data

**Pre-migration:** Cleaned up 1 duplicate override row
**Applied:** ✅ Successfully via `mcp__supabase__apply_migration`

### Service Layer: PermissionService Updates

**File:** `src/server/services/permission.service.ts`

**Changes:**

1. **Fixed Override Query Filter** (Lines 119-131)

   ```typescript
   // OLD (broken):
   const overrideFilters = [
     `and(scope.eq.global)`, // Brittle, doesn't handle NULL
     `and(scope.eq.org,scope_id.eq.${orgId})`,
   ];

   // NEW (correct):
   const overrideOr = branchId
     ? `scope.eq.global,and(scope.eq.org,scope_id.eq.${orgId}),and(scope.eq.branch,scope_id.eq.${branchId})`
     : `scope.eq.global,and(scope.eq.org,scope_id.eq.${orgId})`;
   ```

   - Uses proper `scope.eq.global` filter (no `and()` wrapper)
   - Correctly handles NULL scope_id for global overrides
   - Single .or() string for better PostgREST compatibility

2. **Added Deterministic Secondary Sort** (Lines 172-180)

   ```typescript
   const sortedOverrides = [...overrides].sort((a, b) => {
     const scopeDiff = scopePrecedence[a.scope] - scopePrecedence[b.scope];

     // NEW: Stable tiebreaker
     if (scopeDiff !== 0) return scopeDiff;
     return String(a.permission_id).localeCompare(String(b.permission_id));
   });
   ```

   - Adds stable tiebreaker using permission_id
   - Ensures reproducible results when multiple overrides at same level
   - Makes debugging predictable

### Context Loader: Additional Fixes

**File:** `src/lib/api/load-app-context-server.ts`

**Changes from earlier review:**

1. **Deterministic Org Fallback** (Lines 64-70)

   ```typescript
   // Added ORDER BY for deterministic fallback
   .order("created_at", { ascending: true }) // Oldest owned org first
   ```

2. **Minimal Organization Profile Fields** (Lines 79-83)

   ```typescript
   // Reduced from SELECT * to minimal fields
   .select("organization_id, name, slug, logo_url, description")
   ```

3. **Fixed activeBranchId Consistency** (Lines 110-112)

   ```typescript
   // Ensure activeBranchId matches the selected activeBranch object
   const finalActiveBranchId = activeBranch?.id ?? null;
   ```

4. **Deterministic Branch Ordering** (Line 93)
   ```typescript
   // ASC order for deterministic fallback to oldest/main branch
   .order("created_at", { ascending: true })
   ```

**File:** `src/lib/api/load-user-context-server.ts`

**Enhancement:**

- Now passes `default_branch_id` to PermissionService (Line 111)
- Enables branch-scoped permission calculation
- Users get correct permissions for their active branch context

### Test Updates

**File:** `src/server/services/__tests__/permission.service.test.ts`

**Changes:**

- Updated global override test to use `scope_id: null` instead of `scope_id: "global"`
- Test now reflects actual database schema
- All 88 tests passing

## Results & Impact

### Tests

- ✅ All 88 tests passing
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors

### Database Schema

- ✅ `roles.scope_type` column added with validation
- ✅ `user_permission_overrides.scope_id` now nullable
- ✅ Unique constraint prevents duplicate overrides
- ✅ CHECK constraint enforces scope rules
- ✅ Validation trigger prevents invalid role assignments

### Service Layer

- ✅ PermissionService correctly handles global/org/branch overrides
- ✅ Override precedence is deterministic and reproducible
- ✅ Query filters use proper PostgREST syntax
- ✅ Branch-scoped permissions now work correctly

### Context Loaders

- ✅ loadUserContextServer passes branch context to permission service
- ✅ loadAppContextServer has deterministic fallback behavior
- ✅ activeBranchId consistent with activeBranch object
- ✅ Minimal data loading reduces SSR payload

### Security

- ✅ Global overrides properly represented in database
- ✅ No possibility of UUID collision with scope filtering
- ✅ Role assignments validated against role scope_type
- ✅ Permission overrides validated with CHECK constraints

## RBAC System Now Fully Supports

### Org-Scoped Permissions

```typescript
// Example: Org Owner assigned at organization level
{
  role_id: "org_owner_role",
  scope: "org",
  scope_id: "org-123"
}
// Gets permissions: ["org.*", "org.branches.manage", ...]
// These permissions apply to ALL branches in org-123
```

### Branch-Scoped Permissions

```typescript
// Example: Branch Admin assigned at branch level
{
  role_id: "branch_admin_role",
  scope: "branch",
  scope_id: "branch-456"
}
// Gets permissions: ["branch.settings.update", "warehouse.products.*", ...]
// These permissions apply ONLY to branch-456
```

### Same User, Different Branches

```typescript
// User can be admin of branch A but viewer of branch B
roleAssignments: [
  { role_id: "admin", scope: "branch", scope_id: "branch-A" },
  { role_id: "viewer", scope: "branch", scope_id: "branch-B" },
];

// When active branch = A: Full admin permissions
// When active branch = B: Read-only permissions
```

### Permission Override Precedence

```typescript
// Override hierarchy (later wins):
// 1. Global override (scope='global', scope_id=NULL)
// 2. Org override (scope='org', scope_id=org_id)
// 3. Branch override (scope='branch', scope_id=branch_id)

// Example: Branch override wins
overrides: [
  { perm: "products.delete", allowed: true, scope: "global", scope_id: null }, // 1st
  { perm: "products.delete", allowed: false, scope: "org", scope_id: "org-1" }, // 2nd (wins over global)
  { perm: "products.delete", allowed: true, scope: "branch", scope_id: "branch-1" }, // 3rd (wins over org)
];
// Final result: user CAN delete products in branch-1 (branch override wins)
```

## Files Modified

### Database Migrations

1. `supabase/migrations/20260107145249_fix_rbac_scope_support.sql` - **CREATED**
2. `supabase/migrations/fix_permission_overrides_global_scope.sql` - **CREATED**

### Service Layer

3. `src/server/services/permission.service.ts` - **MODIFIED** (lines 119-131, 172-180)

### Context Loaders

4. `src/lib/api/load-user-context-server.ts` - **MODIFIED** (line 111)
5. `src/lib/api/load-app-context-server.ts` - **MODIFIED** (lines 64-70, 79-83, 93, 110-112)

### Tests

6. `src/server/services/__tests__/permission.service.test.ts` - **MODIFIED** (line 226)

### Documentation

7. `docs/coreframe-rebuild/RBAC_FIXES_SUMMARY.md` - **CREATED** (this file)

## Next Steps

With RBAC system fully functional, Phase 1 can continue with:

### Increment 7: Update Zustand Stores

- Update stores to use new context structure
- Ensure permission state management is correct

### Increment 8: Create usePermissions Hook

- Client-side permission checking hook
- Leverages PermissionService.can() for wildcard support

### Increment 9: Vertical Slice - List Organizations

- Prove entire stack works end-to-end
- First feature using complete auth/context/permissions foundation

## Architectural Decisions

### ADR-005: Nullable scope_id for Global Overrides

**Date:** 2026-01-07
**Context:** Global overrides couldn't be represented with scope_id uuid NOT NULL
**Decision:** Make scope_id nullable, use NULL for global, UUID for org/branch
**Status:** ✅ Implemented
**Impact:** Enables proper 3-level override precedence system

### ADR-006: Role Scope Type Declaration

**Date:** 2026-01-07
**Context:** Roles had no way to declare intended assignment scope
**Decision:** Add scope_type column with validation trigger
**Status:** ✅ Implemented
**Impact:** Prevents accidental role misassignment, documents role intent

### ADR-007: Deterministic Override Sorting

**Date:** 2026-01-07
**Context:** Same-level overrides had non-deterministic order
**Decision:** Add permission_id tiebreaker to sort function
**Status:** ✅ Implemented
**Impact:** Reproducible permission calculations, easier debugging

## Lessons Learned

1. **External Review Value**: ChatGPT analysis caught critical issues missed in initial implementation
2. **Schema Constraints Matter**: CHECK constraints and unique indexes prevent invalid data at source
3. **Test Against Real Schema**: Mock tests must reflect actual database constraints
4. **Determinism is Critical**: Non-deterministic behavior makes debugging impossible
5. **Security Layers**: Multiple layers (DB constraints, service validation, client guards) provide defense in depth

## Conclusion

The RBAC system is now production-ready with:

- ✅ Proper database schema with validation
- ✅ Full org/branch scope support
- ✅ Deterministic permission calculation
- ✅ Security enforced at multiple layers
- ✅ Comprehensive test coverage (88 tests passing)
- ✅ Clean, maintainable codebase

This foundation supports the intended multi-tenant, multi-branch architecture where users can have different permissions per branch within the same organization.
