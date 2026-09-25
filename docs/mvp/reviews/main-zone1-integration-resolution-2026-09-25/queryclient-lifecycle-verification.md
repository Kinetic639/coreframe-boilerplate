# QueryClient Lifecycle Verification

Main's DataView refactor removed the per-mount `QueryClientProvider`/`QueryClient` that `data-view.tsx` previously created on every `<DataView>` mount (`useState(makeQueryClient)`). This section verifies the lifecycle implications explicitly, per the task's own required checklist.

## What changed

**Before:** every `<DataView>` instance created and owned its own isolated `QueryClient`. Unmounting a `DataView` destroyed its entire cache. A `key`-based remount created a brand-new, empty `QueryClient`.

**After:** `DataView`/`DataViewProvider` call `useQueryClient()` — they consume an AMBIENT `QueryClient` from a provider higher in the tree, rather than owning one.

## Where the ambient QueryClient now lives

```
grep -rln "QueryClientProvider" src --include="*.tsx" | grep -v __tests__
→ src/app/[locale]/dashboard/_providers.tsx
```

**Exactly one client-side `QueryClientProvider` exists in the entire app**, at the root of the dashboard tree (`dashboard/_providers.tsx`, used by `dashboard/layout.tsx`, wrapping every dashboard page). It is long-lived for the whole dashboard session, not per-DataView-instance.

## 1. Branch switch does not preserve stale list data incorrectly

**Verified false — no staleness risk.** Because branch identity is now part of the cache KEY itself (`scope` → `dataViewKeys.list(entity, scope, params)`), switching branches produces a genuinely different key. React Query does not "preserve stale data under a new branch" — it correctly treats Branch A's and Branch B's data as two entirely separate cache entries, fetching fresh for whichever key is currently active. This is the standard, intended React Query pattern (key-based cache separation) and is arguably MORE correct than the old per-mount-isolation approach, not less. Proven by `data-view-foundation.test.ts`'s scope-isolation tests and all 4 branch-wiring tests.

## 2. No nested QueryClient is accidentally created

Confirmed via search: the ONLY other `new QueryClient(` call sites in `src/` are (a) `data-view-ssr.ts`'s `createDataViewServerQueryClient()` — explicitly `"server-only"`, used exclusively for server-side prefetch/dehydration, never rendered client-side, not a competing provider; and (b) test files' own `makeQueryClient()` helpers, which correctly wrap tests in their own isolated `QueryClientProvider` since tests don't render inside the real app's `_providers.tsx` tree. No client-side component outside `_providers.tsx` creates a `QueryClient`.

## 3. Cache lifetime matches main's intended architecture

The ambient `QueryClient` now persists across navigation within the dashboard (as long as `dashboard/layout.tsx` stays mounted, which it does for the whole authenticated session). This is main's own deliberate design — confirmed by main's own `data-view-provider.tsx` rewrite, which now includes its own cache-freshness machinery (`initialDataForCurrentParams` scope-key guard, `synchronizeDataViewSidebarPage`, sidebar page recovery) specifically built for a longer-lived, shared cache — this is not an oversight, it's the refactor's own explicit design center of gravity.

## 4. Remounting `AmbraLocationsClient` still works correctly

**Re-evaluated explicitly, per the task's own instruction not to remove `key={branchId}` without proof.** Conclusion: `key={branchId}` on `<AmbraLocationsClient>` (`locations/page.tsx`) is **still required — kept in the merge resolution — but now for a different, still-valid reason**:

- It is NOT required for the DataView's own cache correctness anymore — `scope` already guarantees that, independent of any remount, since a different branch produces a different key regardless of whether the component tree above it remounts or not.
- It IS still required for `AmbraLocationsClient`'s OWN component-local React state (`treeSelectedId`, `pendingCrossBranch`, `isSwitchingBranch`, etc. — Zone 1 Phase 6's own concern) to correctly reset on a same-route branch switch (the cross-branch QR confirm flow, which deliberately stays on the same route rather than navigating away). The ambient, now-shared `QueryClient` living above this component is entirely unaffected by the remount either way — remounting only resets React's own component-instance state, not the shared cache, which was never the point of the `key` prop to begin with for THIS specific concern.

Confirmed via the full, unmodified `ambra-locations-client.cross-branch.test.tsx` suite passing (7/7, after only the unrelated `organizationId` fixture fix) — including the "CONFIRM" test, which specifically exercises the remount-then-fresh-state path.

## 5. No regression in DataView tests

All 8 DataView-focused test files (`data-view.test.tsx`, `data-view-foundation.test.ts`, `data-view-hydration.test.tsx`, `data-view-url-state.test.tsx`, and the 4 branch-wiring tests) pass — 74/74 tests, 0 failures. See `test-results.md`.

## Conclusion

The `QueryClientProvider` removal is a deliberate, coherent architectural upgrade (instance-isolated caches → key-scoped shared cache), not an accidental simplification. It does not reintroduce any branch-data staleness risk — if anything it closes the class of bug Zone 1 Phase 2/3 was built to prevent more robustly, since correctness now lives in the key itself rather than depending on remount timing.
