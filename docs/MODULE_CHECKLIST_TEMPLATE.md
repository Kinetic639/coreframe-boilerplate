# MODULE_IMPLEMENTATION_CHECKLIST.md

> **Copy this file** to `src/modules/<new-module>/MODULE_CHECKLIST.md` and work through it
> top to bottom. Do not skip sections. Do not mark a box unless it is verifiably true.
>
> This checklist encodes the invariants of the Coreframe V2 architecture:
> SSR-first · TDD-first · Security-first · Compiled permissions · Compiled entitlements · Sidebar V2

---

## 1. Purpose & Non-Negotiables

Read these before touching any file. They are not preferences — they are architectural invariants.

### SSR-First Invariants

- [ ] Server Components are authoritative. They compute data, authorization, and sidebar model before the page renders.
- [ ] Client Components are dumb renderers. They accept pre-computed props. They do not re-evaluate permissions.
- [ ] The dashboard layout loads the authoritative context once (e.g. `loadDashboardContextV2()`), not repeated per page.
- [ ] `buildSidebarModel()` runs server-side. Production uses the `React.cache()`-wrapped version (one call per request). The result (`SidebarModel`) is a JSON prop passed to the client renderer.
- [ ] `React.cache()` provides per-request memoization — never a global singleton cache.
- [ ] No `createClient()` / Supabase client instantiation in Client Components for org-scoped data.

### TDD-First Invariants

- [ ] Tests are written alongside (or before) the implementation, not after.
- [ ] Every access-control decision has at least one negative test (prove it fails closed).
- [ ] Sidebar integration tests use `buildSidebarModelUncached` (never `buildSidebarModel`). The uncached variant avoids `React.cache()` artifacts that would leak state between test cases.
- [ ] RLS tests run against real Postgres, not mocked clients.
- [ ] `clearPermissionRegexCache()` is called in `afterEach` in every test file that uses `checkPermission`.

### UX vs. Security Boundary

- [ ] Understood: **the sidebar is a UX boundary, not a security boundary.**
- [ ] Hiding or disabling a sidebar item never prevents direct URL access.
- [ ] Disabling a sidebar item never prevents a server action from executing.
- [ ] Every route that hides a link in the sidebar also has a **server-side guard** that enforces access independently.
- [ ] Every server action that is behind a hidden sidebar item also has a **permission check** at the top of the function.

### Fail-Closed Principles

- [ ] If `organization_entitlements` is missing (no subscription), all module access checks **throw** — never silently allow.
- [ ] If `user_effective_permissions` is missing for a user, access is **denied** — never assumed.
- [ ] If a limit check fails, throws, or returns an indeterminate result, treat it as limit reached — never as unlimited (fail closed).
- [ ] Permission checks use deny-first semantics: a deny pattern overrides any allow pattern, including wildcards.

### No Raw Strings Rule

- [ ] **TypeScript code never contains raw permission strings** (e.g., `"org.update"`). Always import from `@/lib/constants/permissions`.
- [ ] **TypeScript code never contains raw module strings** (e.g., `"warehouse"`). Always import from `@/lib/constants/modules`.
- [ ] Raw string literals in SQL migrations are acceptable (e.g., `has_permission(org_id, 'org.update')`).
- [ ] Raw string literals in SQL `INSERT INTO permissions (slug) VALUES (...)` are acceptable.
- [ ] Verify: run a grep for `can("`, `requireModuleAccess("`, `hasPermission(` with a string literal argument — all must be zero hits in TypeScript files for this module.

---

## 2. Module Specification Inputs

> Fill in every field **before** writing any code. If a field is unknown, resolve it first.
> Incomplete specs are the primary cause of mismatched slugs, missing RLS, and broken entitlement gates.

### Identity

```
Module name (human):       ___________________________________
Module slug (kebab-case):  ___________________________________   (e.g. "analytics")
Constant name:             MODULE_____________________________   (e.g. MODULE_ANALYTICS)
File prefix:               ___________________________________   (e.g. analytics)
v2_ready status:           [ ] v2_ready   [ ] planned   [ ] legacy
```

### Routes

List every route this module exposes. Mark each with its guard type.

```
Route path                          Guard type (module / permission / both / public)
_________________________________   ___________________________________________________
_________________________________   ___________________________________________________
_________________________________   ___________________________________________________
_________________________________   ___________________________________________________
```

### Data Ownership & Scoping

```
Primary scope:             [ ] organization   [ ] branch   [ ] global   [ ] user-personal
organization_id required:  [ ] Yes   [ ] No
branch_id required:        [ ] Yes (all tables)   [ ] Yes (some tables)   [ ] No
Multi-branch isolation:    [ ] Required   [ ] Not applicable
Soft-delete required:      [ ] Yes (deleted_at)   [ ] No
```

### Tables / Entities

```
Table name                    Primary scope    Soft delete    PII/Sensitive
____________________________  _______________  _____________  _______________
____________________________  _______________  _____________  _______________
____________________________  _______________  _____________  _______________
```

### Permission Matrix

List every user action and the permission slug(s) required.

```
Route / Server Action                Permission slug(s) required        Deny effect
___________________________________  _________________________________  _____________________
___________________________________  _________________________________  _____________________
___________________________________  _________________________________  _____________________
___________________________________  _________________________________  _____________________
```

### Entitlement Gating

```
Is this module plan-gated?                   [ ] Yes   [ ] No
Plans that include this module:              [ ] Free   [ ] Professional   [ ] Enterprise   [ ] All
Add-on gated?                                [ ] Yes (add-on slug: ___________________)   [ ] No
Manual override supported?                   [ ] Yes   [ ] No
Module slug added to subscription_plans?     [ ] Pending   [ ] Done
```

### Limits

```
Limit key                              Enforcement point (Server Component / Server Action / Both)
___________________________________   ___________________________________________________________
___________________________________   ___________________________________________________________
```

### i18n Keys Required

```
Sidebar title key:        modules.___________.title
Page title key:           ___________________________________
Error message keys:       ___________________________________
                          ___________________________________
Other keys needed:        ___________________________________
```

### Risks & Edge Cases

```
[ ] Multi-branch data isolation is required
[ ] Soft-delete means deleted rows must be excluded from queries (deleted_at IS NULL)
[ ] Exports or bulk operations are count-limited (enforce at the guard layer, not just DB)
[ ] FORCE RLS required (tables contain PII / audit logs / billing data)
[ ] Module has a "coming_soon" sidebar entry before full release
[ ] Module reuses an existing slug from another context (risk: slug collision)
[ ] Other: _________________________________________________________________
```

---

## 3. Repo Integration Map

Every file or location a developer must touch to fully integrate this module.

### Constants

- [ ] `src/lib/constants/modules.ts` — add `MODULE_YOURMODULE` constant and update `ModuleSlug` union; update any module allowlists/arrays present in this file (if applicable)
- [ ] `src/lib/constants/permissions.ts` — add new permission slug constants and update `PermissionSlug` union + `ALL_PERMISSION_SLUGS` array

### Entitlements Types (if adding a new limit key)

- [ ] `src/lib/types/entitlements.ts` — add to `LIMIT_KEYS` object and `LimitKey` union type

### Database Migrations

- [ ] `supabase/migrations/[timestamp]_create_[module]_tables.sql` — schema + indexes
- [ ] `supabase/migrations/[timestamp]_rls_[module].sql` — RLS ENABLE, FORCE, policies
- [ ] `supabase/migrations/[timestamp]_permissions_[module].sql` — INSERT INTO permissions + role_permissions
- [ ] `supabase/migrations/[timestamp]_entitlements_[module].sql` — UPDATE subscription_plans.enabled_modules / limits (if gated)

### Server Layer

- [ ] `src/server/services/[module].service.ts` — static service class
- [ ] `src/app/actions/[module]/index.ts` — server actions (with guards at top of each)

### Client / App Layer

- [ ] `src/hooks/queries/[module]/index.ts` — React Query hooks
- [ ] `src/app/[locale]/dashboard/[module]/page.tsx` — Server Component + entitlements guard
- [ ] `src/app/[locale]/dashboard/[module]/loading.tsx`
- [ ] `src/app/[locale]/dashboard/[module]/error.tsx`
- [ ] `src/app/[locale]/dashboard/[module]/_components/[module]-page-client.tsx`

### Module Metadata

- [ ] `src/modules/[module]/config.ts` — ModuleConfig (widgets, metadata only — not navigation)
- [ ] `src/modules/index.ts` — register the new module in `getAllModules()`

### Sidebar V2 (Navigation)

- [ ] `src/lib/sidebar/v2/registry.ts` — add entry to `MAIN_NAV_ITEMS` or `FOOTER_NAV_ITEMS`
- [ ] `src/lib/sidebar/v2/icon-map.ts` — add icon if using a new key

### i18n

- [ ] `messages/en.json` — add all required keys
- [ ] `messages/pl.json` — add all required keys

### Tests

- [ ] `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` — update/add SSR integration test for new sidebar items
- [ ] `src/server/services/__tests__/[module].service.test.ts` — unit tests for service layer
- [ ] `src/app/actions/__tests__/[module].test.ts` — guard and action tests
- [ ] `supabase/tests/rls_[module].test.sql` (or TypeScript equivalent) — RLS isolation tests

---

## 4. Step-by-Step Build Flow

Work through each domain in order. Complete one domain fully before moving to the next.

---

### A. Constants & Types

- [ ] Add `MODULE_YOURMODULE = "your-module" as const` to `src/lib/constants/modules.ts`
- [ ] Add `MODULE_YOURMODULE` to the `ModuleSlug` type union
- [ ] Update any `ModuleSlug` unions or module allowlist arrays present in `modules.ts` (if the repo uses them); the authoritative plan gating lives in `subscription_plans.enabled_modules` via the entitlements system
- [ ] For each new permission, add a named constant to `src/lib/constants/permissions.ts` (e.g., `export const YOURMODULE_READ = "yourmodule.read" as const`)
- [ ] Add each new constant to `PermissionSlug` type union
- [ ] Add each new constant to `ALL_PERMISSION_SLUGS` array
- [ ] If adding a new limit, add it to `LIMIT_KEYS` in `src/lib/types/entitlements.ts` and to `LimitKey` union
- [ ] Verify: run `npm run type-check` — zero new errors

**Confirm no raw strings introduced:**

- [ ] Grep `src/` for `can("your-module` → zero matches
- [ ] Grep `src/` for `requireModuleAccess("your-module` → zero matches
- [ ] Grep `src/` for `"yourmodule.` (raw permission string) → zero matches in `.ts`/`.tsx` files

---

### B. Database Schema

- [ ] Create migration file `[timestamp]_create_[module]_tables.sql`
- [ ] Every table includes: `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`
- [ ] Every org-scoped table includes: `organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE`
- [ ] Branch-scoped tables include: `branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL` (or CASCADE — document decision)
- [ ] Soft-delete tables include: `deleted_at timestamptz DEFAULT NULL`
- [ ] All tables include: `created_at timestamptz DEFAULT now() NOT NULL`, `updated_at timestamptz DEFAULT now() NOT NULL`, `created_by uuid REFERENCES auth.users(id)`
- [ ] Index on `organization_id` for every table
- [ ] Index on `(organization_id, deleted_at)` for soft-deleted tables
- [ ] Index on `branch_id` if used
- [ ] Index on columns used in frequent WHERE filters
- [ ] Migration is idempotent where possible (use `IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` pattern)
- [ ] TypeScript types regenerated: `npm run supabase:gen:types`
- [ ] Verify generated types exist in `supabase/types/types.ts` for new tables

---

### C. RLS & Security in DB

> RLS is a hard requirement. Every table with org data must have policies before any application code reads or writes it.

- [ ] `ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;` — all new tables
- [ ] For tables containing PII, audit logs, billing, or permission data: `ALTER TABLE public.your_table FORCE ROW LEVEL SECURITY;`
- [ ] **SELECT policy** exists using `is_org_member(organization_id)`:
  ```sql
  USING (is_org_member(organization_id) AND deleted_at IS NULL)
  ```
- [ ] **INSERT policy** exists using `has_permission(organization_id, 'yourmodule.create')` (raw string in SQL is acceptable)
- [ ] **UPDATE policy** exists — covers both normal updates AND soft-deletes in a single policy:
  ```sql
  -- NOTE: WITH CHECK must mirror USING unless intentionally restricting updates.
  -- See canonical update + escalation pattern in MODULE_DEVELOPMENT_GUIDE.md.
  USING (is_org_member(organization_id))
  WITH CHECK (has_permission(organization_id, 'yourmodule.update'))
  ```
- [ ] **DELETE policy** — only if hard-delete is used (prefer soft-delete + UPDATE policy)
- [ ] No overly broad policies (e.g., `USING (true)` or `TO authenticated` without org scoping)
- [ ] Do not write directly to `user_effective_permissions`, `organization_entitlements`, or `user_permission_overrides` — these are managed by DB triggers only
- [ ] **Verify RLS**: run a cross-tenant isolation test — confirm org A cannot see org B's rows
- [ ] **Verify fail-closed**: unauthenticated access must not return any rows and must not leak cross-tenant data — whether the DB returns zero rows or an auth error is acceptable; what is never acceptable is returning another tenant's data

---

### D. Permissions (RBAC V2 Compile Model)

> Permissions are compiled into `user_effective_permissions` by DB triggers. Application code reads the compiled snapshot — it does not join roles at request time.

All server-side permission checks must use `PermissionServiceV2` and the compiled permission snapshot; do not join roles/permissions at request time.

- [ ] Create migration `[timestamp]_permissions_[module].sql`
- [ ] Insert new slugs into `public.permissions` table:
  ```sql
  INSERT INTO public.permissions (slug, description, module)
  VALUES ('yourmodule.read', 'Read yourmodule data', 'yourmodule')
  ON CONFLICT (slug) DO NOTHING;
  ```
- [ ] Assign permissions to appropriate roles in `public.role_permissions`:
  - Document which roles get which permissions (e.g., `org_owner` gets wildcard `yourmodule.*`, `org_member` gets `yourmodule.read` only)
- [ ] Verify the slug in the migration exactly matches the constant in `src/lib/constants/permissions.ts` — copy-paste, don't retype
- [ ] Verify `user_effective_permissions` re-compiles after migration (trigger should fire; if not, manually check the trigger definition)
- [ ] **Wildcard consideration**: does `org_owner` need `yourmodule.*`? Document the decision:
  ```
  org_owner:    [ ] yourmodule.*   [ ] explicit slugs only
  org_member:   [ ] yourmodule.*   [ ] yourmodule.read only   [ ] none
  branch_admin: [ ] yourmodule.*   [ ] subset   [ ] none
  ```
- [ ] **Deny consideration**: are there actions that must be explicitly deniable even for owners? Document:
  ```
  Action requiring explicit deny capability: ___________________________________
  ```
- [ ] Prove by test: a user with `allow: ["yourmodule.*"]` and `deny: ["yourmodule.delete"]` cannot delete

---

### E. Entitlements (Compiled Snapshot)

> Entitlements describe what an org may do based on its subscription. They are compiled into `organization_entitlements`. Do not query `subscription_plans` directly.

**Guard placement rules (non-negotiable):**

- **Server Components / layouts / route handlers**: use `requireModuleOrRedirect(MODULE_YOURMODULE)` when a redirect UX is appropriate, or `requireModuleAccess(MODULE_YOURMODULE)` when you want to throw instead.
- **Server Actions**: always use `requireModuleAccess(MODULE_YOURMODULE)` — never `requireModuleOrRedirect` (calling `redirect()` inside a server action causes unintended navigation behavior). Wrap errors with `mapEntitlementError(error)` and return `{ success: false, error: mapped.message }`.

- [ ] If module is plan-gated: create migration to add `MODULE_YOURMODULE` slug to `subscription_plans.enabled_modules` for the applicable plan(s), **following the exact pattern used in existing migrations in this repo** (column type and concatenation syntax may vary):
  ```sql
  -- Example only — verify column type and syntax against existing migrations before using:
  -- UPDATE public.subscription_plans
  --   SET enabled_modules = enabled_modules || '["your-module"]'::jsonb
  --   WHERE name IN ('professional', 'enterprise');
  ```
- [ ] Verify `organization_entitlements.enabled_modules` is updated for test orgs after migration
- [ ] If adding limits: add limit key to `subscription_plans.limits` JSONB for each plan tier
- [ ] Verify `LIMIT_KEYS.YOURMODULE_MAX_X` constant matches the key string in `subscription_plans.limits`
- [ ] `requireModuleOrRedirect(MODULE_YOURMODULE)` — use ONLY in Server Components and Route Handlers (never in Server Actions)
- [ ] `requireModuleAccess(MODULE_YOURMODULE)` — use in layouts and Server Actions
- [ ] `requireWithinLimit(LIMIT_KEYS.YOURMODULE_MAX_X)` — call BEFORE creating a new row for any limit-tracked resource
- [ ] `checkLimit(LIMIT_KEYS.YOURMODULE_MAX_X)` — use for non-blocking UI feedback; if it fails or returns an indeterminate result, treat as limit reached (fail closed)
- [ ] Confirm: if `organization_entitlements` row is missing, the module check **throws** — verify this is handled with `mapEntitlementError` in server actions
- [ ] Fail-closed test: an org with no entitlements row cannot access any gated route or action

---

### F. Server Guards (Real Enforcement at Runtime)

> The sidebar hiding a link is NOT enforcement. These guards are the enforcement layer.

For every route in this module:

- [ ] Route: `__________________________` has guard: `entitlements.requireModuleOrRedirect(MODULE_YOURMODULE)` in its Server Component
- [ ] Route: `__________________________` has guard: `PermissionServiceV2.hasPermission(...)` for permission-gated operations
- [ ] Route: `__________________________` has guard: _(repeat for each route)_

For every server action in this module:

- [ ] Action: `__________________________` calls `entitlements.requireModuleAccess(MODULE_YOURMODULE)` at the top (before any data access)
- [ ] Action: `__________________________` calls `PermissionServiceV2.hasPermission(supabase, userId, orgId, PERMISSION_CONSTANT)` before any mutation
- [ ] Action: `__________________________` wraps entitlement errors with `mapEntitlementError(error)` and returns `{ success: false, error: mapped.message }`
- [ ] Action: `__________________________` _(repeat for each action)_

Invariant checklist:

- [ ] Verify: manually type the route URL while logged in as a user without module access → redirected or 403, not rendered
- [ ] Verify: call a protected server action directly (simulate form POST) as a user without permission → returns `{ success: false }`, not data
- [ ] Verify: no route in this module relies solely on sidebar visibility for access control

---

### G. Sidebar V2 (UX Integration)

> The Sidebar V2 registry is the single source of truth for navigation. `ModuleConfig` is for widgets and metadata only — it does not drive sidebar rendering.

- [ ] Add entry to `MAIN_NAV_ITEMS` or `FOOTER_NAV_ITEMS` in `src/lib/sidebar/v2/registry.ts`
- [ ] Entry uses imported constants — not raw strings:
  ```typescript
  import { MODULE_YOURMODULE } from "@/lib/constants/modules";
  import { YOURMODULE_READ } from "@/lib/constants/permissions";
  // visibility: { requiresModules: [MODULE_YOURMODULE], requiresPermissions: [YOURMODULE_READ] }
  ```
- [ ] `iconKey` value exists in `src/lib/sidebar/v2/icon-map.ts` — if not, add it there
- [ ] `titleKey` exists in `messages/en.json` and `messages/pl.json`; English `title` fallback is also set
- [ ] `href` is set for active items; `href` is `undefined` for `coming_soon` items
- [ ] If the module is not yet released: set `status: "coming_soon"` — item renders disabled, no href, regardless of user permissions
- [ ] If the module should show as a teaser for upgrade: set `showWhenDisabled: true` — item appears disabled with `disabledReason: "entitlement"`
- [ ] If the module has child links (group): parent carries `requiresModules`, children carry their individual `requiresPermissions`
- [ ] Confirm parent pruning: if all children are pruned, the parent group disappears (no empty groups rendered)
- [ ] Confirm: client renderer (`AppSidebar` in `dashboard-shell.tsx`) never reads `permissionSnapshot` or `entitlements` — it renders the model as-is
- [ ] Confirm: `ModuleConfig` (`src/modules/[module]/config.ts`) does NOT contain navigation hrefs that duplicate registry entries

---

### H. Tests (TDD-First Proof)

> Tests are not optional. "It works in the browser" is not a test.

**Sidebar SSR Integration Tests** (`src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx`):

- [ ] Test: module item appears when `enabled_modules` includes `"your-module"` and user has the required permission
- [ ] Test: module item is **absent** when `enabled_modules` does NOT include `"your-module"` (free plan)
- [ ] Test: module item is **absent** when user lacks the required permission slug
- [ ] Test: `showWhenDisabled: true` item appears as disabled (not absent) when user lacks access
- [ ] `afterEach(() => clearPermissionRegexCache())` is present in the test file

**Unit Tests — Service Layer** (`src/server/services/__tests__/[module].service.test.ts`):

- [ ] Happy path: correct org-scoped data is returned
- [ ] Isolation: queries are scoped to `organization_id` (prove by checking the query argument in mock)
- [ ] Soft-delete: deleted rows are excluded from list queries

**Unit Tests — Server Actions** (`src/app/actions/__tests__/[module].test.ts`):

- [ ] Guard test: action returns `{ success: false }` when user lacks module access
- [ ] Guard test: action returns `{ success: false }` when user lacks required permission
- [ ] Guard test: action returns `{ success: false }` when limit is exceeded
- [ ] Happy path: action succeeds and returns correct shape

> Mocked tests are allowed for service logic; RLS enforcement must be verified with real DB tests.

**RLS Integration Tests** (real Postgres — not mocked):

- [ ] Org A cannot SELECT rows belonging to Org B
- [ ] Org A cannot UPDATE rows belonging to Org B
- [ ] User without `yourmodule.create` permission cannot INSERT (RLS WITH CHECK blocks it)
- [ ] Unauthenticated access returns no rows and leaks no cross-tenant data (fail closed; error vs empty is acceptable, cross-tenant exposure is not)

**Negative / Fail-Closed Tests**:

- [ ] Missing entitlements → module access throws, not silently allows
- [ ] Missing permission → action returns error, not data
- [ ] Limit check failure (any error or indeterminate result) → treated as limit reached in calling code (fail closed)

**Final Build Gate**:

- [ ] `npm run type-check` — zero errors
- [ ] `npx vitest run` — all tests pass (run full suite, not just this module's tests)
- [ ] `npm run build` — succeeds with no errors

---

### I. i18n / Metadata / UX Finishing

- [ ] `messages/en.json` — all required keys added (sidebar title, page titles, error messages)
- [ ] `messages/pl.json` — all keys translated (or placeholder added)
- [ ] `titleKey` in sidebar registry resolves correctly — verify with a test or browser check
- [ ] Error messages returned from server actions use `mapEntitlementError(error).message` — not raw error strings
- [ ] Toast notifications use `react-toastify` only — no `sonner` imports
- [ ] `toast.success`, `toast.error`, `toast.info`, `toast.warning` — correct variants used
- [ ] Loading states: `loading.tsx` exists and uses a skeleton appropriate for the module
- [ ] Error boundary: `error.tsx` exists and provides a recoverable error state (not a blank page)
- [ ] Accessibility: interactive elements have accessible labels (button text, aria-label on icon-only buttons)

---

### J. Release / Verification Checklist

- [ ] `npm run type-check` → clean
- [ ] `npx vitest run` → all passing (zero skipped tests that matter)
- [ ] `npm run build` → succeeds
- [ ] Kill dev server: `pnpm dev` is terminated (per project convention)
- [ ] **Smoke — module access gate**: log in as a free-plan user → direct URL to gated route → redirected to `/upgrade` (or equivalent), not rendered
- [ ] **Smoke — permission gate**: log in as a user without required permission → direct URL → blocked server-side
- [ ] **Smoke — server action gate**: submit a protected form as an unauthorized user (use browser devtools to bypass client UI) → action returns `{ success: false }`, not data
- [ ] **Smoke — sidebar UX**: log in as authorized user → module appears in sidebar; log in as unauthorized user → module does not appear
- [ ] **Smoke — coming_soon** (if applicable): item renders disabled with no href, not navigable
- [ ] No TypeScript `any` types introduced by this module
- [ ] No `console.log` / debug statements left in production paths
- [ ] No new ESLint warnings introduced that are suppressed with `// eslint-disable`
- [ ] **Service role key is NOT used in any request-time code** (pages, layouts, server actions, route handlers). Service role is allowed only in integration tests, seed scripts, and CLI tooling.

**Diff discipline (PR / output gate):**

- [ ] Only files necessary for this module were changed — no unrelated refactors or formatting-only edits in other modules
- [ ] No commented-out code or debug artifacts left in the diff
- [ ] PR/commit scope matches the module spec — no side-creep into unrelated systems
- [ ] At least one reviewer verifies RLS policies and guard placement

---

### K. Entitlements Gate (MANDATORY IF MODULE IS PLAN-GATED)

> Skip this section only if the module is available on all plans without gating.

- [ ] Module slug constant added to `src/lib/constants/modules.ts`
- [ ] No raw module slug strings anywhere in TypeScript code for this module
- [ ] Subscription plan or add-on updated to include the module slug (migration applied)
- [ ] Verified: compiled `organization_entitlements.enabled_modules` includes the slug for an entitled org (query the DB)
- [ ] Verified: slug is NOT present in `organization_entitlements.enabled_modules` for a free/unentitled org
- [ ] Page-level server guard implemented: `entitlements.requireModuleAccess(MODULE_YOURMODULE)` or `requireModuleOrRedirect(MODULE_YOURMODULE)` in every page
- [ ] All server actions enforce module access at top (before any data access)

---

### L. Sidebar V2 Registry Integration (MANDATORY IF MODULE HAS UI ROUTES)

> Skip this section only if the module has no user-facing dashboard routes.

- [ ] Registry entry added to `MAIN_NAV_ITEMS` or `FOOTER_NAV_ITEMS` in `src/lib/sidebar/v2/registry.ts`
- [ ] Entry uses module and permission constants only — no raw strings
- [ ] `visibility.requiresModules` set to `[MODULE_YOURMODULE]` (if plan-gated)
- [ ] `visibility.requiresPermissions` or `requiresAnyPermissions` set using permission constants
- [ ] SSR sidebar integration test updated or added in `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx`
- [ ] Verified: org owner / entitled user sees the sidebar item
- [ ] Verified: member without permission does NOT see the sidebar item

---

### M. Permission Slug Integrity Verification

- [ ] All permission constants in `src/lib/constants/permissions.ts` exactly match slugs in the `public.permissions` DB table (copy-paste match, verified by query)
- [ ] No permission slug used in application code is absent from the DB `permissions` table
- [ ] No outdated or removed slugs referenced anywhere in this module's TypeScript
- [ ] No raw permission strings in any `.ts` or `.tsx` file for this module (grep confirms zero hits)

---

### N. UI Responsiveness Verification

- [ ] Verified layout at 390px viewport width — no horizontal overflow
- [ ] Primary actions (create, save, submit) are reachable and tappable on mobile
- [ ] Sidebar collapse/expand state does not obscure module content on small screens
- [ ] No layout breakpoints cause primary actions or content to be hidden or unreachable
- [ ] Tables or data-dense views have a mobile-appropriate fallback (horizontal scroll or card layout)

---

## 5. Definition of Done (Enterprise-Grade Gate)

A module is **not complete** unless every statement below is verifiably true:

- [ ] **Constants**: module slug constant exists in `modules.ts`; all permission constants exist in `permissions.ts`; `PermissionSlug` and `ModuleSlug` union types are updated
- [ ] **No raw strings**: grep of `src/` finds zero raw permission or module strings in TypeScript files for this module
- [ ] **Database**: all tables have `ENABLE ROW LEVEL SECURITY` (and `FORCE ROW LEVEL SECURITY` for sensitive tables)
- [ ] **RLS policies**: SELECT, INSERT, UPDATE policies exist and are tenant-scoped using `is_org_member()` and `has_permission()`
- [ ] **RLS tests**: cross-tenant isolation is proven by a test, not assumed
- [ ] **Permission rows**: new slugs are inserted into `public.permissions` table via migration and assigned to roles in `public.role_permissions`
- [ ] **Entitlements**: if module is plan-gated, it is listed in `subscription_plans.enabled_modules` for the correct plans; the compiled `organization_entitlements` snapshot reflects this
- [ ] **Server guards**: every route has an `entitlements.requireModuleOrRedirect()` or `requireModuleAccess()` call; every mutating server action has both a module check and a permission check
- [ ] **Sidebar registry**: entry exists in `src/lib/sidebar/v2/registry.ts`; uses constants, not raw strings; `iconKey` is valid; `titleKey` resolves
- [ ] **No client-side authorization logic**: `usePermissions()` is used for UX only; no route or data is protected solely by client-side checks
- [ ] **Tests pass**: `npx vitest run` is clean; sidebar SSR tests cover the new module; guard tests cover fail-closed cases; RLS tests cover isolation
- [ ] **Type-check passes**: `npm run type-check` is clean
- [ ] **Build passes**: `npm run build` succeeds
- [ ] **i18n keys exist**: all `titleKey` values and user-facing strings have entries in both `en.json` and `pl.json`
- [ ] **No direct writes to compiled tables**: no application code writes to `user_effective_permissions`, `organization_entitlements`, or `user_permission_overrides`
- [ ] **No service role at runtime**: service role key does not appear in any page, layout, server action, or route handler for this module; allowed only in tests/seed/CLI

---

## 6. Common Failure Modes (Anti-Footguns)

These are the most common "looks done but isn't" mistakes. Check each before declaring done.

- [ ] **Route exists but no server-side guard** — sidebar hides the link, but a user who types the URL directly gets the page. Verify by direct navigation without the sidebar.

- [ ] **Sidebar shows the link but module is not enabled in the plan** — the registry entry has `requiresModules` set, but the slug was never added to `subscription_plans.enabled_modules`. Result: the link appears for all users on all plans. Fix: run the entitlements migration.

- [ ] **Permission constant added to `permissions.ts` but not inserted into the DB** (or vice versa) — `PermissionServiceV2` checks the compiled `user_effective_permissions` table. If the slug was never inserted into `public.permissions` and assigned via `role_permissions`, no user will ever have it, even with a wildcard role. Fix: verify the migration ran and the slug exists in `SELECT * FROM public.permissions WHERE slug = '...'`.

- [ ] **RLS enabled but not FORCE RLS on a sensitive table** — service role or table owner can bypass RLS. Fix: use `FORCE ROW LEVEL SECURITY` for tables with PII, audit logs, billing data, or permission data.

- [ ] **Wrong policy command type** — UPDATE policy is missing a `WITH CHECK` clause; INSERT policy uses `USING` instead of `WITH CHECK`. Both silently allow the wrong behavior. Fix: review each policy with `\d+ your_table` in psql.

- [ ] **Limits defined in `LIMIT_KEYS` but never enforced** — `requireWithinLimit` is not called before the create action. The limit key exists, the entitlement has the value, but the enforcement is missing. Fix: add the guard to every server action that creates a limit-tracked resource.

- [ ] **`coming_soon` item accidentally has an `href`** — item is disabled visually but navigable. Fix: `coming_soon` items must have `href: undefined`.

- [ ] **`ModuleConfig` navigation items duplicate sidebar registry entries** — developer added routes to `config.ts` expecting them to appear in the sidebar, but `ModuleConfig` does not drive the sidebar. Fix: all navigation belongs in `src/lib/sidebar/v2/registry.ts` only.

- [ ] **Raw module or permission strings in TypeScript** — developer bypassed constants "just for this one case." These silently drift when slugs are renamed. Fix: import the constant. If the constant doesn't exist yet, create it.

- [ ] **`buildSidebarModel` (cached) used in tests** — React `cache()` does not reset between tests; test isolation is broken. Fix: always use `buildSidebarModelUncached` in test files.

- [ ] **`clearPermissionRegexCache()` missing from `afterEach`** — regex cache from test N leaks into test N+1, causing false positives or false negatives. Fix: add `afterEach(() => clearPermissionRegexCache())` to every test file that calls `checkPermission` or `buildSidebarModelUncached`.

- [ ] **Server action uses `requireModuleOrRedirect`** — `redirect()` inside a server action produces unintended behavior (navigation side-effect instead of error return). Fix: use `requireModuleAccess()` in actions; use `requireModuleOrRedirect()` only in Server Components and Route Handlers.

- [ ] **Client component re-evaluates permissions** — `usePermissions()` is used to gate data fetching, not just UI visibility. A determined user can manipulate client state. Fix: server actions must independently verify permissions; client checks are UX-only.

- [ ] **TypeScript types not regenerated after migration** — new tables exist in Postgres but not in `supabase/types/types.ts`. Service code uses `any` or type assertions. Fix: run `npm run supabase:gen:types` after every migration.

---

_Checklist version: February 2026 — aligned with Permissions V2, Entitlements V2, Sidebar V2_
_Architecture invariants sourced from: PERMISSIONS_ARCHITECTURE, ENTITLEMENTS_ARCHITECTURE, SIDEBAR_V2, MODULE_DEVELOPMENT_GUIDE_
