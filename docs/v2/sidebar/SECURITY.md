# Sidebar V2 — Security Model

## TL;DR

**The sidebar is a UX boundary, not a security boundary.**

Hiding or disabling a sidebar item never prevents access to the underlying route or data.
All authorization is enforced server-side via RLS + permission guards + entitlements checks.

---

## What the Sidebar Does (and Does Not) Enforce

| Concern                                       | Sidebar V2       | Real enforcement                      |
| --------------------------------------------- | ---------------- | ------------------------------------- |
| Hide nav items the user cannot access         | ✅ Yes (UX only) | —                                     |
| Prevent navigation to a hidden route          | ❌ No            | Server guard / middleware             |
| Prevent data access for an unauthorized route | ❌ No            | RLS policies                          |
| Prevent a server action from executing        | ❌ No            | Server action permission check        |
| Enforce module entitlements                   | ❌ No            | `requireModuleAccess()` guard         |
| Enforce permission level                      | ❌ No            | `PermissionServiceV2.hasPermission()` |

**Consequence:** A user who manually types a hidden URL must be blocked server-side.
The sidebar hiding the link is only a UX affordance.

---

## Architecture: How the Sidebar Computes Visibility

```
SSR Request
    │
    ▼
dashboard/layout.tsx
    │  loadDashboardContextV2()          ← fails-closed: redirect if no session
    │  loads permissionSnapshot + entitlements
    │
    ▼
buildSidebarModel(appContext, userContext, entitlements, locale)
    │  pure, deterministic, no side-effects
    │  resolver prunes items the user cannot see
    │
    ▼
SidebarModel (JSON-serializable)        ← server → client prop
    │  contains ONLY items the user may see
    │  no permission slugs, no entitlement data
    │
    ▼
AppSidebar (client component)
    │  renders model as-is (dumb renderer)
    │  computes active state via pathname only
    └  never re-evaluates permissions
```

### Resolver contract

`resolveSidebarModel(input, registry)` is a **pure function**:

- Reads `input.permissionSnapshot` (allow/deny compiled snapshot) and `input.entitlements`.
- Applies wildcard-aware deny-first permission matching via `checkPermission()`.
- Prunes items that fail `requiresPermissions` or `requiresModules` checks.
- Prunes parent groups that become empty after child pruning.
- Returns a `SidebarModel` containing only visible items.
- **No timestamps, no randomness, no env reads, no network calls.**
- **Does not mutate the registry input.**

The resolved model is serialized as a Next.js Server Component prop and passed to the client renderer.
It never contains raw permission slugs or entitlement data.

---

## Real Security Boundaries

Authorization is enforced at three independent server-side layers:

### Layer 1 — Layout session guard

```typescript
// src/app/[locale]/dashboard/layout.tsx
const ctx = await loadDashboardContextV2();
if (!ctx) redirect("/sign-in");
```

Unauthenticated users are redirected before any data is loaded.

### Layer 2 — Entitlements guards (module/feature/limit)

```typescript
// src/server/guards/entitlements-guards.ts
await requireModuleAccess("analytics"); // throws MODULE_ACCESS_DENIED
await requireWithinLimit("seats", current); // throws LIMIT_EXCEEDED
await requireModuleOrRedirect("warehouse", "/dashboard/upgrade");
```

Called at the top of server components or server actions before any module data is touched.
Uses `SECURITY DEFINER` functions to prevent RLS recursion.

### Layer 3 — RLS + Permission Service (data layer)

Every Supabase query runs with an authenticated session token.
Row Level Security policies enforce tenant isolation and permission checks:

```sql
-- Example RLS policy
USING (is_org_member(organization_id))
WITH CHECK (authorize('org.update', organization_id))
```

Server-side permission checks use the pre-compiled `user_effective_permissions` view:

```typescript
// src/server/services/permission-v2.service.ts
await PermissionServiceV2.hasPermission(supabase, userId, orgId, "org.update");
await PermissionServiceV2.currentUserHasPermission(orgId, "members.manage");
```

---

## Adding a New Protected Page

When adding a new route that requires permissions or module access:

1. **Add the nav item to the registry** (`src/lib/sidebar/v2/registry.ts`) with the appropriate
   `visibility.requiresPermissions` and/or `visibility.requiresModules` constraints.
   This is UX-only — it will hide the link from users who lack access.

2. **Add a server-side guard** at the top of the page/layout/action:

   ```typescript
   // For module-gated pages
   await requireModuleAccess("analytics");

   // For permission-gated actions
   const allowed = await PermissionServiceV2.currentUserHasPermission(orgId, "org.update");
   if (!allowed) throw new Error("Unauthorized");
   ```

3. **Verify RLS covers the underlying tables.** If the page fetches data, the RLS policies
   must independently enforce access — do not rely on the server guard alone.

---

## Permission Snapshot Model

The sidebar resolver receives a `permissionSnapshot`:

```typescript
interface PermissionSnapshot {
  allow: string[]; // e.g. ["org.read", "account.*", "members.read"]
  deny: string[]; // explicit denies take precedence over wildcards
}
```

This snapshot is **compiled at write time** (when roles or permission overrides change),
not evaluated at request time. It is loaded once per SSR request and reused for the sidebar.

Wildcard matching follows deny-first semantics:

```
deny check first  →  if any deny pattern matches → DENIED
allow check next  →  if any allow pattern matches → ALLOWED
otherwise         →  DENIED (fail-closed)
```

---

## Disabled Items (coming_soon / showWhenDisabled)

Some items may be rendered in a visually disabled state (greyed out, no href):

- `status: "coming_soon"` — item exists in registry but feature is not yet available.
- `showWhenDisabled: true` — item fails visibility check but is shown as a teaser.

These items have `disabledReason` set in the resolved model (`"coming_soon"`, `"permission"`, `"entitlement"`).
The renderer uses this to display appropriate UI (tooltip, "Soon" badge, etc.).

**Disabled items carry no security implication.** They have `href: undefined` so the browser
cannot navigate to them, but direct URL access is not prevented by the sidebar.

---

## What Must NOT Happen

- ❌ Do not read `permissionSnapshot` or `entitlements` in the client sidebar renderer.
- ❌ Do not conditionally render content based on permissions in client components without a
  corresponding server-side guard.
- ❌ Do not treat "item not in sidebar model" as proof that a user cannot access the route.
- ❌ Do not add authorization logic to `resolveSidebarModel` beyond visibility shaping.
- ❌ Do not cache the sidebar model globally across users or requests.

---

## Tests

Integration tests live at:

```
src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx
```

They validate:

- SSR model renders expected items for a given permission/entitlement input
- `org_owner` (with `org.update`) sees billing item; `org_member` does not
- Free plan hides analytics module; professional plan shows it
- Wildcard `account.*` grants access to `account.profile.read`

All tests call `buildSidebarModelUncached` directly — no database, no React, no network.

Unit tests for the resolver, label, and registry live at:

```
src/lib/sidebar/v2/__tests__/
src/lib/types/v2/__tests__/
```
