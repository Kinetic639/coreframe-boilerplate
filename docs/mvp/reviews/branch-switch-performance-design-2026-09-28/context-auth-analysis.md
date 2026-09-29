# Context-Loader Boundaries and Auth Duplication

## Where `auth.getUser()` runs (per request)

| Request          | `getUser` calls | Where                                                                          |
| ---------------- | --------------- | ------------------------------------------------------------------------------ |
| action POST      | 4               | proxy `updateSession`, `changeBranch`, `loadAppContextV2`, `loadUserContextV2` |
| page-only RSC    | 3               | proxy, app ctx, user ctx                                                       |
| full-tree RSC    | 4               | proxy, app ctx, user ctx, `loadAdminContextV2`                                 |
| **switch today** | **11**          |                                                                                |

## Rule for reducing it without weakening auth

- **Allowed:** one **server-validated** `supabase.auth.getUser()` per request, memoized with React `cache()` for the lifetime of that request (e.g. `getAuthUser()`). Every loader and action in the same request reuses that validated result. This is exactly as strong as today: the same network validation of the JWT against Supabase Auth, done once instead of 3–4 times on the same cookie in the same request.
- **Not allowed:** `getSession()` / cookie-decoded user as an authorization source; caching across requests; passing the user from the client; skipping `getUser` in the action because the proxy already did it (the proxy's result doesn't reach route code, and a React `cache()` value doesn't cross the proxy boundary).
- The proxy's own `getUser` stays. It refreshes the session cookies. That leaves **2 per request** (proxy + route), down from 3–4.

## Context boundaries: what each consumer actually needs

| Consumer                         | Needs                                                                           | Loads today                                                                    | Excess                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `changeBranch`                   | user id, activeOrgId, availableBranches, accessibleBranches, permissionSnapshot | full `loadDashboardContextV2`, **including `users` row and avatar signed URL** | users + avatar (2 calls)                                                             |
| `dashboard/layout.tsx`           | full context + entitlements + pinned + admin ctx + latest activity              | all serial                                                                     | 4 independent awaits in series; admin ctx refetches getUser + users + avatar         |
| `getLatestActivityAction` (poll) | user id, activeOrgId (for the personal feed)                                    | full `loadDashboardContextV2` (10 calls)                                       | ~7 calls                                                                             |
| `getBranchPermissions`           | user id + UEP rows                                                              | getUser + 2 UEP                                                                | fine per call, but redundant after a server render that already carries the snapshot |

## Decisions

1. **Keep `loadDashboardContextV2` + `isBranchAccessible` as the authorization source for `changeBranch`.** A lighter "authorization-only" loader would save 2 calls but create a second code path for the Zone 1 invariant. Once calls are request-deduped and parallel, the saving is ~1 serial step. **Rejected for now.** Instead, make the shared loader cheaper for everyone:
   - `loadUserContextV2`: `users` ‖ avatar sign ‖ `getPermissionSnapshotForUser` in parallel, and UEP org ‖ UEP branch in parallel;
   - `loadAppContextV2`: org validation merged with org+profile, and org ‖ branches once `activeOrgId` is known;
   - result: 10 serial → ~5 serial steps, same queries, same results, same fail-closed behavior.
2. **`loadAdminContextV2` reuses the request's user context** (user row, avatar) instead of re-fetching.
3. **Layout:** `Promise.all` the post-context loaders (entitlements, pinned tools, admin ctx, latest activity). They all depend only on the context.
4. **Background reads leave the router action queue:**
   - status-bar latest activity → a `GET` Route Handler read with `fetch`/React Query. Same auth: `getUser` + RLS; for a user-scoped feed it needs only `activeOrgId` from preferences, not the whole context;
   - `PermissionsSync` → seeded from the SSR `context.user.permissionSnapshot` as `initialData` for key `[v2, permissions, org, branch]`, so a server render that already carries the snapshot never triggers a refetch.

   Neither change touches authorization semantics. The route handler is fail-closed like the action.

5. **No change** to RLS, `user_effective_permissions`, `isBranchAccessible`, or Tickets/Tasks scope.

## Parallelization safety

| Parallelization                             | Safe?                                 | Condition                                                                                                                                                                                              |
| ------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UEP org ‖ UEP branch                        | Yes                                   | both read-only, same user; merge order in the snapshot must stay deterministic (org rows then branch rows)                                                                                             |
| `users` ‖ avatar sign ‖ permission snapshot | Yes                                   | the avatar needs `avatar_path` from `users`, so it is `users → avatar` ‖ snapshot; avatar failure stays non-fatal as today                                                                             |
| org validate + org/profile merge            | Yes                                   | must still return "no org" (fail-closed) when the org isn't visible under RLS                                                                                                                          |
| org ‖ branches                              | Yes                                   | both keyed only by `activeOrgId`                                                                                                                                                                       |
| layout loaders fan-out                      | Yes                                   | each depends only on the context; one failing loader must keep today's degradation (e.g. missing pinned tools doesn't blank the layout); use `Promise.allSettled` where today's code tolerates failure |
| `getUser` ‖ context loads                   | **No**                                | context loads need the validated user id; auth must finish first (fail-closed)                                                                                                                         |
| `changeBranch` authorization ‖ `UPDATE`     | **No**                                | the update must happen only after `isBranchAccessible` passes                                                                                                                                          |
| background poll ‖ switch                    | Yes, once the poll is a Route Handler | not in the router queue; RLS-scoped read                                                                                                                                                               |

## Resulting call counts (branch switch, after all stages)

| Request                                       | Today                                 | After                                                                       |
| --------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| action (`changeBranch` + redirect)            | 13 serial                             | ~7 serial steps (proxy, getUser, ~4 ctx steps, update)                      |
| redirected full-tree render (same response)   | 19 (as `refresh`) + 12 (as `replace`) | ~7 serial steps (proxy, getUser, ~4 ctx steps, one parallel layout fan-out) |
| queued background actions ahead of the switch | 0–17+                                 | 0                                                                           |
| **serial steps per switch**                   | **44 + queue**                        | **~14**                                                                     |
