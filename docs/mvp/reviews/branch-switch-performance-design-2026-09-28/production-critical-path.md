# Production Critical Path

Everything here was read from the code on `zone3-zone5-integration-audit` (== main 1e86d66c for these files) and from Next.js 16.1.7 `dist` sources in `node_modules`.

## 1. Code state (the files on the critical path)

| File                                                                                                                        | Role in the switch                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx`                                               | `startTransition(async () => { await changeBranch(id); setActiveBranch(id); toast.success(); router.replace("/dashboard/start"); router.refresh(); })` |
| `apps/web/src/app/actions/shared/changeBranch.ts`                                                                           | `getUser` → `loadDashboardContextV2` → org membership check → `isBranchAccessible` → `UPDATE user_preferences`                                         |
| `apps/web/src/server/loaders/v2/load-app-context.v2.ts`                                                                     | `getUser` → prefs → org validate → org+profile → branches (serial)                                                                                     |
| `apps/web/src/server/loaders/v2/load-user-context.v2.ts`                                                                    | `getUser` → `users` → avatar signed URL → UEP org → UEP branch (serial)                                                                                |
| `apps/web/src/server/loaders/v2/load-dashboard-context.v2.ts`                                                               | app → user → accessible branches (fast path via `branches.view.any`)                                                                                   |
| `apps/web/src/app/[locale]/dashboard/layout.tsx`                                                                            | context → entitlements → pinned tools → `loadAdminContextV2` → `getLatestActivityAction` (all serial)                                                  |
| `apps/web/src/app/[locale]/dashboard/_providers.tsx:55-89`                                                                  | on every context change: `hydrateFromServer`, then a **sessionStorage branch override** (per-tab working branch)                                       |
| `apps/web/src/app/[locale]/dashboard/start/_components/scope-boundary.tsx`                                                  | `router.replace(?branch=…)` on store/server branch mismatch                                                                                            |
| `apps/web/src/app/[locale]/dashboard/_components/permissions-sync.tsx` + `hooks/queries/v2/use-branch-permissions-query.ts` | React Query with **no `initialData`**. Calls the **server action** `getBranchPermissions` on mount and on every branch change                          |
| `apps/web/src/components/activity/DashboardStatusBarActivity.tsx:19,117-133`                                                | calls the **server action** `getLatestActivityAction()` every 30 s **and on every `focus` / `visibilitychange`**                                       |
| `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/ambra-locations-client.tsx`                            | second `changeBranch` caller (cross-branch QR confirm): same replace + refresh pattern                                                                 |

Toast policy, `react-toastify`: `autoClose` 2500 ms.

## 2. Next.js mechanics that decide the critical path (verified in source)

1. **Serialized router action queue.** `client/components/app-router-instance.js` `dispatchAction`:
   - if nothing is pending, the action runs;
   - a navigate/restore **discards** the pending action and starts at once;
   - **everything else, including every server action and every `router.refresh()`, is appended and waits for all actions ahead of it.**

   `callServer` dispatches `ACTION_SERVER_ACTION` into this queue. So a click on the switcher waits behind any server action or refresh already in flight **in that tab**.

2. **Partial rendering.**
   - `router.replace` between `/dashboard/*` routes re-renders only the changed page segment.
   - `router.refresh()` refetches from the root, so the shared `dashboard/layout.tsx` re-runs.
3. **Server action + `redirect()`** (`server/app-render/action-handler.js:226-290`, `createRedirectRenderResult`):
   - for an app-relative redirect, the server fetches the target URL internally as an RSC request;
   - it **deletes `Next-Router-State-Tree`**, so the whole tree including the layout renders;
   - it streams that tree back **in the same action response**;
   - if that fails, it falls back to a client-side navigation (`x-action-redirect` header).
4. **Server-action page re-render.** If the action writes cookies or calls `revalidatePath`/`revalidateTag`/`refresh()`, `skipPageRendering` becomes false and the current page is rendered into the action response (`action-handler.js:814-836`). Today this only happens when the Supabase token refreshes during the action.
5. **Next 16 `refresh()` from `next/cache`** exists (`spec-extension/revalidate.js:63`). It may only be called inside a server action and marks `ActionDidRevalidateDynamicOnly`.

## 3. Critical-path DAG (today)

```
click
 │  (isPending=true: switcher disabled — only feedback)
 ▼
[QUEUE WAIT]  ← any in-flight server action / refresh in this tab:
 │               • getLatestActivityAction (poll; fires on window focus — i.e. often right before a click)
 │               • getBranchPermissions (PermissionsSync, fires on every full mount)
 │               • a previous router.refresh / navigation still resolving
 ▼
POST <current URL> [Next-Action: changeBranch]          ── Vercel function (region: UNVERIFIED, default iad1)
 │   proxy getUser ─► action getUser ─► app ctx (getUser, prefs, org, org+profile, branches)
 │   ─► user ctx (getUser, users, avatar sign, UEP org, UEP branch) ─► UPDATE prefs
 │   = 13 serial HTTPS calls to eu-west-1  (+ page re-render in response if token refreshed: +19)
 ▼
setActiveBranch(B)  → store=B, sessionStorage=B
toast.success       ← "success" claimed here
router.replace(/dashboard/start)   → NAVIGATE (starts at once)
router.refresh()                   → queued behind it
 │   [if already on /start] HomeScopeBoundary mismatch → another NAVIGATE (discards; wasted server render)
 │   PermissionsSync (activeBranchId changed) → getBranchPermissions queued (4 calls)
 ▼
GET RSC page-only (/dashboard/start): proxy getUser + ctx 10 + entitlements 1 = 12 serial
 ▼   (page shows B; layout/sidebar still A-rendered)
GET RSC full tree (refresh): proxy getUser + ctx 10 + ent + pinned + admin ctx 4 + activity 2 = 19 serial
 ▼
commit → layout shows B → isPending=false
```

## 4. Round-trip model, re-verified

| Request                                             | Serial Supabase calls | Composition (re-counted)                                                                |
| --------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `changeBranch` action                               | **13**                | proxy 1 + action `getUser` 1 + app ctx 5 + user ctx 5 + update 1                        |
| page-only render (`replace`)                        | **12**                | proxy 1 + ctx 10 + entitlements 1                                                       |
| full-tree render (`refresh`)                        | **19**                | proxy 1 + ctx 10 + ent 1 + pinned 1 + admin ctx 4 + activity 2 (page reuses cached ctx) |
| **switch total**                                    | **44**                | 11 of them `auth.getUser`                                                               |
| status-bar poll action (can sit ahead in the queue) | **13**                | proxy 1 + ctx 10 + 2 event queries                                                      |
| `getBranchPermissions` action                       | **4**                 | proxy 1 + `getUser` 1 + UEP org + UEP branch                                            |

- The earlier audit's model is confirmed as far as it goes. It had no **queue-wait term**, and no **deployment-topology term** (where the function runs relative to Supabase).
- Under RLS, DB execution for the whole context chain is <60 ms (measured in the earlier audit). Query cost is irrelevant. **Latency = (calls on the critical path) × (per-call function→Supabase latency) + queue wait + cold starts.**
