# Phase 7: Mobile Authorization

Bootstrap state machine, permission/entitlement loading, and test coverage for `apps/mobile`.

---

## Overview

Phase 7 establishes a secure, typed authorization layer for the mobile app.
The mobile client is **not an authorization authority** — all enforcement is done by server-side RLS.
Permissions and entitlements loaded here are used exclusively for UI gating (show/hide, enable/disable).

---

## 6-State Bootstrap Machine

`AppBootstrapState` in `contexts/app-context.tsx`:

| State                      | Meaning                                             | Render output                                |
| -------------------------- | --------------------------------------------------- | -------------------------------------------- |
| `resolving`                | Backend load in progress                            | Spinner (`ActivityIndicator`)                |
| `resolved`                 | Both queries succeeded                              | `AppContext.Provider` wrapping children      |
| `authenticated-unresolved` | Authenticated but no org-scoped JWT role            | No-org screen + sign-out button              |
| `forbidden`                | 403 / RLS denied — authenticated but not authorized | Access-denied screen + sign-out button       |
| `invalid-session`          | 401 / token expired — auto sign-out in progress     | Spinner (sign-out propagates asynchronously) |
| `error`                    | Unexpected server or network failure                | Error screen + retry button                  |

Screens rendered as children **always run with `bootstrapState === "resolved"`** and may assume `appState.permissions` is a non-null `PermissionSnapshot`.

---

## Source-of-Truth Tables

| Table                        | Purpose                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| `user_effective_permissions` | Wildcard-expanded, concrete permission slugs for the user+org |
| `organization_entitlements`  | Compiled plan + addon + override snapshot for the org         |
| `organization_profiles`      | Display name and profile metadata for the org                 |

The mobile loader queries all three in parallel (`Promise.all`) and inspects results in priority order: permissions → entitlements → profile.

---

## Error Classification

`classifyError(status, code, message)` in `lib/loaders/bootstrap-loader.ts`:

| Primary signal     | Secondary hint | Result                                                     |
| ------------------ | -------------- | ---------------------------------------------------------- |
| `status === 401`   | —              | `invalid-session`                                          |
| `status === 403`   | —              | `forbidden`                                                |
| `code === "42501"` | (any status)   | `forbidden` — PostgreSQL `insufficient_privilege` SQLSTATE |
| Any other          | —              | `error` (fail-closed)                                      |

Supabase/PostgREST queries **resolve** (not reject) for application-level errors. Network-level failures that do reject propagate through `Promise.all` to the outer `.catch` handler in `AppProvider`.

---

## UI-Only Permission Model

```
Server RLS         ← authoritative enforcement (always)
    ↕
PermissionSnapshot ← UI gating only (show/hide, enable/disable)
```

`appState.permissions` is a `PermissionSnapshot { allow: string[]; deny: string[] }` loaded from `user_effective_permissions`. It contains concrete, pre-expanded slugs — no wildcards. Use `checkPermission()` from `@repo/domain/permissions` for UI checks.

`appState.entitlements` is an `OrganizationEntitlements | null`. `null` within `resolved` state means the org has no subscription row — this is a valid free-tier state, semantically distinct from a load failure.

---

## Token-Refresh Behavior

When a Supabase silent token refresh occurs (same user, same org, new JWT), `session.access_token` changes. `AppProvider` detects this via `jwtDerived.accessToken` in the `useEffect` dependency array and triggers a fresh bootstrap load.

This ensures the permission snapshot stays current after token rotation without requiring the user to sign out and sign back in.

Dependency array (Phase 7):

```typescript
[jwtDerived.userId, jwtDerived.activeOrgId, jwtDerived.accessToken, retryKey];
```

---

## Bugs Fixed in Phase 7

### `org_id` column bug (bootstrap-loader.ts)

**Before:**

```typescript
.eq("org_id", orgId)   // ← WRONG — column does not exist on user_effective_permissions
```

**After:**

```typescript
.eq("organization_id", orgId)   // ← correct column name
```

This bug caused the permissions query to silently return an empty result set for every user, making all permission checks appear as "no permissions granted". The fix was verified against `permission-v2.service.ts` lines 82 and 114.

### Sequential queries (bootstrap-loader.ts)

Three sequential `await` calls replaced with `Promise.all`. All three queries now execute concurrently, reducing bootstrap latency from ~3× to ~1× the slowest query round-trip.

### Token-refresh non-reload (app-context.tsx)

`session.access_token` was not included in the bootstrap `useEffect` dependency array. A silent token refresh (same user/org, new JWT) would not trigger a fresh permission load. Fixed by adding `jwtDerived.accessToken` to the dependency array and removing the `eslint-disable-next-line react-hooks/exhaustive-deps` suppression that masked this.

---

## Test Coverage

| File                                                       | Test count | Coverage focus                                                                             |
| ---------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `__tests__/lib/normalizers/normalize-entitlements.test.ts` | 15         | Pure function, field-by-field, edge cases (NaN, Infinity, type mismatches, nested objects) |
| `__tests__/lib/loaders/bootstrap-loader.test.ts`           | 16         | Error classification, result building, priority order, deferred-promise concurrency proof  |
| `__tests__/contexts/app-context.test.tsx`                  | 10         | All 6 bootstrap states, token-refresh reload, retry flow, loader argument verification     |

**Total: 41 test cases.**

The concurrency test (bootstrap-loader case 16) uses deferred promises to prove that all three `from()` calls are made before any query resolves — this only passes if the implementation uses `Promise.all`, not sequential `await` chains.

---

## Deferred to Phase 8

- Org switcher (multi-org JWT support)
- Branch context loading
- Entitlement-gated feature flags in mobile UI
- Refresh token expiry handling (currently: auto sign-out; Phase 8 may add a re-auth flow)
