# Zone 1 / Phase 6 — Same-Branch Flow (Case A)

## Behavior

Scanning/opening a `warehouse.location` QR for a location that belongs to the caller's own currently active branch behaves exactly as it did before this phase: the resolver redirects to `/dashboard/warehouse/locations?selected=<id>&view=tree`, `AmbraLocationsClient` reads `selected` on mount, and the location opens directly in the tree view. No dialog, no branch check, no extra round-trip.

## Why this required no behavior change

The new cross-branch lookup in `resolvePublicQrToken` only appends a query param when a mismatch is detected (`callerActiveBranchId !== validation.branchId`). Same-branch callers never trigger that branch of the condition, so `rawPath` is never mutated — the function returns the exact same redirect string it always has for this case.

On the client, `AmbraLocationsClient`'s `initialUrlState` reads `crossBranch` from the URL once on mount. When absent, `pendingCrossBranch` initializes to `null` and `treeSelectedId` initializes directly from `selected` — identical to the pre-Phase-6 code path (the only change is that this read now goes through a small `initialUrlState` object instead of inline `window.location.href` parsing, done to support the new cross-branch branch without duplicating URL-parsing logic).

## Evidence

- `public-token-resolver.test.ts` → "same branch: no crossBranch hint, target opens directly" — asserts `redirectPath` equals the exact unmodified dashboard path and does not contain `crossBranch`.
- `ambra-locations-client.cross-branch.test.tsx` → "opens the exact target normally with no confirmation dialog when no crossBranch hint is present" — asserts no `alertdialog` role rendered, `LocationsPage` receives `selectedLocationId: "loc-a-1"` directly, and `changeBranch` is never called.

## Manual verification

Deferred to Phase 8's formal UAT (on the actual presentation phone), per the plan's own testing requirements for this phase.
