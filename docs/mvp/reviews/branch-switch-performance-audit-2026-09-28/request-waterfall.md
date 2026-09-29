# Request Waterfall (one branch switch)

Derived from the code path plus Next.js 16.1.7 source:

- **Router queue** (`client/components/app-router-instance.js`): a _navigate_ starts immediately and discards any pending action; a _refresh_ is appended and starts only after the current action finishes.
- **Partial rendering** (`server/app-render/walk-tree-with-flight-router-state.js`): the server starts rendering at the first segment that differs from the client's router state, or where the client marks `refetch`. A navigation between two `/dashboard/*` routes therefore does **not** re-run `dashboard/layout.tsx`. `router.refresh()` marks `refetch` from the root, so the whole tree re-renders.

```
T0  user clicks branch B in SidebarBranchSwitcher
    └─ startTransition(async …)       (switcher disabled via isPending — no other visible feedback)

T1  POST <current page URL>  [Next-Action: changeBranch]
    ├─ middleware: getUser                                         Auth
    ├─ changeBranch: getUser                                        Auth
    ├─ loadAppContextV2: getUser → prefs → org → org+profile → branches            Auth + 4 REST
    ├─ loadUserContextV2: getUser → users → avatar sign → UEP org → UEP branch       Auth + 2 REST + Storage + 1 REST
    └─ UPDATE user_preferences                                      REST
T2  action resolves   (13 serial round trips; observed 10–15 s in UAT, modeled ~1.6 s here)

T3  setActiveBranch(B)   (Zustand store → B immediately)
T4  toast.success("Branch switched successfully")   ← fires BEFORE the new page exists
T5  router.replace("/dashboard/start")  → NAVIGATE starts immediately
    router.refresh()                    → queued behind it

    [only if the user was already on /dashboard/start]
    HomeScopeBoundary sees store=B vs server-rendered branch=A → mismatch
      → router.replace("/dashboard/start?branch=B") → NAVIGATE: discards T5's navigate
        (T5's server render still executes → wasted load) and starts a new one

T6  request #1 — RSC for the `start` PAGE SEGMENT ONLY (shared dashboard layout preserved)
    └─ middleware getUser → loadHomeContext → loadDashboardContextV2 (10, new request, so no cache) → entitlements (1)
       12 serial round trips, then widgets stream
T7  navigate commits: page shows B; the shared layout (sidebar model, accessible
    branches, providers context/permission snapshot) is still the pre-switch render
    queued refresh starts:
    request #2 — RSC for the FULL TREE (refetch from root)
    └─ middleware getUser → layout: context (10) → entitlements → pinned tools
       → admin context (getUser + users + avatar sign + admin ent.) → latest activity (2)
       → page again (cached context, 0 extra)
       19 serial round trips before the layout emits
T8  refresh commits → layout now reflects B → transition ends → isPending false
```

## Duplicate / redundant work identified

| Item                                                                                                    | Evidence                                                                                                                                                                                 | Classification                                                     |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `router.refresh()` after `router.replace()`                                                             | Partial-rendering source: navigate alone does NOT re-render the shared dashboard layout; refresh is what updates the sidebar, accessible branches and the permission context to branch B | **Required** in the current design; must not be removed on its own |
| The `start` page rendered twice (request #1 page-only, request #2 full tree)                            | two sequential requests both render the page, and each loads `loadDashboardContextV2` from scratch (React `cache()` is per request)                                                      | **Redundant**: ~12 serial round trips                              |
| `HomeScopeBoundary` navigation when switching from `/dashboard/start` → one more page render, discarded | `scope-boundary.tsx` mismatch effect + switcher's `setActiveBranch` before navigating                                                                                                    | **Redundant**, wasted server work                                  |
| `getUser` ×4 in the action request, ×3 in the page-only render, ×4 in the full-tree render              | code path                                                                                                                                                                                | All but one per request are redundant                              |
| `users` + avatar signed URL fetched twice per full-tree render                                          | `loadUserContextV2` and `loadAdminContextV2`                                                                                                                                             | Redundant                                                          |
| Layout steps (entitlements, pinned tools, admin ctx, latest activity) awaited serially                  | `dashboard/layout.tsx`                                                                                                                                                                   | Serial where they could run in parallel                            |
| Duplicate `changeBranch` calls                                                                          | switcher disables items while `isPending`                                                                                                                                                | **Not observed**                                                   |
| React Query invalidation storm                                                                          | switch doesn't invalidate queries; DataView keys change via `scope`                                                                                                                      | **Not a factor**                                                   |
| Retries                                                                                                 | none in the path                                                                                                                                                                         | **Not a factor**                                                   |

**Network operations per switch (UAT account):** 13 (action) + 12 (request #1) + 19 (request #2) = **44 serial round trips**, including **11 Auth `getUser` calls** (4 + 3 + 4). When starting on `/dashboard/start`, add 12 wasted round trips overlapping request #1.
