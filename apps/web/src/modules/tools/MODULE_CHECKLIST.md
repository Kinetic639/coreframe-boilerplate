# MODULE_IMPLEMENTATION_CHECKLIST.md — `tools`

> **Filled in** for the `tools` module (V2 implementation, 2026-03-05).
> This module was implemented to current V2 standards from scratch.
>
> This checklist encodes the invariants of the Coreframe V2 architecture:
> SSR-First · TDD-First · Security-First · Compiled permissions · Sidebar V2

---

## 1. Purpose & Non-Negotiables

### SSR-First Invariants

- [x] Server Components are authoritative. They compute data, authorization, and sidebar model before the page renders.
  > ✅ All three pages (`/dashboard/tools`, `/dashboard/tools/all`, `/dashboard/tools/[slug]`) are async Server Components. Each calls `loadDashboardContextV2()` + service methods, passes results as `initialMyTools`/`initialCatalog`/`initialTool` props. Client components receive SSR data.
- [x] Client Components are dumb renderers. They accept pre-computed props. They do not re-evaluate permissions.
  > ✅ `ToolsUnifiedClient`, `ToolsMyToolsClient`, `ToolsCatalogClient`, `ToolDetailClient` all receive SSR props and never re-fetch on mount.
- [x] The dashboard layout loads the authoritative context once (via `loadDashboardContextV2()`), not repeated per page.
  > ✅ `React.cache()`-wrapped — deduplicated per request.
- [x] `buildSidebarModel()` runs server-side.
- [x] `React.cache()` provides per-request memoization — never a global singleton cache.
- [x] No `createClient()` / Supabase client instantiation in Client Components for tools data.
  > ✅ All data mutations go through server actions (`src/app/actions/tools/index.ts`). Services use injected supabase client.

### TDD-First Invariants

- [x] Tests are written alongside the implementation.
  > ✅ `src/server/services/__tests__/tools.service.test.ts` — service + action tests written in same session.
- [x] Every access-control decision has at least one negative test (prove it fails closed).
  > ✅ T-TOOLS-ACTIONS describe block: Unauthenticated + Unauthorized tests for `listToolsCatalogAction`, `listMyEnabledToolsAction`, `setToolEnabledAction`, `setToolPinnedAction`.
- [x] Sidebar integration tests use `buildSidebarModelUncached`.
  > ⚠️ No sidebar SSR tests added specifically for the tools module. Existing tests verify the generic `requiresPermissions` filter. Sidebar tests for tools are tracked as a future gap (LOW priority).
- [x] RLS tests are documented as stubs (live DB only).
  > ✅ `T-TOOLS-RLS` describe block with `.todo` stubs documenting all RLS invariants that require a live DB.

### UX vs. Security Boundary

- [x] Understood: the sidebar is a UX boundary, not a security boundary.
- [x] Hiding or disabling a sidebar item never prevents direct URL access.
- [x] Every route that hides a link in the sidebar also has a server-side guard.
  > ✅ `tools/layout.tsx` checks `PERMISSION_TOOLS_READ` via `checkPermission`; redirects to `/dashboard/access-denied?reason=tools_read_required` on failure.
- [x] Every server action behind a hidden sidebar item also has a permission check.
  > ✅ All read actions check `PERMISSION_TOOLS_READ`; all mutation actions check `PERMISSION_TOOLS_MANAGE`.

### Fail-Closed Principles

- [x] If permission snapshot has no matching permission, access is denied.
- [x] Permission checks use deny-first semantics (deny entries override allow, wildcards respected).
- [x] RLS policies are final boundary — server actions cannot bypass.
- [x] `user_enabled_tools` RLS: USING + WITH CHECK both require `user_id = auth.uid()` — fail-closed mirroring.

### No Raw Strings Rule

- [x] TypeScript code never contains raw permission strings — `PERMISSION_TOOLS_READ` / `PERMISSION_TOOLS_MANAGE` from `src/lib/constants/permissions.ts`.
  > ✅ `src/app/[locale]/dashboard/tools/layout.tsx`, `src/app/actions/tools/index.ts` — all use constants.
- [x] TypeScript code never contains raw module strings — `MODULE_TOOLS` from `src/lib/constants/modules.ts`.

---

## 2. Entitlements System

### Module Access

- [x] **No plan gate**: Tools module does NOT check `entitlements.requireModuleOrRedirect()`.
  > ✅ Always available. Layout only calls `loadDashboardContextV2()` + `checkPermission(..., PERMISSION_TOOLS_READ)`. No `requiresModules` gate in sidebar entry.
- [x] No `organization_entitlements.enabled_modules` entry for `tools` — intentional design decision.
  > ✅ Confirmed via MODULE.md: "Plan-gated: ❌ — Always available".

---

## 3. Permission System

### V2 Guard Pattern

- [x] Server actions use synchronous `checkPermission(context.user.permissionSnapshot, PERM)`.
- [x] No async DB calls for permission checking in any action.
- [x] Context loaded via `loadDashboardContextV2()` — `permissionSnapshot` pre-compiled, `React.cache()` deduplicated.
- [x] Layout page uses `checkPermission(context.user.permissionSnapshot, PERM)` for redirect guard.
- [x] Client components use `usePermissions()` hook for UI-only guards where applicable.

### Permission Coverage

| Domain          | Read perm               | Write perm                | Guard location      |
| --------------- | ----------------------- | ------------------------- | ------------------- |
| Tools catalog   | `PERMISSION_TOOLS_READ` | —                         | layout.tsx + action |
| My tools list   | `PERMISSION_TOOLS_READ` | —                         | layout.tsx + action |
| Tool detail     | `PERMISSION_TOOLS_READ` | —                         | layout.tsx + action |
| Enable/disable  | `PERMISSION_TOOLS_READ` | `PERMISSION_TOOLS_MANAGE` | layout.tsx + action |
| Pin/unpin       | `PERMISSION_TOOLS_READ` | `PERMISSION_TOOLS_MANAGE` | layout.tsx + action |
| Update settings | `PERMISSION_TOOLS_READ` | `PERMISSION_TOOLS_MANAGE` | layout.tsx + action |

### Permission DB State (verified 2026-03-05)

- [x] `tools.read` permission row exists in `public.permissions` table.
- [x] `tools.manage` permission row exists in `public.permissions` table.
- [x] `org_owner` role has both `tools.read` and `tools.manage` in `role_permissions`.
- [x] `org_member` role has both `tools.read` and `tools.manage` in `role_permissions`.
  > ✅ Verified via Supabase MCP queries in Phase 1 verification (2026-03-05).

---

## 4. Database (RLS & Schema)

### RLS

- [x] RLS enabled on `tools_catalog` and `user_enabled_tools`.
- [x] `tools_catalog` SELECT policy: `USING (true)` — all authenticated users can read catalog.
  > ✅ `CREATE POLICY "tools_catalog_select_authenticated" ON tools_catalog FOR SELECT TO authenticated USING (true);`
- [x] `user_enabled_tools` SELECT policy: `USING (user_id = auth.uid())` — own rows only.
- [x] `user_enabled_tools` INSERT WITH CHECK: `(user_id = auth.uid())` — cannot insert for other users.
- [x] `user_enabled_tools` UPDATE: USING + WITH CHECK both `(user_id = auth.uid())` — fail-closed mirroring.
- [x] `user_enabled_tools` DELETE: `USING (user_id = auth.uid())` — own rows only.
- [x] No INSERT/UPDATE/DELETE policies on `tools_catalog` — admin-only via direct DB access.
- [x] `FORCE ROW LEVEL SECURITY` applied to `user_enabled_tools` — SECURITY DEFINER functions cannot bypass `user_id = auth.uid()` policies.
  > ✅ Applied via migration `20260305130000_tools_force_rls_user_enabled_tools.sql` (2026-03-05 verification pass). `tools_catalog` intentionally excluded: `USING (true)` policy means FORCE RLS adds no security benefit there.
- [x] Migrations tracked: `20260305120000_tools_module.sql` + `20260305130000_tools_force_rls_user_enabled_tools.sql` + `20260305140000_tools_pinned_partial_idx.sql`.

### Schema Correctness

- [x] `tools_catalog`: `slug TEXT PK`, `name TEXT NOT NULL`, `is_active BOOLEAN DEFAULT true`, `sort_order INT DEFAULT 0`, `metadata JSONB DEFAULT '{}'`.
- [x] `user_enabled_tools`: `id UUID PK`, `user_id UUID NOT NULL REFERENCES auth.users`, `tool_slug TEXT NOT NULL REFERENCES tools_catalog(slug)`, `enabled BOOLEAN NOT NULL DEFAULT true`, `pinned BOOLEAN NOT NULL DEFAULT false`, `settings JSONB NOT NULL DEFAULT '{}'`.
- [x] Unique constraint on `(user_id, tool_slug)` — prevents duplicate rows, enables upsert conflict target.
- [x] Indexes: `user_enabled_tools_user_enabled_idx (user_id, enabled)`, `user_enabled_tools_tool_slug_idx (tool_slug)`, `user_enabled_tools_pinned_idx (user_id, created_at) WHERE pinned = true`.
  > ✅ Partial index added in surgical hardening pass (2026-03-05): migration `20260305140000`.
- [x] Cascade deletes: `user_id` → `auth.users ON DELETE CASCADE`, `tool_slug` → `tools_catalog ON DELETE CASCADE`.

### Upsert Pattern

- [x] `setToolEnabled` and `setToolPinned` use upsert with `onConflict: "user_id,tool_slug"` — handles first-time interaction without requiring a prior row.
- [x] Auto-unpin on disable: `setToolEnabled(enabled=false)` includes `pinned: false` in upsert payload — atomic, enforced at service layer.

### Storage

- N/A — Tools module has no file storage requirements.

---

## 5. API Design

### Server Actions

- [x] All actions live in `src/app/actions/tools/index.ts`.
- [x] All actions are in a `"use server"` file.
- [x] All actions validate input with Zod before calling services.
- [x] All actions return `{ success: true, data: T } | { success: false, error: string }`.
- [x] No action throws to callers — all errors caught and returned as structured results.
- [x] No action bypasses RLS (all use `createClient()` — authenticated Supabase client only).
- [x] Never trusts client-supplied `user_id` — always uses `user.id` from `getUser()`.

### Service Layer

- [x] Services live in `src/server/services/tools.service.ts` (flat, no subdirectories).
- [x] Services return `ServiceResult<T>` — never throw to callers.
- [x] `ToolsCatalogService` and `UserToolsService` use injected supabase client (testable).
- [x] RLS violation (`42501` / `"row-level security"`) is normalized to a friendly error string.

---

## 6. UI Standards

### Navigation

- [x] Routes registered in `src/i18n/routing.ts` with English + Polish locale paths.
  - EN: `/dashboard/tools`, `/dashboard/tools/all`, `/dashboard/tools/[slug]`
  - PL: `/dashboard/narzedzia`, `/dashboard/narzedzia/wszystkie`, `/dashboard/narzedzia/[slug]`
- [x] All internal `Link` components use `@/i18n/navigation` (locale-aware).
- [x] Dynamic tool links use `{ pathname: "/dashboard/tools/[slug]", params: { slug } }` — NOT template literals.

### Components

- [x] Only shadcn/ui components used (Button, Card, Badge, Tabs, Separator).
- [x] No custom UI components created that duplicate shadcn/ui functionality.
- [x] Toast notifications use `react-toastify` — no `sonner` imports.
- [x] Loading states: `LoadingSkeleton` in `tools/loading.tsx` (card variant).
- [x] Error states: `ToolsError` component in `tools/error.tsx` with refresh + go-home actions.
- [x] Empty states: inline with Wrench icon + action link.
- [x] Mutation buttons disabled during `isPending` state.
- [x] View-detail arrow buttons (`→`) have `aria-label={t("aria.viewDetail", { name })}`.
  > ✅ Fixed in verification pass (2026-03-05): `tools-my-tools-client.tsx` and `tools-catalog-client.tsx`. `aria.viewDetail` key added to both `messages/en.json` and `messages/pl.json`.

### Unified Tabs Page

- [x] `/dashboard/tools` uses shadcn `Tabs` to switch between "My Tools" and "All Tools" views.
  > ✅ `ToolsUnifiedClient` in `tools/_components/tools-unified-client.tsx` wraps both sub-clients.
- [x] Removed separate `/dashboard/tools/all` page routing (now a tab in the unified page).
  > ✅ `/dashboard/tools/all/page.tsx` delegates to the same unified component for direct URL access.

### Tool Detail Page

- [x] Two-mode rendering based on enabled state:
  - **Disabled mode**: preview card with description, Enable button, "enable to use" hint.
  - **Enabled mode**: compact header strip (name, badges, pin/disable buttons) + tool UI from registry or developer placeholder.
- [x] Tool component registry at `src/lib/tools/registry.tsx` — maps `slug` → React component.
- [x] `getToolComponent(slug)` returns `null` when no component registered — shows `ToolPlaceholder`.
- [x] `ToolPlaceholder` clearly communicates "UI not registered yet" with registry file hint.

---

## 7. Sidebar V2

### Registry

- [x] Tools item registered in `src/lib/sidebar/v2/registry.ts` as last item in `MAIN_NAV_ITEMS` (above account footer section).
- [x] No `requiresModules` gate — tools is always visible to any user with `tools.read`.
- [x] `requiresPermissions: [PERMISSION_TOOLS_READ]`.
- [x] Icon: `"tools"` key → `Wrench` from lucide-react in `icon-map.ts`.
- [x] `href: "/dashboard/tools"`, `match: { startsWith: "/dashboard/tools" }`.

### Dynamic Pinned Tools Injection

- [x] `injectPinnedToolsIntoSidebar()` called in `src/app/[locale]/dashboard/layout.tsx` after `buildSidebarModel()`.
- [x] Pinned tools fetched via lean join query (`listPinnedToolsForSidebar`) — single DB round-trip returning only `tool_slug, created_at, tools_catalog(name)`. No separate catalog fetch for names.
  > ✅ Added in surgical hardening pass (2026-03-05): `UserToolsService.listPinnedToolsForSidebar` replaces the previous two parallel full-row fetches.
- [x] Fetch wrapped in `React.cache()` (`fetchPinnedToolsForSidebar`) — deduplicated per SSR request.
  > ✅ Added in surgical hardening pass (2026-03-05): `const fetchPinnedToolsForSidebar = cache(async (userId) => {...})` in `dashboard/layout.tsx`.
- [x] Partial index `user_enabled_tools_pinned_idx (user_id, created_at) WHERE pinned = true` supports the sidebar query efficiently.
  > ✅ Migration `20260305140000_tools_pinned_partial_idx.sql`.
- [x] Pinned tools appear as `children` of the tools sidebar item (above "All Tools" fixed child).
- [x] "All Tools" child is always last in the children array.
- [x] "All Tools" child links to `/dashboard/tools/all` (catalog page), NOT `/dashboard/tools` (unified page).
  > ✅ Fixed in verification pass (2026-03-05): `TOOLS_ALL_CHILD.href` was incorrectly `/dashboard/tools` (shows My Tools tab by default). Now `/dashboard/tools/all` which renders the catalog directly.
- [x] `router.refresh()` in `useSetToolPinnedMutation` `onSuccess` triggers layout re-run for sidebar update.
- [x] `router.refresh()` in `useSetToolEnabledMutation` `onSuccess` triggers refresh when tool is disabled (auto-unpin side effect).

---

## 8. i18n

- [x] All UI strings under `modules.tools.*` namespace in both `messages/en.json` and `messages/pl.json`.
- [x] Sub-namespaces: `pages.myTools.*`, `pages.catalog.*`, `pages.detail.*`, `actions.*`, `toasts.*`, `loading.*`, `errors.*`, `aria.*`.
- [x] Detail page keys added: `enableToUse`, `uiNotRegistered`, `uiNotRegisteredDesc`, `uiNotRegisteredHint`.
- [x] `aria.viewDetail` key added for view-detail button accessibility labels.
  > ✅ Added in verification pass (2026-03-05): EN `"View {name} details"`, PL `"Zobacz szczegóły {name}"`.
- [x] No hardcoded English strings in client components — all use `useTranslations`.
  > ⚠️ Exception: `→` Unicode arrow used as visual icon inside view-detail buttons — acceptable as a non-semantic symbol. `aria-label` is present, so accessibility is covered.

---

## 9. Tests

### Service Tests (T-TOOLS-SERVICE)

- [x] `ToolsCatalogService.listCatalog`: success with data, DB error, empty array.
- [x] `ToolsCatalogService.getToolBySlug`: null data for non-existent slug.
- [x] `UserToolsService.listUserEnabledTools`: returns rows for user.
- [x] `UserToolsService.setToolEnabled`: upserts with enabled=true, returns row.
- [x] `UserToolsService.setToolPinned`: upserts with pinned=true, returns row.
- [x] `UserToolsService.setToolEnabled`: normalizes RLS violation to friendly error.

### RLS Stubs (T-TOOLS-RLS)

- [x] `.todo` stubs documenting all RLS invariants (require live DB in CI):
  - `user_enabled_tools`: own rows only (select, insert, update, delete).
  - `tools_catalog`: authenticated users can select; unauthenticated cannot.

### Action Tests (T-TOOLS-ACTIONS)

- [x] `listToolsCatalogAction`: Unauthenticated, Unauthorized, success.
- [x] `listMyEnabledToolsAction`: Unauthenticated, Unauthorized.
- [x] `setToolEnabledAction`: Unauthenticated, Unauthorized (tools.manage missing), schema validation (empty slug), success.
- [x] `setToolPinnedAction`: Unauthorized, success.

---

## 10. Known Gaps

| #   | Section   | Description                                                                                            | Priority | Status                                                                                                                                     |
| --- | --------- | ------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | a11y/i18n | `→` view-detail buttons in `tools-my-tools-client` and `tools-catalog-client` had no `aria-label`      | MEDIUM   | ✅ **Closed 2026-03-05** — `aria-label={t("aria.viewDetail")}` added; `aria.viewDetail` key added to EN+PL                                 |
| G2  | Security  | `FORCE ROW LEVEL SECURITY` not applied to `user_enabled_tools`                                         | MEDIUM   | ✅ **Closed 2026-03-05** — migration `20260305130000` applies `ALTER TABLE ... FORCE ROW LEVEL SECURITY`                                   |
| G3  | Tests     | Raw `"tools.read"` / `"tools.manage"` string literals in test fixture helpers                          | LOW      | ⏳ Accepted — test fixture data; low ROI to import constants. Documented as known/accepted.                                                |
| G4  | UX/Bug    | `TOOLS_ALL_CHILD.href` was `/dashboard/tools` — labeled "All Tools" but showed My Tools tab by default | HIGH     | ✅ **Closed 2026-03-05** — changed to `/dashboard/tools/all` (catalog page)                                                                |
| G5  | Docs      | `listUserEnabledTools` JSDoc said "enabled or disabled" but filters `enabled = true` only              | LOW      | ✅ **Closed 2026-03-05** — JSDoc corrected in `tools.service.ts`                                                                           |
| G6  | Tests     | No sidebar SSR tests for `tools.read` show/hide of tools sidebar item                                  | LOW      | ⏳ Open                                                                                                                                    |
| G7  | Tests     | T-TOOLS-RLS live DB integration tests (require real Supabase connection)                               | LOW      | ⏳ Open (stubs present)                                                                                                                    |
| G8  | Tests     | RTL tests for `ToolsMyToolsClient`, `ToolsCatalogClient`, `ToolDetailClient`                           | LOW      | ⏳ Open                                                                                                                                    |
| G9  | Registry  | `src/lib/tools/registry.tsx` has no registered tool components (all commented out)                     | N/A      | Expected — placeholder until real tool UIs are built                                                                                       |
| G10 | PERF      | `listPinnedTools` used `select("*")` + separate catalog fetch for sidebar injection                    | MEDIUM   | ✅ **Closed 2026-03-05** — `listPinnedToolsForSidebar` lean join + `React.cache()` in layout.tsx; partial index migration `20260305140000` |
| G11 | Routing   | MODULE.md described `/dashboard/tools/all` as "URL alias rendering same unified component"             | LOW      | ✅ **Closed 2026-03-05** — Fixed to "Dedicated catalog page renders ToolsCatalogClient directly"                                           |
| G12 | Docs      | No explicit user-global vs org-scoped documentation or guardrail comments in service/actions           | LOW      | ✅ **Closed 2026-03-05** — State Scoping section in MODULE.md; guardrail comments in service.ts + actions                                  |

---

_Last updated: 2026-03-05 — Surgical hardening pass: G10 (lean+cached sidebar fetch), G11 (routing docs), G12 (user-global scoping docs) closed._
