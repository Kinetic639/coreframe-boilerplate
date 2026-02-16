# Permissions and Modules: Canonical Lists & Constants Strategy

**Status:** Verified 2026-02-13
**Purpose:** Single source of truth for permission slugs and module slugs used throughout the application
**Scope:** Database schema, TypeScript constants, import strategy, and verification queries

---

## Table of Contents

1. [Permission Slugs: Canonical List](#1-permission-slugs-canonical-list)
2. [Permission Constants Strategy](#2-permission-constants-strategy)
3. [Module Slugs: Canonical List](#3-module-slugs-canonical-list)
4. [Module Constants Strategy](#4-module-constants-strategy)
5. [Verification Queries](#5-verification-queries)
6. [Trust Boundaries & Security Model](#6-trust-boundaries--security-model)

---

# 1. PERMISSION SLUGS: CANONICAL LIST

## 1.1 Source of Truth

**Database Table:** `permissions` (20 columns)

**Schema:**

```sql
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,  -- THE CANONICAL IDENTIFIER
  label text,
  name text,
  description text,
  category text,
  subcategory text,
  resource_type text,
  action text,
  scope_types text[],         -- Array: ["global"], ["org"], ["branch"], null
  dependencies text[],         -- Array of permission slugs
  conflicts_with text[],       -- Array of permission slugs
  is_system boolean DEFAULT false,
  is_dangerous boolean DEFAULT false,
  requires_mfa boolean DEFAULT false,
  priority integer,
  metadata jsonb,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## 1.2 All Permission Slugs (from Database)

**Query Date:** 2026-02-13
**Query:** `SELECT slug, category, scope_types, is_system FROM permissions WHERE deleted_at IS NULL ORDER BY slug;`

| slug                         | category     | scope_types  | is_system |
| ---------------------------- | ------------ | ------------ | --------- |
| `account.*`                  | account      | `["global"]` | true      |
| `account.preferences.read`   | account      | `["global"]` | true      |
| `account.preferences.update` | account      | `["global"]` | true      |
| `account.profile.read`       | account      | `["global"]` | true      |
| `account.profile.update`     | account      | `["global"]` | true      |
| `account.settings.read`      | account      | `["global"]` | true      |
| `account.settings.update`    | account      | `["global"]` | true      |
| `branches.create`            | branches     | null         | false     |
| `branches.delete`            | branches     | null         | false     |
| `branches.read`              | branches     | null         | false     |
| `branches.update`            | branches     | null         | false     |
| `invites.cancel`             | invites      | null         | false     |
| `invites.create`             | invites      | null         | false     |
| `invites.read`               | invites      | null         | false     |
| `members.manage`             | members      | null         | false     |
| `members.read`               | members      | null         | false     |
| `org.read`                   | organization | null         | false     |
| `org.update`                 | organization | null         | false     |
| `self.read`                  | self         | null         | false     |
| `self.update`                | self         | null         | false     |

**Total:** 20 permission slugs

## 1.3 Permission Slug Patterns

### Category-Based Grouping

```
account.*                    (wildcard, system)
├── account.preferences.*
│   ├── account.preferences.read
│   └── account.preferences.update
├── account.profile.*
│   ├── account.profile.read
│   └── account.profile.update
└── account.settings.*
    ├── account.settings.read
    └── account.settings.update

branches.*
├── branches.create
├── branches.read
├── branches.update
└── branches.delete

invites.*
├── invites.create
├── invites.read
└── invites.cancel

members.*
├── members.read
└── members.manage

org.*
├── org.read
└── org.update

self.*
├── self.read
└── self.update
```

### Naming Convention

**Pattern:** `{resource}.{action}` or `{category}.{resource}.{action}`

**Examples:**

- `org.read` — Read organization profile
- `branches.create` — Create new branches
- `account.profile.update` — Update user's own profile
- `members.manage` — Full member management (invite, remove, update roles)

### Scope Types

| Scope Type   | Meaning                              | Example Slugs                                 |
| ------------ | ------------------------------------ | --------------------------------------------- |
| `["global"]` | User-scoped, not org/branch specific | `account.*`, `account.profile.read`           |
| `null`       | Org-scoped by default (via RLS)      | `org.read`, `branches.create`, `members.read` |

**IMPORTANT:** There are NO branch-scoped permissions in the database. Branch isolation is enforced via RLS policies, not permission scoping.

## 1.4 Wildcard Permissions

| Wildcard    | Grants Access To                | Assigned To                      |
| ----------- | ------------------------------- | -------------------------------- |
| `account.*` | All `account.*` sub-permissions | System (all authenticated users) |

**Wildcard Matching Logic:**

- Implemented in `src/lib/utils/permissions.ts` `checkPermission()`
- Uses `startsWith()` matching: `account.*` matches `account.profile.read`
- Deny permissions take precedence over wildcards

## 1.5 Permission Slugs NOT in Database (Legacy/Mismatched)

**Found in module configs** (`src/modules/organization-managment/config.ts`) but NOT in database:

| Config Slug                   | Should Be                                               | Status      |
| ----------------------------- | ------------------------------------------------------- | ----------- |
| `organization.profile.update` | `org.update`                                            | ❌ Mismatch |
| `branch.manage`               | `branches.create`, `branches.update`, `branches.delete` | ❌ Mismatch |
| `user.manage`                 | `members.manage`                                        | ❌ Mismatch |
| `user.role.read`              | Not in DB                                               | ❌ Missing  |
| `invitation.read`             | `invites.read`                                          | ❌ Mismatch |

**Action Required:** Module configs must be updated to use actual database slugs.

---

# 2. PERMISSION CONSTANTS STRATEGY

## 2.1 Source of Truth File

**File:** `src/lib/constants/permissions.ts`

This file MUST be created and contain ALL permission slugs as named constants.

## 2.2 Implementation Pattern

```typescript
/**
 * Permission Slug Constants
 *
 * CRITICAL: These MUST match the `slug` column in the `permissions` table.
 * - Do NOT create new permissions here without adding them to the database first
 * - If a permission slug changes in the database, update this file and TypeScript will catch all usages
 * - NEVER use raw permission strings outside this file
 *
 * Single source of truth for permission slug references.
 *
 * Database Query to Verify:
 * SELECT slug FROM permissions WHERE deleted_at IS NULL ORDER BY slug;
 */

// Account Permissions (global scope, system permissions)
export const ACCOUNT_WILDCARD = "account.*" as const;
export const ACCOUNT_PREFERENCES_READ = "account.preferences.read" as const;
export const ACCOUNT_PREFERENCES_UPDATE = "account.preferences.update" as const;
export const ACCOUNT_PROFILE_READ = "account.profile.read" as const;
export const ACCOUNT_PROFILE_UPDATE = "account.profile.update" as const;
export const ACCOUNT_SETTINGS_READ = "account.settings.read" as const;
export const ACCOUNT_SETTINGS_UPDATE = "account.settings.update" as const;

// Branch Permissions (org-scoped)
export const BRANCHES_CREATE = "branches.create" as const;
export const BRANCHES_DELETE = "branches.delete" as const;
export const BRANCHES_READ = "branches.read" as const;
export const BRANCHES_UPDATE = "branches.update" as const;

// Invite Permissions (org-scoped)
export const INVITES_CANCEL = "invites.cancel" as const;
export const INVITES_CREATE = "invites.create" as const;
export const INVITES_READ = "invites.read" as const;

// Member Permissions (org-scoped)
export const MEMBERS_MANAGE = "members.manage" as const;
export const MEMBERS_READ = "members.read" as const;

// Organization Permissions (org-scoped)
export const ORG_READ = "org.read" as const;
export const ORG_UPDATE = "org.update" as const;

// Self Permissions (user-scoped)
export const SELF_READ = "self.read" as const;
export const SELF_UPDATE = "self.update" as const;

/**
 * Type union of all valid permission slugs
 * Useful for type-safe permission checks
 */
export type PermissionSlug =
  | typeof ACCOUNT_WILDCARD
  | typeof ACCOUNT_PREFERENCES_READ
  | typeof ACCOUNT_PREFERENCES_UPDATE
  | typeof ACCOUNT_PROFILE_READ
  | typeof ACCOUNT_PROFILE_UPDATE
  | typeof ACCOUNT_SETTINGS_READ
  | typeof ACCOUNT_SETTINGS_UPDATE
  | typeof BRANCHES_CREATE
  | typeof BRANCHES_DELETE
  | typeof BRANCHES_READ
  | typeof BRANCHES_UPDATE
  | typeof INVITES_CANCEL
  | typeof INVITES_CREATE
  | typeof INVITES_READ
  | typeof MEMBERS_MANAGE
  | typeof MEMBERS_READ
  | typeof ORG_READ
  | typeof ORG_UPDATE
  | typeof SELF_READ
  | typeof SELF_UPDATE;

/**
 * Helper: Get all permission slugs as array
 * Useful for validation and testing
 */
export const ALL_PERMISSION_SLUGS: PermissionSlug[] = [
  ACCOUNT_WILDCARD,
  ACCOUNT_PREFERENCES_READ,
  ACCOUNT_PREFERENCES_UPDATE,
  ACCOUNT_PROFILE_READ,
  ACCOUNT_PROFILE_UPDATE,
  ACCOUNT_SETTINGS_READ,
  ACCOUNT_SETTINGS_UPDATE,
  BRANCHES_CREATE,
  BRANCHES_DELETE,
  BRANCHES_READ,
  BRANCHES_UPDATE,
  INVITES_CANCEL,
  INVITES_CREATE,
  INVITES_READ,
  MEMBERS_MANAGE,
  MEMBERS_READ,
  ORG_READ,
  ORG_UPDATE,
  SELF_READ,
  SELF_UPDATE,
];
```

## 2.3 Usage Pattern (Import Strategy)

### ✅ CORRECT: Import constants

```typescript
// sidebar/v2/registry.ts
import { ORG_READ, ORG_UPDATE, MEMBERS_READ, BRANCHES_CREATE } from "@/lib/constants/permissions";

export const MAIN_NAV_ITEMS: SidebarItem[] = [
  {
    id: "organization.profile",
    title: "Profile",
    visibility: {
      requiresPermissions: [ORG_READ], // ✅ Imported constant
    },
  },
  {
    id: "organization.billing",
    title: "Billing",
    visibility: {
      requiresPermissions: [ORG_UPDATE], // ✅ Imported constant
    },
  },
];
```

### ❌ WRONG: Raw strings (forbidden)

```typescript
// ❌ BAD: Raw permission string
export const MAIN_NAV_ITEMS: SidebarItem[] = [
  {
    id: "organization.profile",
    visibility: {
      requiresPermissions: ["org.read"], // ❌ Raw string — will break silently if slug changes
    },
  },
];
```

## 2.4 Enforcement Strategy

### Test-Based Enforcement

**File:** `src/lib/sidebar/v2/__tests__/registry.test.ts`

```typescript
it("should use imported permission constants (no raw strings in registry file)", async () => {
  const registryFilePath = "src/lib/sidebar/v2/registry.ts";
  const fs = await import("fs/promises");
  const registrySource = await fs.readFile(registryFilePath, "utf-8");

  // Check that constants are imported
  expect(registrySource).toMatch(/import.*from.*['"]@\/lib\/constants\/permissions['"]/);

  // Verify no raw permission strings in visibility rules
  const rawPermissionStringPattern = /requiresPermissions:\s*\[\s*['"][a-z._]+['"]/;
  const hasRawStrings = rawPermissionStringPattern.test(registrySource);

  if (hasRawStrings) {
    const matches = registrySource.match(rawPermissionStringPattern);
    throw new Error(
      `Registry file contains raw permission strings. Use imported constants instead.\n` +
        `Found: ${matches?.[0]}\n` +
        `Import permission constants from @/lib/constants/permissions`
    );
  }

  expect(hasRawStrings).toBe(false);
});
```

### ESLint Rule (Optional Enhancement)

```json
// .eslintrc.json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Literal[value=/^(account|branches|invites|members|org|self)\\./]",
        "message": "Use permission constants from @/lib/constants/permissions instead of raw strings"
      }
    ]
  }
}
```

## 2.5 Migration Strategy (Existing Code)

1. **Create constants file** at `src/lib/constants/permissions.ts`
2. **Run search-replace** across codebase:
   - Find: `'org.update'` → Replace: Import `ORG_UPDATE` and use constant
   - Find: `'members.read'` → Replace: Import `MEMBERS_READ` and use constant
3. **Add test** to prevent regression (see 2.4)
4. **Verify** with `npm run type-check` (all imports resolve)

---

# 3. MODULE SLUGS: CANONICAL LIST

## 3.1 Source of Truth

**Database Tables:**

- `subscription_plans.enabled_modules` (JSONB array) — plan-level module slugs
- `organization_entitlements.enabled_modules` (JSONB array) — compiled org-level module slugs

**Codebase Registry:**

- `src/modules/index.ts` — module config registry

## 3.2 All Module Slugs (from Database)

**Query:** `SELECT plan_name, enabled_modules FROM subscription_plans WHERE is_active = true ORDER BY sort_order;`

### Free Plan

```json
[
  "home",
  "warehouse",
  "teams",
  "organization-management",
  "support",
  "user-account",
  "contacts",
  "documentation"
]
```

### Professional Plan

```json
[
  "home",
  "warehouse",
  "teams",
  "organization-management",
  "support",
  "user-account",
  "analytics",
  "development"
]
```

### Enterprise Plan

```json
[
  "home",
  "warehouse",
  "teams",
  "organization-management",
  "support",
  "user-account",
  "analytics",
  "development"
]
```

### All Unique Module Slugs (Deduplicated)

| Module Slug               | Free | Professional | Enterprise | Category  |
| ------------------------- | ---- | ------------ | ---------- | --------- |
| `home`                    | ✅   | ✅           | ✅         | Core      |
| `warehouse`               | ✅   | ✅           | ✅         | Core      |
| `teams`                   | ✅   | ✅           | ✅         | Core      |
| `organization-management` | ✅   | ✅           | ✅         | Core      |
| `support`                 | ✅   | ✅           | ✅         | Core      |
| `user-account`            | ✅   | ✅           | ✅         | Core      |
| `contacts`                | ✅   | ❌           | ❌         | Free-only |
| `documentation`           | ✅   | ❌           | ❌         | Free-only |
| `analytics`               | ❌   | ✅           | ✅         | Premium   |
| `development`             | ❌   | ✅           | ✅         | Premium   |

**Total:** 10 unique module slugs across all plans

## 3.3 Module Slugs in Code Registry (from `src/modules/index.ts`)

```typescript
const allModulesConfig = [
  { module: homeModule, alwaysAvailable: true, requiredPlan: "free" }, // home
  { module: warehouseModule, alwaysAvailable: true, requiredPlan: "free" }, // warehouse
  { module: contactsModule, alwaysAvailable: true, requiredPlan: "free" }, // contacts
  { module: teamsModule, alwaysAvailable: true, requiredPlan: "free" }, // teams
  { module: orgManagmentModule, alwaysAvailable: true, requiredPlan: "free" }, // organization-managment (typo!)
  { module: supportModule, alwaysAvailable: true, requiredPlan: "free" }, // support
  { module: userAccountModule, alwaysAvailable: true, requiredPlan: "free" }, // user-account
  { module: documentationModuleConfig, alwaysAvailable: true, requiredPlan: "free" }, // documentation
  { module: analyticsModule, alwaysAvailable: false, requiredPlan: "professional" }, // analytics
  { module: developmentModule, alwaysAvailable: true, requiredPlan: "free" }, // development
];
```

**Registered Module IDs:**

- `home`
- `warehouse`
- `contacts`
- `teams`
- `organization-management` (note: directory name is `organization-managment` with typo)
- `support`
- `user-account`
- `documentation`
- `analytics`
- `development`

**NOT Registered:**

- `admin` — module exists at `src/modules/admin/config.ts` but NOT in registry

## 3.4 Module Slug Discrepancies

| Issue               | Database                  | Code                                | Status            |
| ------------------- | ------------------------- | ----------------------------------- | ----------------- |
| Directory typo      | `organization-management` | Directory: `organization-managment` | ⚠️ Inconsistency  |
| Admin module        | Not in any plan           | Exists in code but not registered   | ⚠️ Not accessible |
| Development in free | Not in free plan          | Marked `alwaysAvailable: true`      | ⚠️ Mismatch       |

**IMPORTANT:** Module slug is `organization-management` (with 'e'), but directory is `organization-managment` (missing 'e'). Code correctly uses `organization-management` as the ID.

---

# 4. MODULE CONSTANTS STRATEGY

## 4.1 Source of Truth File

**File:** `src/lib/constants/modules.ts`

This file MUST be created and contain ALL module slugs as named constants.

## 4.2 Implementation Pattern

```typescript
/**
 * Module Slug Constants
 *
 * CRITICAL: These MUST match the `enabled_modules` array values in:
 * - `organization_entitlements.enabled_modules` (JSONB array)
 * - `subscription_plans.enabled_modules` (JSONB array)
 *
 * - Do NOT create new module slugs here without adding them to subscription plans first
 * - If a module slug changes in entitlements, update this file and TypeScript will catch all usages
 * - NEVER use raw module strings outside this file
 *
 * Single source of truth for module slug references.
 *
 * Database Query to Verify:
 * SELECT DISTINCT jsonb_array_elements_text(enabled_modules) AS module_slug
 * FROM subscription_plans
 * WHERE is_active = true
 * ORDER BY module_slug;
 */

// Core Modules (Available on Free Plan)
export const MODULE_HOME = "home" as const;
export const MODULE_WAREHOUSE = "warehouse" as const;
export const MODULE_TEAMS = "teams" as const;
export const MODULE_ORGANIZATION_MANAGEMENT = "organization-management" as const;
export const MODULE_SUPPORT = "support" as const;
export const MODULE_USER_ACCOUNT = "user-account" as const;

// Free-Only Modules (Removed in Professional/Enterprise)
export const MODULE_CONTACTS = "contacts" as const;
export const MODULE_DOCUMENTATION = "documentation" as const;

// Premium Modules (Professional/Enterprise Only)
export const MODULE_ANALYTICS = "analytics" as const;
export const MODULE_DEVELOPMENT = "development" as const;

// Admin Module (Not in any plan - superadmin only, manual override required)
export const MODULE_ADMIN = "admin" as const;

/**
 * Type union of all valid module slugs
 * Useful for type-safe module checks
 */
export type ModuleSlug =
  | typeof MODULE_HOME
  | typeof MODULE_WAREHOUSE
  | typeof MODULE_TEAMS
  | typeof MODULE_ORGANIZATION_MANAGEMENT
  | typeof MODULE_SUPPORT
  | typeof MODULE_USER_ACCOUNT
  | typeof MODULE_CONTACTS
  | typeof MODULE_DOCUMENTATION
  | typeof MODULE_ANALYTICS
  | typeof MODULE_DEVELOPMENT
  | typeof MODULE_ADMIN;

/**
 * Free plan modules (always available)
 */
export const FREE_PLAN_MODULES = [
  MODULE_HOME,
  MODULE_WAREHOUSE,
  MODULE_TEAMS,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_SUPPORT,
  MODULE_USER_ACCOUNT,
  MODULE_CONTACTS,
  MODULE_DOCUMENTATION,
] as const;

/**
 * Premium modules (require paid plan)
 */
export const PREMIUM_MODULES = [MODULE_ANALYTICS, MODULE_DEVELOPMENT] as const;

/**
 * Core modules (available across all paid plans)
 */
export const CORE_MODULES = [
  MODULE_HOME,
  MODULE_WAREHOUSE,
  MODULE_TEAMS,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_SUPPORT,
  MODULE_USER_ACCOUNT,
] as const;

/**
 * Helper: Get all module slugs as array
 * Useful for validation and testing
 */
export const ALL_MODULE_SLUGS: ModuleSlug[] = [
  MODULE_HOME,
  MODULE_WAREHOUSE,
  MODULE_TEAMS,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_SUPPORT,
  MODULE_USER_ACCOUNT,
  MODULE_CONTACTS,
  MODULE_DOCUMENTATION,
  MODULE_ANALYTICS,
  MODULE_DEVELOPMENT,
  MODULE_ADMIN,
];
```

## 4.3 Usage Pattern (Import Strategy)

### ✅ CORRECT: Import constants

```typescript
// sidebar/v2/registry.ts
import {
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_ANALYTICS,
  MODULE_DEVELOPMENT,
  MODULE_SUPPORT,
} from "@/lib/constants/modules";

export const MAIN_NAV_ITEMS: SidebarItem[] = [
  {
    id: "organization",
    title: "Organization",
    visibility: {
      requiresModules: [MODULE_ORGANIZATION_MANAGEMENT], // ✅ Imported constant
    },
  },
  {
    id: "analytics",
    title: "Analytics",
    visibility: {
      requiresModules: [MODULE_ANALYTICS], // ✅ Imported constant
    },
  },
];
```

### ❌ WRONG: Raw strings (forbidden)

```typescript
// ❌ BAD: Raw module string
export const MAIN_NAV_ITEMS: SidebarItem[] = [
  {
    id: "analytics",
    visibility: {
      requiresModules: ["analytics"], // ❌ Raw string — will break silently if slug changes
    },
  },
];
```

## 4.4 Enforcement Strategy

### Test-Based Enforcement

**File:** `src/lib/sidebar/v2/__tests__/registry.test.ts`

```typescript
it("should use imported module constants (no raw strings in registry file)", async () => {
  const registryFilePath = "src/lib/sidebar/v2/registry.ts";
  const fs = await import("fs/promises");
  const registrySource = await fs.readFile(registryFilePath, "utf-8");

  // Check that constants are imported
  expect(registrySource).toMatch(/import.*from.*['"]@\/lib\/constants\/modules['"]/);

  // Verify no raw module strings in visibility rules
  const rawModuleStringPattern = /requiresModules:\s*\[\s*['"][a-z-]+['"]/;
  const hasRawStrings = rawModuleStringPattern.test(registrySource);

  if (hasRawStrings) {
    const matches = registrySource.match(rawModuleStringPattern);
    throw new Error(
      `Registry file contains raw module strings. Use imported constants instead.\n` +
        `Found: ${matches?.[0]}\n` +
        `Import module constants from @/lib/constants/modules`
    );
  }

  expect(hasRawStrings).toBe(false);
});
```

---

# 5. VERIFICATION QUERIES

## 5.1 Verify Permission Slugs Match Database

```sql
-- Get all active permission slugs from database
SELECT slug, category, scope_types, is_system
FROM permissions
WHERE deleted_at IS NULL
ORDER BY slug;

-- Expected count: 20 rows
```

**Compare against:** `src/lib/constants/permissions.ts` constants

## 5.2 Verify Module Slugs Match Entitlements

```sql
-- Get all unique module slugs from subscription plans
SELECT DISTINCT jsonb_array_elements_text(enabled_modules) AS module_slug
FROM subscription_plans
WHERE is_active = true
ORDER BY module_slug;

-- Expected modules:
-- analytics, contacts, development, documentation, home,
-- organization-management, support, teams, user-account, warehouse
```

**Compare against:** `src/lib/constants/modules.ts` constants

## 5.3 Verify Effective Permissions for User

```sql
-- Get effective permissions for a specific user in an org
SELECT permission_slug
FROM user_effective_permissions
WHERE user_id = 'YOUR_USER_ID'
  AND organization_id = 'YOUR_ORG_ID'
  AND deleted_at IS NULL
ORDER BY permission_slug;

-- This is what usePermissions() hook sees
```

## 5.4 Verify Organization Entitlements

```sql
-- Get compiled entitlements for an org
SELECT
  organization_id,
  plan_name,
  enabled_modules,
  limits
FROM organization_entitlements
WHERE organization_id = 'YOUR_ORG_ID';

-- This is what EntitlementsService loads
```

## 5.5 Cross-Reference: Constants vs Database

```typescript
// Test to verify constants match database
// File: src/lib/constants/__tests__/permissions.test.ts

import { ALL_PERMISSION_SLUGS } from "../permissions";
import { createClient } from "@/utils/supabase/server";

it("should match database permission slugs exactly", async () => {
  const supabase = await createClient();

  const { data: dbPermissions } = await supabase
    .from("permissions")
    .select("slug")
    .is("deleted_at", null)
    .order("slug");

  const dbSlugs = dbPermissions?.map((p) => p.slug) || [];
  const constantSlugs = [...ALL_PERMISSION_SLUGS].sort();

  expect(constantSlugs).toEqual(dbSlugs);
});
```

---

# 6. TRUST BOUNDARIES & SECURITY MODEL

## 6.1 Permission Checks: Where They Happen

### Server-Side (Authoritative - Security Enforcement)

| Layer              | Implementation                        | File Path                                      | Purpose                    |
| ------------------ | ------------------------------------- | ---------------------------------------------- | -------------------------- |
| **Database RLS**   | `has_permission(org_id, slug)`        | Supabase functions                             | Table-level access control |
| **Server Actions** | `PermissionServiceV2.hasPermission()` | `src/server/services/permission-service.v2.ts` | Action-level guards        |
| **Page Guards**    | `getServerPermissions()` then `can()` | Server components/layouts                      | Route-level enforcement    |
| **API Routes**     | Middleware permission checks          | API route handlers                             | Endpoint protection        |

### Client-Side (UI/UX Only - NOT Security Enforcement)

| Layer          | Implementation              | File Path                         | Purpose               |
| -------------- | --------------------------- | --------------------------------- | --------------------- |
| **Hooks**      | `usePermissions()`          | `src/hooks/v2/use-permissions.ts` | Hide/show UI elements |
| **Sidebar**    | Registry visibility rules   | `src/lib/sidebar/v2/registry.ts`  | Navigation filtering  |
| **Components** | `can()` / `cannot()` checks | Throughout app                    | Conditional rendering |

**CRITICAL:** Client-side checks are convenience only. Users can bypass by editing localStorage/cookies. ALL enforcement happens server-side.

## 6.2 Module Access Checks: Where They Happen

### Server-Side (Authoritative - Security Enforcement)

| Layer              | Implementation                            | File Path                                  | Purpose                 |
| ------------------ | ----------------------------------------- | ------------------------------------------ | ----------------------- |
| **Server Actions** | `requireModuleAccess()`                   | `src/server/guards/entitlements-guards.ts` | Action-level guards     |
| **Page Guards**    | `EntitlementsService.hasModuleAccess()`   | Server components/layouts                  | Route-level enforcement |
| **Database**       | No RLS for modules (handled in app layer) | N/A                                        | N/A                     |

### Client-Side (UI/UX Only - NOT Security Enforcement)

| Layer               | Implementation                  | File Path                        | Purpose                   |
| ------------------- | ------------------------------- | -------------------------------- | ------------------------- |
| **Hooks**           | `useEntitlements()`             | `src/hooks/use-entitlements.ts`  | Check module access       |
| **Sidebar**         | `requiresModules` in visibility | `src/lib/sidebar/v2/registry.ts` | Hide unavailable modules  |
| **Module Registry** | `getAllModules()` filtering     | `src/modules/index.ts`           | Filter accessible modules |

## 6.3 Constants Strategy Security Benefits

### Compile-Time Safety

**Before (Raw Strings):**

```typescript
// ❌ Typo in permission slug - will fail silently at runtime
if (can("org.updat")) {
  // Typo: 'updat' instead of 'update'
  // This will ALWAYS be false, but no error
}
```

**After (Constants):**

```typescript
// ✅ Typo in constant name - TypeScript error at compile time
import { ORG_UPDAT } from "@/lib/constants/permissions"; // ❌ Compile error: no such export

if (can(ORG_UPDATE)) {
  // ✅ Correct constant, type-safe
  // Works correctly
}
```

### Refactoring Safety

**Scenario:** Permission slug changes from `org.update` to `organization.update` in database.

**Before (Raw Strings):**

- Update database
- Search codebase for all instances of `'org.update'`
- Easy to miss some (string search is unreliable)
- **Result:** Silent breakage in production

**After (Constants):**

- Update database
- Update constant: `export const ORG_UPDATE = 'organization.update' as const;`
- **Result:** All usages automatically updated, TypeScript verifies all imports resolve

### Test Enforcement

**Registry Test:** Enforces no raw strings in registry files (CI/CD gate)
**Database Sync Test:** Verifies constants match database slugs (see 5.5)

**Result:** Impossible to accidentally use wrong slugs or introduce typos.

---

# 7. SUMMARY

## 7.1 Canonical Lists

### Permission Slugs (20 total)

- **Source of Truth:** `permissions` table, `slug` column
- **Constants File:** `src/lib/constants/permissions.ts`
- **Pattern:** `{resource}.{action}` or `{category}.{resource}.{action}`
- **Scopes:** `["global"]` for account, `null` (org-scoped) for others

### Module Slugs (10 active + 1 admin)

- **Source of Truth:** `subscription_plans.enabled_modules`, `organization_entitlements.enabled_modules`
- **Constants File:** `src/lib/constants/modules.ts`
- **Pattern:** `kebab-case` names (e.g., `organization-management`)
- **Categories:** Core (6), Free-only (2), Premium (2), Admin (1)

## 7.2 Import Strategy

**Mandatory Pattern:**

```typescript
// ✅ ALWAYS import constants
import { ORG_UPDATE, MEMBERS_READ } from "@/lib/constants/permissions";
import { MODULE_ANALYTICS } from "@/lib/constants/modules";

// ❌ NEVER use raw strings
const perms = ["org.update"]; // FORBIDDEN
```

**Enforcement:**

- Test-based (registry tests check for raw strings)
- Optional: ESLint rule to ban raw string patterns
- Database sync tests verify constants match DB

## 7.3 Migration Checklist

- [ ] Create `src/lib/constants/permissions.ts` with all 20 permission constants
- [ ] Create `src/lib/constants/modules.ts` with all 11 module constants
- [ ] Update `src/lib/sidebar/v2/registry.ts` to import constants (when implementing sidebar v2)
- [ ] Update `src/modules/organization-managment/config.ts` to use correct permission slugs
- [ ] Add registry tests to enforce no raw strings (see Section 2.4 and 4.4)
- [ ] Add database sync tests to verify constants match DB (see Section 5.5)
- [ ] Run `npm run type-check` to verify all imports resolve
- [ ] Search codebase for remaining raw permission/module strings and replace

---

# 8. APPENDIX: Quick Reference

## Permission Constants (Alphabetical)

```typescript
ACCOUNT_PREFERENCES_READ;
ACCOUNT_PREFERENCES_UPDATE;
ACCOUNT_PROFILE_READ;
ACCOUNT_PROFILE_UPDATE;
ACCOUNT_SETTINGS_READ;
ACCOUNT_SETTINGS_UPDATE;
ACCOUNT_WILDCARD;
BRANCHES_CREATE;
BRANCHES_DELETE;
BRANCHES_READ;
BRANCHES_UPDATE;
INVITES_CANCEL;
INVITES_CREATE;
INVITES_READ;
MEMBERS_MANAGE;
MEMBERS_READ;
ORG_READ;
ORG_UPDATE;
SELF_READ;
SELF_UPDATE;
```

## Module Constants (Alphabetical)

```typescript
MODULE_ADMIN;
MODULE_ANALYTICS;
MODULE_CONTACTS;
MODULE_DEVELOPMENT;
MODULE_DOCUMENTATION;
MODULE_HOME;
MODULE_ORGANIZATION_MANAGEMENT;
MODULE_SUPPORT;
MODULE_TEAMS;
MODULE_USER_ACCOUNT;
MODULE_WAREHOUSE;
```

---

**END OF EXTRACTION**
