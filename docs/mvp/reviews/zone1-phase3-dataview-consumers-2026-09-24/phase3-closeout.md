# Zone 1 / Phase 3 — Migrate Confirmed Branch-Scoped DataView Consumers — Closeout

**Starting SHA:** 02992cbcdef22fdc0f97ac7cb564c03feb0c9509
**Branch:** zone3-zone5-integration-audit
**Date:** 2026-09-24

## Ending working-tree state

Intentionally dirty, containing only this phase's changes (left for review, not committed, per explicit instruction):

**Generic DataView plumbing:**

- `apps/web/src/lib/data-view/types.ts` (`DataViewProps.branchId`)
- `apps/web/src/components/data-view/data-view.tsx` (forwards `branchId`)
- `apps/web/src/components/data-view/data-view-provider.tsx` (threads `branchId` into both hooks)
- `apps/web/src/components/data-view/__tests__/data-view.test.tsx` (new `T-DV-BRANCH` block, 4 tests)

**4 consumer files:**

- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/locations-data-view.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/_components/inventory-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-client.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx`

**4 new consumer-wiring test files** (one `__tests__/` directory each, new).

**Documentation:**

- `docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` (Phase 3 tasks marked done, 2 factual corrections recorded)
- `docs/mvp/zones/01-auth-org-branch-access-progress.md` (Phase 3 marked DONE with full evidence; mechanical counts recomputed: 24/95)
- `docs/mvp/reviews/zone1-phase3-dataview-consumers-2026-09-24/` (this closeout bundle)

Zero other files touched. Zero Matcher, QR, migration/SQL/RLS, or Phase 10D files touched.

## Locations wiring result

`branch-aware = YES`. Live `activeBranchId` (via `useAppStoreV2((s) => s.activeBranchId)`) forwarded as `<DataView branchId={activeBranchId}>` alongside the unchanged `queryKey={["locations"]}`. Verified by 2 dedicated tests.

## Balances wiring result

`branch-aware = YES`. Identical pattern. Verified by 2 dedicated tests.

## Movements wiring result

`branch-aware = YES`. A NEW, separate live-read local variable (`liveActiveBranchId`) drives the DataView's `branchId`; the pre-existing `activeBranchId` PROP (frozen SSR value) is left completely unchanged, still forwarded to `InventoryMovementDetailPanel`. Verified by 3 dedicated tests, including one that explicitly proves both values remain independently correct and are not conflated.

## Products wiring result

`branch-aware = YES`. Live `activeBranchId` forwarded as a new, separate `branchId` prop alongside the unchanged `INVENTORY_PRODUCTS_QUERY_KEY` constant (per a factual correction to the plan's original wording — see below). Verified by 2 dedicated tests.

## Mutation invalidation result for each consumer

See `mutation-invalidation-review.md` for full detail. Summary: zero `invalidateQueries`/`useQueryClient`/`refreshToken` usage exists in any of the 4 consumer files or their sibling detail/panel components today. Locations, Movements, and Products each have "no relevant mutation exists in this file." Inventory Balances has 4 real mutation forms but none currently invalidate anything — a pre-existing, unrelated gap, discovered and explicitly not fixed in this phase (recorded, not silently patched).

## Confirmation branchId remains cache identity only

Confirmed structurally: no consumer passes `branchId` (or `activeBranchId`) into any `listFetcher`/server action call — each consumer's `listFetcher` function signature and call sites are unchanged from before this phase. Confirmed by test: Phase 2's own already-passing "branchId is never forwarded to listFetcher" tests remain valid and unmodified, since the request-payload code path (`DataViewListParams`) was not touched by this phase.

## Confirmation no new server branch filter was introduced

No server action, service, or RPC call was modified in this phase. `git status` confirms zero files under `apps/web/src/app/actions/` or `apps/web/src/server/` were touched.

## Tests added/updated

4 new consumer-wiring test files (9 tests). 1 new test block in the existing `data-view.test.tsx` (4 tests, `T-DV-BRANCH`). No existing test file's pre-existing tests were modified.

## Test results

63/63 relevant tests pass (12 Phase 2 regression + 42 generic DataView + 9 new consumer wiring). `pnpm type-check`: clean. `eslint`: 0 errors, 4 pre-existing warnings (verified unrelated via stash comparison).

## Acceptance criteria result

1. **All four confirmed consumers opt into branch-aware DataView cache identity.** PASS.
2. **Changing branch changes their effective list cache identity.** PASS — proven at both the generic-plumbing level (`T-DV-BRANCH`'s refetch-on-branchId-change test) and Phase 2's own `buildDataViewQueryKey` contract tests.
3. **Existing org-scoped DataViews remain backward-compatible.** PASS — `branchId` is optional throughout the full chain; the "omitting branchId" test and all 38 pre-existing `data-view.test.tsx` tests remain green, unmodified.
4. **No consumer forwards branchId as new authorization/request input.** PASS — confirmed structurally and by test.
5. **Generic DataView does not implicitly read global branch state.** PASS — `use-data-view-query.ts`, `data-view.tsx`, and `data-view-provider.tsx` contain no `useAppStoreV2` import; `branchId` is always explicit, passed in from each concrete consumer.
6. **Existing filtering/sorting/pagination behavior remains unchanged.** PASS — `DataViewListParams` untouched; all 38 pre-existing `data-view.test.tsx` tests (which exercise search/sort/pagination/filters) remain green.
7. **Existing mutation invalidation remains correct for the new keys.** PASS — none existed to become incorrect (see mutation-invalidation-review.md); the one existing invalidation mechanism (`refreshToken` effect) is unaffected since it relies on prefix-matching, not exact-key matching.
8. **Phase 2 query-key contract remains unchanged.** PASS — `use-data-view-query.ts` was not modified in this phase (`git diff` confirms zero changes since the Phase 2 commit).
9. **Focused automated tests pass.** PASS — 63/63.
10. **Type-check passes.** PASS.
11. **Relevant lint passes.** PASS — 0 errors.
12. **No DB/schema/RLS changes occur.** PASS — zero SQL/migration files touched.
13. **Matcher remains untouched.** PASS — confirmed via `git status`.
14. **QR remains untouched.** PASS — confirmed via `git status`.
15. **Phase 4+ remains NOT STARTED.** PASS — confirmed below.

**All 15 acceptance criteria: PASS.**

## Confirmation: Phase 4+ NOT started

No file under `apps/web/src/hooks/queries/tools/` (Matcher) or `apps/web/src/server/qr/` (QR) was touched. Phase 4, 5, 6, 7, 8, and all PILOT phases remain `NOT STARTED` in the progress tracker.

## Confirmation: Phase 10D NOT started

`docs/mvp/zones/03-repair-orders-implementation-plan.md`'s own Phase 10D header carries no `DONE` suffix — unchanged by this task.
