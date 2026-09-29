# `changeBranch()` Profile

Every await on the Server Action request path, in execution order, for the UAT account shape (has avatar; holds `branches.view.any`, so the accessible-branches query is skipped). **All strictly sequential: each step awaits the previous one.**

| #   | Step                                                      | Call                                      | Kind      | DB time (measured)   | Expected?                  |
| --- | --------------------------------------------------------- | ----------------------------------------- | --------- | -------------------- | -------------------------- |
| 1   | Middleware session refresh (`proxy.ts` → `updateSession`) | `auth.getUser()`                          | Auth      | —                    | Yes (once per request)     |
| 2   | `changeBranch` auth check                                 | `auth.getUser()`                          | Auth      | —                    | **Redundant** with 3 and 5 |
| 3   | `loadAppContextV2` auth                                   | `auth.getUser()`                          | Auth      | —                    | **Redundant**              |
| 4   | preferences                                               | `user_preferences` select                 | PostgREST | 12 ms                | Yes                        |
| 5   | preferred-org validation                                  | `organizations` select id                 | PostgREST | ~3 ms                | Mergeable with 6           |
| 6   | org snapshot                                              | `organizations` + `organization_profiles` | PostgREST | 3 ms                 | Yes                        |
| 7   | available branches                                        | `branches` select                         | PostgREST | 1 ms                 | Yes                        |
| 8   | `loadUserContextV2` auth                                  | `auth.getUser()`                          | Auth      | —                    | **Redundant**              |
| 9   | session (local cookie read)                               | `auth.getSession()`                       | local     | 0                    | —                          |
| 10  | user identity                                             | `users` select                            | PostgREST | 5 ms                 | Not needed to switch       |
| 11  | avatar                                                    | `storage.createSignedUrl`                 | Storage   | —                    | **Not needed to switch**   |
| 12  | permissions, org scope                                    | `user_effective_permissions`              | PostgREST | 16 ms                | Yes                        |
| 13  | permissions, branch scope (current branch A)              | `user_effective_permissions`              | PostgREST | 0.3 ms               | Parallelizable with 12     |
| 14  | accessible branches                                       | skipped (wildcard fast path)              | —         | —                    | —                          |
| 15  | `isBranchAccessible()`                                    | in-memory                                 | —         | 0                    | Yes                        |
| 16  | persist choice                                            | `user_preferences` UPDATE                 | PostgREST | trivial trigger only | Yes                        |

**Totals:** 13 network round trips (4 Auth, 1 Storage, 8 PostgREST). **DB work: ~40 ms.** Modeled wall time at this environment's latency: **~1.6 s**.

## `loadDashboardContextV2()` breakdown (steps 3–14)

- `loadAppContextV2`: 1 Auth + 4 PostgREST, all sequential.
- `loadUserContextV2`: 1 Auth + 1 PostgREST + 1 Storage + 2 PostgREST, all sequential.
- `_computeAccessibleBranches`: 0 round trips for this account; 1 more for accounts without the branch wildcards.
- A re-load of the user context when the preferred branch is stale/inaccessible: +5 round trips (not hit here).
- **10 sequential round trips; ~37 ms of DB time.** No N+1 and no permission recompilation (the snapshot reads the precompiled `user_effective_permissions`). The cost is entirely serial round trips and duplicated `getUser()` calls.

## Not a factor (checked)

- **Cookie-triggered page re-render in the action response.** `@supabase/ssr` 0.6.1 only writes cookies when storage actually changes, e.g. `TOKEN_REFRESHED`. It can happen occasionally (on token refresh) but can't explain a consistent delay.
- **Slow UPDATE / triggers.** Only `set_updated_at`.
- **Revalidation.** `changeBranch` calls no `revalidatePath` / `revalidateTag`.

## Unexplained remainder

The 10–15 s observed before the toast is ~6–9× this model. See `timing-breakdown.md`: most likely a dev-mode compile or much higher latency in the UAT environment. One log line from the UAT dev terminal settles it (see `recommended-fix-sequence.md` step 0).
