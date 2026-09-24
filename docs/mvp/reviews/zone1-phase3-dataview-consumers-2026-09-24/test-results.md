# Zone 1 / Phase 3 — Test Results

Run 2026-09-24 via `pnpm vitest run <files>` from `apps/web`, plus `pnpm type-check` and `eslint` on all touched files.

## 1. Phase 2 regression (`use-data-view-query.test.ts`)

**12/12 PASS, file unmodified.** Confirms the branch-aware query-key foundation itself is unaffected by Phase 3's consumer wiring.

## 2. Generic DataView regression + new plumbing tests (`data-view.test.tsx`)

**42/42 PASS** — 38 pre-existing tests (unmodified) + 4 new tests in a new `T-DV-BRANCH` block, added to prove the new `DataViewProps.branchId` plumbing actually reaches both the list and sidebar query paths:

- `fetches the list normally when branchId is provided` — the list query fires correctly when branchId is supplied.
- `opens the sidebar (branch-aware infinite query path) when a row is selected, with branchId provided` — the sidebar's own infinite query (which shares the same `buildDataViewQueryKey` merge) renders correctly with branchId present.
- `refetches the list when branchId changes on the same mounted DataView instance` — proves a branchId change on an already-mounted `<DataView>` triggers an immediate second fetch (fetcher call count 1 → 2), demonstrating the cache key genuinely changed rather than staying the same and merely being re-considered for staleness.
- `omitting branchId (org-scoped usage) does not affect list rendering` — backward-compatibility check at the full-component level.

## 3. New consumer-wiring tests (4 files, 9 tests total)

**9/9 PASS.**

| File                                                | Tests | Result                                                                                                                                                                                                        |
| --------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `locations-data-view.branch-wiring.test.tsx`        | 2     | PASS — forwards live branchId; forwards a changed branchId on branch change                                                                                                                                   |
| `inventory-client.branch-wiring.test.tsx`           | 2     | PASS — same pattern for Inventory Balances                                                                                                                                                                    |
| `inventory-movements-client.branch-wiring.test.tsx` | 3     | PASS — forwards the LIVE branchId (distinct from the frozen SSR prop); forwards a changed live branchId; the pre-existing frozen `activeBranchId` prop still reaches `InventoryMovementDetailPanel` unchanged |
| `inventory-products-client.branch-wiring.test.tsx`  | 2     | PASS — same pattern for Inventory Products, the newly-discovered 4th bug instance                                                                                                                             |

Each test mocks `@/components/data-view/data-view`'s `DataView` export to a prop-capturing spy (list/sidebar/detail rendering itself is already covered by Phase 2's and the generic `data-view.test.tsx`'s own tests — not re-tested here) and mocks `@/lib/stores/v2/app-store`'s `useAppStoreV2` to a controllable `activeBranchId`, proving each consumer's own wiring in isolation.

## 4. Type-check

`pnpm type-check` (whole `apps/web`) — **PASS, zero errors.**

## 5. Lint

All touched runtime and test files — **0 errors, 4 warnings, all 4 confirmed pre-existing** (verified via a `git stash`/lint/`stash pop` comparison showing identical warnings at the same relative code locations before this phase's changes):

- `inventory-client.tsx:55` — unused `tList` variable (pre-existing).
- `inventory-movements-client.tsx:149` — `useMemo` missing `tStatus` dependency (pre-existing).
- `inventory-products-client.tsx:95` — `useCallback` missing `tList` dependency (pre-existing).
- `data-view.test.tsx:31` — `framer-motion` mock component missing a display name (pre-existing, part of the original file's own mock setup, far from this phase's additions at the file's end).

## Unrelated failures

None encountered.

## Verdict

Zero regressions across 63 tests (12 + 42 + 9). Zero new lint warnings or errors. Zero type errors. Every one of the 4 confirmed consumers is proven, at both the generic-plumbing level and the individual-consumer level, to forward a live, branch-change-sensitive `branchId` into the DataView cache-identity mechanism.
