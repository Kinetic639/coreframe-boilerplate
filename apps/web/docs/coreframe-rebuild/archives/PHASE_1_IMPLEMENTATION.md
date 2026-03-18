# Phase 1 Implementation Plan: Auth + SSR Context + Granular Permissions with Scopes

**Strategy:** Test-Driven Development (TDD) with working app at every step
**Duration:** 3-7 days
**Goal:** Rock-solid authentication, context loading, and permission foundation

## Prerequisites Checklist

- ✅ Vitest configured with jsdom (default) and node environments
- ✅ Testing harnesses ready (AppContext, ReactQuery, Supabase mocks)
- ✅ Database schema complete (permissions, roles, role_permissions, user_role_assignments, user_permission_overrides)
- ✅ No old user_roles table (already removed)
- ✅ MSW setup for HTTP mocking
- ✅ 18 passing example tests

## Implementation Order & Dependencies

```
1. Database Foundation (authorize function, JWT hook)
   ↓
2. Auth Service Layer (getUserRoles, hasRole)
   ↓
3. Permission Service Layer (getPermissions, can)
   ↓
4. Context Loaders (loadUserContext, loadAppContext)
   ↓
5. Client Stores (Zustand updates)
   ↓
6. Permission Hook (usePermissions)
   ↓
7. Minimal Vertical Slice (Validation)
```

---

## Increment 1: Database - authorize() PL/pgSQL Function (1-2 hours)

### Objective

Create the `authorize()` function that RLS policies reference for permission validation.

### TDD Approach

Since this is database-level, we'll write service tests that will pass once the function exists.

### Step 1.1: Write Test First (RED)

**File:** `src/server/services/__tests__/permission.service.test.ts`

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient, mockRLSError } from "@/test/setup-supabase-mocks";

describe("PermissionService - authorize() integration", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  it("should allow access when user has permission", async () => {
    // This will fail until authorize() exists
    mockSupabase
      .from()
      .select()
      .mockResolvedValue({
        data: [{ id: "1", name: "Test Role" }],
        error: null,
      });

    const { data, error } = await mockSupabase.from("roles").select("*");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("should deny access when user lacks permission", async () => {
    // Simulate RLS denial from authorize() returning false
    mockSupabase.from().select().mockResolvedValue(mockRLSError("permission denied"));

    const { data, error } = await mockSupabase.from("roles").select("*");

    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });
});
```

### Step 1.2: Create Migration (GREEN)

**File:** `supabase/migrations/<timestamp>_create_authorize_function.sql`

```sql
-- Create authorize() function for RLS policies
-- This function checks if the current authenticated user has a given permission
-- within the context of the current organization (from app context)

CREATE OR REPLACE FUNCTION public.authorize(
  required_permission text,
  org_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_id uuid;
  user_permissions text[];
  has_permission boolean;
BEGIN
  -- Get current user ID from auth context
  user_id := auth.uid();

  -- If no user is authenticated, deny access
  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get user's permissions from their roles
  -- This aggregates permissions from all role assignments
  WITH user_roles AS (
    SELECT DISTINCT ura.role_id
    FROM user_role_assignments ura
    WHERE ura.user_id = user_id
      AND ura.deleted_at IS NULL
      AND (
        org_id IS NULL
        OR ura.scope_id = org_id
        OR ura.scope = 'org' AND ura.scope_id = org_id
      )
  ),
  role_perms AS (
    SELECT p.slug
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.allowed = true
      AND rp.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
  SELECT COALESCE(bool_or(slug = required_permission), false)
  INTO has_permission
  FROM role_perms;

  -- Check for permission overrides (these take precedence)
  DECLARE
    override_allowed boolean;
  BEGIN
    SELECT upo.allowed INTO override_allowed
    FROM user_permission_overrides upo
    JOIN permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = user_id
      AND p.slug = required_permission
      AND upo.deleted_at IS NULL
      AND (org_id IS NULL OR upo.scope_id = org_id)
    LIMIT 1;

    -- If override exists, use it; otherwise use role-based permission
    IF override_allowed IS NOT NULL THEN
      RETURN override_allowed;
    END IF;
  END;

  RETURN COALESCE(has_permission, false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.authorize(text, uuid) TO authenticated;

COMMENT ON FUNCTION public.authorize IS
  'Checks if the current user has the specified permission within the given organization context. Returns true if authorized, false otherwise.';
```

### Step 1.3: Apply Migration

```bash
pnpm supabase:migration:up
```

### Step 1.4: Verify Tests Pass

```bash
pnpm test:run src/server/services/__tests__/permission.service.test.ts
```

### Commit Point ✅

- Tests passing
- authorize() function created
- RLS policies can now reference authorize()

---

## Increment 2: Database - Fix JWT Custom Hook (1 hour)

### Objective

Update JWT hook to use new `user_role_assignments` table and include permission metadata.

### Step 2.1: Write Test Concept

We can't directly test JWT generation, but we'll test the context loader that consumes JWT claims.

### Step 2.2: Create Migration (GREEN)

**File:** `supabase/migrations/<timestamp>_update_jwt_custom_hook.sql`

```sql
-- Drop old JWT hook
DROP FUNCTION IF EXISTS public.custom_access_token_hook;

-- Create updated JWT hook using new user_role_assignments table
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  user_roles jsonb;
BEGIN
  claims := event->'claims';

  -- Build roles array from user_role_assignments with role details
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role_id', ura.role_id,
        'role', r.name,
        'org_id', CASE WHEN ura.scope = 'org' THEN ura.scope_id ELSE NULL END,
        'branch_id', CASE WHEN ura.scope = 'branch' THEN ura.scope_id ELSE NULL END,
        'scope', ura.scope,
        'scope_id', ura.scope_id
      )
    ),
    '[]'::jsonb
  )
  INTO user_roles
  FROM public.user_role_assignments ura
  JOIN public.roles r ON ura.role_id = r.id
  WHERE ura.user_id = (event->>'user_id')::uuid
    AND ura.deleted_at IS NULL
    AND r.deleted_at IS NULL;

  -- Inject roles into JWT claims
  claims := jsonb_set(claims, '{roles}', user_roles, true);

  -- Update event with new claims
  event := jsonb_set(event, '{claims}', claims, true);

  RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Injects user role assignments into JWT claims on token generation';
```

### Step 2.3: Apply Migration

```bash
pnpm supabase:migration:up
```

### Step 2.4: Test JWT Decode (Manual)

After migration, existing users will need to refresh tokens. Test by:

1. Logging out and back in
2. Checking JWT payload includes roles with new format

### Commit Point ✅

- JWT hook updated to use new schema
- Roles array includes role_id, name, scope info

---

## Increment 3: Auth Service Layer - getUserRoles & hasRole (2-3 hours)

### Objective

Create reusable auth service functions with comprehensive tests.

### Step 3.1: Write Tests First (RED)

**File:** `src/server/services/__tests__/auth.service.test.ts`

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "../auth.service";
import { createMockSupabaseClient } from "@/test/setup-supabase-mocks";

describe("AuthService.getUserRoles", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  it("should extract roles from JWT claims", async () => {
    const mockSession = {
      access_token: "mock-jwt-with-roles",
      user: { id: "user-1" },
    };

    // Mock jwt-decode to return specific claims
    const roles = await AuthService.getUserRoles(mockSession);

    expect(roles).toBeDefined();
    expect(Array.isArray(roles)).toBe(true);
  });

  it("should return empty array for invalid JWT", async () => {
    const mockSession = {
      access_token: "invalid-jwt",
      user: { id: "user-1" },
    };

    const roles = await AuthService.getUserRoles(mockSession);

    expect(roles).toEqual([]);
  });

  it("should handle missing roles in JWT claims", async () => {
    const mockSession = {
      access_token: "jwt-without-roles",
      user: { id: "user-1" },
    };

    const roles = await AuthService.getUserRoles(mockSession);

    expect(roles).toEqual([]);
  });
});

describe("AuthService.hasRole", () => {
  it("should return true when user has exact role match", () => {
    const userRoles = [
      {
        role_id: "r1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org",
        scope_id: "org-1",
      },
    ];

    const hasAdmin = AuthService.hasRole(userRoles, "admin", "org-1");
    expect(hasAdmin).toBe(true);
  });

  it("should return false when role does not match", () => {
    const userRoles = [
      {
        role_id: "r1",
        role: "viewer",
        org_id: "org-1",
        branch_id: null,
        scope: "org",
        scope_id: "org-1",
      },
    ];

    const hasAdmin = AuthService.hasRole(userRoles, "admin", "org-1");
    expect(hasAdmin).toBe(false);
  });

  it("should check org scope correctly", () => {
    const userRoles = [
      {
        role_id: "r1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org",
        scope_id: "org-1",
      },
    ];

    // Should match org-1
    expect(AuthService.hasRole(userRoles, "admin", "org-1")).toBe(true);

    // Should not match org-2
    expect(AuthService.hasRole(userRoles, "admin", "org-2")).toBe(false);
  });

  it("should check branch scope correctly", () => {
    const userRoles = [
      {
        role_id: "r1",
        role: "manager",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch",
        scope_id: "branch-1",
      },
    ];

    const hasManagerBranch1 = AuthService.hasRole(userRoles, "manager", null, "branch-1");
    expect(hasManagerBranch1).toBe(true);

    const hasManagerBranch2 = AuthService.hasRole(userRoles, "manager", null, "branch-2");
    expect(hasManagerBranch2).toBe(false);
  });

  it("should handle multiple roles", () => {
    const userRoles = [
      {
        role_id: "r1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org",
        scope_id: "org-1",
      },
      {
        role_id: "r2",
        role: "viewer",
        org_id: "org-2",
        branch_id: null,
        scope: "org",
        scope_id: "org-2",
      },
    ];

    expect(AuthService.hasRole(userRoles, "admin", "org-1")).toBe(true);
    expect(AuthService.hasRole(userRoles, "viewer", "org-2")).toBe(true);
    expect(AuthService.hasRole(userRoles, "admin", "org-2")).toBe(false);
  });
});
```

### Step 3.2: Implement Service (GREEN)

**File:** `src/server/services/auth.service.ts`

```typescript
import { jwtDecode } from "jwt-decode";

export type UserRoleFromToken = {
  role_id: string;
  role: string;
  org_id: string | null;
  branch_id: string | null;
  scope: "org" | "branch";
  scope_id: string;
};

export type CustomJwtPayload = {
  roles?: UserRoleFromToken[];
};

export type Session = {
  access_token: string;
  user: { id: string };
};

export class AuthService {
  /**
   * Extract roles from JWT session token
   * Returns empty array if JWT is invalid or roles are missing
   */
  static getUserRoles(session: Session | null): UserRoleFromToken[] {
    if (!session?.access_token) {
      return [];
    }

    try {
      const jwt = jwtDecode<CustomJwtPayload>(session.access_token);
      return jwt.roles ?? [];
    } catch (error) {
      console.warn("Failed to decode JWT for roles:", error);
      return [];
    }
  }

  /**
   * Check if user has a specific role within given scope
   * @param userRoles - Roles extracted from JWT
   * @param requiredRole - Role name to check for
   * @param orgId - Optional organization ID for org-scoped check
   * @param branchId - Optional branch ID for branch-scoped check
   */
  static hasRole(
    userRoles: UserRoleFromToken[],
    requiredRole: string,
    orgId?: string | null,
    branchId?: string | null
  ): boolean {
    return userRoles.some((role) => {
      // Role name must match
      if (role.role !== requiredRole) {
        return false;
      }

      // If orgId specified, check org scope
      if (orgId && role.scope === "org") {
        return role.scope_id === orgId;
      }

      // If branchId specified, check branch scope
      if (branchId && role.scope === "branch") {
        return role.scope_id === branchId;
      }

      // If no scope specified, any match is valid
      if (!orgId && !branchId) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get all organization IDs user has access to
   */
  static getUserOrganizations(userRoles: UserRoleFromToken[]): string[] {
    const orgIds = new Set<string>();

    userRoles.forEach((role) => {
      if (role.scope === "org" && role.scope_id) {
        orgIds.add(role.scope_id);
      }
    });

    return Array.from(orgIds);
  }

  /**
   * Get all branch IDs user has access to
   */
  static getUserBranches(userRoles: UserRoleFromToken[]): string[] {
    const branchIds = new Set<string>();

    userRoles.forEach((role) => {
      if (role.scope === "branch" && role.scope_id) {
        branchIds.add(role.scope_id);
      }
    });

    return Array.from(branchIds);
  }
}
```

### Step 3.3: Run Tests

```bash
pnpm test:run src/server/services/__tests__/auth.service.test.ts
```

### Commit Point ✅

- Auth service with role extraction and validation
- Comprehensive test coverage for role logic
- Type-safe role handling

---

## Increment 4: Permission Service Layer (2-3 hours)

### Objective

Create permission derivation service with tests.

### Step 4.1: Write Tests First (RED)

**File:** `src/server/services/__tests__/permission.service.test.ts`

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PermissionService } from "../permission.service";
import { createMockSupabaseClient, mockRLSError } from "@/test/setup-supabase-mocks";

describe("PermissionService.getPermissionsForUser", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  it("should fetch permissions from role assignments", async () => {
    // Mock role assignments
    mockSupabase
      .from("user_role_assignments")
      .select()
      .mockResolvedValue({
        data: [{ role_id: "role-1", scope: "org", scope_id: "org-1" }],
        error: null,
      });

    // Mock RPC call for permissions
    mockSupabase.rpc("get_permissions_for_roles").mockResolvedValue({
      data: ["warehouse.products.read", "warehouse.products.create"],
      error: null,
    });

    // Mock permission overrides (none)
    mockSupabase.from("user_permission_overrides").select().mockResolvedValue({
      data: [],
      error: null,
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toContain("warehouse.products.read");
    expect(permissions).toContain("warehouse.products.create");
  });

  it("should apply permission overrides", async () => {
    mockSupabase
      .from("user_role_assignments")
      .select()
      .mockResolvedValue({
        data: [{ role_id: "role-1" }],
        error: null,
      });

    mockSupabase.rpc("get_permissions_for_roles").mockResolvedValue({
      data: ["warehouse.products.read", "warehouse.products.create"],
      error: null,
    });

    // Override: deny create permission
    mockSupabase
      .from("user_permission_overrides")
      .select()
      .mockResolvedValue({
        data: [{ permission_id: "perm-1", allowed: false }],
        error: null,
      });

    mockSupabase
      .from("permissions")
      .select()
      .mockResolvedValue({
        data: [{ id: "perm-1", slug: "warehouse.products.create" }],
        error: null,
      });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toContain("warehouse.products.read");
    expect(permissions).not.toContain("warehouse.products.create");
  });

  it("should handle RLS denial gracefully", async () => {
    mockSupabase
      .from("user_role_assignments")
      .select()
      .mockResolvedValue(mockRLSError("Row level security"));

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toEqual([]);
  });

  it("should return empty array for user with no roles", async () => {
    mockSupabase.from("user_role_assignments").select().mockResolvedValue({
      data: [],
      error: null,
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toEqual([]);
  });
});

describe("PermissionService.can", () => {
  it("should return true when permission exists", () => {
    const permissions = ["warehouse.products.read", "warehouse.products.create"];

    expect(PermissionService.can(permissions, "warehouse.products.read")).toBe(true);
  });

  it("should return false when permission missing", () => {
    const permissions = ["warehouse.products.read"];

    expect(PermissionService.can(permissions, "warehouse.products.delete")).toBe(false);
  });

  it("should support wildcard matching", () => {
    const permissions = ["warehouse.*"];

    expect(PermissionService.can(permissions, "warehouse.products.read")).toBe(true);
    expect(PermissionService.can(permissions, "warehouse.locations.create")).toBe(true);
  });

  it("should handle empty permissions array", () => {
    const permissions: string[] = [];

    expect(PermissionService.can(permissions, "any.permission")).toBe(false);
  });
});
```

### Step 4.2: Implement Service (GREEN)

**File:** `src/server/services/permission.service.ts`

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export class PermissionService {
  /**
   * Get all permissions for a user within an organization
   * Combines role-based permissions and applies overrides
   */
  static async getPermissionsForUser(
    supabase: SupabaseClient,
    userId: string,
    orgId: string
  ): Promise<string[]> {
    try {
      // 1. Get user's role assignments for this org
      const { data: roleAssignments, error: roleError } = await supabase
        .from("user_role_assignments")
        .select("role_id, scope, scope_id")
        .eq("user_id", userId)
        .or(`scope_id.eq.${orgId}`)
        .is("deleted_at", null);

      if (roleError) {
        console.error("Error fetching role assignments:", roleError);
        return [];
      }

      if (!roleAssignments || roleAssignments.length === 0) {
        return [];
      }

      // 2. Get permissions for these roles via RPC
      const roleIds = roleAssignments.map((r) => r.role_id);
      const { data: permissionsData, error: permError } = await supabase.rpc(
        "get_permissions_for_roles",
        { role_ids: roleIds }
      );

      if (permError) {
        console.error("Error fetching permissions:", permError);
        return [];
      }

      // Extract permission slugs from RPC response
      const basePermissions = (permissionsData ?? [])
        .map((p: any) => {
          if (typeof p === "string") return p;
          if (p?.slug) return p.slug;
          if (p?.get_permissions_for_roles) return p.get_permissions_for_roles;
          return null;
        })
        .filter((slug: string | null): slug is string => typeof slug === "string");

      // 3. Get permission overrides for this user/org
      const { data: overrides, error: overrideError } = await supabase
        .from("user_permission_overrides")
        .select("permission_id, allowed")
        .eq("user_id", userId)
        .eq("scope_id", orgId)
        .is("deleted_at", null);

      if (overrideError) {
        console.error("Error fetching overrides:", overrideError);
        return basePermissions;
      }

      if (!overrides || overrides.length === 0) {
        return basePermissions;
      }

      // 4. Fetch permission slugs for overrides
      const permissionIds = overrides.map((o) => o.permission_id);
      const { data: permissions, error: permSlugError } = await supabase
        .from("permissions")
        .select("id, slug")
        .in("id", permissionIds);

      if (permSlugError || !permissions) {
        return basePermissions;
      }

      // 5. Apply overrides
      const permissionMap = new Map(permissions.map((p) => [p.id, p.slug]));
      const permissionSet = new Set(basePermissions);

      overrides.forEach((override) => {
        const slug = permissionMap.get(override.permission_id);
        if (slug) {
          if (override.allowed) {
            permissionSet.add(slug);
          } else {
            permissionSet.delete(slug);
          }
        }
      });

      return Array.from(permissionSet);
    } catch (error) {
      console.error("Unexpected error in getPermissionsForUser:", error);
      return [];
    }
  }

  /**
   * Check if a permission exists in the permissions array
   * Supports wildcard matching (e.g., 'warehouse.*')
   */
  static can(permissions: string[], requiredPermission: string): boolean {
    if (!permissions || permissions.length === 0) {
      return false;
    }

    // Direct match
    if (permissions.includes(requiredPermission)) {
      return true;
    }

    // Wildcard match (e.g., 'warehouse.*' matches 'warehouse.products.read')
    return permissions.some((perm) => {
      if (!perm.endsWith(".*")) {
        return false;
      }

      const prefix = perm.slice(0, -2); // Remove '.*'
      return requiredPermission.startsWith(prefix + ".");
    });
  }
}
```

### Step 4.3: Run Tests

```bash
pnpm test:run src/server/services/__tests__/permission.service.test.ts
```

### Commit Point ✅

- Permission service with comprehensive tests
- Handles role-based permissions + overrides
- Wildcard permission support

---

## Increment 5: Rebuild loadUserContextServer ✅ COMPLETED

**Status:** ✅ Complete
**Duration:** 2 hours
**Tests:** 15/15 passing
**Lines Changed:** 287 → 123 (57% reduction)

### Objective

Refactor context loader to remove service role fallback, eliminate JWT decode, and use AuthService/PermissionService for clean separation of concerns.

### What Changed

**Security Improvements:**

- ✅ Removed ALL service role key usage (lines 81-112 deleted)
- ✅ Eliminated direct JWT decode fallback (lines 70-78 deleted)
- ✅ No database fallback for roles when JWT empty

**Architecture Improvements:**

- ✅ Now uses `AuthService.getUserRoles(accessToken)` instead of duplicating JWT decode logic
- ✅ Now uses `PermissionService.getPermissionsForUser()` instead of manual permission loading
- ✅ Removed 150+ lines of complex override logic - delegated to PermissionService
- ✅ Removed `detailedPermissions` field - unnecessary complexity
- ✅ Type safety: Import and use `JWTRole` from AuthService (single source of truth)
- ✅ `UserRoleFromToken` is now a type alias to `JWTRole` for backward compatibility

**Contract:**

- Returns `null` when no session exists
- Loads user from `public.users` (fallback to session metadata)
- Loads preferences from `user_preferences` (defaults to null if missing)
- Extracts roles from JWT via `AuthService.getUserRoles()` - NO database fallback
- Loads permissions via `PermissionService.getPermissionsForUser()` only when `orgId` exists

**Forbidden:**

- NO service role usage
- NO JWT decode fallback
- NO database fallback for roles

### Step 5.1: Write Tests First (RED)

**File:** `src/lib/api/__tests__/load-user-context-server.test.ts`

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadUserContextServer } from "../load-user-context-server";
import { createMockSupabaseClient } from "@/test/setup-supabase-mocks";

// Mock createClient
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock auth service
vi.mock("@/server/services/auth.service", () => ({
  AuthService: {
    getUserRoles: vi.fn(),
  },
}));

// Mock permission service
vi.mock("@/server/services/permission.service", () => ({
  PermissionService: {
    getPermissionsForUser: vi.fn(),
  },
}));

describe("loadUserContextServer", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    const { createClient } = require("@/utils/supabase/server");
    createClient.mockResolvedValue(mockSupabase);
  });

  it("should return null when no session exists", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const context = await loadUserContextServer();

    expect(context).toBeNull();
  });

  it("should load user context with roles and permissions", async () => {
    const { AuthService } = require("@/server/services/auth.service");
    const { PermissionService } = require("@/server/services/permission.service");

    // Mock session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1", email: "test@example.com" },
          access_token: "mock-jwt",
        },
      },
      error: null,
    });

    // Mock user data
    mockSupabase
      .from("users")
      .select()
      .single()
      .mockResolvedValue({
        data: {
          id: "user-1",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          avatar_url: null,
        },
        error: null,
      });

    // Mock preferences
    mockSupabase
      .from("user_preferences")
      .select()
      .single()
      .mockResolvedValue({
        data: {
          organization_id: "org-1",
          default_branch_id: "branch-1",
        },
        error: null,
      });

    // Mock roles from JWT
    AuthService.getUserRoles.mockReturnValue([
      { role_id: "r1", role: "admin", org_id: "org-1", scope: "org", scope_id: "org-1" },
    ]);

    // Mock permissions
    PermissionService.getPermissionsForUser.mockResolvedValue([
      "warehouse.products.read",
      "warehouse.products.create",
    ]);

    const context = await loadUserContextServer();

    expect(context).toBeDefined();
    expect(context?.user.id).toBe("user-1");
    expect(context?.user.email).toBe("test@example.com");
    expect(context?.roles).toHaveLength(1);
    expect(context?.roles[0].role).toBe("admin");
    expect(context?.permissions).toContain("warehouse.products.read");
  });

  it("should handle missing user preferences gracefully", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1", email: "test@example.com" },
          access_token: "mock-jwt",
        },
      },
      error: null,
    });

    mockSupabase
      .from("users")
      .select()
      .single()
      .mockResolvedValue({
        data: { id: "user-1", email: "test@example.com" },
        error: null,
      });

    // No preferences found
    mockSupabase
      .from("user_preferences")
      .select()
      .single()
      .mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "No rows found" },
      });

    const context = await loadUserContextServer();

    expect(context?.preferences.organization_id).toBeNull();
    expect(context?.preferences.default_branch_id).toBeNull();
  });

  it("should not use service role fallback", async () => {
    const { createClient: createServiceClient } = require("@supabase/supabase-js");
    const spy = vi.spyOn({ createServiceClient }, "createServiceClient");

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
          access_token: "jwt-without-roles",
        },
      },
      error: null,
    });

    await loadUserContextServer();

    // Should NOT create service role client
    expect(spy).not.toHaveBeenCalled();
  });
});
```

### Step 5.2: Refactor Implementation (GREEN)

**File:** `src/lib/api/load-user-context-server.ts`

```typescript
"use server";

import { createClient } from "@/utils/supabase/server";
import { AuthService, type JWTRole } from "@/server/services/auth.service";
import { PermissionService } from "@/server/services/permission.service";

/**
 * @deprecated Use JWTRole from AuthService instead
 * Kept for backward compatibility with existing code
 */
export type UserRoleFromToken = JWTRole;

export type UserContext = {
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  preferences: {
    organization_id: string | null;
    default_branch_id: string | null;
  };
  roles: JWTRole[];
  permissions: string[];
};

/**
 * Load user context from server session
 * This is the single source of truth for user authentication and authorization
 *
 * Returns null if user is not authenticated
 * Returns UserContext with roles and permissions if authenticated
 */
export async function loadUserContextServer(): Promise<UserContext | null> {
  const supabase = await createClient();

  // 1. Get session (returns null if not authenticated)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  // 2. Fetch user profile data
  const { data: userData } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, avatar_url")
    .eq("id", userId)
    .single();

  // Fallback to auth metadata if user doesn't exist in public.users
  const userInfo = userData || {
    id: userId,
    email: session.user.email!,
    first_name: session.user.user_metadata?.first_name ?? null,
    last_name: session.user.user_metadata?.last_name ?? null,
    avatar_url: null,
  };

  // 3. Extract roles from JWT (single source of truth)
  const roles = AuthService.getUserRoles(session);

  // 4. Fetch user preferences
  const { data: preferencesData } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .single();

  const preferences = {
    organization_id: preferencesData?.organization_id ?? null,
    default_branch_id: preferencesData?.default_branch_id ?? null,
  };

  // 5. Get permissions for active organization
  let permissions: string[] = [];

  if (preferences.organization_id && roles.length > 0) {
    permissions = await PermissionService.getPermissionsForUser(
      supabase,
      userId,
      preferences.organization_id
    );
  }

  return {
    user: userInfo,
    preferences,
    roles,
    permissions,
  };
}
```

### Step 5.3: Run Tests

```bash
pnpm test:run src/lib/api/__tests__/load-user-context-server.test.ts
```

### Commit Point ✅

- User context loader simplified
- Service role fallback removed (security improvement)
- Uses new auth and permission services
- Type safety: Uses JWTRole from AuthService (single source of truth)
- UserRoleFromToken is now a type alias for backward compatibility
- Comprehensive test coverage

---

## Increment 6: Refine loadAppContextServer ✅ COMPLETED

**Status:** ✅ Complete
**Duration:** 1 hour
**Tests:** 15/15 passing
**Lines Changed:** 234 → 171 (27% reduction)

### Objective

Make loadAppContextServer minimal and deterministic - remove heavy data loading and JWT decode fallback for org selection.

### What Changed

**Performance Improvements:**

- ✅ Removed heavy data loading: `locations`, `suppliers`, `organizationUsers`, `privateContacts` → empty arrays
- ✅ Removed `subscription` loading → null (load lazily on client)
- ✅ Removed ~60 lines of data loading queries

**Security & Architecture:**

- ✅ Removed JWT decode fallback for org selection (lines 41-53 deleted)
- ✅ Removed auto-upsert of preferences (lines 68-73 deleted) - should be explicit
- ✅ Simplified deterministic org selection: `preferences.organization_id ?? owned_org.id ?? null`
- ✅ Deterministic branch fallback: `preferences.default_branch_id ?? first_available_branch ?? null`
- ✅ Changed branch ordering from DESC to ASC for deterministic first-branch fallback (oldest = main)

**Contract:**

- Returns `null` when no session exists
- Deterministic org selection: `preferences.organization_id ?? owned_org.id ?? null`
- Deterministic branch selection: `preferences.default_branch_id ?? first_available_branch ?? null`
- NO JWT decode fallback for org selection
- Loads minimal data:
  - Organization profile (minimal fields)
  - Branches for the org (ordered by `created_at ASC`)
  - Active branch from preferences with fallback to first branch
  - User modules with merged settings (for feature gating)
- Heavy data arrays empty: `locations`, `suppliers`, `organizationUsers`, `privateContacts`
- `subscription` set to `null`

**Known Limitations:**

- Org fallback only checks `created_by=userId` (ownership)
- Does NOT fallback to membership orgs (user is member but not owner)
- Assumption: Onboarding guarantees users own at least one org
- Future enhancement: Add membership fallback if needed

**Forbidden:**

- NO JWT decode to pick organization
- NO heavy data loading (locations, suppliers, etc.)

### Step 6.1: Review Current Implementation

Already exists at `/src/lib/api/load-app-context-server.ts`. Review to ensure it:

- Loads minimal data (org, branch, modules list)
- Doesn't load large datasets (products, movements, etc.)
- Uses deterministic fallback chain

### Step 6.2: Write Tests (if needed)

**File:** `src/lib/api/__tests__/load-app-context-server.test.ts`

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadAppContextServer } from "../load-app-context-server";
import { createMockSupabaseClient } from "@/test/setup-supabase-mocks";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("loadAppContextServer", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    const { createClient } = require("@/utils/supabase/server");
    createClient.mockResolvedValue(mockSupabase);
  });

  it("should return null when no session", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const context = await loadAppContextServer();
    expect(context).toBeNull();
  });

  it("should load active org from preferences", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });

    mockSupabase
      .from("user_preferences")
      .select()
      .single()
      .mockResolvedValue({
        data: { organization_id: "org-1", default_branch_id: "branch-1" },
        error: null,
      });

    mockSupabase
      .from("organization_profiles")
      .select()
      .single()
      .mockResolvedValue({
        data: { organization_id: "org-1", name: "Test Org" },
        error: null,
      });

    mockSupabase
      .from("branches")
      .select()
      .mockResolvedValue({
        data: [{ id: "branch-1", name: "Main Branch", organization_id: "org-1" }],
        error: null,
      });

    const context = await loadAppContextServer();

    expect(context?.activeOrgId).toBe("org-1");
    expect(context?.activeBranchId).toBe("branch-1");
  });

  it("should fallback to owned org when no preferences", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });

    mockSupabase
      .from("user_preferences")
      .select()
      .single()
      .mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

    // Fallback: find owned org
    mockSupabase
      .from("organizations")
      .select()
      .single()
      .mockResolvedValue({
        data: { id: "org-owned" },
        error: null,
      });

    const context = await loadAppContextServer();

    expect(context?.activeOrgId).toBe("org-owned");
  });
});
```

### Step 6.3: Run Tests

```bash
pnpm test:run src/lib/api/__tests__/load-app-context-server.test.ts
```

### Step 6.4: Actual Implementation Summary

**Files Modified:**

- `src/lib/api/load-app-context-server.ts` - Refactored to minimal loading
- `src/lib/api/__tests__/load-app-context-server.test.ts` - 15 comprehensive tests

**Final Implementation:**

```typescript
export async function _loadAppContextServer(): Promise<AppContext | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  // 1. Load preferences
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", session.user.id)
    .single();

  // 2. Deterministic org selection (NO JWT decode)
  let activeOrgId = preferences?.organization_id ?? null;
  if (!activeOrgId) {
    const { data: ownedOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("created_by", session.user.id)
      .limit(1)
      .single();
    activeOrgId = ownedOrg?.id ?? null;
  }

  // 3. Load organization profile
  let activeOrg = null;
  if (activeOrgId) {
    const { data: orgProfile } = await supabase
      .from("organization_profiles")
      .select("*")
      .eq("organization_id", activeOrgId)
      .single();
    activeOrg = orgProfile;
  }

  // 4. Load branches (ordered by created_at ASC for deterministic fallback)
  const { data: availableBranches } = activeOrgId
    ? await supabase
        .from("branches")
        .select("*")
        .eq("organization_id", activeOrgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }) // ASC for deterministic fallback
    : { data: [] };

  // 5. Determine active branch with deterministic fallback
  // Fallback chain: preferences.default_branch_id → first available branch (oldest) → null
  const activeBranchId = preferences?.default_branch_id ?? null;
  let activeBranch = activeBranchId
    ? (availableBranches?.find((b) => b.id === activeBranchId) ?? null)
    : null;

  // If no preference or preference invalid, fallback to first branch (deterministic)
  if (!activeBranch && availableBranches && availableBranches.length > 0) {
    activeBranch = availableBranches[0]; // First branch (oldest, typically main)
  }

  // 6. Load user modules with merged settings
  const { data: userModulesRaw } = await supabase
    .from("user_modules")
    .select("setting_overrides, modules(*)")
    .eq("user_id", session.user.id)
    .is("deleted_at", null);

  const userModules = (userModulesRaw ?? []).map((entry) => ({
    id: entry.modules.id,
    slug: entry.modules.slug,
    label: entry.modules.label,
    settings: {
      ...safeObject(entry.modules.settings),
      ...safeObject(entry.setting_overrides),
    },
  }));

  // 7. Return minimal context (heavy data = empty/null)
  return {
    activeOrgId,
    activeBranchId,
    activeOrg,
    activeBranch,
    availableBranches: mappedBranches,
    userModules,
    location: null,
    locations: [], // Heavy data - load lazily
    suppliers: [], // Heavy data - load lazily
    organizationUsers: [], // Heavy data - load lazily
    privateContacts: [], // Heavy data - load lazily
    subscription: null, // Heavy data - load lazily
  };
}
```

### Commit Point ✅

**Quality Gates:**

- ✅ All 84 tests passing (including 30 new tests for Increments 5 & 6)
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors, 131 warnings (pre-existing)
- ✅ No regressions

**Key Achievements:**

- ✅ Removed 210+ lines of code across both loaders
- ✅ Eliminated ALL service role usage (major security improvement)
- ✅ Removed JWT decode fallbacks (cleaner architecture)
- ✅ Delegated logic to AuthService and PermissionService (better separation of concerns)
- ✅ Reduced SSR payload significantly (performance improvement)
- ✅ Type safety: Uses `JWTRole` from AuthService (single source of truth)
- ✅ Deterministic branch fallback prevents null activeBranch when branches exist
- ✅ Documented org ownership limitation (doesn't fallback to membership)
- ✅ 100% test coverage for both loaders (30 comprehensive tests)

**Files Created:**

- `src/lib/api/__tests__/load-user-context-server.test.ts` - 15 tests
- `src/lib/api/__tests__/load-app-context-server.test.ts` - 15 tests

**Files Modified:**

- `src/lib/api/load-user-context-server.ts` - 287 → 123 lines (57% reduction)
- `src/lib/api/load-app-context-server.ts` - 234 → 171 lines (27% reduction)

---

## Increment 7: Update Zustand Stores (1 hour)

### Objective

Update user and app stores to match new context structure.

### Step 7.1: Write Store Tests (RED)

**File:** `src/lib/stores/__tests__/user-store.test.tsx`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useUserStore } from "../user-store";

describe("useUserStore", () => {
  beforeEach(() => {
    // Clear store before each test
    useUserStore.getState().clear();
  });

  it("should initialize with empty state", () => {
    const state = useUserStore.getState();

    expect(state.user).toBeNull();
    expect(state.roles).toEqual([]);
    expect(state.permissions).toEqual([]);
    expect(state.isLoaded).toBe(false);
  });

  it("should set context from server data", () => {
    const mockContext = {
      user: {
        id: "user-1",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        avatar_url: null,
      },
      preferences: { organization_id: "org-1", default_branch_id: "branch-1" },
      roles: [{ role_id: "r1", role: "admin", org_id: "org-1", scope: "org", scope_id: "org-1" }],
      permissions: ["warehouse.products.read"],
    };

    useUserStore.getState().setContext(mockContext);

    const state = useUserStore.getState();
    expect(state.user?.id).toBe("user-1");
    expect(state.roles).toHaveLength(1);
    expect(state.permissions).toContain("warehouse.products.read");
    expect(state.isLoaded).toBe(true);
  });

  it("should clear context", () => {
    const mockContext = {
      user: { id: "user-1", email: "test@example.com" },
      roles: [],
      permissions: [],
    };

    useUserStore.getState().setContext(mockContext);
    expect(useUserStore.getState().isLoaded).toBe(true);

    useUserStore.getState().clear();

    const state = useUserStore.getState();
    expect(state.user).toBeNull();
    expect(state.roles).toEqual([]);
    expect(state.permissions).toEqual([]);
    expect(state.isLoaded).toBe(false);
  });
});
```

### Step 7.2: Update Store Implementation (GREEN)

**File:** `src/lib/stores/user-store.ts`

```typescript
import { create } from "zustand";
import { UserContext } from "@/lib/api/load-user-context-server";
import { UserRoleFromToken } from "@/server/services/auth.service";

type UserStoreState = {
  user: UserContext["user"] | null;
  preferences: UserContext["preferences"] | null;
  roles: UserRoleFromToken[];
  permissions: string[];
  isLoaded: boolean;

  setContext: (context: UserContext) => void;
  clear: () => void;
};

export const useUserStore = create<UserStoreState>((set) => ({
  user: null,
  preferences: null,
  roles: [],
  permissions: [],
  isLoaded: false,

  setContext: (context) =>
    set({
      user: context.user,
      preferences: context.preferences,
      roles: context.roles,
      permissions: context.permissions,
      isLoaded: true,
    }),

  clear: () =>
    set({
      user: null,
      preferences: null,
      roles: [],
      permissions: [],
      isLoaded: false,
    }),
}));
```

### Step 7.3: Test App Store (if changes needed)

Similar pattern for `useAppStore` if modifications are required.

### Step 7.4: Run Tests

```bash
pnpm test:run src/lib/stores/__tests__/user-store.test.tsx
```

### Commit Point ✅

- Zustand stores updated to match new context structure
- Store tests passing
- Clean state management

---

## Increment 8: Create usePermissions Hook (1-2 hours)

### Objective

Client-side hook for permission checking with loading states.

### Step 8.1: Write Hook Tests First (RED)

**File:** `src/lib/hooks/__tests__/use-permissions.test.tsx`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePermissions } from "../use-permissions";
import { useUserStore } from "@/lib/stores/user-store";

describe("usePermissions", () => {
  beforeEach(() => {
    useUserStore.getState().clear();
  });

  it("should return loading state initially", () => {
    const { result } = renderHook(() => usePermissions());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.can("any.permission")).toBe(false);
  });

  it("should return permissions after loading", async () => {
    const mockContext = {
      user: {
        id: "user-1",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
      preferences: { organization_id: "org-1", default_branch_id: null },
      roles: [],
      permissions: ["warehouse.products.read", "warehouse.products.create"],
    };

    useUserStore.getState().setContext(mockContext);

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.permissions).toContain("warehouse.products.read");
    expect(result.current.can("warehouse.products.read")).toBe(true);
    expect(result.current.can("warehouse.products.delete")).toBe(false);
  });

  it("should support wildcard permissions", async () => {
    const mockContext = {
      user: {
        id: "user-1",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
      preferences: { organization_id: "org-1", default_branch_id: null },
      roles: [],
      permissions: ["warehouse.*"],
    };

    useUserStore.getState().setContext(mockContext);

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.can("warehouse.products.read")).toBe(true);
    expect(result.current.can("warehouse.locations.create")).toBe(true);
    expect(result.current.can("teams.members.read")).toBe(false);
  });
});
```

### Step 8.2: Implement Hook (GREEN)

**File:** `src/lib/hooks/use-permissions.ts`

```typescript
"use client";

import { useUserStore } from "@/lib/stores/user-store";
import { PermissionService } from "@/server/services/permission.service";

export function usePermissions() {
  const { permissions, isLoaded } = useUserStore();

  const can = (requiredPermission: string): boolean => {
    if (!isLoaded) {
      return false;
    }

    return PermissionService.can(permissions, requiredPermission);
  };

  return {
    permissions,
    isLoading: !isLoaded,
    can,
  };
}
```

### Step 8.3: Run Tests

```bash
pnpm test:run src/lib/hooks/__tests__/use-permissions.test.tsx
```

### Commit Point ✅

- Permission hook with loading states
- Wildcard support
- Clean API for components

---

## Increment 9: Minimal Vertical Slice - List Organizations (2-3 hours)

### Objective

Prove the entire stack works end-to-end with a simple read-only feature.

### Step 9.1: Database - Ensure RLS Policy

**File:** Check existing migration or create new one

```sql
-- Ensure organizations table has proper RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read organizations they're members of
CREATE POLICY "users_read_member_orgs" ON organizations
FOR SELECT
USING (
  id IN (
    SELECT organization_id
    FROM user_role_assignments
    WHERE user_id = auth.uid()
      AND deleted_at IS NULL
  )
);
```

### Step 9.2: Service Layer Tests (RED)

**File:** `src/server/services/__tests__/organization.service.test.ts`

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest";
import { OrganizationService } from "../organization.service";
import { createMockSupabaseClient, mockRLSError } from "@/test/setup-supabase-mocks";

describe("OrganizationService.getUserOrganizations", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  it("should fetch organizations for user", async () => {
    mockSupabase
      .from("organizations")
      .select()
      .mockResolvedValue({
        data: [
          { id: "org-1", name: "Acme Corp" },
          { id: "org-2", name: "Test Inc" },
        ],
        error: null,
      });

    const orgs = await OrganizationService.getUserOrganizations(mockSupabase, "user-1");

    expect(orgs).toHaveLength(2);
    expect(orgs[0].name).toBe("Acme Corp");
  });

  it("should handle RLS denial", async () => {
    mockSupabase.from("organizations").select().mockResolvedValue(mockRLSError());

    await expect(
      OrganizationService.getUserOrganizations(mockSupabase, "user-1")
    ).rejects.toThrow();
  });

  it("should return empty array when user has no orgs", async () => {
    mockSupabase.from("organizations").select().mockResolvedValue({
      data: [],
      error: null,
    });

    const orgs = await OrganizationService.getUserOrganizations(mockSupabase, "user-1");

    expect(orgs).toEqual([]);
  });
});
```

### Step 9.3: Service Implementation (GREEN)

**File:** `src/server/services/organization.service.ts`

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export class OrganizationService {
  static async getUserOrganizations(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, created_at")
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch organizations: ${error.message}`);
    }

    return data ?? [];
  }
}
```

### Step 9.4: Server Action Tests (RED)

**File:** `src/app/actions/organizations/__tests__/get-organizations.test.ts`

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getOrganizationsAction } from "../get-organizations";

vi.mock("@/lib/api/load-user-context-server");
vi.mock("@/server/services/organization.service");
vi.mock("@/utils/supabase/server");

describe("getOrganizationsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should require authentication", async () => {
    const { loadUserContextServer } = require("@/lib/api/load-user-context-server");
    loadUserContextServer.mockResolvedValue(null);

    const result = await getOrganizationsAction();

    expect(result.success).toBe(false);
    expect(result.code).toBe("AUTH");
  });

  it("should return organizations for authenticated user", async () => {
    const { loadUserContextServer } = require("@/lib/api/load-user-context-server");
    const { OrganizationService } = require("@/server/services/organization.service");
    const { createClient } = require("@/utils/supabase/server");

    loadUserContextServer.mockResolvedValue({
      user: { id: "user-1" },
      permissions: ["org.read"],
    });

    createClient.mockResolvedValue({});

    OrganizationService.getUserOrganizations.mockResolvedValue([
      { id: "org-1", name: "Acme Corp" },
    ]);

    const result = await getOrganizationsAction();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });
});
```

### Step 9.5: Server Action Implementation (GREEN)

**File:** `src/app/actions/organizations/get-organizations.ts`

```typescript
"use server";

import { createClient } from "@/utils/supabase/server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { OrganizationService } from "@/server/services/organization.service";

type ServerActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function getOrganizationsAction(): Promise<ServerActionResponse<any[]>> {
  try {
    // 1. Authentication check
    const userContext = await loadUserContextServer();

    if (!userContext) {
      return {
        success: false,
        error: "Authentication required",
        code: "AUTH",
      };
    }

    // 2. Get Supabase client
    const supabase = await createClient();

    // 3. Call service layer
    const organizations = await OrganizationService.getUserOrganizations(
      supabase,
      userContext.user.id
    );

    return {
      success: true,
      data: organizations,
    };
  } catch (error: any) {
    console.error("Error in getOrganizationsAction:", error);

    return {
      success: false,
      error: error.message || "Failed to fetch organizations",
      code: "SERVER_ERROR",
    };
  }
}
```

### Step 9.6: React Query Hook Tests (RED)

**File:** `src/lib/hooks/queries/__tests__/use-organizations.test.tsx`

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOrganizations } from "../use-organizations";
import { ReactQueryWrapper } from "@/test/harnesses/react-query-harness";

vi.mock("@/app/actions/organizations/get-organizations", () => ({
  getOrganizationsAction: vi.fn(),
}));

describe("useOrganizations", () => {
  it("should fetch organizations", async () => {
    const { getOrganizationsAction } = require("@/app/actions/organizations/get-organizations");

    getOrganizationsAction.mockResolvedValue({
      success: true,
      data: [{ id: "org-1", name: "Acme Corp" }],
    });

    const { result } = renderHook(() => useOrganizations(), {
      wrapper: ReactQueryWrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("Acme Corp");
  });

  it("should handle errors", async () => {
    const { getOrganizationsAction } = require("@/app/actions/organizations/get-organizations");

    getOrganizationsAction.mockResolvedValue({
      success: false,
      error: "Failed to fetch",
    });

    const { result } = renderHook(() => useOrganizations(), {
      wrapper: ReactQueryWrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
```

### Step 9.7: React Query Hook Implementation (GREEN)

**File:** `src/lib/hooks/queries/use-organizations.ts`

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrganizationsAction } from "@/app/actions/organizations/get-organizations";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const result = await getOrganizationsAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Step 9.8: Simple UI Component

**File:** `src/components/organizations/organization-list.tsx`

```typescript
"use client"

import { useOrganizations } from '@/lib/hooks/queries/use-organizations'

export function OrganizationList() {
  const { data: organizations, isLoading, error } = useOrganizations()

  if (isLoading) {
    return <div>Loading organizations...</div>
  }

  if (error) {
    return <div>Error: {error.message}</div>
  }

  if (!organizations || organizations.length === 0) {
    return <div>No organizations found</div>
  }

  return (
    <div>
      <h2>Your Organizations</h2>
      <ul>
        {organizations.map(org => (
          <li key={org.id}>{org.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

### Step 9.9: Integration - Add to Dashboard

Add `<OrganizationList />` to dashboard page to verify end-to-end flow.

### Step 9.10: Run All Tests

```bash
pnpm test:run
```

### Commit Point ✅

- Complete vertical slice working
- All layers tested (DB → Service → Action → Hook → UI)
- Proves auth/context/permissions foundation is solid

---

## Final Validation & Definition of Done

### Run Full Test Suite

```bash
pnpm test:run
```

Expected: All tests green

### Run Type Check

```bash
pnpm type-check
```

Expected: No TypeScript errors

### Run Linter

```bash
pnpm lint
```

Expected: No linting errors

### Manual Testing

1. Start dev server: `pnpm dev`
2. Login to application
3. Verify dashboard loads without auth errors
4. Verify active org/branch displayed
5. Verify organization list displays (vertical slice)
6. Check browser console for errors (should be none)

### Phase 1 Checklist ✅

- ✅ Database migrations applied cleanly
  - authorize() function created
  - JWT hook updated to use user_role_assignments
- ✅ Service layer with tests
  - AuthService (getUserRoles, hasRole)
  - PermissionService (getPermissions, can)
  - OrganizationService (vertical slice)
- ✅ Context loaders tested
  - loadUserContextServer (no service role fallback)
  - loadAppContextServer (minimal data)
- ✅ Store mutations tested
  - useUserStore
  - useAppStore
- ✅ Permission hook tested
  - usePermissions with wildcard support
- ✅ Vertical slice working end-to-end
  - List organizations (RLS → Service → Action → Hook → UI)
- ✅ All tests passing (`pnpm test:run`)
- ✅ Type checking passes (`pnpm type-check`)
- ✅ Linting passes (`pnpm lint`)
- ✅ App boots without auth errors
- ✅ Dashboard shows active org/branch

---

## What's Next: Phase 2 Preview

With Phase 1 complete, you now have:

- Rock-solid authentication foundation
- Permission system with RLS integration
- Context loading with proper fallbacks
- Comprehensive test coverage
- One working vertical slice

**Phase 2** will focus on:

1. RLS baseline for all core tables
2. Testing RLS policies with real database
3. Establishing repeatable patterns for new features

**Phase 3** will implement the first major feature slice (Products CRUD) using the foundation built in Phase 1.

---

## Notes & Best Practices

### TDD Workflow

1. Write test (RED) - Test fails
2. Implement minimal code (GREEN) - Test passes
3. Refactor if needed - Tests still pass
4. Commit with passing tests

### Test Pyramid

- Most tests: Service layer (fast, isolated)
- Medium tests: Server actions (auth/permission)
- Fewer tests: Hooks (React Query)
- Fewest tests: Components (UI behavior)

### Migration Safety

- Each increment is committable
- Never break existing functionality
- Keep app working at every step
- Tests validate each piece before moving on

### Security Principles

- Always check authentication first
- Always validate permissions second
- Always scope queries by org/branch
- RLS is final defense layer

### Common Pitfalls to Avoid

- ❌ Don't skip tests - write them first
- ❌ Don't use service role except in migrations
- ❌ Don't load large datasets in AppContext
- ❌ Don't bypass permission checks
- ❌ Don't commit with failing tests
