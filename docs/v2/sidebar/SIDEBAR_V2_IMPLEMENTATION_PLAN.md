# Dashboard V2 Sidebar Implementation Plan

**Status:** Not Started
**Created:** 2026-02-13
**Updated:** 2026-02-16
**Architecture:** SSR-First, TDD, Security-Hardened

---

## Patch Tracker (Plan Fixes)

### Round 1

- [x] Patch 1 — Parent Expansion policy precedence (resolve contradiction)
- [x] Patch 2 — Define source of manual expansion state
- [x] Patch 3 — Footer required: fix rendering snippet inconsistency (already resolved)
- [x] Patch 4 — Hydration flag naming: align with actual V2 UI store API naming
- [x] Patch 5 — requiresAnyModules: add fail-closed test variant when entitlements missing

### Round 2

- [x] Patch 6 — Eliminate double SidebarProvider ambiguity (single provider in DashboardShell only)
- [x] Patch 7 — Normalize redirect examples to match existing Dashboard V2 behavior (`/sign-in`, not `/login`)
- [x] Patch 8 — Make resolver test snippets internally consistent (documentation snippets use raw strings for readability; implementation tests use constants)
- [x] Patch 9 — Make registry 'no raw strings' tests path-stable (`path.resolve(process.cwd(), ...)`)
- [x] Patch 10 — Align fail-closed wording with non-nullable `permissionSnapshot` type (empty, not null)

### Round 3

- [x] Patch 11 — Explicit permission fail-closed test (`permissionSnapshot.allow` empty → items hidden)
- [x] Patch 12 — Footer wording fix (type guarantee removes null check; `length > 0` is content check)
- [x] Patch 13 — Parent Expansion Policy anchored to sidebar primitives (`Collapsible`/`SidebarGroup`)
- [x] Patch 14 — Constant Usage Policy: registry AND tests MUST use imported constants (no raw strings)
- [x] Patch 15 — `cache()` semantics: RSC render execution context, no cross-request persistence guarantee

---

## 📊 Progress Tracker

Track implementation progress by checking off completed steps:

### Phase 0: Non-Negotiables / Scope Lock

- [ ] 0.1 Document scope boundaries and forbidden zones
- [ ] 0.2 Define "done" criteria
- [ ] 0.3 List explicit out-of-scope items

### Phase 1: Sidebar Contract (Pure Types)

- [ ] 1.1 Create `src/lib/types/v2/sidebar.ts` with JSON-serializable types
- [ ] 1.2 Define `SidebarModel` with visibility rules
- [ ] 1.3 Create icon key mapping (`iconKey` → lucide component)
- [ ] 1.4 Write contract validation tests

### Phase 2: Pure Resolver (TDD First)

- [ ] 2.1 Create failing tests in `src/lib/sidebar/v2/__tests__/resolver.test.ts`
- [ ] 2.2 Implement `resolveSidebarModel()` in `src/lib/sidebar/v2/resolver.ts`
- [ ] 2.3 Test: public items render
- [ ] 2.4 Test: `requiresPermissions` AND logic
- [ ] 2.5 Test: `requiresAnyPermissions` OR logic
- [ ] 2.6 Test: module gating via entitlements
- [ ] 2.7 Test: fail-closed when entitlements null
- [ ] 2.7.1 Test: permission fail-closed when `permissionSnapshot.allow` is empty (`[]`)
- [ ] 2.8 Test: nested group pruning (hide empty parents)
- [ ] 2.9 Test: wildcard permission matching (`account.*`)
- [ ] 2.10 Test: determinism (same inputs → identical outputs)
- [ ] 2.11 All resolver tests passing

### Phase 3: Nav Registry (Data Only)

- [ ] 3.0 Create centralized permission slug constants (`src/lib/constants/permissions.ts`)
- [ ] 3.0.1 Create centralized module slug constants (`src/lib/constants/modules.ts`)
- [ ] 3.1 Create `src/lib/sidebar/v2/registry.ts` with nav catalog
- [ ] 3.2 Define core sections (Home, Organization, Account, etc.)
- [ ] 3.3 Write registry structure tests
- [ ] 3.4 Verify registry is deterministic and pure

### Phase 4: SSR Assembly in Dashboard V2 Layout

- [ ] 4.1 Load entitlements server-side in layout
- [ ] 4.2 Create server helper `buildSidebarModel()` in `src/server/sidebar/build-sidebar-model.ts`
- [ ] 4.3 Compute `sidebarModel` in `src/app/[locale]/dashboard/layout.tsx`
- [ ] 4.4 Pass model to `DashboardShell` via props
- [ ] 4.5 Verify no hydration mismatch warnings
- [ ] 4.6 Test SSR output includes expected nav items

### Phase 5: Client Sidebar as Dumb Renderer

- [ ] 5.1 Create `src/app/[locale]/dashboard/_components/sidebar-v2.tsx`
- [ ] 5.2 Accept `sidebarModel` prop and render without filtering
- [ ] 5.3 Remove hardcoded `navData` from client component
- [ ] 5.4 Implement collapse state via `useUiStoreV2`
- [ ] 5.5 Add hydration strategy to prevent layout shift
- [ ] 5.6 Test: client renders exactly what SSR sent

### Phase 6: Enforcement Stays Server-Side

- [ ] 6.1 Document sidebar as UX-only boundary in `docs/v2/sidebar/SECURITY.md`
- [ ] 6.2 Verify page-level guards still enforce permissions
- [ ] 6.3 Verify server actions still enforce entitlements
- [ ] 6.4 Create enforcement checklist for new pages

### Phase 7: Integration Tests

- [ ] 7.1 Add test: SSR renders sidebar with expected items
- [ ] 7.2 Add test: `org_owner` sees more items than `org_member`
- [ ] 7.3 Add test: free plan hides analytics/development modules
- [ ] 7.4 Add test: wildcard permission grants access to sub-permissions
- [ ] 7.5 All integration tests passing

### Phase 8: Safe Commit Order

- [ ] 8.1 Commit: Contract types + icon map
- [ ] 8.2 Commit: Failing resolver tests
- [ ] 8.3 Commit: Resolver implementation (tests passing)
- [ ] 8.4 Commit: Nav registry + registry tests
- [ ] 8.5 Commit: Server layout computes sidebar model
- [ ] 8.6 Commit: Client sidebar renderer
- [ ] 8.7 Commit: Remove old navData, cleanup
- [ ] 8.8 Commit: Integration tests
- [ ] 8.9 Smoke check: SSR consistency, no flicker, no security regression

---

## 🚨 Guardrails (Do Not Break Existing Systems)

**CRITICAL:** This implementation is STRICTLY LIMITED to sidebar V2. The following changes are **FORBIDDEN**:

### ❌ Forbidden Actions

1. **DO NOT touch entitlement compiler triggers**
   - Files: `supabase/migrations/*_entitlements_compiler_*.sql`
   - Reason: Sidebar uses compiled snapshots, doesn't modify compiler logic
   - Risk: Breaking subscription plan inheritance or permission compilation

2. **DO NOT modify RLS policies**
   - Files: `supabase/migrations/*_rls_*.sql`
   - Reason: Sidebar is UX-only, RLS is security enforcement
   - Risk: Accidental security bypass or data exposure

3. **DO NOT rename permission slugs in database**
   - Table: `permissions.slug` column
   - Reason: Permission slugs are used throughout codebase and RLS policies
   - Risk: Silent breakage of authorization checks

4. **DO NOT refactor unrelated UI/layout components**
   - Files: Dashboard shell, theme providers, existing sidebar components
   - Reason: Keep scope tight to sidebar V2 only
   - Risk: Scope creep, regression in unrelated features

5. **DO NOT add "quick fixes" outside sidebar scope**
   - Example: Fixing module config typos, updating legacy components
   - Reason: Separate concerns, avoid feature coupling
   - Risk: Bloated PR, harder code review, increased QA burden

### ✅ Allowed Actions (Sidebar V2 Scope Only)

- Create new sidebar V2 files (`src/lib/sidebar/v2/*`, `src/lib/types/v2/sidebar.ts`)
- Create permission/module constants files (`src/lib/constants/{permissions,modules}.ts`)
- Update dashboard layout to compute sidebar model server-side
- Create client sidebar renderer component
- Add sidebar-specific tests (resolver, registry, integration)
- Document sidebar security model

### Why These Guardrails Matter

- **Minimize blast radius:** If sidebar V2 has bugs, only navigation is affected
- **Enable fast rollback:** Can revert sidebar changes without touching auth/entitlements
- **Simplify code review:** Reviewers can focus on sidebar logic only
- **Reduce QA surface:** Test sidebar behavior, not entire auth system
- **Prevent cascading failures:** Sidebar bugs don't break login, RLS, or data access

**Acceptance Criteria:**

- [ ] No changes to `supabase/migrations/*` (except adding test data if needed)
- [ ] No changes to `src/server/services/entitlements-service.ts` logic
- [ ] No changes to `src/server/services/permission-service.v2.ts` logic
- [ ] No changes to RLS function definitions
- [ ] All changes scoped to sidebar V2 files only

---

## ⚠️ Senior Review Corrections (MANDATORY Before Implementation)

**Purpose:** These corrections address architectural weaknesses that could cause production instability, silent breakage, or security regressions. Each correction must be verified during code review.

### Architectural Quality Gates

- [ ] **Deterministic Resolver Output** — Resolver must produce identical output for identical inputs (no timestamps, no side effects)
- [ ] **Active State Fully Client-Side** — Server computes visibility only; client computes active highlighting
- [ ] **Permission Slug Constants Required** — No raw permission strings in registry; centralized constants only
- [ ] **Module Slug Constants Required** — No raw module slugs in registry; centralized constants only
- [ ] **Explicit Fail-Closed Documentation** — Null/missing entitlements must hide all module-gated items (fail-safe behavior)
- [ ] **Hydration Stability Guarantees** — SSR and initial client render must produce identical markup (no layout shift)

**Why These Matter:**

- **Determinism** enables snapshot testing, memoization, and predictable debugging
- **Client-side active state** decouples visibility logic from routing concerns
- **Centralized constants** prevent silent breakage during schema evolution
- **Fail-closed behavior** ensures security-first defaults (never accidentally expose premium features)
- **Hydration stability** prevents production layout thrashing and React warnings

**Implementation Note:** These are NOT optional optimizations. They are architectural requirements for enterprise-grade production systems.

---

## 📚 SSR Data Availability

**Where do `enabledModules` and `permissionSnapshot` come from?**

### Server-Side Context Loading (Already Exists)

The dashboard V2 layout already loads all required context server-side:

**File:** `src/app/[locale]/dashboard/layout.tsx`

```typescript
const dashboardContext = await loadDashboardContextV2();
// Returns: { app: AppContextV2, user: UserContextV2 }
```

**What's Available:**

```typescript
// From UserContextV2 (src/lib/stores/v2/user-store.ts)
userContext.permissionSnapshot = {
  allow: string[];  // Pre-compiled permission slugs user has
  deny: string[];   // Explicitly denied permissions (overrides allow)
}

// From AppContextV2 (src/lib/stores/v2/app-store.ts)
appContext.activeOrgId: string | null;
appContext.activeBranchId: string | null;
appContext.userModules: Array<{ id, slug, label }>;
```

**Entitlements (Need to Load):**

```typescript
// Load in Phase 4.1
const entitlements = await EntitlementsService.loadEntitlements(appContext.activeOrgId);
// Returns: OrganizationEntitlements | null

// Structure:
{
  organization_id: string;
  plan_id: string;
  plan_name: string;
  enabled_modules: string[];      // ← Used by sidebar resolver
  enabled_contexts: string[];
  features: Record<string, any>;
  limits: Record<string, number>;
  updated_at: string;
}
```

### How Sidebar Resolver Uses This Data

```typescript
// Phase 4.2: Build sidebar model server-side
const sidebarModel = buildSidebarModel(
  appContext, // activeOrgId, activeBranchId, userModules
  userContext, // permissionSnapshot (allow/deny)
  entitlements, // enabled_modules array
  locale
);
```

**Visibility Resolution:**

- `requiresPermissions` → Checked against `userContext.permissionSnapshot.allow`
- `requiresModules` → Checked against `entitlements.enabled_modules`
- `deny` permissions override `allow` (deny-first semantics)
- `null` entitlements → Fail-closed (hide all module-gated items)

**Key Insight:** All data already exists in V2 context system. Sidebar just consumes it.

---

## Phase 0: Non-Negotiables / Scope Lock

### 0.1 Document Scope Boundaries and Forbidden Zones

**What:** Define hard boundaries for this implementation.

**Forbidden:**

- DO NOT reference, copy, or port code from legacy dashboard (`src/app/[locale]/dashboard-old/`)
- DO NOT reference or copy old sidebar components (`src/components/Dashboard/sidebar/`)
- DO NOT modify permission compiler, RLS policies, or V2 loaders unless explicitly required
- DO NOT treat sidebar visibility as a security enforcement boundary
- DO NOT introduce client-side permission/entitlement evaluation that diverges from server

**Allowed:**

- Read extraction docs (`docs/extractions/`) for understanding architecture
- Use existing V2 loaders (`loadDashboardContextV2`, `loadUserContextV2`)
- Use existing services (`EntitlementsService`, `PermissionServiceV2`)
- Use canonical permission matcher (`src/lib/utils/permissions.ts`)
- Use existing V2 stores (`useAppStoreV2`, `useUserStoreV2`, `useUiStoreV2`)

**Acceptance Criteria:**

- [ ] No imports from `dashboard-old` or legacy sidebar components
- [ ] No new permission evaluation logic (reuse existing utilities)
- [ ] Document references extraction docs for context

### 0.2 Define "Done" Criteria

**What:** Sidebar V2 is considered complete when:

1. **SSR Consistency:** Sidebar nav model is computed server-side and rendered without client-side filtering
2. **No Flicker:** Initial render matches SSR output; no "hide after render" behavior
3. **Security:** RLS + server guards remain authoritative; sidebar is UX-only
4. **Test Coverage:**
   - Unit tests: resolver with 100% branch coverage
   - Integration tests: SSR output, permission/entitlement gating
5. **Deterministic:** Same inputs → same nav output (pure function)
6. **Extensible:** Nav registry supports adding new sections without rewriting resolver

**Acceptance Criteria:**

- [ ] All tests passing (unit + integration)
- [ ] No hydration mismatch warnings in console
- [ ] No layout shift on hydration
- [ ] SSR renders sidebar with JS disabled (basic verification)

### 0.3 List Explicit Out-of-Scope Items

**What:** Features NOT included in this implementation:

- Custom modules (org-specific nav items from DB)
- User-specific nav customization (drag-and-drop, pinned items)
- Sidebar search/filtering
- Nested groups beyond 2 levels
- Dynamic nav based on feature flags (beyond enabled_modules)
- Sidebar analytics/tracking
- AI-suggested shortcuts

**Why:** Keep scope tight; these can be added incrementally after core is solid.

**Acceptance Criteria:**

- [ ] Document states these are future enhancements
- [ ] Registry structure supports future extension without breaking changes

---

## Phase 1: Sidebar Contract (Pure Types)

### 1.1 Create `src/lib/types/v2/sidebar.ts`

**What:** Define JSON-serializable types for sidebar model.

**File:** `src/lib/types/v2/sidebar.ts`

```typescript
/**
 * Sidebar V2 Type Definitions
 *
 * Pure, JSON-serializable types for SSR sidebar model.
 * NO React components, NO client-only imports.
 */

/**
 * Visibility rules for nav items (ALL must be satisfied to show item)
 */
export interface SidebarVisibilityRules {
  /** ALL of these permissions must be satisfied (AND) */
  requiresPermissions?: string[];

  /** AT LEAST ONE of these permissions must be satisfied (OR) */
  requiresAnyPermissions?: string[];

  /** ALL of these modules must be enabled (AND) */
  requiresModules?: string[];

  /** AT LEAST ONE of these modules must be enabled (OR) */
  requiresAnyModules?: string[];
}

/**
 * Active route matching rules
 */
export interface SidebarMatchRules {
  /** Pathname starts with this string */
  startsWith?: string;

  /** Pathname exactly matches this string */
  exact?: string;
}

/**
 * Reason an item is disabled (for UX feedback)
 */
export type SidebarDisabledReason = "permission" | "entitlement" | "coming_soon";

/**
 * Base sidebar item (recursive structure)
 */
export interface SidebarItem {
  /** Stable unique ID (used for keys, tracking) */
  id: string;

  /** Display title (already translated) */
  title: string;

  /** Icon key (maps to lucide icon name) */
  iconKey: string;

  /** Href for navigation (optional for groups) */
  href?: string;

  /** Child items (for groups/nested nav) */
  children?: SidebarItem[];

  /** Active route matching rules */
  match?: SidebarMatchRules;

  /** Visibility rules (if missing, item is always visible) */
  visibility?: SidebarVisibilityRules;

  /** Why item is disabled (optional UX hint) */
  disabledReason?: SidebarDisabledReason;

  /** Badge text (e.g., "New", "Beta", count) */
  badge?: string;

  /**
   * IMPORTANT: Active state is NOT in this model.
   * Active highlighting is a CLIENT-SIDE concern computed using router pathname.
   * Server-side model only contains VISIBILITY data (permissions/entitlements).
   */
}

/**
 * Sidebar model (root structure)
 *
 * CRITICAL: This type must be DETERMINISTIC.
 * - Same inputs → identical output (every time)
 * - No timestamps, no random IDs, no side effects
 * - Required for: snapshot tests, memoization, hydration consistency
 */
export interface SidebarModel {
  /** Main navigation sections */
  main: SidebarItem[];

  /** Footer navigation (settings, help, etc.) - always present, may be empty array */
  footer: SidebarItem[];
}

/**
 * Resolver input (everything needed to compute VISIBILITY)
 *
 * IMPORTANT: This input contains ONLY data needed for VISIBILITY decisions.
 * - Permissions → what user can access
 * - Entitlements → what org has enabled
 * - Context → org/branch for scoping
 *
 * It does NOT contain:
 * - pathname (active state is CLIENT-SIDE concern)
 * - UI preferences (collapse state is CLIENT-SIDE concern)
 * - Any routing-related state
 */
export interface SidebarResolverInput {
  /** Current locale (for future i18n if needed) */
  locale: string;

  /** User permission snapshot (allow/deny) — non-nullable, defaults to { allow: [], deny: [] } */
  permissionSnapshot: {
    allow: string[];
    deny: string[];
  };

  /** Organization entitlements (nullable for fail-closed) */
  entitlements: {
    enabled_modules: string[];
    enabled_contexts: string[];
    features: Record<string, boolean | number | string>;
    limits: Record<string, number>;
  } | null;

  /** App context (org/branch scope) */
  context: {
    activeOrgId: string | null;
    activeBranchId: string | null;
    userModules?: Array<{ id: string; slug: string; label: string }>;
  };
}
```

**Why:**

- **No React components:** Icon is a string key, mapped on client. Server can serialize this to JSON.
- **Visibility rules:** Explicit AND/OR semantics prevent ambiguity.
- **Recursive structure:** Supports nested groups without rewriting resolver.

**Acceptance Criteria:**

- [ ] All types are JSON-serializable (no functions, no React nodes)
- [ ] TypeScript compiles without errors
- [ ] Can call `JSON.stringify(sidebarModel)` without loss

**Gotchas:**

- Don't add `onClick` handlers or React elements to this type
- Keep visibility rules flat (don't allow nested conditions yet)

### 1.2 Define `SidebarModel` with Visibility Rules

**What:** The type above already defines visibility rules. Document the semantics.

**Visibility Rule Semantics:**

**IMPORTANT:** All examples below use imported constants from `@/lib/constants/permissions` and `@/lib/constants/modules`. Raw strings are NOT allowed in implementation.

| Rule                                                       | Logic                                          | Example                                                          |
| ---------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `requiresPermissions: [ORG_UPDATE, MEMBERS_MANAGE]`        | AND — user must have ALL                       | Hide "Billing" unless user has `ORG_UPDATE` AND `MEMBERS_MANAGE` |
| `requiresAnyPermissions: [ORG_UPDATE, BRANCHES_UPDATE]`    | OR — user must have AT LEAST ONE               | Show "Settings" if user has `ORG_UPDATE` OR `BRANCHES_UPDATE`    |
| `requiresModules: [MODULE_ANALYTICS]`                      | AND — org must have ALL modules enabled        | Hide "Reports" unless `MODULE_ANALYTICS` in `enabled_modules`    |
| `requiresAnyModules: [MODULE_ANALYTICS, MODULE_WAREHOUSE]` | OR — org must have AT LEAST ONE module enabled | Show "Data" if org has `MODULE_ANALYTICS` OR `MODULE_WAREHOUSE`  |

**Combined rules:** All rule types are ANDed together. Example:

```typescript
import { ORG_UPDATE } from '@/lib/constants/permissions';
import { MODULE_ANALYTICS } from '@/lib/constants/modules';

{
  requiresPermissions: [ORG_UPDATE],
  requiresModules: [MODULE_ANALYTICS]
}
// Shows ONLY if user has ORG_UPDATE AND org has MODULE_ANALYTICS module
```

**Acceptance Criteria:**

- [ ] Document includes truth table for rule combinations
- [ ] Examples show both simple and combined rules

### 1.2.1 Registry Immutability Policy

**CRITICAL:** Registry objects are immutable configuration and must NEVER be mutated.

**Immutability Requirements:**

1. **Registry as Read-Only Data**
   - Registry exports (`MAIN_NAV_ITEMS`, `FOOTER_NAV_ITEMS`) are configuration, not mutable state
   - Treat registry as `readonly` data structure
   - Registry should be safe to import and use from multiple contexts simultaneously

2. **Resolver Must Not Mutate Input**
   - The `resolveSidebarModel()` function MUST NOT modify registry items
   - Filtering creates NEW objects, never modifies existing ones
   - Use object spreading (`{ ...item }`) to create copies when filtering

3. **Why This Matters**
   - **Prevents side effects:** Multiple renders won't corrupt registry state
   - **Enables memoization:** Pure inputs → deterministic outputs → safe to cache
   - **Simplifies testing:** Test fixtures remain unchanged across test runs
   - **Thread-safe:** Registry can be safely shared across requests in SSR

**Correct Pattern (Creating New Objects):**

```typescript
// ✅ CORRECT: Create new objects when filtering
function filterItems(items: SidebarItem[]): SidebarItem[] {
  return items
    .map((item) => {
      // Create NEW object, don't modify original
      return {
        ...item,
        children: item.children ? filterItems(item.children) : undefined,
      };
    })
    .filter((item) => isItemVisible(item));
}
```

**Forbidden Pattern (Mutating Registry):**

```typescript
// ❌ WRONG: Mutating registry items
function filterItems(items: SidebarItem[]): SidebarItem[] {
  items.forEach((item) => {
    if (item.children) {
      item.children = filterItems(item.children); // ❌ Mutation!
    }
  });
  return items.filter((item) => isItemVisible(item));
}
```

**Acceptance Criteria:**

- [ ] Resolver implementation creates new objects (no mutations)
- [ ] Registry exports are never modified at runtime
- [ ] Tests verify resolver doesn't mutate input (deep equality check before/after)

### 1.3 Create Icon Key Mapping

**What:** Create a client-side utility that maps `iconKey` strings to lucide React components.

**File:** `src/lib/sidebar/v2/icon-map.ts`

```typescript
import {
  Home,
  Warehouse,
  Users,
  Settings,
  BarChart3,
  FileText,
  MessageSquare,
  Calendar,
  Package,
  MapPin,
  // ... add more as needed
} from "lucide-react";

/**
 * Icon key to lucide component mapping
 *
 * IMPORTANT: Only import this on client side.
 * Server uses iconKey strings only.
 */
export const ICON_MAP = {
  home: Home,
  warehouse: Warehouse,
  users: Users,
  settings: Settings,
  analytics: BarChart3,
  documentation: FileText,
  chat: MessageSquare,
  calendar: Calendar,
  products: Package,
  locations: MapPin,
  // Add more mappings as registry grows
} as const;

export type IconKey = keyof typeof ICON_MAP;

/**
 * Get icon component by key (client-side only)
 */
export function getIconComponent(key: string) {
  return ICON_MAP[key as IconKey] || Settings; // Fallback to Settings icon
}
```

**Why:** Keeps server-side model serializable while still using lucide icons on client.

**Acceptance Criteria:**

- [ ] All icon keys used in registry have mappings
- [ ] Fallback icon exists for unknown keys
- [ ] File has `"use client"` directive or is only imported in client components

**Gotchas:**

- Don't import this in server components or resolver
- Keep in sync with registry (add new icons when registry adds new items)

### 1.4 Write Contract Validation Tests

**What:** Test that types are correctly structured.

**File:** `src/lib/types/v2/__tests__/sidebar.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import type { SidebarModel, SidebarItem } from "../sidebar";

describe("Sidebar Contract Types", () => {
  it("should allow JSON serialization of complete model", () => {
    const model: SidebarModel = {
      main: [
        {
          id: "home",
          title: "Home",
          iconKey: "home",
          href: "/dashboard/start",
          match: { exact: "/dashboard/start" },
        },
      ],
      footer: [],
    };

    const serialized = JSON.stringify(model);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.main[0].id).toBe("home");
    expect(deserialized.main[0].iconKey).toBe("home");

    // Verify determinism: same model serializes to same JSON every time
    const serialized2 = JSON.stringify(model);
    expect(serialized).toBe(serialized2);
  });

  it("should support nested children", () => {
    const parent: SidebarItem = {
      id: "warehouse",
      title: "Warehouse",
      iconKey: "warehouse",
      children: [
        {
          id: "warehouse.products",
          title: "Products",
          iconKey: "products",
          href: "/dashboard/warehouse/products",
        },
      ],
    };

    expect(parent.children).toHaveLength(1);
    expect(parent.children![0].id).toBe("warehouse.products");
  });

  it("should support visibility rules", () => {
    const item: SidebarItem = {
      id: "billing",
      title: "Billing",
      iconKey: "settings",
      href: "/dashboard/organization/billing",
      visibility: {
        requiresPermissions: ["org.update"],
        requiresModules: ["organization-management"],
      },
    };

    expect(item.visibility?.requiresPermissions).toHaveLength(1);
    expect(item.visibility?.requiresModules).toContain("organization-management");
  });
});
```

**Acceptance Criteria:**

- [ ] Tests pass
- [ ] Coverage includes all major type paths (href, children, visibility, match, etc.)

---

## Phase 2: Pure Resolver (TDD First)

**IMPORTANT: Examples Must Use Constants**

All test examples in this phase show inline values for readability, but **actual implementation MUST use imported constants**:

```typescript
// ✅ CORRECT (actual implementation):
import { ORG_UPDATE, MEMBERS_READ } from "@/lib/constants/permissions";
import { MODULE_ANALYTICS, MODULE_WAREHOUSE } from "@/lib/constants/modules";

const item: SidebarItem = {
  visibility: {
    requiresPermissions: [ORG_UPDATE],
    requiresModules: [MODULE_ANALYTICS],
  },
};

// ❌ WRONG (forbidden in implementation):
const item: SidebarItem = {
  visibility: {
    requiresPermissions: ["org.update"], // Raw string - FORBIDDEN
    requiresModules: ["analytics"], // Raw string - FORBIDDEN
  },
};
```

The examples below use inline strings for documentation clarity only. When implementing (both registry and test files), **always import and use constants**.

### 2.1 Create Failing Tests

**What:** Write tests BEFORE implementing resolver. Tests define expected behavior.

**IMPORTANT NOTE ON PERMISSION/MODULE STRINGS IN TEST EXAMPLES:**

- The test examples below show **raw strings** (e.g., `'org.update'`, `'analytics'`) for **documentation readability only**
- **Actual test implementations** MUST use imported constants (e.g., `PERM_ORG_UPDATE`, `MODULE_ANALYTICS`) per the Constant Usage Policy (Phase 3.3)
- Both **registry** and **resolver tests** MUST import constants from `@/lib/constants/permissions.ts` and `@/lib/constants/modules.ts`
- Raw strings shown in this plan section are for illustrating resolver behavior, not for copy-paste into test code

**File:** `src/lib/sidebar/v2/__tests__/resolver.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { resolveSidebarModel } from "../resolver";
import type { SidebarResolverInput, SidebarItem } from "@/lib/types/v2/sidebar";

describe("resolveSidebarModel", () => {
  const baseInput: SidebarResolverInput = {
    locale: "en",
    permissionSnapshot: { allow: [], deny: [] },
    entitlements: {
      enabled_modules: [],
      enabled_contexts: [],
      features: {},
      limits: {},
    },
    context: {
      activeOrgId: "org-123",
      activeBranchId: null,
    },
  };

  const publicItem: SidebarItem = {
    id: "home",
    title: "Home",
    iconKey: "home",
    href: "/dashboard/start",
  };

  it("should show public items (no visibility rules)", () => {
    const registry = { main: [publicItem], footer: [] };
    const result = resolveSidebarModel(baseInput, registry);

    expect(result.main).toHaveLength(1);
    expect(result.main[0].id).toBe("home");
  });

  it("should hide item when requiresPermissions not satisfied (AND)", () => {
    const protectedItem: SidebarItem = {
      id: "billing",
      title: "Billing",
      iconKey: "settings",
      href: "/dashboard/organization/billing",
      visibility: {
        requiresPermissions: ["org.update"],
      },
    };

    const registry = { main: [protectedItem], footer: [] };

    // User does NOT have org.update
    const input = {
      ...baseInput,
      permissionSnapshot: { allow: ["org.read"], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0); // Hidden
  });

  it("should show item when ALL requiresPermissions satisfied (AND)", () => {
    const protectedItem: SidebarItem = {
      id: "billing",
      title: "Billing",
      iconKey: "settings",
      href: "/dashboard/organization/billing",
      visibility: {
        requiresPermissions: ["org.update"],
      },
    };

    const registry = { main: [protectedItem], footer: [] };

    // User has permission
    const input = {
      ...baseInput,
      permissionSnapshot: { allow: ["org.update"], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1); // Shown
  });

  it("should show item when ANY requiresAnyPermissions satisfied (OR)", () => {
    const item: SidebarItem = {
      id: "settings",
      title: "Settings",
      iconKey: "settings",
      href: "/dashboard/settings",
      visibility: {
        requiresAnyPermissions: ["org.update", "branches.update"],
      },
    };

    const registry = { main: [item], footer: [] };

    // User has only branches.update
    const input = {
      ...baseInput,
      permissionSnapshot: { allow: ["branches.update"], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1); // Shown
  });

  it("should hide item when NO requiresAnyPermissions satisfied (OR)", () => {
    const item: SidebarItem = {
      id: "settings",
      title: "Settings",
      iconKey: "settings",
      href: "/dashboard/settings",
      visibility: {
        requiresAnyPermissions: ["org.update", "branches.update"],
      },
    };

    const registry = { main: [item], footer: [] };

    // User has neither permission
    const input = {
      ...baseInput,
      permissionSnapshot: { allow: ["members.read"], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0); // Hidden
  });

  it("should hide module-gated item when module not enabled", () => {
    const analyticsItem: SidebarItem = {
      id: "analytics",
      title: "Analytics",
      iconKey: "analytics",
      href: "/dashboard/analytics",
      visibility: {
        requiresModules: ["analytics"],
      },
    };

    const registry = { main: [analyticsItem], footer: [] };

    // Org does NOT have analytics module
    const input = {
      ...baseInput,
      entitlements: {
        enabled_modules: ["home", "warehouse"],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0); // Hidden
  });

  it("should show module-gated item when module enabled", () => {
    const analyticsItem: SidebarItem = {
      id: "analytics",
      title: "Analytics",
      iconKey: "analytics",
      href: "/dashboard/analytics",
      visibility: {
        requiresModules: ["analytics"],
      },
    };

    const registry = { main: [analyticsItem], footer: [] };

    // Org HAS analytics module
    const input = {
      ...baseInput,
      entitlements: {
        enabled_modules: ["home", "warehouse", "analytics"],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1); // Shown
  });

  it("should fail-closed when entitlements null and item requires module", () => {
    const analyticsItem: SidebarItem = {
      id: "analytics",
      title: "Analytics",
      iconKey: "analytics",
      href: "/dashboard/analytics",
      visibility: {
        requiresModules: ["analytics"],
      },
    };

    const registry = { main: [analyticsItem], footer: [] };

    // Entitlements missing (null)
    const input = {
      ...baseInput,
      entitlements: null,
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0); // Hidden (fail-closed)
  });

  it("should hide parent group when all children hidden", () => {
    const warehouseGroup: SidebarItem = {
      id: "warehouse",
      title: "Warehouse",
      iconKey: "warehouse",
      children: [
        {
          id: "warehouse.products",
          title: "Products",
          iconKey: "products",
          href: "/dashboard/warehouse/products",
          visibility: {
            requiresModules: ["warehouse"],
          },
        },
      ],
    };

    const registry = { main: [warehouseGroup], footer: [] };

    // User has NO warehouse module
    const input = {
      ...baseInput,
      entitlements: {
        enabled_modules: ["home"],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0); // Parent hidden because all children hidden
  });

  it("should show parent group when at least one child visible", () => {
    const settingsGroup: SidebarItem = {
      id: "settings",
      title: "Settings",
      iconKey: "settings",
      children: [
        {
          id: "settings.general",
          title: "General",
          iconKey: "settings",
          href: "/dashboard/settings/general",
          // No visibility rules = always visible
        },
        {
          id: "settings.analytics",
          title: "Analytics Settings",
          iconKey: "analytics",
          href: "/dashboard/settings/analytics",
          visibility: {
            requiresModules: ["analytics"], // Premium module
          },
        },
      ],
    };

    const registry = { main: [settingsGroup], footer: [] };

    // User does NOT have analytics module (free plan)
    const input = {
      ...baseInput,
      entitlements: {
        enabled_modules: ["home", "warehouse", "teams"],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1); // Parent shown
    expect(result.main[0].children).toHaveLength(1); // Only general child
    expect(result.main[0].children![0].id).toBe("settings.general");
  });

  it("should use canonical permission matcher for wildcards", () => {
    const accountItem: SidebarItem = {
      id: "account",
      title: "Account",
      iconKey: "settings",
      href: "/dashboard/account/profile",
      visibility: {
        requiresPermissions: ["account.profile.read"],
      },
    };

    const registry = { main: [accountItem], footer: [] };

    // User has account.* wildcard (compiled permission)
    const input = {
      ...baseInput,
      permissionSnapshot: { allow: ["account.*"], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1); // Shown (wildcard matches)
  });

  it("should show item when ANY required module is enabled (OR logic)", () => {
    const dataItem: SidebarItem = {
      id: "data",
      title: "Data",
      iconKey: "database",
      href: "/dashboard/data",
      visibility: {
        requiresAnyModules: ["analytics", "development"],
      },
    };

    const registry = { main: [dataItem], footer: [] };

    // Test 1: User has analytics (one of two required)
    const input1 = {
      ...baseInput,
      entitlements: {
        enabled_modules: ["home", "analytics"], // Has one required module
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result1 = resolveSidebarModel(input1, registry);
    expect(result1.main).toHaveLength(1); // Shown (has analytics)

    // Test 2: User has development (other required module)
    const input2 = {
      ...baseInput,
      entitlements: {
        enabled_modules: ["home", "development"], // Has other required module
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result2 = resolveSidebarModel(input2, registry);
    expect(result2.main).toHaveLength(1); // Shown (has development)

    // Test 3: User has both modules
    const input3 = {
      ...baseInput,
      entitlements: {
        enabled_modules: ["home", "analytics", "development"], // Has both
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result3 = resolveSidebarModel(input3, registry);
    expect(result3.main).toHaveLength(1); // Shown (has both)

    // Test 4: User has neither module
    const input4 = {
      ...baseInput,
      entitlements: {
        enabled_modules: ["home", "warehouse"], // Has neither required module
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result4 = resolveSidebarModel(input4, registry);
    expect(result4.main).toHaveLength(0); // Hidden (has neither)
  });

  it("should fail-closed for requiresAnyModules when entitlements are null", () => {
    const dataItem: SidebarItem = {
      id: "data",
      title: "Data",
      iconKey: "database",
      href: "/dashboard/data",
      visibility: {
        requiresAnyModules: ["analytics", "development"],
      },
    };

    const registry = { main: [dataItem], footer: [] };

    // Entitlements snapshot is missing (null)
    const input = {
      ...baseInput,
      entitlements: null,
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0); // Hidden (fail-closed: cannot verify module access)
  });

  it("should respect deny permissions (deny-first semantics)", () => {
    const billingItem: SidebarItem = {
      id: "billing",
      title: "Billing",
      iconKey: "settings",
      href: "/dashboard/organization/billing",
      visibility: {
        requiresPermissions: ["org.update"],
      },
    };

    const registry = { main: [billingItem], footer: [] };

    // User has org.update allowed but explicitly denied
    const input = {
      ...baseInput,
      permissionSnapshot: { allow: ["org.update"], deny: ["org.update"] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0); // Hidden (deny wins)
  });

  it("should fail-closed when permissionSnapshot.allow is empty", () => {
    const settingsItem: SidebarItem = {
      id: "settings",
      title: "Settings",
      iconKey: "settings",
      href: "/dashboard/organization/settings",
      visibility: {
        requiresPermissions: ["org.update"],
      },
    };

    const registry = { main: [settingsItem], footer: [] };

    // permissionSnapshot is non-nullable but has empty allow array (default state)
    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0); // Hidden (fail-closed: no permissions granted)
  });

  it("should be 100% deterministic (same inputs → identical outputs)", () => {
    const registry = {
      main: [
        {
          id: "home",
          title: "Home",
          iconKey: "home",
          href: "/dashboard/start",
        },
        {
          id: "warehouse",
          title: "Warehouse",
          iconKey: "warehouse",
          children: [
            {
              id: "warehouse.products",
              title: "Products",
              iconKey: "products",
              href: "/dashboard/warehouse/products",
            },
          ],
        },
      ],
      footer: [],
    };

    const input = {
      ...baseInput,
      permissionSnapshot: { allow: ["org.read"], deny: [] },
      entitlements: {
        enabled_modules: ["home", "warehouse"],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    // Call resolver multiple times
    const result1 = resolveSidebarModel(input, registry);
    const result2 = resolveSidebarModel(input, registry);
    const result3 = resolveSidebarModel(input, registry);

    // All results must be deeply equal (no timestamps, no randomness)
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);

    // Serialized JSON must be identical byte-for-byte
    const json1 = JSON.stringify(result1);
    const json2 = JSON.stringify(result2);
    const json3 = JSON.stringify(result3);

    expect(json1).toBe(json2);
    expect(json2).toBe(json3);

    // Verify no timestamp fields exist
    expect(JSON.stringify(result1)).not.toMatch(/generatedAt/);
    expect(JSON.stringify(result1)).not.toMatch(/timestamp/);
    expect(JSON.stringify(result1)).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO date pattern
  });
});
```

**Why TDD:**

- Tests define behavior before implementation
- Prevents scope creep (only implement what tests require)
- Regression safety when refactoring
- Documents expected behavior for future maintainers

**Acceptance Criteria:**

- [ ] All tests written
- [ ] All tests initially FAIL (resolver not implemented yet)
- [ ] Tests cover all visibility rule combinations
- [ ] Tests cover wildcard permissions and deny semantics
- [ ] Tests cover nested group pruning
- [ ] **PERMISSION FAIL-CLOSED TEST:** Resolver MUST fail-closed when `permissionSnapshot.allow` is empty; permission-gated items must not render
- [ ] **DETERMINISM TEST:** Resolver called 3x with same inputs produces identical JSON output (no timestamps)

**Gotchas:**

- Don't implement resolver yet — tests should fail at this stage
- Make sure tests use canonical permission matcher (not just `includes()`)
- **CRITICAL:** Do NOT add `generatedAt` or any timestamp field to model — breaks determinism

### 2.2 Implement `resolveSidebarModel()`

**What:** Implement the resolver to make all tests pass.

**File:** `src/lib/sidebar/v2/resolver.ts`

```typescript
import type {
  SidebarResolverInput,
  SidebarModel,
  SidebarItem,
  SidebarVisibilityRules,
} from "@/lib/types/v2/sidebar";
import { checkPermission } from "@/lib/utils/permissions";

/**
 * Check if item should be visible based on visibility rules
 */
function isItemVisible(item: SidebarItem, input: SidebarResolverInput): boolean {
  if (!item.visibility) {
    return true; // Public item
  }

  const { visibility } = item;
  const { permissionSnapshot, entitlements } = input;

  // Check requiresPermissions (AND logic)
  if (visibility.requiresPermissions && visibility.requiresPermissions.length > 0) {
    const hasAllPermissions = visibility.requiresPermissions.every((permission) =>
      checkPermission(permissionSnapshot, permission)
    );
    if (!hasAllPermissions) {
      return false;
    }
  }

  // Check requiresAnyPermissions (OR logic)
  if (visibility.requiresAnyPermissions && visibility.requiresAnyPermissions.length > 0) {
    const hasAnyPermission = visibility.requiresAnyPermissions.some((permission) =>
      checkPermission(permissionSnapshot, permission)
    );
    if (!hasAnyPermission) {
      return false;
    }
  }

  // Check requiresModules (AND logic) — fail-closed if entitlements null
  if (visibility.requiresModules && visibility.requiresModules.length > 0) {
    if (!entitlements) {
      return false; // Fail-closed
    }
    const hasAllModules = visibility.requiresModules.every((module) =>
      entitlements.enabled_modules.includes(module)
    );
    if (!hasAllModules) {
      return false;
    }
  }

  // Check requiresAnyModules (OR logic) — fail-closed if entitlements null
  if (visibility.requiresAnyModules && visibility.requiresAnyModules.length > 0) {
    if (!entitlements) {
      return false; // Fail-closed
    }
    const hasAnyModule = visibility.requiresAnyModules.some((module) =>
      entitlements.enabled_modules.includes(module)
    );
    if (!hasAnyModule) {
      return false;
    }
  }

  return true;
}

/**
 * Filter sidebar items recursively
 *
 * IMPORTANT: This function ONLY handles VISIBILITY.
 * It does NOT compute active state (that's client-side, using router pathname).
 */
function filterItems(items: SidebarItem[], input: SidebarResolverInput): SidebarItem[] {
  return items
    .map((item) => {
      // Filter children first (if any)
      let filteredChildren: SidebarItem[] | undefined;
      if (item.children && item.children.length > 0) {
        filteredChildren = filterItems(item.children, input);
      }

      // Check visibility (permissions + entitlements)
      const visible = isItemVisible(item, input);
      if (!visible) {
        return null; // Hide item
      }

      // If parent has children, hide parent if all children hidden
      if (item.children && (!filteredChildren || filteredChildren.length === 0)) {
        return null; // Hide empty parent
      }

      // Return filtered item with children (NO active state)
      return {
        ...item,
        children: filteredChildren,
      };
    })
    .filter((item): item is SidebarItem => item !== null);
}

/**
 * Resolve sidebar model from registry and input
 *
 * This is a PURE, DETERMINISTIC function:
 * - No side effects (no DB, no API, no filesystem)
 * - Same inputs → IDENTICAL output (every single time)
 * - No timestamps, no random values, no Date.now()
 * - No reading from process.env or global state
 *
 * CRITICAL: Determinism is REQUIRED for:
 * - Snapshot testing (tests must not fail on timestamp changes)
 * - Memoization (React useMemo must see stable data)
 * - SSR hydration (server and client must produce identical output)
 * - Debugging (comparing two models must be meaningful)
 */
export function resolveSidebarModel(
  input: SidebarResolverInput,
  registry: Pick<SidebarModel, "main" | "footer">
): SidebarModel {
  const main = filterItems(registry.main || [], input);
  const footer = filterItems(registry.footer || [], input);

  // IMPORTANT: Return ONLY filtered items.
  // No timestamps, no metadata, no debug info.
  // The model must be 100% deterministic.
  return {
    main,
    footer,
  };
}
```

**Why:**

- Uses canonical `checkPermission()` from `src/lib/utils/permissions.ts` (wildcards + deny semantics)
- Fail-closed on entitlements (null → hide module-gated items)
- **100% deterministic** (no timestamps, no side effects) — enables snapshot testing and memoization
- Recursive filtering handles nested groups
- Prunes empty parent groups automatically

**Acceptance Criteria:**

- [ ] All tests from 2.1 now PASS
- [ ] Resolver uses `checkPermission()` utility (no custom permission logic)
- [ ] **FAIL-CLOSED:** Entitlements null → hide items with `requiresModules` or `requiresAnyModules`
- [ ] Empty parent groups are removed
- [ ] **DETERMINISM VERIFIED:** `resolveSidebarModel(input, registry)` called twice with same inputs produces `deepEqual()` outputs
- [ ] **NO TIMESTAMPS:** Model contains no `Date`, `Date.now()`, or ISO strings
- [ ] **NO ACTIVE STATE:** Resolver does NOT compute `isActive` or read `pathname`
- [ ] **VISIBILITY ONLY:** Resolver concerns are permissions + entitlements, nothing else

### 2.2.1 Fail-Closed Behavior Matrix

**CRITICAL:** The resolver MUST fail-closed (hide items) when authoritative data is empty or absent. This prevents accidental exposure of features.

**V2 Contract:**

- `permissionSnapshot` is **non-nullable** — type is `{ allow: string[]; deny: string[] }`, always present, defaults to `{ allow: [], deny: [] }`. It is never null or undefined under the V2 contract. Fail-closed condition for permissions is `allow.length === 0`.
- `entitlements` **IS nullable** — type is `OrganizationEntitlements | null`. Null when org has no subscription data. Fail-closed condition for modules is `entitlements === null`.

**Behavior Matrix:**

| Condition                                   | Item Has                                              | Behavior                      | Rationale                                        |
| ------------------------------------------- | ----------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| **Entitlements is null**                    | `requiresModules: ['analytics']`                      | **HIDE**                      | Cannot verify module access without entitlements |
| **Entitlements is null**                    | `requiresAnyModules: ['analytics', 'development']`    | **HIDE**                      | Cannot verify module access without entitlements |
| **Entitlements exists**                     | `requiresModules: ['analytics']`                      | Check `enabled_modules` array | Normal module gating                             |
| **Permission snapshot empty** (`allow: []`) | `requiresPermissions: [ORG_UPDATE]`                   | **HIDE**                      | No permissions granted — fail-closed             |
| **Permission snapshot empty** (`allow: []`) | `requiresAnyPermissions: [ORG_UPDATE, BRANCH_UPDATE]` | **HIDE**                      | No permissions granted — fail-closed             |
| **Both present**                            | Both permission + module rules                        | **AND** all conditions        | Must satisfy ALL rule types                      |
| **No visibility rules**                     | No `requiresPermissions`, no `requiresModules`        | **SHOW**                      | Public item (e.g., Home)                         |

**Combined Rule Behavior:**

When an item has BOTH permission and module requirements:

```typescript
{
  requiresPermissions: [ORG_UPDATE],
  requiresModules: [MODULE_ANALYTICS]
}
```

**Evaluation order:**

1. Check permissions → If fail, **HIDE**
2. Check modules → If fail, **HIDE**
3. If BOTH pass → **SHOW**

**Result:** Item is visible ONLY if user has `ORG_UPDATE` **AND** org has `MODULE_ANALYTICS` enabled.

**Empty / Null Safety:**

| Input State                                                                            | Visibility Behavior                                 |
| -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `entitlements = null` + item has `requiresModules`                                     | **HIDE** (fail-closed: cannot verify module access) |
| `entitlements = null` + item has NO module rules                                       | Check permissions only                              |
| `permissionSnapshot.allow = []` (empty, non-nullable) + item has `requiresPermissions` | **HIDE** (fail-closed: no permissions granted)      |
| `permissionSnapshot.allow = []` (empty, non-nullable) + item has NO permission rules   | **SHOW** if module rules also pass                  |

> **Note:** `permissionSnapshot` is never null under V2 contract. If a defensive check is added, it should log a warning stating "this should never occur under V2 contract" and fail-closed.

**Acceptance Criteria:**

- [ ] Fail-closed behavior explicitly tested for null entitlements
- [ ] Fail-closed behavior explicitly tested for empty permission snapshot (`{ allow: [], deny: [] }`)
- [ ] Combined rules (permissions + modules) tested with AND semantics
- [ ] Public items (no visibility rules) always visible

---

## Phase 3: Nav Registry (Data Only)

### 3.0 Create Centralized Permission Slug Constants

**What:** Create a centralized constants file for permission slugs used in navigation.

**CRITICAL REQUIREMENT:** This file contains ONLY the 20 canonical permission slugs from the database. NO warehouse-specific permissions (those don't exist yet).

**File:** `src/lib/constants/permissions.ts`

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
 *
 * Expected Count: 20 permissions
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

**Why This Matters:**

- If a permission slug changes in the database but code still references the old string, navigation silently breaks
- Centralized constants + imports make this a type error (import fails if constant doesn't exist)
- Prevents typos and ensures consistency across the codebase
- Single source of truth for permission slug references

**CRITICAL NOTE ON WAREHOUSE PERMISSIONS:**
These permissions do NOT exist in the database yet and MUST NOT be included:

- ❌ `warehouse.products.read` (future work)
- ❌ `warehouse.products.create` (future work)
- ❌ `warehouse.locations.read` (future work)
- ❌ `warehouse.inventory.read` (future work)

**Warehouse fine-grained permissions are a SEPARATE PROJECT requiring:**

1. Database migration to add permission rows
2. Compiler updates to assign permissions to roles
3. RLS policy updates to use new permissions
4. Module config updates

**For now, warehouse nav items should use module gating only:**

```typescript
{
  id: 'warehouse',
  visibility: {
    requiresModules: [MODULE_WAREHOUSE], // ✅ Use module, not permission
  }
}
```

**Acceptance Criteria:**

- [ ] File contains exactly 20 permission constants (matches database)
- [ ] NO warehouse-specific permissions included
- [ ] All constants use `as const` type assertion
- [ ] Type union `PermissionSlug` includes all constants
- [ ] Helper array `ALL_PERMISSION_SLUGS` contains all 20 permissions

### 3.0.1 Create Centralized Module Slug Constants

**What:** Create a centralized constants file for module slugs used in navigation.

**File:** `src/lib/constants/modules.ts`

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

// Admin Module (Not in any plan - superadmin only)
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
```

**Acceptance Criteria:**

- [ ] File contains all 11 module constants (matches database + admin)
- [ ] All constants use `as const` type assertion
- [ ] Type union `ModuleSlug` includes all constants
- [ ] Helper arrays (FREE_PLAN_MODULES, PREMIUM_MODULES, CORE_MODULES) defined

### 3.1 Create `src/lib/sidebar/v2/registry.ts`

**What:** Define the sidebar nav catalog as pure data using centralized permission and module constants.

**CRITICAL REQUIREMENTS:**

- The registry MUST import permission slugs from `src/lib/constants/permissions.ts`
- The registry MUST import module slugs from `src/lib/constants/modules.ts`
- Raw permission/module strings are NOT allowed (enforced by tests)
- Warehouse items use MODULE_WAREHOUSE for gating (NOT non-existent warehouse.\*.read permissions)

**File:** `src/lib/sidebar/v2/registry.ts`

```typescript
import type { SidebarItem } from "@/lib/types/v2/sidebar";
import {
  ACCOUNT_PROFILE_READ,
  ACCOUNT_PREFERENCES_READ,
  ORG_READ,
  ORG_UPDATE,
  MEMBERS_READ,
} from "@/lib/constants/permissions";
import {
  MODULE_HOME,
  MODULE_WAREHOUSE,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_ANALYTICS,
  MODULE_DEVELOPMENT,
  MODULE_SUPPORT,
} from "@/lib/constants/modules";

/**
 * Sidebar V2 Registry
 *
 * Pure data catalog of all sidebar navigation items.
 * NO hooks, NO permission checks, NO React components.
 *
 * IMPORTANT:
 * - All permission slugs MUST be imported from @/lib/constants/permissions
 * - All module slugs MUST be imported from @/lib/constants/modules
 * - Raw strings are NOT allowed (enforced by tests)
 *
 * NOTE ON WAREHOUSE PERMISSIONS:
 * Warehouse does NOT have fine-grained permissions in database yet.
 * Use module gating (MODULE_WAREHOUSE) instead of permissions for now.
 * Fine-grained warehouse permissions are future work (separate project).
 *
 * Version: 1.0.0
 */

/**
 * Main navigation sections
 */
export const MAIN_NAV_ITEMS: SidebarItem[] = [
  // Home
  {
    id: "home",
    title: "Home",
    iconKey: "home",
    href: "/dashboard/start",
    match: { exact: "/dashboard/start" },
  },

  // Warehouse (module-gated only, no fine-grained permissions yet)
  {
    id: "warehouse",
    title: "Warehouse",
    iconKey: "warehouse",
    href: "/dashboard/warehouse",
    match: { startsWith: "/dashboard/warehouse" },
    visibility: {
      requiresModules: [MODULE_WAREHOUSE],
    },
  },

  // Organization Management
  {
    id: "organization",
    title: "Organization",
    iconKey: "users",
    visibility: {
      requiresModules: [MODULE_ORGANIZATION_MANAGEMENT],
    },
    children: [
      {
        id: "organization.profile",
        title: "Profile",
        iconKey: "settings",
        href: "/dashboard/organization/profile",
        match: { exact: "/dashboard/organization/profile" },
        visibility: {
          requiresPermissions: [ORG_READ],
        },
      },
      {
        id: "organization.users",
        title: "Users",
        iconKey: "users",
        href: "/dashboard/organization/users",
        match: { startsWith: "/dashboard/organization/users" },
        visibility: {
          requiresPermissions: [MEMBERS_READ],
        },
      },
      {
        id: "organization.billing",
        title: "Billing",
        iconKey: "settings",
        href: "/dashboard/organization/billing",
        match: { exact: "/dashboard/organization/billing" },
        visibility: {
          requiresPermissions: [ORG_UPDATE], // Only owners see billing
        },
      },
    ],
  },

  // Analytics (Premium)
  {
    id: "analytics",
    title: "Analytics",
    iconKey: "analytics",
    href: "/dashboard/analytics",
    match: { startsWith: "/dashboard/analytics" },
    visibility: {
      requiresModules: [MODULE_ANALYTICS],
    },
  },

  // Development (Premium)
  {
    id: "development",
    title: "Development",
    iconKey: "settings",
    href: "/dashboard/development",
    match: { startsWith: "/dashboard/development" },
    visibility: {
      requiresModules: [MODULE_DEVELOPMENT],
    },
  },
];

/**
 * Footer navigation (settings, help, etc.)
 */
export const FOOTER_NAV_ITEMS: SidebarItem[] = [
  {
    id: "account",
    title: "Account",
    iconKey: "settings",
    children: [
      {
        id: "account.profile",
        title: "Profile",
        iconKey: "settings",
        href: "/dashboard/account/profile",
        match: { exact: "/dashboard/account/profile" },
        visibility: {
          requiresPermissions: [ACCOUNT_PROFILE_READ],
        },
      },
      {
        id: "account.preferences",
        title: "Preferences",
        iconKey: "settings",
        href: "/dashboard/account/preferences",
        match: { exact: "/dashboard/account/preferences" },
        visibility: {
          requiresPermissions: [ACCOUNT_PREFERENCES_READ],
        },
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    iconKey: "documentation",
    href: "/dashboard/support",
    match: { startsWith: "/dashboard/support" },
    visibility: {
      requiresModules: [MODULE_SUPPORT],
    },
  },
];

/**
 * Get full sidebar registry
 */
export function getSidebarRegistry() {
  return {
    main: MAIN_NAV_ITEMS,
    footer: FOOTER_NAV_ITEMS,
  };
}
```

**Why:**

- Pure data (no functions, no React, no hooks)
- Versioned (can track changes over time)
- Deterministic (same registry every time)
- Extensible (easy to add new sections)
- Centralizes all nav structure in one place
- Uses module gating for warehouse (no fine-grained permissions yet)

**Acceptance Criteria:**

- [ ] Registry exports pure data only
- [ ] All items use `iconKey` strings (no React components)
- [ ] All permission slugs imported from centralized constants (no raw strings in registry file)
- [ ] All module slugs imported from centralized constants (no raw strings in registry file)
- [ ] Warehouse items use MODULE_WAREHOUSE for gating (NOT non-existent warehouse.\*.read)
- [ ] Test verifies no raw permission strings exist in registry
- [ ] Test verifies no raw module strings exist in registry

### 3.2 Define Core Sections

**What:** Registry above already defines core sections. Document the structure.

**Core Sections:**

1. **Home** — Single item, always visible
2. **Warehouse** — Single item, module-gated (uses MODULE_WAREHOUSE, not fine-grained permissions)
3. **Organization** — Group, module-gated, permission-gated children
4. **Analytics** — Single item, module-gated (premium)
5. **Development** — Single item, module-gated (premium)
6. **Account** (footer) — Group with profile, preferences children
7. **Support** (footer) — Single item, module-gated

**Future Extensions:**

- Teams module
- Contacts module
- Warehouse sub-items with fine-grained permissions (separate project)
- Custom org-specific items (from `userModules` in context)

**Acceptance Criteria:**

- [ ] All core sections documented
- [ ] Structure supports adding new sections without breaking resolver

### 3.3 Write Registry Structure Tests

> **Constant Usage Policy**
>
> 1. **Registry** MUST use imported constants — no raw strings (e.g., `PERM_ORG_UPDATE`, not `'org.update'`)
> 2. **Resolver tests** MUST use imported constants — no raw strings (e.g., `PERM_ORG_UPDATE`, not `'org.update'`)
> 3. No `permission: "some.string"` in examples — always `PERM_SOMETHING` (imported from `@/lib/constants/permissions`)
> 4. No `module: "warehouse"` in examples — always `MODULE_WAREHOUSE` (imported from `@/lib/constants/modules`)

**What:** Test that registry is well-formed and uses imported constants.

**File:** `src/lib/sidebar/v2/__tests__/registry.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { getSidebarRegistry, MAIN_NAV_ITEMS, FOOTER_NAV_ITEMS } from "../registry";

describe("Sidebar Registry", () => {
  it("should return main and footer sections", () => {
    const registry = getSidebarRegistry();

    expect(registry.main).toBeDefined();
    expect(registry.footer).toBeDefined();
    expect(registry.main.length).toBeGreaterThan(0);
  });

  it("should have unique IDs for all items", () => {
    const registry = getSidebarRegistry();
    const allItems = [...registry.main, ...registry.footer];

    function collectIds(items: any[]): string[] {
      return items.flatMap((item) => [
        item.id,
        ...(item.children ? collectIds(item.children) : []),
      ]);
    }

    const ids = collectIds(allItems);
    const uniqueIds = new Set(ids);

    expect(ids.length).toBe(uniqueIds.size); // No duplicates
  });

  it("should use iconKey strings (not React components)", () => {
    const registry = getSidebarRegistry();
    const allItems = [...registry.main, ...registry.footer];

    function checkIconKeys(items: any[]): void {
      items.forEach((item) => {
        expect(typeof item.iconKey).toBe("string");
        if (item.children) {
          checkIconKeys(item.children);
        }
      });
    }

    checkIconKeys(allItems);
  });

  it("should have valid permission slugs in visibility rules", () => {
    const registry = getSidebarRegistry();
    const allItems = [...registry.main, ...registry.footer];

    function checkPermissions(items: any[]): void {
      items.forEach((item) => {
        if (item.visibility?.requiresPermissions) {
          expect(Array.isArray(item.visibility.requiresPermissions)).toBe(true);
          item.visibility.requiresPermissions.forEach((perm: string) => {
            expect(typeof perm).toBe("string");
            expect(perm.length).toBeGreaterThan(0);
          });
        }
        if (item.children) {
          checkPermissions(item.children);
        }
      });
    }

    checkPermissions(allItems);
  });

  it("should use imported permission constants (no raw strings in registry file)", async () => {
    // CRITICAL: This test prevents silent breakage when permission slugs change in the database
    const path = await import("path");
    const fs = await import("fs/promises");
    const registryFilePath = path.resolve(process.cwd(), "src/lib/sidebar/v2/registry.ts");
    const registrySource = await fs.readFile(registryFilePath, "utf-8");

    // Check that constants are imported
    expect(registrySource).toMatch(/import.*from.*['"]@\/lib\/constants\/permissions['"]/);

    // Verify no raw permission strings in visibility rules (covers both requiresPermissions and requiresAnyPermissions)
    const rawPermissionStringPattern = /requires(?:Any)?Permissions:\s*\[\s*['"][a-z._]+['"]/;
    const hasRawStrings = rawPermissionStringPattern.test(registrySource);

    if (hasRawStrings) {
      const matches = registrySource.match(rawPermissionStringPattern);
      throw new Error(
        `Registry file contains raw permission strings in requiresPermissions or requiresAnyPermissions. Use imported constants instead.\n` +
          `Found: ${matches?.[0]}\n` +
          `Import permission constants from @/lib/constants/permissions`
      );
    }

    expect(hasRawStrings).toBe(false);
  });

  it("should use imported module constants (no raw strings in registry file)", async () => {
    // CRITICAL: This test prevents silent breakage when module slugs change in entitlements
    const path = await import("path");
    const fs = await import("fs/promises");
    const registryFilePath = path.resolve(process.cwd(), "src/lib/sidebar/v2/registry.ts");
    const registrySource = await fs.readFile(registryFilePath, "utf-8");

    // Check that constants are imported
    expect(registrySource).toMatch(/import.*from.*['"]@\/lib\/constants\/modules['"]/);

    // Verify no raw module strings in visibility rules (covers both requiresModules and requiresAnyModules)
    const rawModuleStringPattern = /requires(?:Any)?Modules:\s*\[\s*['"][a-z-]+['"]/;
    const hasRawStrings = rawModuleStringPattern.test(registrySource);

    if (hasRawStrings) {
      const matches = registrySource.match(rawModuleStringPattern);
      throw new Error(
        `Registry file contains raw module strings in requiresModules or requiresAnyModules. Use imported constants instead.\n` +
          `Found: ${matches?.[0]}\n` +
          `Import module constants from @/lib/constants/modules`
      );
    }

    expect(hasRawStrings).toBe(false);
  });
});
```

**Acceptance Criteria:**

- [ ] Tests pass
- [ ] All IDs are unique
- [ ] All iconKeys are strings
- [ ] All permission/module slugs are valid strings
- [ ] No raw permission strings in registry file (enforced by test)
- [ ] No raw module strings in registry file (enforced by test)

### 3.4 Verify Registry is Deterministic and Pure

**What:** Ensure registry function always returns same structure.

```typescript
it("should be deterministic (same output every call)", () => {
  const registry1 = getSidebarRegistry();
  const registry2 = getSidebarRegistry();

  expect(JSON.stringify(registry1)).toBe(JSON.stringify(registry2));
});
```

**Acceptance Criteria:**

- [ ] Registry is pure (no side effects)
- [ ] Same output on every call
- [ ] Can be serialized to JSON without loss

---

## Phase 4-8: [Content continues...]

Due to length constraints, I'll provide the rest in a follow-up. The updated plan now includes:

1. ✅ Progress Tracker at top
2. ✅ Guardrails section forbidding dangerous changes
3. ✅ SSR Data Availability section explaining context sources
4. ✅ Fixed Permission Constants to use ONLY 20 canonical slugs
5. ✅ Fixed Module Constants
6. ✅ Fixed Registry to use MODULE_WAREHOUSE for gating (not non-existent warehouse permissions)
7. ✅ Added enforcement tests for no raw strings

Would you like me to continue with Phases 4-8 plus the Results, Changelog, and Quality Checklist sections?

## Phase 4: SSR Assembly in Dashboard V2 Layout

**⚠️ DO NOT CHANGE AUTH REDIRECT SEMANTICS.** The existing layout uses `redirect({ href: "/sign-in", locale })`. Sidebar V2 work adds entitlements loading and sidebar model computation ONLY. Auth redirect paths, locale handling, and guard logic MUST remain exactly as they are today.

### 4.1 Load Entitlements Server-Side

**What:** Load organization entitlements in server layout to pass to resolver.

**Where Entitlements Come From:**

- **Source:** `organization_entitlements` table (compiled by entitlement triggers)
- **Service:** `EntitlementsService.loadEntitlements(orgId)`
- **Returns:** `OrganizationEntitlements | null` with `enabled_modules` array

**File:** `src/app/[locale]/dashboard/layout.tsx`

**Changes:**

```typescript
import { EntitlementsService } from "@/server/services/entitlements-service";
// ... existing imports

export default async function DashboardV2Layout({ children, params }: Props) {
  const { locale } = await params;

  // Existing V2 context loading
  const dashboardContext = await loadDashboardContextV2();

  if (!dashboardContext) {
    redirect({ href: "/sign-in", locale }); // ← Existing redirect, DO NOT CHANGE
  }

  const { app: appContext, user: userContext } = dashboardContext;

  // NEW: Load entitlements for sidebar (SSR only)
  let entitlements = null;
  if (appContext.activeOrgId) {
    entitlements = await EntitlementsService.loadEntitlements(appContext.activeOrgId);
  }

  // ... rest of existing layout
}
```

**Why:**

- Entitlements needed for module-gated items (`requiresModules` checks)
- Loaded server-side only for sidebar (not expanding V2 store scope)
- Null-safe (fail-closed if org has no entitlements)

**Data Flow:**

```
organization_entitlements table
  ↓ (compiled by triggers from subscription_plans)
EntitlementsService.loadEntitlements(orgId)
  ↓ returns { enabled_modules: string[], ... }
Passed to buildSidebarModel()
  ↓ used in resolver for requiresModules checks
SidebarModel with filtered items
```

**Acceptance Criteria:**

- [ ] Entitlements loaded server-side
- [ ] Org ID validated before loading
- [ ] Handles null entitlements gracefully (fail-closed)
- [ ] No entitlements added to V2 store (sidebar-only scope)

**Gotchas:**

- Don't add entitlements to V2 store yet (keep scope tight)
- Use `EntitlementsService.loadEntitlements()` not direct DB query

### 4.2 Create Server Helper `buildSidebarModel()`

**What:** Server-side function that builds sidebar model.

**File:** `src/server/sidebar/build-sidebar-model.ts`

```typescript
import { cache } from "react";
import { resolveSidebarModel } from "@/lib/sidebar/v2/resolver";
import { getSidebarRegistry } from "@/lib/sidebar/v2/registry";
import type { SidebarResolverInput, SidebarModel } from "@/lib/types/v2/sidebar";
import type { AppContextV2 } from "@/lib/stores/v2/app-store";
import type { UserContextV2 } from "@/lib/stores/v2/user-store";
import type { OrganizationEntitlements } from "@/lib/types/entitlements";

/**
 * Build sidebar model server-side
 *
 * IMPORTANT: This function computes VISIBILITY only (permissions + entitlements).
 * It does NOT compute active state (that's client-side, using router pathname).
 * It does NOT read request headers or routing state.
 *
 * Server concerns: What can user SEE?
 * Client concerns: What is user VIEWING?
 */
function _buildSidebarModel(
  appContext: AppContextV2,
  userContext: UserContextV2,
  entitlements: OrganizationEntitlements | null,
  locale: string
): SidebarModel {
  // Build resolver input (NO pathname, NO routing state)
  const input: SidebarResolverInput = {
    locale,
    permissionSnapshot: userContext.permissionSnapshot,
    entitlements,
    context: {
      activeOrgId: appContext.activeOrgId,
      activeBranchId: appContext.activeBranchId,
      userModules: appContext.userModules,
    },
  };

  // Get registry
  const registry = getSidebarRegistry();

  // Resolve model (pure function, deterministic)
  return resolveSidebarModel(input, registry);
}

/**
 * Build sidebar model server-side (cached within RSC render execution context)
 *
 * This is the SSR entry point for sidebar generation.
 * Returns pre-filtered model based on permissions + entitlements.
 *
 * Safe because: no global mutable state, no cross-user leakage,
 * no cross-request persistence guarantee,
 * deterministic input → deterministic output.
 */
export const buildSidebarModel = cache(_buildSidebarModel);
```

**Why:**

- **Cached within RSC render execution context** — same model reused if called multiple times during a single server render pass. No global state, no cross-user leakage, no cross-request persistence guarantee.
- **No coupling to routing** (doesn't read headers, doesn't know about pathname)
- **Separation of concerns:** Visibility (server) vs. active highlighting (client)
- **Deterministic:** Same user + same org → same model (every time)

**Acceptance Criteria:**

- [ ] Function is cached with React `cache()`
- [ ] **Does NOT import `headers` from Next.js**
- [ ] **Does NOT read pathname or routing state**
- [ ] **Function is synchronous** (all inputs provided as params)
- [ ] Calls resolver with all required inputs
- [ ] Returns SidebarModel

**Gotchas:**

- `cache()` is scoped to the RSC render execution context (not global, not cross-request, no cross-request persistence guarantee)
- Don't read headers or pathname (active state is client-side)

### 4.3 Compute `sidebarModel` in Layout

**What:** Call `buildSidebarModel()` in layout and pass result to client.

**File:** `src/app/[locale]/dashboard/layout.tsx`

```typescript
import { buildSidebarModel } from '@/server/sidebar/build-sidebar-model';

export default async function DashboardV2Layout({ children, params }: Props) {
  const { locale } = await params;

  const dashboardContext = await loadDashboardContextV2();

  if (!dashboardContext) {
    redirect({ href: "/sign-in", locale }); // ← Existing redirect, DO NOT CHANGE
  }

  const { app: appContext, user: userContext } = dashboardContext;

  // Load entitlements
  let entitlements = null;
  if (appContext.activeOrgId) {
    entitlements = await EntitlementsService.loadEntitlements(appContext.activeOrgId);
  }

  // NEW: Build sidebar model server-side
  const sidebarModel = buildSidebarModel(
    appContext,
    userContext,
    entitlements,
    locale
  );

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <DashboardV2Providers
          initialAppContext={appContext}
          initialUserContext={userContext}
        >
          <DashboardShell sidebarModel={sidebarModel}>
            {children}
          </DashboardShell>
        </DashboardV2Providers>
      </body>
    </html>
  );
}
```

**Why:**

- Model computed on server with all required data
- Client receives pre-filtered model (no flicker)
- SSR-consistent (same model on server and initial client render)

**Acceptance Criteria:**

- [ ] `sidebarModel` computed before rendering
- [ ] Model passed to `DashboardShell` as prop
- [ ] No permission/entitlement checks on client

**Gotchas:**

- Ensure `DashboardShell` accepts `sidebarModel` prop (update in next phase)
- This snippet mirrors the actual V2 layout (`loadDashboardContextV2`, `redirect({ href: "/sign-in", locale })`, next-intl locale). Do NOT change these patterns — only ADD sidebar model computation.
- Don't serialize functions or React components in model

### 4.4 Pass Model to DashboardShell

**What:** Update `DashboardShell` to accept and forward `sidebarModel`.

**File:** `src/app/[locale]/dashboard/_components/dashboard-shell.tsx`

```typescript
'use client';

import type { SidebarModel } from '@/lib/types/v2/sidebar';
import { useUiStoreV2 } from '@/lib/stores/v2/ui-store';

interface DashboardShellProps {
  children: React.ReactNode;
  sidebarModel: SidebarModel;
}

export function DashboardShell({ children, sidebarModel }: DashboardShellProps) {
  const sidebarCollapsed = useUiStoreV2((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUiStoreV2((state) => state.setSidebarCollapsed);
  const hasHydrated = useUiStoreV2((state) => state._hasHydrated);

  // CRITICAL: SSR and initial client render use DEFAULT (open)
  // After hydration, switch to persisted state
  const isOpen = hasHydrated ? !sidebarCollapsed : true;

  return (
    // SINGLE SidebarProvider for the entire dashboard — never duplicated in child components
    <SidebarProvider open={isOpen} onOpenChange={(open) => setSidebarCollapsed(!open)}>
      <AppSidebarV2 model={sidebarModel} />
      <SidebarInset>
        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

**Why:**

- **Single SidebarProvider** — only here, NEVER in `AppSidebarV2` (prevents shadcn/ui state conflicts)
- Props drilling is simple and explicit for this case
- Collapse state managed via `useUiStoreV2` with hydration safety

**Acceptance Criteria:**

- [ ] `DashboardShell` accepts `sidebarModel` prop
- [ ] Model passed to `AppSidebarV2` component
- [ ] TypeScript types correct

### 4.5 Verify No Hydration Mismatch

**What:** Ensure SSR and initial client render produce byte-for-byte identical markup.

**Why Hydration Stability Matters:**

- React compares server HTML with initial client render
- Mismatch causes React to discard SSR HTML and re-render
- Results in layout shift, performance loss, and console warnings

**Testing:**

```bash
# Build production bundle
npm run build

# Start production server
npm run start

# Open browser with React DevTools
# Check console for hydration warnings
```

**Acceptance Criteria:**

- [ ] **No hydration mismatch warnings** in browser console (production build)
- [ ] **No layout shift** (sidebar position/size stable)
- [ ] **Sidebar renders immediately** without flicker or blank state
- [ ] **No timestamps or random values** in rendered output

**Gotchas:**

- Collapse state from `localStorage` can cause mismatch — apply AFTER hydration using `useEffect()`
- Don't use `window`, `document`, `localStorage` during initial render
- `usePathname()` is a **client-only hook** — it must only be used in client components (never in server components or the resolver). Hydration stability is achieved by SSR rendering the same markup without pathname-dependent state, then applying active highlighting after hydration on the client.

### 4.6 Test SSR Output

**What:** Verify sidebar renders in SSR HTML.

**Test:**

```bash
# Check SSR HTML contains nav items
curl http://localhost:3000/dashboard/start | grep -E "(Home|Warehouse|Organization)"
```

**Acceptance Criteria:**

- [ ] Nav items appear in SSR HTML
- [ ] Icon keys present (not React components)
- [ ] No hydration warnings in console

**Verification Scope Guardrail:**

- Manual verification (browser console, `curl`, React DevTools) is sufficient for this phase.
- Automated E2E validation (Playwright, Cypress, etc.) is **OUT OF SCOPE** for this implementation unless already present in the project.
- Do NOT introduce new testing frameworks as part of sidebar V2 implementation. Unit tests (Vitest) and manual SSR checks are the testing boundary.

---

## Phase 5: Client Sidebar as Dumb Renderer

### 5.1 Create `AppSidebarV2` Component

**What:** New sidebar component that renders pre-filtered model.

**File:** `src/app/[locale]/dashboard/_components/sidebar-v2.tsx`

```typescript
"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SidebarModel, SidebarItem } from '@/lib/types/v2/sidebar';
import { getIconComponent } from '@/lib/sidebar/v2/icon-map';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';

interface AppSidebarV2Props {
  model: SidebarModel;
}

function SidebarNavItem({ item }: { item: SidebarItem }) {
  const Icon = getIconComponent(item.iconKey);
  const pathname = usePathname();

  /**
   * CRITICAL: Active state is computed CLIENT-SIDE ONLY.
   *
   * Why client-side?
   * - Works with SPA navigation (Next.js router updates pathname)
   * - No coupling to server headers or middleware
   * - Simpler testing (no header mocking needed)
   * - Active state updates dynamically as user navigates
   *
   * Server model contains NO active state.
   * Server concerns: VISIBILITY (permissions + entitlements)
   * Client concerns: HIGHLIGHTING (active route detection)
   */
  const isActive = useMemo(() => {
    if (item.match?.exact) {
      return pathname === item.match.exact;
    }
    if (item.match?.startsWith) {
      return pathname.startsWith(item.match.startsWith);
    }
    return false;
  }, [pathname, item.match]);

  if (item.children && item.children.length > 0) {
    // Group with children
    return (
      <SidebarGroup>
        <SidebarGroupLabel>
          <Icon className="h-4 w-4 mr-2" />
          {item.title}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          {item.children.map((child) => (
            <SidebarNavItem key={child.id} item={child} />
          ))}
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // Leaf item
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={item.href || '#'}>
          <Icon className="h-4 w-4" />
          <span>{item.title}</span>
          {item.badge && (
            <span className="ml-auto text-xs">{item.badge}</span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebarV2({ model }: AppSidebarV2Props) {
  return (
    <Sidebar>
      <SidebarHeader>
        {/* Org logo, name, etc. */}
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {model.main.map((item) => (
            <SidebarNavItem key={item.id} item={item} />
          ))}
        </SidebarMenu>
      </SidebarContent>

      {model.footer.length > 0 && (
        <SidebarFooter>
          <SidebarMenu>
            {model.footer.map((item) => (
              <SidebarNavItem key={item.id} item={item} />
            ))}
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
```

**Why:**

- **Separation of concerns:** Server computes VISIBILITY (permissions/entitlements), client computes HIGHLIGHTING (active state)
- **No coupling to server:** Active detection uses `usePathname()` hook, not server headers
- **SPA-friendly:** Active state updates on client-side navigation (no server re-render needed)
- **Dumb renderer:** No filtering, no authorization logic — just renders pre-filtered model
- Uses icon map to render lucide components (server sent string keys, client maps to React components)

**Acceptance Criteria:**

- [ ] Component accepts `model` prop
- [ ] Renders all items from model (no filtering)
- [ ] Uses icon map for icon components
- [ ] **Active state computed using `usePathname()` hook (client-side only)**
- [ ] **No permission/entitlement checks in component** (model already filtered)
- [ ] **Active highlighting works after SPA navigation** (URL changes without server re-render)

**Gotchas:**

- **CRITICAL:** Don't add visibility logic here — model is already filtered server-side
- **CRITICAL:** Don't read server headers or expect `item.isActive` field (doesn't exist)
- Use `usePathname()` hook for all active detection (Next.js router integration)

### 5.1.1 Active State Policy (MANDATORY)

**CRITICAL RULE:** Active state is **NOT** part of `SidebarModel` and **MUST NOT** be computed in SSR/resolver.

**Why This Matters:**

- **Server-side** (resolver): Computes **VISIBILITY** (what items the user can see based on permissions/entitlements)
- **Client-side** (sidebar component): Computes **HIGHLIGHTING** (which item is active based on current pathname)

**Implementation Requirements:**

| Component                      | Responsibility       | What It Receives                                   | What It Computes                          |
| ------------------------------ | -------------------- | -------------------------------------------------- | ----------------------------------------- |
| **Resolver (SSR)**             | Visibility filtering | `permissionSnapshot`, `enabledModules`, `registry` | Filtered `SidebarModel` (NO active state) |
| **Sidebar Component (Client)** | Active highlighting  | `SidebarModel`, `usePathname()`                    | Active state per item                     |

**Forbidden:**

- ❌ Resolver MUST NOT receive `pathname` parameter
- ❌ Resolver MUST NOT compute `isActive` field
- ❌ `SidebarItem` type MUST NOT include `isActive` property
- ❌ Server components MUST NOT read `headers().get('x-pathname')`
- ❌ `AppSidebarV2` MUST NOT render its own `<SidebarProvider>` — the single provider lives in `DashboardShell` (Phase 4.4)

**Required:**

- ✅ Client uses `usePathname()` hook to get current pathname
- ✅ Client uses `item.match` rules to determine if item is active
- ✅ Active state updates dynamically on SPA navigation (no server round-trip)

**Example (Client-Side Active Detection):**

```typescript
// Client component only
import { usePathname } from 'next/navigation';

function SidebarNavItem({ item }: { item: SidebarItem }) {
  const pathname = usePathname();

  const isActive = useMemo(() => {
    if (item.match?.exact) return pathname === item.match.exact;
    if (item.match?.startsWith) return pathname.startsWith(item.match.startsWith);
    return false;
  }, [pathname, item.match]);

  return (
    <SidebarMenuButton asChild isActive={isActive}>
      {/* ... */}
    </SidebarMenuButton>
  );
}
```

### 5.2 Accept `sidebarModel` Prop

**What:** Already done in 5.1 — component accepts `model` prop.

**Acceptance Criteria:**

- [ ] TypeScript enforces `model` prop is required
- [ ] Prop is `SidebarModel` type

### 5.3 Remove Hardcoded `navData`

**What:** Delete any hardcoded nav arrays from client components.

**File:** `src/app/[locale]/dashboard/_components/dashboard-shell.tsx`

Remove any old hardcoded nav like:

```typescript
const navData = [ ... ]; // DELETE THIS
```

**Acceptance Criteria:**

- [ ] No hardcoded nav arrays in client components
- [ ] All nav comes from `sidebarModel` prop

### 5.4 Implement Collapse State

**What:** Use `useUiStoreV2` for sidebar collapse state.

**File:** `src/app/[locale]/dashboard/_components/sidebar-v2.tsx`

```typescript
import { useUiStoreV2 } from '@/lib/stores/v2/ui-store';

export function AppSidebarV2({ model }: AppSidebarV2Props) {
  // NOTE: SidebarProvider is in DashboardShell (Phase 4.4), NOT here.
  // This component renders inside the provider, never wraps its own.

  return (
    <Sidebar>
      {/* ... sidebar content ... */}
    </Sidebar>
  );
}
```

**Why:**

- Single `SidebarProvider` lives in `DashboardShell` (Phase 4.4) — NOT in `AppSidebarV2`
- Collapse state is managed by `DashboardShell` via `useUiStoreV2` (see Phase 5.5)
- This component is a pure renderer — it reads model and renders, nothing else

**Acceptance Criteria:**

- [ ] `AppSidebarV2` does NOT render `<SidebarProvider>`
- [ ] Collapse state persists across page loads (via DashboardShell)
- [ ] No hydration mismatch warnings
- [ ] No layout shift on hydration

**Gotchas:**

- Only ONE `SidebarProvider` in the tree (in `DashboardShell`)
- If `AppSidebarV2` wraps its own provider, shadcn/ui state will conflict

### 5.5 Add Hydration Strategy

**What:** Apply client-only state (collapse, theme, preferences) AFTER hydration to prevent mismatches.

**Hydration-Safe Pattern:**

Collapse state and hydration are managed in `DashboardShell` (Phase 4.4), NOT in `AppSidebarV2`. The shell renders the single `SidebarProvider` with hydration-safe defaults:

```typescript
// In DashboardShell (Phase 4.4) — NOT in AppSidebarV2
const isOpen = hasHydrated ? !sidebarCollapsed : true; // Default open on SSR

<SidebarProvider open={isOpen} onOpenChange={(open) => setSidebarCollapsed(!open)}>
  <AppSidebarV2 model={sidebarModel} />
  {/* ... */}
</SidebarProvider>
```

`AppSidebarV2` receives the open/collapsed state implicitly via shadcn/ui context from the parent `SidebarProvider`. It does NOT manage collapse state itself.

**Zustand Store Configuration:**

```typescript
// src/lib/stores/v2/ui-store.ts
export const useUiStoreV2 = create<UiStoreV2>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      _hasHydrated: false,
      _setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
    }),
    {
      name: "ui-store-v2",
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true); // Mark as hydrated after rehydration
      },
    }
  )
);
```

**Acceptance Criteria:**

- [ ] **No layout shift on hydration** (sidebar doesn't jump from open to closed)
- [ ] **No hydration mismatch warnings** (SSR and initial client render match)
- [ ] **Persisted state applies after hydration** (user preference respected post-mount)
- [ ] **Works with JS disabled** (sidebar renders open as SSR default)
- [ ] **Zustand store has `_hasHydrated` flag** with `onRehydrateStorage` hook

### 5.6 Test Client Renders SSR Data

**What:** Verify client doesn't filter differently than server.

**Test:**

```typescript
// In browser dev tools:
// 1. Inspect sidebar HTML from SSR
// 2. Check sidebar HTML after hydration
// 3. Should be identical (except for collapse state)
```

**Acceptance Criteria:**

- [ ] Client renders exact same items as SSR
- [ ] No items added/removed after hydration
- [ ] Active states match

### 5.7 Parent Expansion Policy

**What:** Define how parent groups should behave when a child route is active.

**Precedence Rule: Active Route Wins**

When a child item is active (current pathname matches the child's route):

- **All ancestor groups MUST be expanded** (children visible)
- Active route expansion **takes precedence over manual collapse**
- Users can collapse groups that do NOT contain the active route
- Navigating to a route inside a collapsed group **re-expands it automatically**

> Expansion behavior is client-side only; it does not affect resolver output.

**Why This Matters:**

Users expect to see the active route in the navigation:

- If "Warehouse → Products" is the current page, the Warehouse group must be expanded
- Users must always be able to see where they are in the nav hierarchy
- Allowing manual collapse of the active group would hide the user's current location

**Implementation Guidelines:**

```typescript
// Client-side component logic (NOT in resolver)
function SidebarGroup({ item, children }: Props) {
  const pathname = usePathname();
  const [manuallyExpanded, setManuallyExpanded] = useState(true);

  // Check if any child is active
  const hasActiveChild = useMemo(() => {
    return children.some((child) => {
      if (child.match?.exact) return pathname === child.match.exact;
      if (child.match?.startsWith) return pathname.startsWith(child.match.startsWith);
      return false;
    });
  }, [pathname, children]);

  // Active child forces expansion; manual toggle only applies when no active child
  const isExpanded = hasActiveChild || manuallyExpanded;

  return (
    <Collapsible open={isExpanded} onOpenChange={(open) => {
      // Only allow manual collapse if no child is active
      if (!hasActiveChild) setManuallyExpanded(open);
    }}>
      {/* render children */}
    </Collapsible>
  );
}
```

**Manual Expansion State:**
Manual expansion state is maintained in the sidebar component as local UI state (e.g., React state keyed by group id). It is not persisted and does not affect the resolver. It resets on page reload. Manual toggle only applies to groups that do NOT contain the active route.

**Ownership & Boundaries:**

- Expansion state is owned by the sidebar UI component (e.g., shadcn/ui `Collapsible` wrapping `SidebarGroup`, or equivalent wrapper)
- Expansion state is PURELY CLIENT-SIDE UI concern — derived from pathname comparison via `usePathname()`
- The resolver does NOT control expansion and MUST NOT include expansion state in `SidebarModel`
- `SidebarModel` contains NO expansion fields — expansion is computed at render time by the client component
- Expansion logic uses `usePathname()` (same as active highlighting)

**Edge Cases:**

| Scenario                             | Behavior                                    |
| ------------------------------------ | ------------------------------------------- |
| Multiple nested levels               | Expand ALL parent levels up to active child |
| No active child                      | Default to manual expand/collapse state     |
| Deep link to child route             | Auto-expand parent on page load             |
| SPA navigation to child              | Re-expand parent automatically              |
| User clicks collapse on active group | Collapse is ignored (active route wins)     |

**Acceptance Criteria:**

- [ ] Parent groups expand when child route is active
- [ ] Active route expansion takes precedence over manual collapse
- [ ] Groups without active children can be manually collapsed
- [ ] Expansion state is client-side only (not in `SidebarModel`)
- [ ] Works with deep links (SSR + initial client render)
- [ ] Works with SPA navigation (pathname changes without page reload)

---

## Phase 6: Enforcement Stays Server-Side

### 6.1 Document Sidebar as UX-Only Boundary

**What:** Create security documentation.

**File:** `docs/v2/sidebar/SECURITY.md`

````markdown
# Sidebar V2 Security Model

## Trust Boundary

**CRITICAL:** The sidebar is a **UX-only boundary**. It is NOT a security enforcement mechanism.

### What Sidebar Does

- Hides nav items from UI based on permissions/entitlements
- Provides visual feedback about accessible features
- Improves UX by not showing inaccessible items

### What Sidebar Does NOT Do

- Prevent direct URL access to pages
- Enforce authorization
- Block API calls

## Actual Enforcement Layers

Authorization is enforced at THREE layers:

### 1. RLS Policies (Database Level)

- Tables have Row Level Security policies
- Users can only read/write rows they have access to
- Even if sidebar shows a link, RLS blocks unauthorized data access

### 2. Server Action Guards (API Level)

- All server actions use `requireModuleAccess()` / `requireWithinLimit()`
- Entitlements checked before executing operations
- See: `src/server/guards/entitlements-guards.ts`

### 3. Page-Level Guards (Route Level)

- Server layouts/pages check permissions before rendering
- Unauthorized users get redirected or 404
- See: Layout guards in `src/app/[locale]/dashboard/*/layout.tsx`

## Example: Why Hiding Billing Link Isn't Enough

```typescript
// ❌ WRONG: Relying on sidebar to hide link
// User can still navigate to /dashboard/organization/billing directly

// ✅ CORRECT: Page enforces authorization
// src/app/[locale]/dashboard/organization/billing/page.tsx
export default async function BillingPage() {
  const { can } = await getServerPermissions();

  if (!can("org.update")) {
    redirect("/dashboard/start");
  }

  // ... render billing page
}
```
````

## Checklist for New Pages

When adding a new page:

- [ ] Add route to sidebar registry (if should be visible)
- [ ] Add visibility rules to sidebar item (permissions/modules)
- [ ] Add server-side guard in page/layout (redirect if unauthorized)
- [ ] Add RLS policies for any new tables
- [ ] Add server action guards for any new mutations

## References

- Entitlements Architecture: `docs/extractions/ENTITLEMENTS_ARCHITECTURE_EXTRACTION.md`
- Permissions Architecture: `docs/extractions/PERMISSIONS_ARCHITECTURE_EXTRACTION.md`

````

**Acceptance Criteria:**
- [ ] Document created
- [ ] Explicitly states sidebar is NOT enforcement boundary
- [ ] Lists actual enforcement layers
- [ ] Provides checklist for new pages

### 6.2 Verify Page-Level Guards

**What:** Audit existing pages to ensure server-side guards exist.

**Files to check:**
- `src/app/[locale]/dashboard/warehouse/*/page.tsx`
- `src/app/[locale]/dashboard/organization/*/page.tsx`
- `src/app/[locale]/dashboard/analytics/*/page.tsx`

**Acceptance Criteria:**
- [ ] All protected pages have server-side permission checks
- [ ] Unauthorized access redirects or shows 404
- [ ] No pages rely solely on sidebar hiding

**Gotchas:**
- Some legacy pages might not have guards yet — document gaps

### 6.3 Verify Server Actions Guards

**What:** Ensure server actions check entitlements.

**Files to check:**
- `src/app/actions/warehouse/*.ts`
- `src/app/actions/organization/*.ts`

**Acceptance Criteria:**
- [ ] All mutations check `requireModuleAccess()` or `requireWithinLimit()`
- [ ] No server actions skip authorization

### 6.4 Create Enforcement Checklist

**What:** Add checklist to SECURITY.md (already in 6.1).

**Acceptance Criteria:**
- [ ] Checklist exists in SECURITY.md
- [ ] Referenced in PR template or contributor guide

---

## Phase 7: Integration Tests

### 7.1 Add Test: SSR Renders Expected Items

**What:** Integration test for SSR output.

**File:** `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { buildSidebarModel } from '@/server/sidebar/build-sidebar-model';

describe('Sidebar SSR Integration', () => {
  it('should render sidebar model with expected items', () => {
    const appContext = {
      activeOrgId: 'org-123',
      activeBranchId: null,
      activeOrg: null,
      activeBranch: null,
      availableBranches: [],
      userModules: [],
    };

    const userContext = {
      user: { id: 'user-123', email: 'test@example.com', first_name: null, last_name: null, avatar_url: null },
      roles: [],
      permissionSnapshot: { allow: ['org.read', 'members.read'], deny: [] },
    };

    const entitlements = {
      organization_id: 'org-123',
      plan_id: 'plan-free',
      plan_name: 'free',
      enabled_modules: ['home', 'warehouse', 'organization-management'],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: '2026-02-13T10:00:00.000Z',
    };

    const model = buildSidebarModel(appContext, userContext, entitlements, 'en');

    expect(model.main.length).toBeGreaterThan(0);
    expect(model.main.find(item => item.id === 'home')).toBeDefined();
  });
});
````

**Acceptance Criteria:**

- [ ] Test passes
- [ ] Uses mocked snapshots (no DB calls)
- [ ] Verifies expected items appear in model

### 7.2 Add Test: Different Permissions → Different Nav

**What:** Test that `org_owner` sees more items than `org_member`.

**File:** Same as 7.1

```typescript
it("should show more items for org_owner than org_member", () => {
  const appContext = {
    /* ... */
  };
  const entitlements = {
    /* ... all modules enabled ... */
  };

  // org_owner permissions (includes org.update)
  const ownerContext = {
    user: {
      /* ... */
    },
    roles: [],
    permissionSnapshot: {
      allow: ["org.read", "org.update", "members.read", "members.manage"],
      deny: [],
    },
  };

  // org_member permissions (no org.update)
  const memberContext = {
    user: {
      /* ... */
    },
    roles: [],
    permissionSnapshot: {
      allow: ["org.read", "members.read"],
      deny: [],
    },
  };

  const ownerModel = buildSidebarModel(appContext, ownerContext, entitlements, "en");
  const memberModel = buildSidebarModel(appContext, memberContext, entitlements, "en");

  const ownerBilling = findItemById(ownerModel, "organization.billing");
  const memberBilling = findItemById(memberModel, "organization.billing");

  expect(ownerBilling).toBeDefined(); // Owner sees billing
  expect(memberBilling).toBeUndefined(); // Member does NOT see billing
});
```

**Acceptance Criteria:**

- [ ] Test passes
- [ ] Demonstrates permission-based filtering
- [ ] Uses realistic permission snapshots

### 7.3 Add Test: Free Plan Hides Premium Modules

**What:** Test that free plan hides analytics/development.

**File:** Same as 7.1

```typescript
it("should hide analytics module for free plan", () => {
  const appContext = {
    /* ... */
  };
  const userContext = {
    user: {
      /* ... */
    },
    roles: [],
    permissionSnapshot: { allow: ["org.read"], deny: [] },
  };

  // Free plan (no analytics module)
  const freeEntitlements = {
    organization_id: "org-123",
    plan_id: "plan-free",
    plan_name: "free",
    enabled_modules: ["home", "warehouse", "organization-management"],
    enabled_contexts: [],
    features: {},
    limits: {},
    updated_at: "2026-02-13T10:00:00.000Z",
  };

  const model = buildSidebarModel(appContext, userContext, freeEntitlements, "en");

  const analyticsItem = findItemById(model, "analytics");
  expect(analyticsItem).toBeUndefined(); // Hidden
});

it("should show analytics module for professional plan", () => {
  const appContext = {
    /* ... */
  };
  const userContext = {
    /* ... */
  };

  // Professional plan (has analytics)
  const proEntitlements = {
    organization_id: "org-123",
    plan_id: "plan-pro",
    plan_name: "professional",
    enabled_modules: ["home", "warehouse", "organization-management", "analytics"],
    enabled_contexts: [],
    features: {},
    limits: {},
    updated_at: "2026-02-13T10:00:00.000Z",
  };

  const model = buildSidebarModel(appContext, userContext, proEntitlements, "en");

  const analyticsItem = findItemById(model, "analytics");
  expect(analyticsItem).toBeDefined(); // Shown
});
```

**Acceptance Criteria:**

- [ ] Tests pass
- [ ] Demonstrates entitlement-based filtering
- [ ] Uses realistic plan configurations

### 7.4 Add Test: Wildcard Permission

**What:** Test that `account.*` grants access to `account.profile.read`.

**File:** Same as 7.1

```typescript
it("should grant access when wildcard permission matches", () => {
  const appContext = {
    /* ... */
  };
  const entitlements = {
    /* ... */
  };

  const userContext = {
    user: {
      /* ... */
    },
    roles: [],
    permissionSnapshot: {
      allow: ["account.*"], // Wildcard
      deny: [],
    },
  };

  const model = buildSidebarModel(appContext, userContext, entitlements, "en");

  const profileItem = findItemById(model, "account.profile");
  expect(profileItem).toBeDefined(); // Shown (account.* matches account.profile.read)
});
```

**Acceptance Criteria:**

- [ ] Test passes
- [ ] Demonstrates wildcard matching works correctly

### 7.5 All Integration Tests Passing

**What:** Run all tests and verify coverage.

```bash
npm run test -- src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx
```

**Acceptance Criteria:**

- [ ] All integration tests pass
- [ ] Tests are stable (no flakiness)
- [ ] Tests use mocked data (no DB dependency)

---

## Phase 8: Safe Commit Order

### 8.1 Commit: Contract Types + Icon Map

**What:** First commit establishes types.

**Files:**

- `src/lib/types/v2/sidebar.ts`
- `src/lib/sidebar/v2/icon-map.ts`
- `src/lib/types/v2/__tests__/sidebar.test.ts`

**Commit Message:**

```
feat(sidebar-v2): add sidebar contract types and icon mapping

- Define JSON-serializable SidebarModel and SidebarItem types
- Add visibility rules (requiresPermissions, requiresModules, etc.)
- Create icon key → lucide component mapping for client
- Add contract validation tests

No behavior change yet.
```

**Acceptance Criteria:**

- [ ] Commit contains only types and tests
- [ ] Tests pass
- [ ] No application code changes

### 8.2 Commit: Failing Resolver Tests

**What:** Add resolver tests (will fail).

**Files:**

- `src/lib/sidebar/v2/__tests__/resolver.test.ts`

**Commit Message:**

```
test(sidebar-v2): add failing resolver tests (TDD)

- Test public items visibility
- Test permission-based filtering (AND/OR)
- Test module-based filtering
- Test fail-closed when entitlements null
- Test nested group pruning
- Test wildcard permission matching
- Test determinism

All tests fail (resolver not implemented yet).
```

**Acceptance Criteria:**

- [ ] Tests written
- [ ] All tests fail (expected)

### 8.3 Commit: Resolver Implementation

**What:** Implement resolver to make tests pass.

**Files:**

- `src/lib/sidebar/v2/resolver.ts`

**Commit Message:**

```
feat(sidebar-v2): implement pure sidebar resolver

- Create resolveSidebarModel() pure function
- Use canonical checkPermission() for wildcard + deny semantics
- Fail-closed when entitlements null
- Prune empty parent groups
- 100% deterministic (no timestamps, no side effects)

All resolver tests now pass.
```

**Acceptance Criteria:**

- [ ] All tests pass
- [ ] 100% code coverage for resolver
- [ ] No side effects in resolver

### 8.4 Commit: Permission/Module Constants + Nav Registry

**What:** Add permission/module constants and nav catalog.

**Files:**

- `src/lib/constants/permissions.ts`
- `src/lib/constants/modules.ts`
- `src/lib/sidebar/v2/registry.ts`
- `src/lib/sidebar/v2/__tests__/registry.test.ts`

**Commit Message:**

```
feat(sidebar-v2): add permission/module constants and navigation registry

- Create permission slug constants (20 canonical permissions)
- Create module slug constants (11 modules)
- Define sidebar nav catalog with core sections
- Add registry structure tests
- Enforce no raw strings via tests

Registry is pure data; no behavior change yet.

IMPORTANT: Only 20 canonical permissions exist in database.
Warehouse fine-grained permissions (warehouse.products.read, etc.)
do NOT exist yet and are future work.
```

**Acceptance Criteria:**

- [ ] Registry tests pass
- [ ] All IDs unique
- [ ] All permission/module slugs valid
- [ ] No raw strings in registry (enforced by tests)

### 8.5 Commit: Server Layout Computes Model

**What:** Add SSR sidebar model generation.

**Files:**

- `src/server/sidebar/build-sidebar-model.ts`
- `src/app/[locale]/dashboard/layout.tsx` (updated)

**Commit Message:**

```
feat(sidebar-v2): compute sidebar model server-side

- Load entitlements in dashboard layout
- Create buildSidebarModel() server helper
- Compute sidebar model before rendering
- Pass model to DashboardShell

SSR-consistent sidebar; no client filtering.
```

**Acceptance Criteria:**

- [ ] Layout computes model server-side
- [ ] Model passed to shell
- [ ] No hydration warnings

### 8.6 Commit: Client Sidebar Renderer

**What:** Add new sidebar component.

**Files:**

- `src/app/[locale]/dashboard/_components/sidebar-v2.tsx`
- `src/app/[locale]/dashboard/_components/dashboard-shell.tsx` (updated)

**Commit Message:**

```
feat(sidebar-v2): add client sidebar renderer

- Create AppSidebarV2 component (dumb renderer)
- Render pre-filtered model from server
- Add collapse state via useUiStoreV2
- Add hydration strategy to prevent mismatch
- Active state computed client-side using usePathname()

Sidebar now fully SSR-consistent.
```

**Acceptance Criteria:**

- [ ] Sidebar renders SSR model
- [ ] Collapse state works
- [ ] No layout shift on hydration

### 8.7 Commit: Remove Old NavData

**What:** Clean up old code.

**Files:**

- Any files with hardcoded nav arrays

**Commit Message:**

```
refactor(sidebar-v2): remove old hardcoded nav data

- Remove hardcoded navData constants
- All nav now comes from registry + resolver

No behavior change.
```

**Acceptance Criteria:**

- [ ] No hardcoded nav arrays remain
- [ ] All nav from registry

### 8.8 Commit: Integration Tests + Security Docs

**What:** Add integration tests and security documentation.

**Files:**

- `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx`
- `docs/v2/sidebar/SECURITY.md`

**Commit Message:**

```
test(sidebar-v2): add integration tests and security docs

- Test SSR renders expected items
- Test permission-based filtering (owner vs member)
- Test entitlement-based filtering (free vs pro)
- Test wildcard permission matching
- Document sidebar as UX-only boundary

All tests pass; sidebar implementation complete.
```

**Acceptance Criteria:**

- [ ] All integration tests pass
- [ ] Security documentation complete

### 8.9 Smoke Check

**What:** Final verification.

**Checklist:**

- [ ] `npm run build` succeeds
- [ ] `npm run type-check` passes
- [ ] `npm run test` all tests pass
- [ ] No hydration warnings in browser console
- [ ] Sidebar renders correctly with JS disabled (basic)
- [ ] Collapse state persists across reloads
- [ ] Active item highlighted correctly
- [ ] org_owner sees more items than org_member
- [ ] Free plan doesn't show analytics module
- [ ] Direct URL access to protected pages still enforces server guards

---

## Results: What This Plan Delivers

### ✅ Architectural Outcomes

**SSR-First Architecture:**

- Sidebar nav model computed 100% server-side
- No "render then hide" flicker
- Same output on server and initial client render
- Works with JavaScript disabled (basic functionality)

**Deterministic Behavior:**

- Pure functions (`resolveSidebarModel`)
- Same inputs → same output (every time)
- Testable without side effects
- Debuggable (can inspect model at any point)
- No timestamps, no random values, no Date.now()

**Fail-Closed Security:**

- Missing entitlements → hide all module-gated items
- Missing permissions → hide all permission-gated items
- Null/undefined data → fail safe (hide, don't expose)
- Deny permissions override allow (deny-first semantics)

### ✅ Security & Consistency Outcomes

**No Client-Side Guessing:**

- Server computes visibility based on authoritative data
- Client receives pre-filtered model (no permission checks on client)
- Sidebar is UX-only (not security enforcement boundary)
- Actual enforcement remains at RLS, server actions, page guards

**Consistency with Server:**

- Sidebar visibility matches server-side permission checks
- No divergence between what sidebar shows and what pages allow
- Uses same permission matcher (`checkPermission()`) as server guards
- Compiled permission snapshots (wildcards, deny semantics) work correctly

**Hydration Stability:**

- SSR and client produce byte-for-byte identical markup
- No layout shift on hydration
- No hydration mismatch warnings
- Collapse state applied after hydration (no SSR/client divergence)

### ✅ Test Coverage Outcomes

**Unit Tests:**

- Resolver with 100% branch coverage
- 10+ test cases covering all visibility rule combinations
- Tests for wildcards, deny semantics, nested pruning
- Determinism test (same inputs → identical outputs)

**Integration Tests:**

- SSR output verification
- Permission-based filtering (owner vs member)
- Entitlement-based filtering (free vs pro vs enterprise)
- Wildcard permission matching

**No DB Dependencies:**

- All tests use mocked snapshots
- Tests run in CI without database
- Fast test execution

### ✅ Developer Experience

**Type-Safe:**

- TypeScript enforced throughout
- Permission/module constants prevent typos
- Import errors if constant doesn't exist

**Self-Documenting:**

- Types describe structure
- Comments explain "why" not "what"
- Security model explicitly documented

**TDD Workflow:**

- Tests define behavior before implementation
- Red → Green → Refactor cycle
- Regression safety built-in

**Clear Separation of Concerns:**

- Registry (data) → Resolver (logic) → Renderer (UI)
- Server (visibility) → Client (highlighting)
- Easy to reason about, easy to extend

### ✅ Performance

**Request-Scoped Cache:**

- `buildSidebarModel` cached per request
- Single DB query for entitlements
- No redundant computation

**Minimal Client JS:**

- Only icon map shipped to client
- No runtime filtering on client (already filtered on server)
- Smaller bundle size

### ✅ Extensibility

**Registry-Based:**

- Add new sections without touching resolver
- Pluggable registry implementations
- Version-controlled nav structure

**Future-Ready:**

- Supports custom modules (org-specific nav)
- Supports feature flags (beyond enabled_modules)
- Supports user preferences (collapse, pinned items)
- Supports localization (i18n-ready types)

### ❌ Explicitly OUT OF SCOPE

**Not Included (Future Work):**

1. **Fine-Grained Warehouse Permissions**
   - `warehouse.products.read`, `warehouse.locations.read`, etc. do NOT exist in database
   - Requires separate project:
     - Database migration to add permission rows
     - Permission compiler updates to assign to roles
     - RLS policy updates to use new permissions
     - Module config updates
   - Current implementation uses module-level gating (`MODULE_WAREHOUSE`)

2. **Entitlement Compiler Changes**
   - No modifications to `supabase/migrations/*_entitlements_compiler_*.sql`
   - Sidebar consumes compiled snapshots, doesn't modify compiler

3. **RLS Policy Modifications**
   - No changes to `supabase/migrations/*_rls_*.sql`
   - Sidebar is UX-only, RLS is security enforcement

4. **Permission Slug Renaming**
   - No changes to `permissions.slug` column values
   - Constants match existing slugs exactly

5. **Legacy Sidebar Removal**
   - Old sidebar components remain (separate cleanup task)
   - No changes to `src/components/Dashboard/sidebar/`

6. **Advanced Features**
   - Custom modules (org-specific nav items from DB)
   - User-specific nav customization (drag-and-drop, pinned items)
   - Sidebar search/filtering
   - Nested groups beyond 2 levels
   - Dynamic nav based on feature flags
   - Sidebar analytics/tracking
   - AI-suggested shortcuts

---

## Out of Scope / Future Work

### 1. Fine-Grained Warehouse Permissions

**Status:** Not implemented (requires separate project)

**What's Missing:**

- Permission rows in database:
  - `warehouse.products.read`
  - `warehouse.products.create`
  - `warehouse.products.update`
  - `warehouse.products.delete`
  - `warehouse.locations.read`
  - `warehouse.locations.create`
  - `warehouse.locations.update`
  - `warehouse.locations.delete`
  - `warehouse.inventory.read`
  - `warehouse.inventory.update`
  - `warehouse.movements.read`
  - `warehouse.movements.create`
  - `warehouse.movements.approve`

**What Needs to Happen:**

1. **Database Migration:** Add permission rows to `permissions` table
2. **Permission Compiler:** Update triggers to assign permissions to roles
3. **RLS Policies:** Update warehouse table policies to use new permissions
4. **Module Config:** Update `src/modules/warehouse/config.ts` to use permissions
5. **Sidebar Registry:** Update registry to use fine-grained permissions instead of module gating

**Current Workaround:**

- Warehouse nav item uses `requiresModules: [MODULE_WAREHOUSE]` (module-level gating)
- No sub-item filtering (all warehouse users see all warehouse nav items)

**Estimated Effort:** 8-12 hours (separate project)

### 2. Entitlement Compiler Changes

**Status:** Forbidden (sidebar consumes compiled snapshots only)

**Why Out of Scope:**

- Sidebar uses compiled permission snapshots and entitlements
- No need to modify compilation logic
- High risk of breaking subscription plan inheritance

**If Needed Later:**

- Separate project with full regression testing
- Coordinate with entitlements system owner

### 3. RLS Policy Modifications

**Status:** Forbidden (sidebar is UX-only, not security enforcement)

**Why Out of Scope:**

- Sidebar visibility does NOT enforce security
- RLS policies are authoritative trust boundary
- High risk of accidental security bypass

**If Needed Later:**

- Separate project focused on database security
- Full security audit required

### 4. Permission Slug Renaming

**Status:** Forbidden (high risk of silent breakage)

**Why Out of Scope:**

- Permission slugs used in RLS policies, server guards, UI checks
- Renaming requires coordinated updates across entire codebase
- Constants strategy mitigates need (TypeScript catches import failures)

**If Needed Later:**

- Database-first migration
- Update constants file
- TypeScript will catch all usages via import errors

### 5. Legacy Sidebar Removal

**Status:** Deferred (separate cleanup task)

**What Remains:**

- `src/components/Dashboard/sidebar/` (old components)
- `src/app/[locale]/dashboard-old/` (legacy dashboard)
- Hardcoded nav arrays in old components

**When to Remove:**

- After sidebar V2 is fully deployed and stable
- After user feedback confirms V2 works correctly
- Coordinate with QA for regression testing

**Estimated Effort:** 2-4 hours (cleanup task)

### 6. Advanced Features (Not Prioritized)

**Custom Modules:**

- Org-specific nav items stored in database
- Loaded dynamically via `appContext.userModules`
- Requires DB schema, admin UI, validation

**User Customization:**

- Drag-and-drop nav items
- Pinned/favorited items
- Custom grouping
- Requires user preferences storage

**Sidebar Search:**

- Fuzzy search across nav items
- Keyboard shortcuts
- Recent/frequent items
- Requires search index, UI component

**Feature Flags:**

- Dynamic nav based on feature flags (beyond enabled_modules)
- A/B testing nav layouts
- Gradual rollout of new sections
- Requires feature flag system integration

**Analytics:**

- Track nav item clicks
- Heatmaps, usage patterns
- User journey analysis
- Requires analytics integration

---

## Plan Changelog (2026-02-13 Review)

### Critical Corrections

**❌ REMOVED: Non-Existent Warehouse Permissions**

- Removed: `warehouse.products.read`, `warehouse.products.create`, `warehouse.products.update`, `warehouse.products.delete`
- Removed: `warehouse.locations.read`, `warehouse.locations.create`, `warehouse.locations.update`, `warehouse.locations.delete`
- Removed: `warehouse.inventory.read`, `warehouse.inventory.update`
- **Why:** These permissions do NOT exist in the `permissions` table (verified 2026-02-13)
- **Impact:** Plan now matches actual database schema

**✅ ADDED: Explicit 20-Permission Limit**

- Added warning in Phase 3.0: "This file contains ONLY the 20 canonical permission slugs from the database"
- Added database verification query: `SELECT slug FROM permissions WHERE deleted_at IS NULL ORDER BY slug;`
- Added expected count: "Expected Count: 20 permissions"
- **Why:** Prevents future additions without database-first approach

**✅ FIXED: Warehouse Sidebar Gating**

- Changed from: `requiresPermissions: [WAREHOUSE_PRODUCTS_READ]` (doesn't exist)
- Changed to: `requiresModules: [MODULE_WAREHOUSE]` (module-level gating)
- Updated registry example in Phase 3.1
- Added comment: "Warehouse does NOT have fine-grained permissions in database yet"
- **Why:** Warehouse nav items can only be gated by module, not permissions (until future work)

**✅ FIXED: Registry Examples**

- All registry examples now use imported constants
- No raw permission/module strings in examples
- Added enforcement tests to prevent raw strings
- **Why:** Prevents silent breakage when schema evolves

### Architectural Improvements

**✅ ADDED: Progress Tracker (Phase 0)**

- Complete checklist mapping to all implementation steps
- Phases 0-8 with sub-step checkboxes
- **Why:** Implementer can track progress and verify completeness

**✅ ADDED: Guardrails Section**

- Explicit forbidden actions (DO NOT touch entitlement compiler, RLS, permission slugs)
- Allowed actions (sidebar V2 scope only)
- Acceptance criteria (no changes to migrations, services, etc.)
- **Why:** Prevents scope creep and cascading failures

**✅ ADDED: SSR Data Availability Section**

- Where `enabledModules` comes from (organization_entitlements table)
- Where `permissionSnapshot` comes from (user_effective_permissions)
- How sidebar resolver uses this data
- **Why:** Clarifies data flow and dependencies

**✅ ADDED: Results Section**

- Architectural outcomes (SSR-first, deterministic, fail-closed)
- Security/consistency outcomes (no client guessing, consistent with server)
- Test coverage outcomes (unit + integration tests)
- Developer experience outcomes (type-safe, self-documenting, TDD)
- Performance outcomes (request-scoped cache, minimal client JS)
- Extensibility outcomes (registry-based, future-ready)
- **Why:** Explicitly states what completing the plan delivers

**✅ ADDED: Out of Scope / Future Work Section**

- Fine-grained warehouse permissions (separate project)
- Entitlement compiler changes (forbidden)
- RLS policy modifications (forbidden)
- Permission slug renaming (forbidden)
- Legacy sidebar removal (separate task)
- Advanced features (not prioritized)
- **Why:** Sets clear expectations and prevents feature creep

**✅ ADDED: Plan Quality Checklist**

- Verify before implementation begins
- 10-point checklist covering permissions, modules, SSR, determinism, etc.
- **Why:** Final gate to ensure plan is implementation-ready

### Documentation Improvements

**✅ ADDED: Warehouse Permissions Note**

- Phase 3.0: "CRITICAL NOTE ON WAREHOUSE PERMISSIONS"
- Explains why warehouse permissions don't exist
- Lists what's required for future implementation
- Provides workaround (module gating)
- **Why:** Prevents confusion and sets expectations

**✅ ENHANCED: Phase 4.1 (SSR Assembly)**

- Added "Where Entitlements Come From" section
- Clarified data flow from `organization_entitlements` table
- Added `EntitlementsService.loadEntitlements()` usage
- **Why:** Implementer knows exact data source and API

**✅ ENHANCED: Phase 5.1 (Client Sidebar)**

- Emphasized "dumb renderer" pattern
- Clarified active state is CLIENT-SIDE ONLY
- Added extensive comments on separation of concerns
- **Why:** Prevents re-implementing visibility logic on client

**✅ ENHANCED: Phase 6 (Enforcement)**

- Added security documentation template
- Clarified three layers of enforcement (RLS, server actions, page guards)
- Added "Why Hiding Billing Link Isn't Enough" example
- **Why:** Prevents treating sidebar as security boundary

### Test Strategy Improvements

**✅ ADDED: Integration Test Examples**

- Phase 7.1: SSR renders expected items
- Phase 7.2: org_owner vs org_member filtering
- Phase 7.3: Free vs professional plan filtering
- Phase 7.4: Wildcard permission matching
- **Why:** Concrete test examples guide implementation

**✅ ADDED: Determinism Test**

- Phase 2.1: Test resolver called 3x produces identical JSON
- Verifies no timestamps, no random values
- **Why:** Ensures SSR hydration stability

**✅ ADDED: Registry Enforcement Tests**

- Phase 3.3: Test verifies no raw strings in registry file
- Regex pattern matching to catch violations
- Throws descriptive error with fix instructions
- **Why:** Prevents accidental raw string usage

### Why These Changes Matter

**Prevents Silent Breakage:**

- Referencing non-existent warehouse permissions would fail at runtime
- Plan now references only verified database schema
- Constants strategy makes schema changes type errors (not runtime errors)

**Ensures Consistency:**

- Plan matches actual database (20 permissions, 11 modules)
- No assumptions about future schema changes
- Explicit about what exists today vs. future work

**Guards Against Drift:**

- Forbidden actions prevent breaking existing systems
- Scope boundaries prevent feature creep
- Out-of-scope section prevents mismatched expectations

**Implementation-Ready:**

- Implementer can follow step-by-step without guessing
- All data sources explicitly documented
- Test strategy with concrete examples
- Quality checklist verifies readiness

**Maintainability:**

- Constants prevent typos and enable refactoring
- TDD approach ensures regression safety
- Security model explicitly documented
- Clear separation of concerns (server visibility, client highlighting)

---

## Plan Quality Checklist

**Verify before implementation begins:**

### Schema Alignment

- [ ] Plan references ONLY the 20 canonical permission slugs from database
- [ ] Plan references ONLY the 11 canonical module slugs from entitlements
- [ ] NO warehouse.\* permissions referenced (these don't exist yet)
- [ ] Warehouse gating uses MODULE_WAREHOUSE (module-level, not permission-level)

### Data Flow Clarity

- [ ] SSR data flow for entitlements + permissions is clearly specified
- [ ] Source of `enabled_modules` documented (organization_entitlements table)
- [ ] Source of `permissionSnapshot` documented (user_effective_permissions)
- [ ] EntitlementsService.loadEntitlements() usage documented

### Architecture Requirements

- [ ] Visibility logic is deterministic (no timestamps, no side effects)
- [ ] Visibility logic is deny-first aware (deny overrides allow)
- [ ] Active state is CLIENT-SIDE ONLY (not server-computed)
- [ ] Fail-closed behavior documented (null/missing data → hide items)

### Implementation Completeness

- [ ] Each phase has Definition of Done (DoD)
- [ ] Each phase has acceptance criteria
- [ ] Each phase has test strategy
- [ ] Guardrails prevent refactors / scope creep

### Scope Management

- [ ] Out-of-scope future work is explicitly listed
- [ ] Forbidden actions clearly documented
- [ ] Warehouse fine-grained permissions marked as future work
- [ ] Legacy sidebar removal marked as separate task

### Test Coverage

- [ ] Unit tests for resolver (100% branch coverage)
- [ ] Integration tests for SSR output
- [ ] Integration tests for permission/module filtering
- [ ] Determinism test (same inputs → identical outputs)
- [ ] Registry enforcement tests (no raw strings)

### Developer Experience

- [ ] Plan is self-contained (all info in one place)
- [ ] Plan is implementation-ready (no missing steps)
- [ ] Progress tracker maps to all implementation steps
- [ ] Quality checklist verifies readiness

### Documentation

- [ ] Security model documented (sidebar is UX-only, not enforcement)
- [ ] Enforcement layers documented (RLS, server actions, page guards)
- [ ] Changelog documents what changed and why
- [ ] Results section states what plan delivers

### Final Gates

- [ ] No assumptions about non-existent database schema
- [ ] No scope creep into entitlements compiler or RLS policies
- [ ] Constants strategy enforced (no raw strings in registry)
- [ ] All 20 permissions + 11 modules verified against database

**If all checkboxes are ticked, the plan is ready for implementation.**

---

## Plan Sanity Checklist (Post-Fix)

**This checklist confirms that specific footguns and inconsistencies have been fixed in the plan:**

### Step 1: Active State Client-Only Policy

- [x] Added explicit "5.1.1 Active State Policy (MANDATORY)" subsection
- [x] Server vs client responsibilities table created (visibility vs highlighting)
- [x] Forbidden actions listed (resolver MUST NOT receive pathname, MUST NOT compute isActive)
- [x] Required actions listed (client uses usePathname(), match rules)
- [x] Example shows correct client-side active detection pattern

### Step 2: Non-Canonical Module Slugs Removed

- [x] Removed `premium-warehouse` (non-canonical module slug)
- [x] Replaced with canonical `MODULE_ANALYTICS` in test examples
- [x] All module references now match canonical list (11 modules)

### Step 3: Examples Use Imported Constants

- [x] Updated visibility rule table to show constants (ORG_UPDATE, MODULE_ANALYTICS, etc.)
- [x] Added import statements to combined rules example
- [x] Added "IMPORTANT: Examples Must Use Constants" section at top of Phase 2
- [x] Provided correct vs wrong comparison (constants vs raw strings)
- [x] Clarified inline strings in docs are for readability only

### Step 4: Determinism Violations Fixed

- [x] Replaced all 3 occurrences of `new Date().toISOString()` with constant `'2026-02-13T10:00:00.000Z'`
- [x] Test fixtures now have stable `updated_at` values
- [x] Examples can be used for snapshot testing (deterministic output)

### Step 5: Progress Tracker Consistency

- [x] Verified tracker numbering is consistent (2.1-2.11 correct)
- [x] Confirmed no active-state tests in resolver phase (correctly excluded)
- [x] Tracker aligns with implementation phases and commit order

### Overall Correctness

- [x] No non-deterministic code in examples (`new Date()`, `Math.random()`, etc.)
- [x] No non-canonical module/permission slugs in plan
- [x] Active state computation correctly documented as client-only
- [x] All examples teach correct patterns (import constants, not raw strings)
- [x] Plan is internally consistent and ready for implementation

**Verification Date:** 2026-02-13

---

## Final Improvement Confirmation

**This section confirms that exactly five improvements were applied to the plan (no more, no less):**

### Improvements Applied

- [x] **Registry Immutability Explicitly Documented**
  - Added section 1.2.1 "Registry Immutability Policy"
  - Documented that registry objects must never be mutated
  - Provided correct vs forbidden patterns with code examples
  - Added acceptance criterion for mutation testing

- [x] **Fail-Closed Behavior Matrix Documented**
  - Added section 2.2.1 "Fail-Closed Behavior Matrix"
  - Created comprehensive table showing visibility behavior for null/missing data
  - Clarified combined rule semantics (AND behavior)
  - Added null safety table with exact behavior specifications

- [x] **Parent Expansion Policy Defined**
  - Added section 5.7 "Parent Expansion Policy"
  - Defined behavior when child route is active (parent should expand)
  - Clarified expansion is client-side only (does not affect resolver output)
  - Documented edge cases: multi-level nesting, deep links, SPA navigation

- [x] **SidebarModel.footer Made Required**
  - Changed `footer?: SidebarItem[]` to `footer: SidebarItem[]` in interface
  - Updated comment to clarify footer is always present (may be empty array)
  - The type guarantee removes the need for `undefined`/`null` checks; the renderer still conditionally renders when `footer.length > 0` (this is a content check, not a null-safety check)

- [x] **requiresAnyModules Test Case Added**
  - Added comprehensive test for OR logic with `requiresAnyModules`
  - Tests 4 scenarios: has one, has other, has both, has neither
  - Validates item visible if at least ONE module enabled
  - Uses canonical module constants (MODULE_ANALYTICS, MODULE_DEVELOPMENT)

### Scope Confirmation

**What was NOT changed (scope discipline):**

- ✅ No new architectural ideas introduced
- ✅ No refactoring of unrelated sections
- ✅ No expansion of scope beyond the 5 improvements
- ✅ No "nice to have" enhancements added
- ✅ No code files modified (plan-only changes)
- ✅ No new features or functionality proposed
- ✅ No changes to resolver logic or implementation approach
- ✅ No modifications to entitlements architecture
- ✅ No changes to permission system design
- ✅ No alterations to SSR data loading strategy

### Summary (Final 10 Bullets)

1. **Registry immutability** now explicitly documented with mutation prevention patterns
2. **Fail-closed behavior** comprehensively documented with behavior matrix for all null/missing cases
3. **Parent expansion** policy defined for active child routes (client-side only)
4. **Footer type** corrected to required (not optional) matching resolver implementation
5. **requiresAnyModules** test case added with OR logic validation (4 test scenarios)
6. **All 5 improvements** are documentation-only (no code changes)
7. **No scope creep** - only the specified improvements were applied
8. **No architectural changes** - existing design preserved
9. **Plan consistency** improved with explicit policies and test requirements
10. **Implementation guidance** enhanced with clear behavioral specifications

**Verification Date:** 2026-02-13

**Reviewer Confirmation:** These 5 improvements close the senior review loop. No further plan changes required before implementation.

---

## Plan Patch Completion (Round 2)

**This section confirms that exactly five patches were applied in Round 2 (no more, no less):**

### Patches Applied

- [x] **Patch 6 — Single SidebarProvider Rule**
  - Added forbidden rule: `AppSidebarV2` MUST NOT render its own `<SidebarProvider>`
  - Updated DashboardShell (Phase 4.4) snippet to own collapse state via `useUiStoreV2`
  - Updated Phase 5.4 snippet to remove `SidebarProvider` from `AppSidebarV2`
  - Updated Phase 5.5 hydration strategy to reference DashboardShell as collapse state owner

- [x] **Patch 7 — Redirect Normalization**
  - Changed `redirect("/login")` to `redirect({ href: "/sign-in", locale })` in both Phase 4.1 and 4.3 snippets
  - Added bold warning at Phase 4 header: DO NOT CHANGE AUTH REDIRECT SEMANTICS
  - Matches actual codebase: `src/app/[locale]/dashboard/layout.tsx:26`

- [x] **Patch 8 — Test Snippet Consistency**
  - Documentation snippets in Phase 2 may use raw strings for readability
  - Implementation tests MUST use imported constants (same rule as registry), per Constant Usage Policy (Phase 3.3)
  - Changed `MODULE_ANALYTICS` → `'analytics'` and `MODULE_DEVELOPMENT` → `'development'` in plan snippets only
  - This affects plan documentation clarity only — actual test code must always use constants

- [x] **Patch 9 — Path-Stable Registry Tests**
  - Changed bare `'src/lib/sidebar/v2/registry.ts'` to `path.resolve(process.cwd(), 'src/lib/sidebar/v2/registry.ts')`
  - Applied to both permission constants test and module constants test
  - Prevents CI failures when test runner CWD differs from project root

- [x] **Patch 10 — Non-Nullable permissionSnapshot Wording**
  - Changed "permissionSnapshot = null" to "permissionSnapshot = { allow: [], deny: [] } (empty default)" in null safety table
  - Changed "null/empty" to "empty" in fail-closed behavior matrix for permission rows
  - Added type note: `permissionSnapshot` is non-nullable, fail-closed condition is empty arrays
  - Updated inline comment on `SidebarResolverInput.permissionSnapshot` to state non-nullable default
  - Updated acceptance criteria to reference "empty permission snapshot" not "null"

### After-Action Checklist

- [x] No new architectural ideas introduced
- [x] No scope creep beyond the 5 specified patches
- [x] All edits are documentation-only (no code files modified)
- [x] Patch tracker updated with Round 2 entries
- [x] Plan remains internally consistent after all patches

**Verification Date:** 2026-02-15

---

## Plan Patch Completion (Round 3)

**This section confirms that exactly five patches were applied in Round 3 (no more, no less):**

### Patches Applied

- [x] **Patch 11 — Explicit Permission Fail-Closed Test**
  - Added named test case: "should fail-closed when permissionSnapshot.allow is empty" (Phase 2.1 resolver test suite)
  - Added progress tracker entry `2.7.1 Test: permission fail-closed when permissionSnapshot.allow is empty ([])`
  - Added acceptance criterion in Phase 2.1: "Resolver MUST fail-closed when permissionSnapshot.allow is empty; permission-gated items must not render"

- [x] **Patch 12 — Footer Required Wording Fix**
  - Clarified in Final Improvement Confirmation section: `footer: SidebarItem[]` guarantees non-null/non-undefined; `footer.length > 0` is a content check (decides whether to render), not a null-safety check
  - No code or type changes

- [x] **Patch 13 — Parent Expansion Policy Anchored to Primitives**
  - Updated "Ownership & Boundaries" block in Section 5.7 (Parent Expansion Policy)
  - Expansion state owned by sidebar UI component (shadcn/ui `Collapsible` wrapping `SidebarGroup`)
  - Derived from `usePathname()` — client-side only
  - Resolver MUST NOT include expansion state in `SidebarModel` — model is pure data

- [x] **Patch 14 — Constant Usage Policy Guardrail**
  - Updated blockquote "Constant Usage Policy" at top of Phase 3.3 with 4 numbered rules
  - Rule 1: Registry MUST use imported constants (no raw strings)
  - Rule 2: Resolver tests MUST use imported constants (no raw strings)
  - Rule 3: No `permission: "some.string"` — always `PERM_SOMETHING`
  - Rule 4: No `module: "warehouse"` — always `MODULE_WAREHOUSE`
  - Updated Phase 2 header note and Phase 2.1 note to align with this policy (raw strings in plan documentation only, not in implementation)

- [x] **Patch 15 — cache() Semantics Wording**
  - Changed "cached per request" → "cached within RSC render execution context" in JSDoc, "Why", and "Gotchas" sections (Phase 4.2)
  - Added safety note in all three locations: no global state, no cross-user leakage, no cross-request persistence guarantee

### Patch Application Confirmation

- [x] Patch 11 applied: Phase 2.1 test suite, Phase 2 progress tracker (2.7.1), Phase 2.1 acceptance criteria
- [x] Patch 12 applied: Final Improvement Confirmation section (SidebarModel.footer wording)
- [x] Patch 13 applied: Section 5.7 "Ownership & Boundaries" block
- [x] Patch 14 applied: Phase 3.3 blockquote, Phase 2 header, Phase 2.1 note
- [x] Patch 15 applied: Phase 4.2 JSDoc, "Why" section, "Gotchas" section

**No implementation work was performed. Only the plan file was changed.**

**No scope expansion beyond patches 11–15.**

### Deferred / Out of Scope

- Phase 2 test code snippets still show raw strings for documentation readability. Actual test implementation must use imported constants per the Constant Usage Policy (Phase 3.3). Rewriting all inline test snippets to use constants is deferred to implementation time.

**Verification Date:** 2026-02-16

---

**END OF IMPLEMENTATION PLAN**

**Summary:**
This plan delivers a production-ready, SSR-first, security-hardened sidebar for Dashboard V2. By following TDD principles and maintaining strict separation between UX and security boundaries, the sidebar provides excellent user experience without compromising authorization enforcement.

The architecture is **extensible** (easy to add new sections), **testable** (pure functions, mocked snapshots), **performant** (SSR-consistent, minimal client JS), and **type-safe** (constants prevent silent breakage). Most importantly, it **respects existing security architecture** by using compiled permission snapshots and treating the sidebar as a UX-only boundary.

**Estimated Effort:** 8-12 hours for experienced developer following this plan step-by-step.

**Risk Level:** Low (isolated scope, no changes to core auth/entitlements systems, TDD ensures correctness).

**Dependencies:** None (all required systems already exist: V2 loaders, entitlements service, permission utilities).

**Next Steps:**

1. Review plan with team lead
2. Verify quality checklist
3. Begin Phase 0 (scope lock)
4. Follow TDD workflow (tests → implementation → refactor)
5. Commit in safe order (Phase 8)
6. Deploy to staging for QA verification

---

### Patch Verification (2026-02-16)

- [x] **Patch A** — Removed remaining contradiction: Patch Tracker Round 2 Patch 8 description and Plan Sanity Checklist entry now state documentation snippets may use raw strings for readability, but implementation tests MUST use imported constants.
- [x] **Patch B** — Registry enforcement test regexes in Phase 3.3 expanded from `requiresPermissions`/`requiresModules` to `requires(?:Any)?Permissions`/`requires(?:Any)?Modules`, catching raw strings in all four visibility rule arrays.
- [x] **Patch C** — Phase 4.5 Gotchas: replaced incorrect claim that `usePathname()` is "safe on server/client" with accurate guidance that it is a client-only hook; hydration stability comes from SSR rendering without pathname-dependent state.

### Pre-Freeze Consistency Fixes (2026-02-16)

- [x] **Fix 1 — permissionSnapshot non-nullable contract** — Replaced "missing or empty" wording in 2.2.1 with explicit V2 Contract block. Consolidated Null Safety table: removed row implying `permissionSnapshot` could be null; added defensive-check note ("this should never occur under V2 contract"). All references now consistent with non-nullable type.
- [x] **Fix 2 — Phase 4 layout snippet alignment** — Verified Phase 4.1 and 4.3 snippets already match V2 codebase (`loadDashboardContextV2`, `redirect({ href: "/sign-in", locale })`). Added gotcha in Phase 4.3 reinforcing: do NOT change these patterns, only ADD sidebar model computation.
- [x] **Fix 3 — SSR verification scope guardrail** — Added "Verification Scope Guardrail" block after Phase 4.6 acceptance criteria. Manual verification sufficient; Playwright/Cypress/E2E out of scope; no new testing frameworks to be introduced.
