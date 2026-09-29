# Implementation Boundaries

This is for the implementation-planning task that follows. **Nothing here is implemented in this task.**

## In scope, by stage

| Stage | Files expected to change                                                                                                                                                                                                                                                                                                                                         | Type                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 0     | none                                                                                                                                                                                                                                                                                                                                                             | measurement             |
| 1     | Vercel project settings, **or** new `apps/web/vercel.json` (`regions`)                                                                                                                                                                                                                                                                                           | config (owner approval) |
| 2     | `sidebar-branch-switcher.tsx`, `ambra-locations-client.tsx` (pending UI, toast on commit); `DashboardStatusBarActivity.tsx` (suppress during switch, debounce focus); `use-branch-permissions-query.ts` + `permissions-sync.tsx` + `_providers.tsx` (SSR `initialData`); a small client "branch switch in progress" signal (Zustand slice or module-level store) | client                  |
| 3     | `actions/shared/changeBranch.ts` (allowlisted redirect target on success); `_providers.tsx` (`switched` handshake, sessionStorage adoption, commit signal); switcher + QR confirm (drop `setActiveBranch`/`replace`/`refresh`); tests for both callers                                                                                                           | server action + client  |
| 4     | new request-scoped `getAuthUser()` helper under `src/server/`; `load-app-context.v2.ts`, `load-user-context.v2.ts`, `load-admin-context.v2.ts`, `permission-v2.service.ts` (`getPermissionSnapshotForUser` parallel), `dashboard/layout.tsx`, `actions/v2/permissions.ts`; new GET Route Handler for latest activity + `DashboardStatusBarActivity.tsx`          | server                  |

## Out of scope (hard boundaries)

- Any DB, RLS, migration, trigger or function change. `user_effective_permissions` is untouched.
- Replacing `getUser()` with `getSession()`/JWT-only decoding anywhere. Removing the proxy's `updateSession`.
- Changing `isBranchAccessible` semantics or the org-membership check in `changeBranch`.
- Adding a second persistent branch-switch path (a Route Handler switch, ALT-3, only if ALT-2's redirect proves unworkable, and then with explicit Origin/CSRF checks and review).
- Tickets or Tasks scope or code.
- Changing the landing target away from `/dashboard/start` (product decision, separate).
- Phase 10D.
- Changing sessionStorage per-tab working-branch semantics (only the handshake that adopts the server branch after a confirmed switch).

## Required tests per stage

- **Stage 2:**
  - switcher shows the pending label synchronously on click;
  - success toast not called until the commit signal;
  - error path unchanged;
  - poll not invoked while a switch is pending;
  - `PermissionsSync` does not call `getBranchPermissions` when `initialData` matches.
- **Stage 3:**
  - `changeBranch` redirects only on success, only to allowlisted targets, and never on any failure branch (existing Zone 1 negative tests keep passing);
  - handshake: stale session A + server B + `switched=B` → store B, session B;
  - `switched` ≠ server branch → ignored;
  - no `HomeScopeBoundary` navigation during a switch;
  - QR confirm flow lands on the exact target.
- **Stage 4:**
  - each loader still fails closed on auth error;
  - `getUser` called exactly once per request per route code (spy);
  - the snapshot content is identical to today's for the UAT fixture;
  - layout degrades as today when an optional loader fails;
  - the full Zone 1 regression suite passes.

## Rollback

- Each stage is a separate PR.
- Stage 1 is reverted in project settings.
- Stage 3 can revert to replace + refresh with no data impact: the DB state is the same either way.
